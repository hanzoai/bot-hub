import { Hono } from 'hono'
import { pb, ensureAdminAuth } from '../db/index.js'
import { buildEmbeddingText, generateEmbedding } from '../lib/embeddings.js'
import type { AuthUser } from '../middleware/auth.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'

type Env = { Variables: { user: AuthUser | null } }
type AuthEnv = { Variables: { user: AuthUser } }

export const skillsRouter = new Hono<Env>()

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
    filters.push(`batch = "${batch}"`)
  } else {
    filters.push('batch = ""')
  }
  if (cursor) {
    filters.push(`updated < "${cursor}"`)
  }

  await ensureAdminAuth()
  const result = await pb.collection('skills').getList(1, limit + 1, {
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
      createdAt: r.created,
      updatedAt: r.updated,
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

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`, {
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
    createdAt: skill.created,
    updatedAt: skill.updated,
    ownerHandle: owner?.handle ?? null,
    ownerDisplayName: owner?.displayName ?? null,
    ownerImage: owner?.image ?? null,
  })
})

// ─── List versions for a skill ──────────────────────────────────────────────
skillsRouter.get('/:slug/versions', async (c) => {
  const slug = c.req.param('slug')
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  const result = await pb.collection('skill_versions').getList(1, limit, {
    filter: `skillId = "${skill.id}" && softDeletedAt = ""`,
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
    createdAt: v.created,
  }))

  return c.json({ items })
})

// ─── Get files for a specific version ───────────────────────────────────────
skillsRouter.get('/:slug/versions/:version/files', async (c) => {
  const slug = c.req.param('slug')
  const version = c.req.param('version')

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  let sv: any
  try {
    sv = await pb.collection('skill_versions').getFirstListItem(
      `skillId = "${skill.id}" && version = "${version}"`,
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

  await ensureAdminAuth()

  // Find or create skill
  let existing: any = null
  try {
    existing = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`)
  } catch { /* not found */ }

  if (existing && existing.ownerUserId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'You do not own this skill' }, 403)
  }

  if (!existing) {
    existing = await pb.collection('skills').create({
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
    await pb.collection('skill_versions').getFirstListItem(
      `skillId = "${existing.id}" && version = "${body.version}"`,
    )
    return c.json({ error: `Version ${body.version} already exists` }, 409)
  } catch { /* not found, good */ }

  // Create version
  const sv = await pb.collection('skill_versions').create({
    skillId: existing.id,
    version: body.version,
    changelog: body.changelog,
    changelogSource: 'user',
    files: body.files,
    parsed: { frontmatter: {} },
    createdBy: user.id,
  })

  // Update skill
  await pb.collection('skills').update(existing.id, {
    latestVersionId: sv.id,
    displayName: body.displayName,
    statsVersions: (existing.statsVersions ?? 0) + 1,
  })

  // Generate embedding (async)
  generateEmbedding(buildEmbeddingText(body.displayName, slug, null, null))
    .then(async (vector) => {
      await ensureAdminAuth()
      // Mark old embeddings as not latest
      const oldEmbeddings = await pb.collection('skill_embeddings').getFullList({
        filter: `skillId = "${existing.id}" && isLatest = true`,
      })
      for (const old of oldEmbeddings) {
        await pb.collection('skill_embeddings').update(old.id, { isLatest: false })
      }
      await pb.collection('skill_embeddings').create({
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
    skill = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  if (skill.ownerUserId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await pb.collection('skills').update(skill.id, {
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
    skill = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  if (skill.ownerUserId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await pb.collection('skills').update(skill.id, {
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
    skill = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  // Check existing star
  let existing: any = null
  try {
    existing = await pb.collection('stars').getFirstListItem(
      `skillId = "${skill.id}" && userId = "${user.id}"`,
    )
  } catch { /* not found */ }

  if (existing) {
    await pb.collection('stars').delete(existing.id)
    await pb.collection('skills').update(skill.id, {
      statsStars: Math.max((skill.statsStars ?? 0) - 1, 0),
    })
    return c.json({ starred: false })
  }

  await pb.collection('stars').create({
    skillId: skill.id,
    userId: user.id,
  })
  await pb.collection('skills').update(skill.id, {
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
    skill = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  try {
    await pb.collection('stars').getFirstListItem(
      `skillId = "${skill.id}" && userId = "${user.id}"`,
    )
    return c.json({ starred: true })
  } catch {
    return c.json({ starred: false })
  }
})

// ─── List comments ──────────────────────────────────────────────────────────
skillsRouter.get('/:slug/comments', async (c) => {
  const slug = c.req.param('slug')

  await ensureAdminAuth()
  let skill: any
  try {
    skill = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  const result = await pb.collection('comments').getList(1, 200, {
    filter: `skillId = "${skill.id}" && softDeletedAt = ""`,
    sort: '-created',
    expand: 'userId',
  })

  const items = result.items.map((r) => {
    const u = r.expand?.userId
    return {
      id: r.id,
      body: r.body,
      userId: r.userId,
      createdAt: r.created,
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
    skill = await pb.collection('skills').getFirstListItem(`slug = "${slug}"`)
  } catch {
    return c.json({ error: 'Skill not found' }, 404)
  }

  const comment = await pb.collection('comments').create({
    skillId: skill.id,
    userId: user.id,
    body: body.body.trim(),
  })

  await pb.collection('skills').update(skill.id, {
    statsComments: (skill.statsComments ?? 0) + 1,
  })

  return c.json({
    id: comment.id,
    skillId: comment.skillId,
    userId: comment.userId,
    body: comment.body,
    createdAt: comment.created,
  })
})

// ─── Delete comment ─────────────────────────────────────────────────────────
skillsRouter.delete('/:slug/comments/:commentId', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const commentId = c.req.param('commentId')

  await ensureAdminAuth()
  let comment: any
  try {
    comment = await pb.collection('comments').getOne(commentId)
  } catch {
    return c.json({ error: 'Comment not found' }, 404)
  }

  if (comment.userId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await pb.collection('comments').update(commentId, {
    softDeletedAt: new Date().toISOString(),
    deletedBy: user.id,
  })

  return c.json({ ok: true })
})
