import { Hono } from 'hono'
import { pb, ensureAdminAuth } from '../db/index.js'
import { optionalAuth } from '../middleware/auth.js'
import type { AuthUser } from '../middleware/auth.js'

type Env = { Variables: { user: AuthUser | null } }

export const integrationsRouter = new Hono<Env>()

// ─── List integrations (public, paginated) ─────────────────────────────────
integrationsRouter.get('/', optionalAuth, async (c) => {
  const sort = c.req.query('sort') ?? 'updated'
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const cursor = c.req.query('cursor')

  let sortField: string
  switch (sort) {
    case 'downloads': sortField = '-statsDownloads'; break
    case 'name':      sortField = '-displayName'; break
    default:          sortField = '-updated'
  }

  const filters: string[] = [
    'softDeletedAt = ""',
    'moderationStatus = "active"',
    'batch = "integration"',
  ]
  if (cursor) {
    filters.push(`updated < "${cursor}"`)
  }

  await ensureAdminAuth()
  const result = await pb.collection('skills').getList(1, limit + 1, {
    filter: filters.join(' && '),
    sort: sortField,
  })

  const hasMore = result.items.length > limit
  const items = result.items.slice(0, limit).map((r) => ({
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    summary: r.summary,
    batch: r.batch,
    statsDownloads: r.statsDownloads ?? 0,
    statsStars: r.statsStars ?? 0,
    createdAt: r.created,
    updatedAt: r.updated,
    latestVersionId: r.latestVersionId,
  }))

  return c.json({ items, hasMore })
})

// ─── Get integration detail ─────────────────────────────────────────────────
integrationsRouter.get('/:slug', optionalAuth, async (c) => {
  const slug = c.req.param('slug')

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await pb.collection('skills').getFirstListItem(
      `slug = "${slug}" && batch = "integration" && softDeletedAt = ""`,
    )
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }

  let latestVersion = null
  if (skill.latestVersionId) {
    try {
      latestVersion = await pb.collection('skill_versions').getOne(skill.latestVersionId)
    } catch { /* missing version */ }
  }

  return c.json({ integration: { ...skill, latestVersion } })
})
