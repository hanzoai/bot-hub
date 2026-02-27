import { Hono } from 'hono'
import { pb, ensureAdminAuth } from '../db/index.js'
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

  // Find or create user in Base
  await ensureAdminAuth()

  let user: any = null
  try {
    user = await pb.collection('users').getFirstListItem(
      `email = "${profile.email ?? ''}"`,
    )
  } catch { /* not found */ }

  if (!user) {
    user = await pb.collection('users').create({
      email: profile.email,
      handle: profile.preferred_username ?? profile.name,
      displayName: profile.name ?? profile.preferred_username,
      name: profile.name ?? profile.preferred_username,
      image: profile.picture,
      role: 'user',
      password: crypto.randomUUID(), // Base auth requires a password
      passwordConfirm: crypto.randomUUID(),
    })
  } else {
    await pb.collection('users').update(user.id, {
      image: profile.picture ?? user.image,
      displayName: profile.name ?? user.displayName,
    })
  }

  // Use the IAM access token as the session token for the frontend.
  // The middleware validates against IAM userinfo, so no need for a
  // separate sessions table.
  const returnUrl = new URL(env.publicUrl)
  returnUrl.searchParams.set('session', tokens.access_token)
  if (state) returnUrl.searchParams.set('state', state)

  return c.redirect(returnUrl.toString())
})

// ─── Get current user ───────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (c) => {
  const authUser = c.get('user') as AuthUser

  await ensureAdminAuth()
  let user: any
  try {
    user = await pb.collection('users').getOne(authUser.id)
  } catch {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    email: user.email,
    image: user.image,
    bio: user.bio,
    role: user.role,
    trustedPublisher: user.trustedPublisher,
    createdAt: user.created,
  })
})

// ─── Logout ─────────────────────────────────────────────────────────────────
authRouter.post('/logout', requireAuth, async (c) => {
  // With IAM-based sessions, logout is handled client-side by clearing
  // the stored token. No server-side session table to delete.
  return c.json({ ok: true })
})
