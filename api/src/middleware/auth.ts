import { eq } from 'drizzle-orm'
import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import * as jose from 'jose'
import { db } from '../db/index.js'
import { apiTokens, users } from '../db/schema.js'
import { env } from '../lib/env.js'

export type AuthUser = {
  id: string
  handle: string | null
  role: string | null
  email: string | null
}

/** Middleware: requires a valid session. Sets c.var.user */
export const requireAuth = createMiddleware<{ Variables: { user: AuthUser } }>(
  async (c: Context, next: Next) => {
    const user = await resolveUser(c)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    c.set('user', user)
    return next()
  },
)

/** Middleware: optionally sets c.var.user if auth header present */
export const optionalAuth = createMiddleware<{ Variables: { user: AuthUser | null } }>(
  async (c: Context, next: Next) => {
    const user = await resolveUser(c)
    c.set('user', user)
    return next()
  },
)

async function resolveUser(c: Context): Promise<AuthUser | null> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null

  // Check if it's an API token (prefix: bh_)
  if (token.startsWith('bh_')) {
    return resolveApiToken(token)
  }

  // Otherwise treat as hanzo.id JWT / OAuth token
  return resolveIamToken(token)
}

async function resolveIamToken(token: string): Promise<AuthUser | null> {
  try {
    // Validate with hanzo.id userinfo endpoint
    const response = await fetch(`${env.iamUrl}/api/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null

    const profile = (await response.json()) as {
      sub?: string
      preferred_username?: string
      name?: string
      email?: string
    }

    if (!profile.sub) return null

    // Find or create user by IAM subject
    const handle = profile.preferred_username ?? profile.name ?? null
    const email = profile.email ?? null

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email ?? ''))
      .limit(1)

    if (!user && handle) {
      ;[user] = await db
        .select()
        .from(users)
        .where(eq(users.handle, handle))
        .limit(1)
    }

    if (!user) {
      // Auto-create user from IAM profile
      const [created] = await db
        .insert(users)
        .values({
          handle,
          email,
          displayName: profile.name ?? handle,
          name: profile.name ?? handle,
          role: 'user',
        })
        .returning()
      user = created
    }

    return {
      id: user.id,
      handle: user.handle,
      role: user.role,
      email: user.email,
    }
  } catch {
    return null
  }
}

async function resolveApiToken(token: string): Promise<AuthUser | null> {
  try {
    const hash = await hashToken(token)
    const [record] = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, hash))
      .limit(1)

    if (!record || record.revokedAt) return null

    // Update lastUsedAt
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, record.id))

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, record.userId))
      .limit(1)

    if (!user) return null

    return {
      id: user.id,
      handle: user.handle,
      role: user.role,
      email: user.email,
    }
  } catch {
    return null
  }
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
