import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { cache } from './lib/cache.js'
import { env } from './lib/env.js'
import { authRouter } from './routes/auth.js'
import { integrationsRouter } from './routes/integrations.js'
import { personasRouter } from './routes/personas.js'
import { searchSkills } from './routes/search.js'
import { skillsRouter } from './routes/skills.js'
import { tokensRouter } from './routes/tokens.js'
import { uploadRouter } from './routes/upload.js'
import { usersRouter } from './routes/users.js'

// The skills capability: everything this API serves is under /v1/skills, the
// address api.hanzo.ai routes here. A sub-resource name (auth, personas,
// search, …) is therefore not a skill slug; RESERVED lists them and publish
// refuses one.
export const skills = new Hono()
skills.route('/auth', authRouter)
skills.route('/personas', personasRouter)
skills.route('/integrations', integrationsRouter)
skills.route('/users', usersRouter)
skills.route('/upload', uploadRouter)
skills.route('/tokens', tokensRouter)
skills.get('/search', searchSkills)

// The CLI's `bothub whoami` reads the signed-in user here.
skills.get('/whoami', (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/v1/skills/auth/me'
  return app.fetch(new Request(url, c.req.raw))
})

skills.route('/', skillsRouter)

export const app = new Hono()

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use('*', logger())
app.use('*', compress())
// Callers authenticate with a bearer token and never with a cookie, so any
// origin may read the answers: the public ones are public, and the rest need a
// token the page must already hold.
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Authorization', 'Content-Type', 'If-None-Match'],
    exposeHeaders: ['ETag'],
    maxAge: 86400,
  }),
)
app.use('*', cache())

// ─── Health ─────────────────────────────────────────────────────────────────
// Healthy means able to answer: the API is up AND the Base it reads is. The
// probes restart the pod when Base is gone, which `wait` in the entrypoint
// never would.
app.get('/health', async (c) => {
  const store = await fetch(`${env.baseUrl}/v1/health`, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok)
    .catch(() => false)
  c.header('Cache-Control', 'no-store')
  return c.json({ status: store ? 'ok' : 'store unavailable' }, store ? 200 : 503)
})

app.route('/v1/skills', skills)

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(`${c.req.method} ${c.req.path}:`, err)
  return c.json({ error: 'Internal error' }, 500)
})
