// @vitest-environment node
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

// Nothing here reaches Base: the routes exercised answer before a read, and
// /health is asked with Base unreachable on purpose (port 9, discard).
process.env.BASE_URL = 'http://127.0.0.1:9'
const { app } = await import('./app')
const { lit } = await import('./db/index')
const { cache, NO_STORE, PUBLIC_CACHE } = await import('./lib/cache')

function tiny() {
  const t = new Hono()
  t.use('*', cache())
  t.get('/ok', (c) => c.json({ skills: ['github'] }))
  t.get('/own', (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true })
  })
  t.get('/missing', (c) => c.json({ error: 'Skill not found' }, 404))
  t.post('/ok', (c) => c.json({ ok: true }))
  return t
}

describe('cache', () => {
  it('lets a shared cache keep an anonymous 2xx GET, with an ETag', async () => {
    const res = await tiny().request('/ok')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe(PUBLIC_CACHE)
    expect(res.headers.get('Vary')).toBe('Accept-Encoding')
    expect(res.headers.get('ETag')).toMatch(/^W\/"[\w-]{27}"$/)
    expect(await res.json()).toEqual({ skills: ['github'] })
  })

  it('answers a matching If-None-Match with an empty 304', async () => {
    const etag = (await tiny().request('/ok')).headers.get('ETag')!
    const res = await tiny().request('/ok', { headers: { 'If-None-Match': etag } })
    expect(res.status).toBe(304)
    expect(await res.text()).toBe('')
    expect(res.headers.get('ETag')).toBe(etag)
    const strong = etag.replace(/^W\//, '')
    expect((await tiny().request('/ok', { headers: { 'If-None-Match': strong } })).status).toBe(304)
    expect((await tiny().request('/ok', { headers: { 'If-None-Match': '"other"' } })).status).toBe(200)
  })

  it('keeps anything asked with a credential private', async () => {
    const res = await tiny().request('/ok', { headers: { Authorization: 'Bearer t' } })
    expect(res.headers.get('Cache-Control')).toBe(NO_STORE)
    expect(res.headers.get('ETag')).toBeNull()
  })

  it('never lets a write or an error be cached', async () => {
    expect((await tiny().request('/ok', { method: 'POST' })).headers.get('Cache-Control')).toBe(NO_STORE)
    expect((await tiny().request('/missing')).headers.get('Cache-Control')).toBe(NO_STORE)
  })

  it('leaves a handler its own Cache-Control', async () => {
    expect((await tiny().request('/own')).headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('app', () => {
  it('serves nothing outside /v1/skills but its probe', () => {
    const paths = app.routes.map((r) => r.path).filter((p) => p !== '/*')
    expect(paths.filter((p) => p !== '/health' && p !== '/v1/skills' && !p.startsWith('/v1/skills/'))).toEqual([])
    expect(paths).toContain('/v1/skills/search')
    expect(paths).toContain('/v1/skills/personas/search')
  })

  it('answers an empty search from any origin, cacheably', async () => {
    const res = await app.request('/v1/skills/search?q=', { headers: { Origin: 'https://hub.hanzo.bot' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [] })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Cache-Control')).toBe(PUBLIC_CACHE)
  })

  it('is unhealthy while its store is', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(503)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('signs in through its own callback on api.hanzo.ai', async () => {
    const res = await app.request('/v1/skills/auth/login?return=https://skills.hanzo.bot')
    expect(res.status).toBe(302)
    const to = new URL(res.headers.get('Location')!)
    expect(to.origin + to.pathname).toBe('https://hanzo.id/v1/iam/oauth/authorize')
    expect(to.searchParams.get('client_id')).toBe('hanzo-bothub')
    expect(to.searchParams.get('redirect_uri')).toBe('https://api.hanzo.ai/v1/skills/auth/callback')
    expect(res.headers.get('Cache-Control')).toBe(NO_STORE)
  })

  it('returns a sign-in only to a Bot Hub site', async () => {
    const res = await app.request('/v1/skills/auth/login?return=https://evil.example')
    expect(res.status).toBe(400)
  })
})

describe('lit', () => {
  it('keeps a value inside its literal', () => {
    expect(lit('github')).toBe('"github"')
    expect(lit('x" || slug != "')).toBe('"x\\" || slug != \\""')
    expect(lit('a\\')).toBe('"a\\\\"')
  })
})
