import PocketBase from 'pocketbase'
import { env } from '../lib/env.js'

// PocketBase SDK client — talks to Hanzo Base server
export const pb = new PocketBase(env.baseUrl)

// Admin auth for server-side operations
let adminAuthed = false

export async function ensureAdminAuth(): Promise<void> {
  if (adminAuthed && pb.authStore.isValid) return
  try {
    await pb.collection('_superusers').authWithPassword(
      env.baseAdminEmail,
      env.baseAdminPassword,
    )
    adminAuthed = true
  } catch (err) {
    console.error('Base admin auth failed:', err)
    throw err
  }
}

// Auto-auth on import (best-effort, routes will retry)
ensureAdminAuth().catch(() => {})
