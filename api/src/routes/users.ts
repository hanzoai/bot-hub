import { Hono } from 'hono'
import { base, lit, ensureAdminAuth, type Row } from '../db/index.js'
import type { AuthUser } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const usersRouter = new Hono()

// ─── Get user by handle ─────────────────────────────────────────────────────
usersRouter.get('/:handle', async (c) => {
  const handle = c.req.param('handle')

  let user: any
  try {
    user = await base.collection('users').getFirstListItem(`handle = ${lit(handle)}`)
  } catch {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    image: user.image,
    bio: user.bio,
    createdAt: user.createdAt,
  })
})

// ─── List user's skills ─────────────────────────────────────────────────────
usersRouter.get('/:handle/skills', async (c) => {
  const handle = c.req.param('handle')

  let user: any
  try {
    user = await base.collection('users').getFirstListItem(`handle = ${lit(handle)}`)
  } catch {
    return c.json({ error: 'User not found' }, 404)
  }

  const result = await base.collection('skills').getList(1, 200, {
    filter: `ownerUserId = ${lit(user.id)}`,
    sort: '-updated',
  })

  const items = result.items.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.displayName,
    summary: s.summary,
    statsDownloads: s.statsDownloads ?? 0,
    statsStars: s.statsStars ?? 0,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))

  return c.json({ items })
})

// ─── List user's stars ──────────────────────────────────────────────────────
usersRouter.get('/:handle/stars', async (c) => {
  const handle = c.req.param('handle')

  let user: any
  try {
    user = await base.collection('users').getFirstListItem(`handle = ${lit(handle)}`)
  } catch {
    return c.json({ error: 'User not found' }, 404)
  }

  const result = await base.collection('stars').getList<Row>(1, 200, {
    filter: `userId = ${lit(user.id)}`,
    sort: '-created',
    expand: 'skillId',
  })

  const items = result.items.map((s) => {
    const skill = s.expand?.skillId
    return {
      skillId: s.skillId,
      skillSlug: skill?.slug ?? null,
      skillDisplayName: skill?.displayName ?? null,
      skillSummary: skill?.summary ?? null,
      starredAt: s.createdAt,
    }
  })

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

  const updates: Record<string, unknown> = {}
  if (body.displayName !== undefined) updates.displayName = body.displayName
  if (body.bio !== undefined) updates.bio = body.bio
  if (body.handle !== undefined) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(body.handle)) {
      return c.json({ error: 'Handle must be lowercase alphanumeric' }, 400)
    }
    updates.handle = body.handle
  }

  await ensureAdminAuth()
  await base.collection('users').update(user.id, updates)

  return c.json({ ok: true })
})
