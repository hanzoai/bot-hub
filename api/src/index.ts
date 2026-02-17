import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './lib/env.js'
import { authRouter } from './routes/auth.js'
import { searchRouter } from './routes/search.js'
import { skillsRouter } from './routes/skills.js'
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
app.route('/api/auth', authRouter)
app.route('/api/v1/skills', skillsRouter)
app.route('/api/v1/search', searchRouter)
app.route('/api/v1/users', usersRouter)
app.route('/api/v1/upload', uploadRouter)
app.route('/api/v1/tokens', tokensRouter)

// ─── CLI compatibility endpoints (v0, maps to v1) ──────────────────────────
app.get('/api/whoami', async (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/api/auth/me'
  return app.fetch(new Request(url, c.req.raw))
})

// ─── Start server ───────────────────────────────────────────────────────────
console.log(`Bot Hub API starting on port ${env.port}`)

serve({
  fetch: app.fetch,
  port: env.port,
})

console.log(`Bot Hub API listening on http://0.0.0.0:${env.port}`)

export default app
