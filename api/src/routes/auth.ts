import { Hono } from 'hono'
import { base, lit, ensureAdminAuth } from '../db/index.js'
import { env, siteOrigins } from '../lib/env.js'
import type { AuthUser } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = new Hono()

// ─── OAuth: Start login flow ────────────────────────────────────────────────
// IAM sends the browser back to this API's own callback. The site to land on
// afterwards rides in `state`, and only a Bot Hub site is accepted there.
const callbackUrl = `${env.apiUrl}/v1/skills/auth/callback`

authRouter.get('/login', (c) => {
  const back = c.req.query('return') ?? env.publicUrl
  if (!siteOrigins.has(back)) return c.json({ error: `${back} is not a Bot Hub site` }, 400)

  const authUrl = new URL(`${env.iamUrl}/v1/iam/oauth/authorize`)
  authUrl.searchParams.set('client_id', env.iamClientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', callbackUrl)
  authUrl.searchParams.set('scope', 'openid profile email')
  authUrl.searchParams.set('state', `${crypto.randomUUID()}.${Buffer.from(back).toString('base64url')}`)

  return c.redirect(authUrl.toString())
})

// The site a sign-in started from, read back out of `state`.
function returnOf(state: string | undefined): string {
  const encoded = state?.split('.')[1]
  const back = encoded ? Buffer.from(encoded, 'base64url').toString() : ''
  return siteOrigins.has(back) ? back : env.publicUrl
}

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
  const tokenResponse = await fetch(`${env.iamUrl}/v1/iam/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
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
  const profileResponse = await fetch(`${env.iamUrl}/v1/iam/oauth/userinfo`, {
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
    user = await base.collection('users').getFirstListItem(
      `email = ${lit(profile.email ?? '')}`,
    )
  } catch { /* not found */ }

  if (!user) {
    user = await base.collection('users').create({
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
    await base.collection('users').update(user.id, {
      image: profile.picture ?? user.image,
      displayName: profile.name ?? user.displayName,
    })
  }

  // The IAM access token is the web's session token; the middleware checks it
  // against IAM userinfo. It travels in the fragment, which no server, log or
  // Referer header ever sees.
  return c.redirect(`${returnOf(state)}/#session=${encodeURIComponent(tokens.access_token)}`)
})

// ─── Get current user ───────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (c) => {
  const authUser = c.get('user') as AuthUser

  await ensureAdminAuth()
  let user: any
  try {
    user = await base.collection('users').getOne(authUser.id)
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
    createdAt: user.createdAt,
  })
})

// ─── Logout ─────────────────────────────────────────────────────────────────
authRouter.post('/logout', requireAuth, async (c) => {
  // With IAM-based sessions, logout is handled client-side by clearing
  // the stored token. No server-side session table to delete.
  return c.json({ ok: true })
})
