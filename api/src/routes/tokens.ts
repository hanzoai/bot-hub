import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { apiTokens } from '../db/schema.js'
import type { AuthUser } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const tokensRouter = new Hono()

// ─── List my API tokens ────────────────────────────────────────────────────
tokensRouter.get('/', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser

  const items = await db
    .select({
      id: apiTokens.id,
      label: apiTokens.label,
      prefix: apiTokens.prefix,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)))

  return c.json({ items })
})

// ─── Create API token ──────────────────────────────────────────────────────
tokensRouter.post('/', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const body = await c.req.json<{ label: string }>()

  if (!body.label?.trim()) {
    return c.json({ error: 'label is required' }, 400)
  }

  // Generate token
  const rawToken = `bh_${crypto.randomUUID().replace(/-/g, '')}`
  const prefix = rawToken.slice(0, 10)
  const hash = await hashToken(rawToken)

  const [token] = await db
    .insert(apiTokens)
    .values({
      userId: user.id,
      label: body.label.trim(),
      prefix,
      tokenHash: hash,
    })
    .returning()

  // Return the raw token ONCE (never stored in plaintext)
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

  const [token] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, user.id)))
    .limit(1)

  if (!token) return c.json({ error: 'Token not found' }, 404)

  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(eq(apiTokens.id, tokenId))

  return c.json({ ok: true })
})

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
