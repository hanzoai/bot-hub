import { serve } from '@hono/node-server'
import { app } from './app.js'
import { env } from './lib/env.js'

serve({ fetch: app.fetch, port: env.port })
console.log(`Bot Hub API listening on http://0.0.0.0:${env.port}`)
