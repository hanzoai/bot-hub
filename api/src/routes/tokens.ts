import { Hono } from 'hono'
import { pb, ensureAdminAuth } from '../db/index.js'
import type { AuthUser } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const tokensRouter = new Hono()

// ─── List my API tokens ────────────────────────────────────────────────────
tokensRouter.get('/', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser

  await ensureAdminAuth()
  const result = await pb.collection('api_tokens').getList(1, 200, {
    filter: `userId = "${user.id}" && revokedAt = ""`,
  })

  const items = result.items.map((t) => ({
    id: t.id,
    label: t.label,
    prefix: t.prefix,
    lastUsedAt: t.lastUsedAt || null,
    createdAt: t.created,
  }))

  return c.json({ items })
})

// ─── Create API token ──────────────────────────────────────────────────────
tokensRouter.post('/', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const body = await c.req.json<{ label: string }>()

  if (!body.label?.trim()) {
    return c.json({ error: 'label is required' }, 400)
  }

  const rawToken = `bh_${crypto.randomUUID().replace(/-/g, '')}`
  const prefix = rawToken.slice(0, 10)
  const hash = await hashToken(rawToken)

  await ensureAdminAuth()
  const token = await pb.collection('api_tokens').create({
    userId: user.id,
    label: body.label.trim(),
    prefix,
    tokenHash: hash,
  })

  return c.json({
    id: token.id,
    token: rawToken,
    prefix,
    label: token.label,
  })
})

// ─── Revoke API token ──────────────────────────────────────────────────────
tokensRouter.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const tokenId = c.req.param('id')

  await ensureAdminAuth()
  let token: any
  try {
    token = await pb.collection('api_tokens').getFirstListItem(
      `id = "${tokenId}" && userId = "${user.id}"`,
    )
  } catch {
    return c.json({ error: 'Token not found' }, 404)
  }

  await pb.collection('api_tokens').update(tokenId, {
    revokedAt: new Date().toISOString(),
  })

  return c.json({ ok: true })
})

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
