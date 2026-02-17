import { Hono } from 'hono'
import { generateUploadUrl } from '../lib/storage.js'
import type { AuthUser } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'

export const uploadRouter = new Hono()

// ─── Generate presigned upload URL ──────────────────────────────────────────
uploadRouter.post('/url', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const body = await c.req.json<{
    filename: string
    contentType?: string
  }>()

  if (!body.filename) {
    return c.json({ error: 'filename is required' }, 400)
  }

  // Generate a unique storage key
  const key = `uploads/${user.id}/${Date.now()}-${body.filename}`
  const url = await generateUploadUrl(key, body.contentType)

  return c.json({ url, storageKey: key })
})
