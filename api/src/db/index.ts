import { BaseClient, type BaseRecord } from '@hanzo/base'
import { HTTPException } from 'hono/http-exception'
import { env } from '../lib/env.js'

// Hanzo Base client. Reads carry no credential: every collection the public
// catalogue reads has a public list and view rule, so an anonymous read sees
// exactly what any visitor may see.
export const base = new BaseClient(env.baseUrl)

// A record read without a declared collection schema
export type Row = BaseRecord & Record<string, any>

// Base takes credentials from Hanzo IAM and nowhere else: it serves no
// password sign-in, so the superuser session this API used to open for writes
// cannot be opened. Every write path calls this first and answers 503 with the
// reason, until the API holds an IAM identity Base accepts.
export async function ensureAdminAuth(): Promise<void> {
  throw new HTTPException(503, {
    message: 'Bot Hub cannot write to its store: Base accepts only Hanzo IAM credentials, and this API holds none',
  })
}

// Quote a value for a Base filter expression. Every caller-supplied string that
// reaches a filter goes through this, so a quote in a slug or cursor cannot end
// the literal and add a clause.
export function lit(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
