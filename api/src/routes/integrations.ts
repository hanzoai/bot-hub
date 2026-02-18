import { and, desc, eq, isNull, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { skills, skillVersions, users } from '../db/schema.js'
import { optionalAuth } from '../middleware/auth.js'
import type { AuthUser } from '../middleware/auth.js'

type Env = { Variables: { user: AuthUser | null } }

export const integrationsRouter = new Hono<Env>()

// ─── List integrations (public, paginated) ─────────────────────────────────
integrationsRouter.get('/', optionalAuth, async (c) => {
  const sort = c.req.query('sort') ?? 'updated'
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const cursor = c.req.query('cursor')

  let orderBy: ReturnType<typeof desc>
  switch (sort) {
    case 'downloads':
      orderBy = desc(skills.statsDownloads)
      break
    case 'name':
      orderBy = desc(skills.displayName)
      break
    default:
      orderBy = desc(skills.updatedAt)
  }

  const conditions = [
    isNull(skills.softDeletedAt),
    eq(skills.moderationStatus, 'active'),
    eq(skills.batch, 'integration'),
  ]
  if (cursor) {
    conditions.push(lt(skills.updatedAt, new Date(cursor)))
  }

  const rows = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      displayName: skills.displayName,
      summary: skills.summary,
      batch: skills.batch,
      statsDownloads: skills.statsDownloads,
      statsStars: skills.statsStars,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
      latestVersionId: skills.latestVersionId,
    })
    .from(skills)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = rows.slice(0, limit)

  return c.json({ items, hasMore })
})

// ─── Get integration detail ─────────────────────────────────────────────────
integrationsRouter.get('/:slug', optionalAuth, async (c) => {
  const slug = c.req.param('slug')

  const [skill] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.slug, slug), eq(skills.batch, 'integration'), isNull(skills.softDeletedAt)))
    .limit(1)

  if (!skill) return c.json({ error: 'Not found' }, 404)

  let latestVersion = null
  if (skill.latestVersionId) {
    const [ver] = await db
      .select()
      .from(skillVersions)
      .where(eq(skillVersions.id, skill.latestVersionId))
      .limit(1)
    latestVersion = ver ?? null
  }

  return c.json({ integration: { ...skill, latestVersion } })
})
