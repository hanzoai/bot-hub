import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { ActionCtx, DatabaseReader, DatabaseWriter } from './_generated/server'
import { action, internalMutation, internalQuery } from './_generated/server'
import { publishPersonaVersionForUser } from './lib/personaPublish'
import { PERSONA_SEED_DISPLAY_NAME, PERSONA_SEED_HANDLE, PERSONA_SEED_KEY, PERSONA_SEEDS } from './seedPersonas'

const SEED_LOCK_STALE_MS = 10 * 60 * 1000

type SeedStateDoc = Doc<'githubBackupSyncState'>

type SeedStartDecision = {
  started: boolean
  reason: 'done' | 'running' | 'patched' | 'inserted'
}

async function getSeedState(ctx: { db: DatabaseReader }): Promise<SeedStateDoc | null> {
  const entries = (await ctx.db
    .query('githubBackupSyncState')
    .withIndex('by_key', (q) => q.eq('key', PERSONA_SEED_KEY))
    .order('desc')
    .take(2)) as SeedStateDoc[]
  return entries[0] ?? null
}

async function cleanupSeedState(ctx: { db: DatabaseWriter }, keepId: Id<'githubBackupSyncState'>) {
  const entries = (await ctx.db
    .query('githubBackupSyncState')
    .withIndex('by_key', (q) => q.eq('key', PERSONA_SEED_KEY))
    .order('desc')
    .take(50)) as SeedStateDoc[]

  for (const entry of entries) {
    if (entry._id === keepId) continue
    await ctx.db.delete(entry._id)
  }
}

export function decideSeedStart(existing: SeedStateDoc | null, now: number): SeedStartDecision {
  const cursor = existing?.cursor ?? null
  if (cursor === 'done') return { started: false, reason: 'done' }
  if (cursor === 'running' && existing && now - existing.updatedAt < SEED_LOCK_STALE_MS) {
    return { started: false, reason: 'running' }
  }
  return existing ? { started: true, reason: 'patched' } : { started: true, reason: 'inserted' }
}

export const getPersonaSeedStateInternal = internalQuery({
  args: {},
  handler: async (ctx) => getSeedState(ctx),
})

export const setPersonaSeedStateInternal = internalMutation({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    const existing = await getSeedState(ctx)
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, { cursor: args.status, updatedAt: now })
      await cleanupSeedState(ctx, existing._id)
      return existing._id
    }
    const id = await ctx.db.insert('githubBackupSyncState', {
      key: PERSONA_SEED_KEY,
      cursor: args.status,
      updatedAt: now,
    })
    await cleanupSeedState(ctx, id)
    return id
  },
})

export const tryStartPersonaSeedInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const existing = await getSeedState(ctx)
    const decision = decideSeedStart(existing, now)

    if (!decision.started) return decision

    if (existing) {
      await ctx.db.patch(existing._id, { cursor: 'running', updatedAt: now })
      await cleanupSeedState(ctx, existing._id)
      return { started: true, reason: 'patched' as const }
    }

    const id = await ctx.db.insert('githubBackupSyncState', {
      key: PERSONA_SEED_KEY,
      cursor: 'running',
      updatedAt: now,
    })
    await cleanupSeedState(ctx, id)
    return { started: true, reason: 'inserted' as const }
  },
})

export const hasAnyPersonasInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const entry = await ctx.db.query('personas').take(1)
    return entry.length > 0
  },
})

export const ensurePersonaSeeds = action({
  args: {},
  handler: async (ctx) => {
    const started = (await ctx.runMutation(internal.seed.tryStartPersonaSeedInternal, {})) as {
      started: boolean
      reason: 'done' | 'running' | 'patched' | 'inserted'
    }
    if (!started.started) {
      if (started.reason === 'done') return { seeded: false, reason: 'already-seeded' as const }
      return { seeded: false, reason: 'in-progress' as const }
    }

    const hasPersonas = (await ctx.runQuery(internal.seed.hasAnyPersonasInternal, {})) as boolean
    if (hasPersonas) {
      await ctx.runMutation(internal.seed.setPersonaSeedStateInternal, { status: 'done' })
      return { seeded: false, reason: 'personas-exist' as const }
    }

    try {
      const result = await runSeed(ctx)
      await ctx.runMutation(internal.seed.setPersonaSeedStateInternal, { status: 'done' })
      return { seeded: true, reason: 'seeded' as const, ...result }
    } catch (error) {
      await ctx.runMutation(internal.seed.setPersonaSeedStateInternal, { status: 'error' })
      throw error
    }
  },
})

export const seed = action({
  args: {},
  handler: async (ctx) => runSeed(ctx),
})

async function runSeed(ctx: ActionCtx) {
  const userId = (await ctx.runMutation(internal.seed.ensureSeedUserInternal, {
    handle: PERSONA_SEED_HANDLE,
    displayName: PERSONA_SEED_DISPLAY_NAME,
  })) as Id<'users'>

  const created: string[] = []
  const skipped: string[] = []

  for (const seedEntry of PERSONA_SEEDS) {
    const existing = (await ctx.runQuery(internal.personas.getPersonaBySlugInternal, {
      slug: seedEntry.slug,
    })) as Doc<'personas'> | null
    if (existing) {
      if (existing.softDeletedAt && existing.ownerUserId === userId) {
        await ctx.runMutation(internal.personas.setPersonaSoftDeletedInternal, {
          userId,
          slug: seedEntry.slug,
          deleted: false,
        })
      }
      skipped.push(seedEntry.slug)
      continue
    }

    const body = seedEntry.readme
    if (!body) {
      skipped.push(seedEntry.slug)
      continue
    }

    const bytes = new TextEncoder().encode(body)
    const sha256 = await sha256Hex(bytes)
    const storageId = await ctx.storage.store(new Blob([bytes], { type: 'text/markdown' }))

    try {
      await publishPersonaVersionForUser(ctx, userId, {
        slug: seedEntry.slug,
        displayName: seedEntry.displayName,
        version: seedEntry.version,
        changelog: '',
        tags: seedEntry.tags,
        files: [
          {
            path: 'PERSONA.md',
            size: bytes.byteLength,
            storageId,
            sha256,
            contentType: 'text/markdown',
          },
        ],
      })
      created.push(seedEntry.slug)
    } catch (error) {
      if (!isExpectedSeedSkipError(error)) throw error
      skipped.push(seedEntry.slug)
    }
  }

  return { created, skipped }
}

function isExpectedSeedSkipError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('Version already exists') || message.includes('Only the owner can publish')
  )
}

export const ensureSeedUserInternal = internalMutation({
  args: {
    handle: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const baseHandle = args.handle.trim()
    const displayName = args.displayName.trim()
    const candidates = [baseHandle, `${baseHandle}-bot`]
    for (let i = 2; i <= 6; i += 1) candidates.push(`${baseHandle}-bot-${i}`)

    for (const candidate of candidates) {
      const existing = await ctx.db
        .query('users')
        .withIndex('handle', (q) => q.eq('handle', candidate))
        .take(2)
      const user = (existing[0] ?? null) as Doc<'users'> | null
      if (user) {
        if ((user.displayName ?? user.name) === displayName) return user._id
        continue
      }

      return ctx.db.insert('users', {
        handle: candidate,
        displayName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    throw new Error('Unable to allocate seed user handle')
  },
})

async function sha256Hex(bytes: Uint8Array) {
  const data = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(digest))
}

function toHex(bytes: Uint8Array) {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}
