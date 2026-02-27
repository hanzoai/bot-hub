import { Hono } from 'hono'
import { pb, ensureAdminAuth } from '../db/index.js'
import type { AuthUser } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const usersRouter = new Hono()

// ─── Get user by handle ─────────────────────────────────────────────────────
usersRouter.get('/:handle', async (c) => {
  const handle = c.req.param('handle')

  await ensureAdminAuth()
  let user: any
  try {
    user = await pb.collection('users').getFirstListItem(`handle = "${handle}"`)
  } catch {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    image: user.image,
    bio: user.bio,
    createdAt: user.created,
  })
})

// ─── List user's skills ─────────────────────────────────────────────────────
usersRouter.get('/:handle/skills', async (c) => {
  const handle = c.req.param('handle')

  await ensureAdminAuth()
  let user: any
  try {
    user = await pb.collection('users').getFirstListItem(`handle = "${handle}"`)
  } catch {
    return c.json({ error: 'User not found' }, 404)
  }

  const result = await pb.collection('skills').getList(1, 200, {
    filter: `ownerUserId = "${user.id}"`,
    sort: '-updated',
  })

  const items = result.items.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.displayName,
    summary: s.summary,
    statsDownloads: s.statsDownloads ?? 0,
    statsStars: s.statsStars ?? 0,
    createdAt: s.created,
    updatedAt: s.updated,
  }))

  return c.json({ items })
})

// ─── List user's stars ──────────────────────────────────────────────────────
usersRouter.get('/:handle/stars', async (c) => {
  const handle = c.req.param('handle')

  await ensureAdminAuth()
  let user: any
  try {
    user = await pb.collection('users').getFirstListItem(`handle = "${handle}"`)
  } catch {
    return c.json({ error: 'User not found' }, 404)
  }

  const result = await pb.collection('stars').getList(1, 200, {
    filter: `userId = "${user.id}"`,
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
      starredAt: s.created,
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
  await pb.collection('users').update(user.id, updates)

  return c.json({ ok: true })
})
