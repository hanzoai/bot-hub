// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Every route Bot Hub serves or calls is /v1/…; nothing lives under /api.
// This fails the moment an /api path comes back: a route mount, a client
// base, a fetch to one of our hosts, or an ingress path. Third-party APIs
// (https://slack.com/api/…) are preceded by a foreign host and do not match.

const root = join(__dirname, '..', '..')
const self = relative(root, __filename)

const scanned = [
  'api/src',
  'src',
  'server',
  'packages/bothub/src',
  'packages/schema/src',
  'packages/schema/dist',
  'public',
  'k8s',
  'Dockerfile',
  'docker-entrypoint.sh',
  'vite.config.ts',
]

const firstPartyApi =
  /(?:['"`(\s}=]|(?:hanzo\.(?:ai|id|bot)|lux\.network|zoo\.ngo))\/api(?:\/|['"`)\s?]|$)/m

function files(path: string): string[] {
  const full = join(root, path)
  if (!statSync(full).isDirectory()) return [path]
  return (readdirSync(full, { recursive: true }) as string[])
    .map((entry) => join(path, entry))
    .filter((entry) => statSync(join(root, entry)).isFile())
}

describe('/v1 prefix', () => {
  it('serves and calls nothing under /api', () => {
    const hits: string[] = []
    for (const path of scanned.flatMap(files)) {
      if (path === self || /\.(png|ico|svg|woff2?)$/.test(path)) continue
      readFileSync(join(root, path), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (firstPartyApi.test(line)) hits.push(`${path}:${i + 1}: ${line.trim()}`)
        })
    }
    expect(hits).toEqual([])
  })
})
