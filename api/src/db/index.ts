import { BaseClient, type BaseRecord } from '@hanzo/base'
import { env } from '../lib/env.js'

// Hanzo Base client
export const base = new BaseClient(env.baseUrl)

// A record read without a declared collection schema
export type Row = BaseRecord & Record<string, any>

// Admin auth for server-side operations
let adminAuthed = false

export async function ensureAdminAuth(): Promise<void> {
  if (adminAuthed && base.authStore.isValid) return
  try {
    await base.collection('_superusers').authWithPassword(
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
