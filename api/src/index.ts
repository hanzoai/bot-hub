import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './lib/env.js'
import { authRouter } from './routes/auth.js'
import { searchRouter } from './routes/search.js'
import { personasRouter } from './routes/personas.js'
import { skillsRouter } from './routes/skills.js'
import { integrationsRouter } from './routes/integrations.js'
import { tokensRouter } from './routes/tokens.js'
import { uploadRouter } from './routes/upload.js'
import { usersRouter } from './routes/users.js'

const app = new Hono()

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use('*', logger())
app.use('*', compress())
app.use(
  '*',
  cors({
    origin: [env.publicUrl, 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  }),
)

// ─── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', version: '0.1.0' }))

// ─── API Routes ─────────────────────────────────────────────────────────────
// Every route is /v1/…; nothing is served under /api.
const v1 = new Hono()
v1.route('/auth', authRouter)
v1.route('/skills', skillsRouter)
v1.route('/personas', personasRouter)
v1.route('/integrations', integrationsRouter)
v1.route('/search', searchRouter)
v1.route('/users', usersRouter)
v1.route('/upload', uploadRouter)
v1.route('/tokens', tokensRouter)

// The CLI's `bothub whoami` reads the signed-in user at /v1/whoami.
v1.get('/whoami', (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/v1/auth/me'
  return app.fetch(new Request(url, c.req.raw))
})

app.route('/v1', v1)

// ─── Start server ───────────────────────────────────────────────────────────
console.log(`Bot Hub API starting on port ${env.port}`)

serve({
  fetch: app.fetch,
  port: env.port,
})

console.log(`Bot Hub API listening on http://0.0.0.0:${env.port}`)
