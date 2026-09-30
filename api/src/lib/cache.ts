import { createHash } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

// What a shared cache (Cloudflare, in front of api.hanzo.ai) may keep, decided
// in one place for every route.
//
// A GET or HEAD answered 2xx to a request that carried no credential is public
// by construction: the handler computed it for nobody in particular, so anyone
// may read it. It is cacheable for a minute in a browser and five at the edge,
// served stale for ten while the edge revalidates, and a GET carries an ETag so
// a revalidation that finds nothing new is a 304 with no body. The tag is weak
// because it names the representation before compression, which the same
// response then gets or not according to Accept-Encoding.
//
// Everything else — a request with an Authorization header, any other method,
// any non-2xx answer — is `private, no-store`: per-caller, a write, or an error
// that must not outlive the moment it describes.
export const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
export const NO_STORE = 'private, no-store'

export function cache(): MiddlewareHandler {
  return async (c, next) => {
    await next()

    const method = c.req.method
    const res = c.res
    const cacheable =
      (method === 'GET' || method === 'HEAD') &&
      !c.req.header('Authorization') &&
      res.status >= 200 &&
      res.status < 300 &&
      !res.headers.has('Set-Cookie')

    // Built once and handed back whole: Hono rebuilds a finalized response on
    // every c.header(), which would read a body this has already read. A
    // header the handler set itself survives (Hono copies it back over).
    const headers = new Headers(res.headers)
    if (!cacheable) {
      headers.set('Cache-Control', NO_STORE)
      c.res = new Response(res.body, { status: res.status, headers })
      return
    }
    headers.set('Cache-Control', PUBLIC_CACHE)
    headers.set('Vary', 'Accept-Encoding')
    if (method !== 'GET') {
      c.res = new Response(res.body, { status: res.status, headers })
      return
    }

    const body = await res.arrayBuffer()
    const etag = `W/"${createHash('sha256').update(new Uint8Array(body)).digest('base64url').slice(0, 27)}"`
    headers.set('ETag', etag)
    const fresh = matches(c.req.header('If-None-Match'), etag)
    c.res = new Response(fresh ? null : body, { status: fresh ? 304 : res.status, headers })
  }
}

function matches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false
  if (ifNoneMatch.trim() === '*') return true
  return ifNoneMatch
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .includes(etag.replace(/^W\//, ''))
}
