import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { skills, stars, users } from '../db/schema.js'
import type { AuthUser } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const usersRouter = new Hono()

// ─── Get user by handle ─────────────────────────────────────────────────────
usersRouter.get('/:handle', async (c) => {
  const handle = c.req.param('handle')

  const [user] = await db
    .select({
      id: users.id,
      handle: users.handle,
      displayName: users.displayName,
      image: users.image,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1)

  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json(user)
})

// ─── List user's skills ─────────────────────────────────────────────────────
usersRouter.get('/:handle/skills', async (c) => {
  const handle = c.req.param('handle')

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1)

  if (!user) return c.json({ error: 'User not found' }, 404)

  const items = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      displayName: skills.displayName,
      summary: skills.summary,
      statsDownloads: skills.statsDownloads,
      statsStars: skills.statsStars,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
    })
    .from(skills)
    .where(eq(skills.ownerUserId, user.id))
    .orderBy(desc(skills.updatedAt))

  return c.json({ items })
})

// ─── List user's stars ──────────────────────────────────────────────────────
usersRouter.get('/:handle/stars', async (c) => {
  const handle = c.req.param('handle')

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1)

  if (!user) return c.json({ error: 'User not found' }, 404)

  const items = await db
    .select({
      skillId: stars.skillId,
      skillSlug: skills.slug,
      skillDisplayName: skills.displayName,
      skillSummary: skills.summary,
      starredAt: stars.createdAt,
    })
    .from(stars)
    .innerJoin(skills, eq(stars.skillId, skills.id))
    .where(eq(stars.userId, user.id))
    .orderBy(desc(stars.createdAt))

  return c.json({ items })
})

// ─── Update profile ─────────────────────────────────────────────────────────
usersRouter.patch('/me', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const body = await c.req.json<{
    displayName?: string
    bio?: string
    handle?: string
  }>()

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.displayName !== undefined) updates.displayName = body.displayName
  if (body.bio !== undefined) updates.bio = body.bio
  if (body.handle !== undefined) {
    // Validate handle
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(body.handle)) {
      return c.json({ error: 'Handle must be lowercase alphanumeric' }, 400)
    }
    updates.handle = body.handle
  }

  await db.update(users).set(updates).where(eq(users.id, user.id))

  return c.json({ ok: true })
})
