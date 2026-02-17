import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { oauthAccounts, sessions, users } from '../db/schema.js'
import { env } from '../lib/env.js'
import type { AuthUser } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = new Hono()

// ─── OAuth: Start login flow ────────────────────────────────────────────────
authRouter.get('/login', (c) => {
  const redirectUri = c.req.query('redirect_uri') ?? `${env.publicUrl}/api/auth/callback`
  const state = c.req.query('state') ?? crypto.randomUUID()

  const authUrl = new URL(`${env.iamUrl}/login/oauth/authorize`)
  authUrl.searchParams.set('client_id', env.iamClientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'openid profile email')
  authUrl.searchParams.set('state', state)

  return c.redirect(authUrl.toString())
})

// ─── OAuth: Callback ────────────────────────────────────────────────────────
authRouter.get('/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  if (error) {
    return c.json({ error: `OAuth error: ${error}` }, 400)
  }

  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400)
  }

  // Exchange code for token
  const tokenResponse = await fetch(`${env.iamUrl}/api/login/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${env.publicUrl}/api/auth/callback`,
      client_id: env.iamClientId,
      client_secret: env.iamClientSecret,
    }),
  })

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text()
    return c.json({ error: `Token exchange failed: ${err}` }, 500)
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  // Get user profile from IAM
  const profileResponse = await fetch(`${env.iamUrl}/api/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!profileResponse.ok) {
    return c.json({ error: 'Failed to fetch user profile' }, 500)
  }

  const profile = (await profileResponse.json()) as {
    sub: string
    preferred_username?: string
    name?: string
    email?: string
    picture?: string
  }

  // Find or create user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email ?? ''))
    .limit(1)

  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        handle: profile.preferred_username ?? profile.name,
        email: profile.email,
        displayName: profile.name ?? profile.preferred_username,
        name: profile.name ?? profile.preferred_username,
        image: profile.picture,
        role: 'user',
      })
      .returning()
    user = created
  } else {
    // Update profile
    await db
      .update(users)
      .set({
        image: profile.picture ?? user.image,
        displayName: profile.name ?? user.displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
  }

  // Upsert OAuth account link
  const [existingOauth] = await db
    .select()
    .from(oauthAccounts)
    .where(eq(oauthAccounts.providerAccountId, profile.sub))
    .limit(1)

  if (!existingOauth) {
    await db.insert(oauthAccounts).values({
      userId: user.id,
      provider: 'hanzo',
      providerAccountId: profile.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    })
  } else {
    await db
      .update(oauthAccounts)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      })
      .where(eq(oauthAccounts.id, existingOauth.id))
  }

  // Create session
  const sessionToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await db.insert(sessions).values({
    userId: user.id,
    token: sessionToken,
    expiresAt,
  })

  // Redirect back to frontend with session token
  const returnUrl = new URL(env.publicUrl)
  returnUrl.searchParams.set('session', sessionToken)
  if (state) returnUrl.searchParams.set('state', state)

  return c.redirect(returnUrl.toString())
})

// ─── Get current user ───────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (c) => {
  const authUser = c.get('user') as AuthUser

  const [user] = await db
    .select({
      id: users.id,
      handle: users.handle,
      displayName: users.displayName,
      email: users.email,
      image: users.image,
      bio: users.bio,
      role: users.role,
      trustedPublisher: users.trustedPublisher,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1)

  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json(user)
})

// ─── Logout ─────────────────────────────────────────────────────────────────
authRouter.post('/logout', requireAuth, async (c) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token))
  }
  return c.json({ ok: true })
})
