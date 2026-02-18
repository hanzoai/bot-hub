import { and, desc, eq, isNull, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { personas, personaVersions, users } from '../db/schema.js'
import { optionalAuth } from '../middleware/auth.js'
import type { AuthUser } from '../middleware/auth.js'

type Env = { Variables: { user: AuthUser | null } }

export const personasRouter = new Hono<Env>()

// ─── List personas (public, paginated) ────────────────────────────────────
personasRouter.get('/', optionalAuth, async (c) => {
  const sort = c.req.query('sort') ?? 'updated'
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const cursor = c.req.query('cursor')

  let orderBy: ReturnType<typeof desc>
  switch (sort) {
    case 'downloads':
      orderBy = desc(personas.statsDownloads)
      break
    case 'stars':
      orderBy = desc(personas.statsStars)
      break
    case 'created':
      orderBy = desc(personas.createdAt)
      break
    default:
      orderBy = desc(personas.updatedAt)
  }

  const conditions = [isNull(personas.softDeletedAt)]
  if (cursor) {
    conditions.push(lt(personas.updatedAt, new Date(cursor)))
  }

  const rows = await db
    .select({
      id: personas.id,
      slug: personas.slug,
      displayName: personas.displayName,
      summary: personas.summary,
      ownerUserId: personas.ownerUserId,
      statsDownloads: personas.statsDownloads,
      statsStars: personas.statsStars,
      statsVersions: personas.statsVersions,
      statsComments: personas.statsComments,
      createdAt: personas.createdAt,
      updatedAt: personas.updatedAt,
      latestVersionId: personas.latestVersionId,
    })
    .from(personas)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = rows.slice(0, limit)

  return c.json({ items, hasMore })
})

// ─── Get persona detail ────────────────────────────────────────────────────
personasRouter.get('/:slug/detail', optionalAuth, async (c) => {
  const slug = c.req.param('slug')

  const [persona] = await db
    .select()
    .from(personas)
    .where(and(eq(personas.slug, slug), isNull(personas.softDeletedAt)))
    .limit(1)

  if (!persona) return c.json({ error: 'Not found' }, 404)

  let latestVersion = null
  if (persona.latestVersionId) {
    const [ver] = await db
      .select()
      .from(personaVersions)
      .where(eq(personaVersions.id, persona.latestVersionId))
      .limit(1)
    latestVersion = ver ?? null
  }

  const [owner] = await db
    .select({ handle: users.handle, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, persona.ownerUserId))
    .limit(1)

  return c.json({ persona: { ...persona, latestVersion, owner } })
})

// ─── Get persona versions ─────────────────────────────────────────────────
personasRouter.get('/:slug/versions', optionalAuth, async (c) => {
  const slug = c.req.param('slug')
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  const [persona] = await db
    .select({ id: personas.id })
    .from(personas)
    .where(eq(personas.slug, slug))
    .limit(1)

  if (!persona) return c.json({ error: 'Not found' }, 404)

  const items = await db
    .select()
    .from(personaVersions)
    .where(eq(personaVersions.personaId, persona.id))
    .orderBy(desc(personaVersions.createdAt))
    .limit(limit)

  return c.json({ items })
})
