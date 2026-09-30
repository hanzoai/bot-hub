import { Hono } from 'hono'
import { base, lit } from '../db/index.js'
import { optionalAuth } from '../middleware/auth.js'
import { searchPersonas } from './search.js'
import type { AuthUser } from '../middleware/auth.js'

type Env = { Variables: { user: AuthUser | null } }

export const personasRouter = new Hono<Env>()

// ─── List personas (public, paginated) ────────────────────────────────────
personasRouter.get('/', optionalAuth, async (c) => {
  const sort = c.req.query('sort') ?? 'updated'
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const cursor = c.req.query('cursor')

  let sortField: string
  switch (sort) {
    case 'downloads': sortField = '-statsDownloads'; break
    case 'stars':     sortField = '-statsStars'; break
    case 'created':   sortField = '-created'; break
    default:          sortField = '-updated'
  }

  const filters: string[] = ['softDeletedAt = ""']
  if (cursor) {
    filters.push(`updated < ${lit(cursor)}`)
  }

  const result = await base.collection('personas').getList(1, limit + 1, {
    filter: filters.join(' && '),
    sort: sortField,
  })

  const hasMore = result.items.length > limit
  const items = result.items.slice(0, limit).map((r) => ({
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    summary: r.summary,
    ownerUserId: r.ownerUserId,
    statsDownloads: r.statsDownloads ?? 0,
    statsStars: r.statsStars ?? 0,
    statsVersions: r.statsVersions ?? 0,
    statsComments: r.statsComments ?? 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    latestVersionId: r.latestVersionId,
  }))

  return c.json({ items, hasMore })
})

personasRouter.get('/search', searchPersonas)

// ─── Get persona detail ────────────────────────────────────────────────────
personasRouter.get('/:slug/detail', optionalAuth, async (c) => {
  const slug = c.req.param('slug')

  let persona: any
  try {
    persona = await base.collection('personas').getFirstListItem(
      `slug = ${lit(slug)} && softDeletedAt = ""`,
    )
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }

  let latestVersion = null
  if (persona.latestVersionId) {
    try {
      const ver = await base.collection('persona_versions').getOne(persona.latestVersionId)
      latestVersion = ver
    } catch { /* missing version */ }
  }

  let owner = null
  try {
    const u = await base.collection('users').getOne(persona.ownerUserId)
    owner = { handle: u.handle, displayName: u.displayName }
  } catch { /* missing owner */ }

  return c.json({ persona: { ...persona, latestVersion, owner } })
})

// ─── Get persona versions ─────────────────────────────────────────────────
personasRouter.get('/:slug/versions', optionalAuth, async (c) => {
  const slug = c.req.param('slug')
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  let persona: any
  try {
    persona = await base.collection('personas').getFirstListItem(`slug = ${lit(slug)}`)
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }

  const result = await base.collection('persona_versions').getList(1, limit, {
    filter: `personaId = ${lit(persona.id)}`,
    sort: '-created',
  })

  return c.json({ items: result.items })
})
