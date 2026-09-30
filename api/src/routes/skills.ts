import { Hono } from 'hono'
import { base, lit, ensureAdminAuth, type Row } from '../db/index.js'
import { buildEmbeddingText, generateEmbedding } from '../lib/embeddings.js'
import { getFile } from '../lib/storage.js'
import type { AuthUser } from '../middleware/auth.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'

type Env = { Variables: { user: AuthUser | null } }
type AuthEnv = { Variables: { user: AuthUser } }

export const skillsRouter = new Hono<Env>()

// Names /v1/skills serves as sub-resources (app.ts) or the CLI calls
// (packages/schema routes.ts). A skill slug is the segment after /v1/skills, so
// none of these can be one.
export const RESERVED = new Set([
  'auth', 'changelog-preview', 'download', 'integrations', 'personas', 'resolve',
  'search', 'stars', 'telemetry', 'tokens', 'upload', 'users', 'whoami',
])

// One skill by slug, or null when Base has none. Any other failure is thrown:
// an unreachable store is not a missing skill.
async function findSkill(slug: string): Promise<Row | null> {
  try {
    return await base.collection('skills').getFirstListItem<Row>(`slug = ${lit(slug)}`, {
      expand: 'ownerUserId',
    })
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null
    throw err
  }
}

// A hidden or removed skill is its owner's and an admin's; to anyone else it
// does not exist.
function visible(skill: Row, user: AuthUser | null): boolean {
  if (skill.softDeletedAt) return false
  if (skill.moderationStatus === 'active') return true
  return !!user && (user.id === skill.ownerUserId || user.role === 'admin')
}

const time = (at: string) => Date.parse(at.replace(' ', 'T'))

// The record shapes the web's skill page reads (src/lib/types.ts).
function skillDoc(r: Row) {
  return {
    _id: r.id,
    _creationTime: time(r.createdAt),
    slug: r.slug,
    displayName: r.displayName,
    summary: r.summary || null,
    ownerUserId: r.ownerUserId,
    latestVersionId: r.latestVersionId || null,
    canonicalSkillId: r.canonicalSkillId || null,
    forkOf: r.forkOf ?? null,
    tags: r.tags ?? {},
    badges: r.badges ?? null,
    stats: {
      downloads: r.statsDownloads ?? 0,
      stars: r.statsStars ?? 0,
      versions: r.statsVersions ?? 0,
      comments: r.statsComments ?? 0,
    },
    quality: r.quality ?? null,
    moderationStatus: r.moderationStatus || null,
    moderationReason: r.moderationReason || null,
    moderationFlags: r.moderationFlags ?? null,
    reportCount: r.reportCount ?? null,
    lastReportedAt: r.lastReportedAt ? time(r.lastReportedAt) : null,
    softDeletedAt: null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

type StoredFile = { path: string; size: number; sha256: string; contentType?: string; storageKey?: string; content?: string }

function versionDoc(v: Row) {
  const files = ((v.files ?? []) as StoredFile[]).map(({ content: _content, ...file }) => file)
  return {
    _id: v.id,
    id: v.id,
    _creationTime: time(v.createdAt),
    skillId: v.skillId,
    version: v.version,
    changelog: v.changelog,
    changelogSource: v.changelogSource || null,
    files,
    parsed: v.parsed ?? null,
    createdBy: v.createdBy,
    vtAnalysis: v.vtAnalysis ?? null,
    llmAnalysis: v.llmAnalysis ?? null,
    sha256hash: v.sha256hash || null,
    createdAt: v.createdAt,
  }
}

// One file of a version, as text. A catalogue skill carries its files inline;
// a published one names an object in storage.
async function fileText(file: StoredFile): Promise<string> {
  if (typeof file.content === 'string') return file.content
  if (file.storageKey) return (await getFile(file.storageKey)).toString('utf8')
  throw new Error(`file ${file.path} has neither content nor a storage key`)
}

// A version of this skill by record id, or null.
async function findVersion(skill: Row, versionId: string): Promise<Row | null> {
  try {
    const v = await base.collection('skill_versions').getOne<Row>(versionId)
    return v.skillId === skill.id && !v.softDeletedAt ? v : null
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null
    throw err
  }
}

// ─── List skills (public, paginated) ────────────────────────────────────────
skillsRouter.get('/', optionalAuth, async (c) => {
  const sort = c.req.query('sort') ?? 'updated'
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const cursor = c.req.query('cursor')

  let sortField: string
  switch (sort) {
    case 'downloads': sortField = '-statsDownloads'; break
    case 'stars':     sortField = '-statsStars'; break
    case 'created':   sortField = '-created'; break
    default:          sortField = '-updated'
  }

  const filters: string[] = [
    'softDeletedAt = ""',
    'moderationStatus = "active"',
  ]

  const batch = c.req.query('batch')
  if (batch) {
    filters.push(`batch = ${lit(batch)}`)
  } else {
    filters.push('batch = ""')
  }
  if (cursor) {
    filters.push(`updated < ${lit(cursor)}`)
  }

  const result = await base.collection('skills').getList<Row>(1, limit + 1, {
    filter: filters.join(' && '),
    sort: sortField,
    expand: 'ownerUserId',
  })

  const hasMore = result.items.length > limit
  const items = result.items.slice(0, limit).map((r) => {
    const owner = r.expand?.ownerUserId
    return {
      id: r.id,
      slug: r.slug,
      displayName: r.displayName,
      summary: r.summary,
      ownerUserId: r.ownerUserId,
      badges: r.badges,
      batch: r.batch,
      statsDownloads: r.statsDownloads ?? 0,
      statsStars: r.statsStars ?? 0,
      statsVersions: r.statsVersions ?? 0,
      statsComments: r.statsComments ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ownerHandle: owner?.handle ?? null,
      ownerImage: owner?.image ?? null,
    }
  })

  const nextCursor = hasMore ? items[items.length - 1]?.updatedAt : undefined
  return c.json({ items, nextCursor, hasMore })
})

// ─── Get skill by slug ──────────────────────────────────────────────────────
skillsRouter.get('/:slug', optionalAuth, async (c) => {
  const slug = c.req.param('slug')

  let skill: any
  try {
    skill = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`, {
      expand: 'ownerUserId',
    })
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  const user = c.get('user')
  if (skill.moderationStatus !== 'active') {
    if (!user || (user.id !== skill.ownerUserId && user.role !== 'admin')) {
      return c.json({ error: 'Skill not found' }, 404)
    }
  }

  const owner = skill.expand?.ownerUserId
  return c.json({
    id: skill.id,
    slug: skill.slug,
    displayName: skill.displayName,
    summary: skill.summary,
    ownerUserId: skill.ownerUserId,
    forkOf: skill.forkOf,
    latestVersionId: skill.latestVersionId,
    tags: skill.tags,
    badges: skill.badges,
    moderationStatus: skill.moderationStatus,
    quality: skill.quality,
    statsDownloads: skill.statsDownloads ?? 0,
    statsStars: skill.statsStars ?? 0,
    statsVersions: skill.statsVersions ?? 0,
    statsComments: skill.statsComments ?? 0,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    ownerHandle: owner?.handle ?? null,
    ownerDisplayName: owner?.displayName ?? null,
    ownerImage: owner?.image ?? null,
  })
})

// ─── Skill detail, as the web's skill page reads it ────────────────────────
skillsRouter.get('/:slug/detail', optionalAuth, async (c) => {
  const skill = await findSkill(c.req.param('slug'))
  if (!skill || !visible(skill, c.get('user'))) return c.json({ error: 'Skill not found' }, 404)

  const latest = skill.latestVersionId ? await findVersion(skill, skill.latestVersionId) : null
  const owner = skill.expand?.ownerUserId
  return c.json({
    skill: skillDoc(skill),
    latestVersion: latest && versionDoc(latest),
    owner: owner
      ? { _id: owner.id, handle: owner.handle ?? null, displayName: owner.displayName ?? null, image: owner.image ?? null }
      : null,
    forkOf: null,
    canonical: null,
  })
})

// ─── A version's SKILL.md ───────────────────────────────────────────────────
skillsRouter.get('/:slug/versions/:versionId/readme', optionalAuth, async (c) => {
  const skill = await findSkill(c.req.param('slug'))
  if (!skill || !visible(skill, c.get('user'))) return c.json({ error: 'Skill not found' }, 404)
  const version = await findVersion(skill, c.req.param('versionId'))
  if (!version) return c.json({ error: 'Version not found' }, 404)

  const file = ((version.files ?? []) as StoredFile[]).find((f) => /^(skill|readme)\.md$/i.test(f.path))
  if (!file) return c.json({ error: 'This version has no SKILL.md' }, 404)
  return c.json({ text: await fileText(file) })
})

// ─── One file of a version ──────────────────────────────────────────────────
skillsRouter.get('/:slug/versions/:versionId/file', optionalAuth, async (c) => {
  const skill = await findSkill(c.req.param('slug'))
  if (!skill || !visible(skill, c.get('user'))) return c.json({ error: 'Skill not found' }, 404)
  const version = await findVersion(skill, c.req.param('versionId'))
  if (!version) return c.json({ error: 'Version not found' }, 404)

  const path = c.req.query('path') ?? ''
  const file = ((version.files ?? []) as StoredFile[]).find((f) => f.path === path)
  if (!file) return c.json({ error: `No file ${path} in this version` }, 404)
  return c.json({ text: await fileText(file), size: file.size, sha256: file.sha256 })
})

// ─── List versions for a skill ──────────────────────────────────────────────
skillsRouter.get('/:slug/versions', async (c) => {
  const slug = c.req.param('slug')
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)

  let skill: any
  try {
    skill = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  const result = await base.collection('skill_versions').getList(1, limit, {
    filter: `skillId = ${lit(skill.id)} && softDeletedAt = ""`,
    sort: '-created',
  })

  const items = result.items.map((v) => ({
    id: v.id,
    version: v.version,
    changelog: v.changelog,
    changelogSource: v.changelogSource,
    createdBy: v.createdBy,
    sha256hash: v.sha256hash,
    vtAnalysis: v.vtAnalysis,
    llmAnalysis: v.llmAnalysis,
    createdAt: v.createdAt,
  }))

  return c.json({ items })
})

// ─── Get files for a specific version ───────────────────────────────────────
skillsRouter.get('/:slug/versions/:version/files', async (c) => {
  const slug = c.req.param('slug')
  const version = c.req.param('version')

  let skill: any
  try {
    skill = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  let sv: any
  try {
    sv = await base.collection('skill_versions').getFirstListItem(
      `skillId = ${lit(skill.id)} && version = ${lit(version)}`,
    )
  } catch {
    return c.json({ error: 'Version not found' }, 404)
  }

  return c.json({ files: sv.files })
})

// ─── Publish a skill version (authenticated) ────────────────────────────────
skillsRouter.post('/:slug/publish', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')
  const body = await c.req.json<{
    displayName: string
    version: string
    changelog: string
    tags?: string[]
    files: Array<{
      path: string
      size: number
      storageKey: string
      sha256: string
      contentType?: string
    }>
  }>()

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return c.json({ error: 'Slug must be lowercase and url-safe' }, 400)
  }
  if (RESERVED.has(slug)) {
    return c.json({ error: `${slug} names a route under /v1/skills and cannot be a skill` }, 400)
  }

  await ensureAdminAuth()

  // Find or create skill
  let existing: any = null
  try {
    existing = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`)
  } catch { /* not found */ }

  if (existing && existing.ownerUserId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'You do not own this skill' }, 403)
  }

  if (!existing) {
    existing = await base.collection('skills').create({
      slug,
      displayName: body.displayName,
      ownerUserId: user.id,
      tags: {},
      statsDownloads: 0,
      statsStars: 0,
      statsVersions: 0,
      statsComments: 0,
      moderationStatus: 'active',
    })
  }

  // Check for duplicate version
  try {
    await base.collection('skill_versions').getFirstListItem(
      `skillId = ${lit(existing.id)} && version = ${lit(body.version)}`,
    )
    return c.json({ error: `Version ${body.version} already exists` }, 409)
  } catch { /* not found, good */ }

  // Create version
  const sv = await base.collection('skill_versions').create({
    skillId: existing.id,
    version: body.version,
    changelog: body.changelog,
    changelogSource: 'user',
    files: body.files,
    parsed: { frontmatter: {} },
    createdBy: user.id,
  })

  // Update skill
  await base.collection('skills').update(existing.id, {
    latestVersionId: sv.id,
    displayName: body.displayName,
    statsVersions: (existing.statsVersions ?? 0) + 1,
  })

  // Generate embedding (async)
  generateEmbedding(buildEmbeddingText(body.displayName, slug, null, null))
    .then(async (vector) => {
      await ensureAdminAuth()
      // Mark old embeddings as not latest
      const oldEmbeddings = await base.collection('skill_embeddings').getFullList({
        filter: `skillId = ${lit(existing.id)} && isLatest = true`,
      })
      for (const old of oldEmbeddings) {
        await base.collection('skill_embeddings').update(old.id, { isLatest: false })
      }
      await base.collection('skill_embeddings').create({
        skillId: existing.id,
        versionId: sv.id,
        ownerId: user.id,
        embedding: vector,
        isLatest: true,
        isApproved: true,
        visibility: 'latest',
      })
    })
    .catch((err) => console.error('Embedding generation failed:', err))

  return c.json({
    skillId: existing.id,
    versionId: sv.id,
    version: body.version,
  })
})

// ─── Delete a skill (soft delete) ───────────────────────────────────────────
skillsRouter.delete('/:slug', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  if (skill.ownerUserId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await base.collection('skills').update(skill.id, {
    softDeletedAt: new Date().toISOString(),
  })

  return c.json({ ok: true })
})

// ─── Undelete a skill ───────────────────────────────────────────────────────
skillsRouter.post('/:slug/undelete', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  if (skill.ownerUserId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await base.collection('skills').update(skill.id, {
    softDeletedAt: '',
  })

  return c.json({ ok: true })
})

// ─── Star/unstar a skill ────────────────────────────────────────────────────
skillsRouter.post('/:slug/stars', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  // Check existing star
  let existing: any = null
  try {
    existing = await base.collection('stars').getFirstListItem(
      `skillId = ${lit(skill.id)} && userId = ${lit(user.id)}`,
    )
  } catch { /* not found */ }

  if (existing) {
    await base.collection('stars').delete(existing.id)
    await base.collection('skills').update(skill.id, {
      statsStars: Math.max((skill.statsStars ?? 0) - 1, 0),
    })
    return c.json({ starred: false })
  }

  await base.collection('stars').create({
    skillId: skill.id,
    userId: user.id,
  })
  await base.collection('skills').update(skill.id, {
    statsStars: (skill.statsStars ?? 0) + 1,
  })
  return c.json({ starred: true })
})

// ─── Check star status ──────────────────────────────────────────────────────
skillsRouter.get('/:slug/stars/me', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  try {
    await base.collection('stars').getFirstListItem(
      `skillId = ${lit(skill.id)} && userId = ${lit(user.id)}`,
    )
    return c.json({ starred: true })
  } catch {
    return c.json({ starred: false })
  }
})

// ─── List comments ──────────────────────────────────────────────────────────
skillsRouter.get('/:slug/comments', async (c) => {
  const slug = c.req.param('slug')

  let skill: any
  try {
    skill = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  const result = await base.collection('comments').getList<Row>(1, 200, {
    filter: `skillId = ${lit(skill.id)} && softDeletedAt = ""`,
    sort: '-created',
    expand: 'userId',
  })

  const items = result.items.map((r) => {
    const u = r.expand?.userId
    return {
      id: r.id,
      body: r.body,
      userId: r.userId,
      createdAt: r.createdAt,
      userHandle: u?.handle ?? null,
      userImage: u?.image ?? null,
      userDisplayName: u?.displayName ?? null,
    }
  })

  return c.json({ items })
})

// ─── Add comment ────────────────────────────────────────────────────────────
skillsRouter.post('/:slug/comments', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')
  const body = await c.req.json<{ body: string }>()

  if (!body.body?.trim()) return c.json({ error: 'Comment body required' }, 400)

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await base.collection('skills').getFirstListItem(`slug = ${lit(slug)}`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  const comment = await base.collection('comments').create({
    skillId: skill.id,
    userId: user.id,
    body: body.body.trim(),
  })

  await base.collection('skills').update(skill.id, {
    statsComments: (skill.statsComments ?? 0) + 1,
  })

  return c.json({
    id: comment.id,
    skillId: comment.skillId,
    userId: comment.userId,
    body: comment.body,
    createdAt: comment.createdAt,
  })
})

// ─── Delete comment ─────────────────────────────────────────────────────────
skillsRouter.delete('/:slug/comments/:commentId', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const commentId = c.req.param('commentId')

  await ensureAdminAuth()
  let comment: any
  try {
    comment = await base.collection('comments').getOne(commentId)
  } catch {
    return c.json({ error: 'Comment not found' }, 404)
  }

  if (comment.userId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await base.collection('comments').update(commentId, {
    softDeletedAt: new Date().toISOString(),
    deletedBy: user.id,
  })

  return c.json({ ok: true })
})
