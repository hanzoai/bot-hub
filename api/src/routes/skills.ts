import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import {
  comments,
  skillEmbeddings,
  skills,
  skillVersions,
  stars,
  users,
} from '../db/schema.js'
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

  let orderBy: ReturnType<typeof desc>
  switch (sort) {
    case 'downloads':
      orderBy = desc(skills.statsDownloads)
      break
    case 'stars':
      orderBy = desc(skills.statsStars)
      break
    case 'created':
      orderBy = desc(skills.createdAt)
      break
    default:
      orderBy = desc(skills.updatedAt)
  }

  const conditions = [isNull(skills.softDeletedAt), eq(skills.moderationStatus, 'active')]
  if (cursor) {
    conditions.push(lt(skills.updatedAt, new Date(cursor)))
  }

  const rows = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      displayName: skills.displayName,
      summary: skills.summary,
      ownerUserId: skills.ownerUserId,
      badges: skills.badges,
      statsDownloads: skills.statsDownloads,
      statsStars: skills.statsStars,
      statsVersions: skills.statsVersions,
      statsComments: skills.statsComments,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
      ownerHandle: users.handle,
      ownerImage: users.image,
    })
    .from(skills)
    .leftJoin(users, eq(skills.ownerUserId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = rows.slice(0, limit)
  const nextCursor = hasMore ? items[items.length - 1].updatedAt?.toISOString() : undefined

  return c.json({ items, nextCursor, hasMore })
})

// ─── Get skill by slug ──────────────────────────────────────────────────────
skillsRouter.get('/:slug', optionalAuth, async (c) => {
  const slug = c.req.param('slug')

  const [skill] = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      displayName: skills.displayName,
      summary: skills.summary,
      ownerUserId: skills.ownerUserId,
      forkOf: skills.forkOf,
      latestVersionId: skills.latestVersionId,
      tags: skills.tags,
      badges: skills.badges,
      moderationStatus: skills.moderationStatus,
      quality: skills.quality,
      statsDownloads: skills.statsDownloads,
      statsStars: skills.statsStars,
      statsVersions: skills.statsVersions,
      statsComments: skills.statsComments,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
      ownerHandle: users.handle,
      ownerDisplayName: users.displayName,
      ownerImage: users.image,
    })
    .from(skills)
    .leftJoin(users, eq(skills.ownerUserId, users.id))
    .where(eq(skills.slug, slug))
    .limit(1)

  if (!skill) return c.json({ error: 'Skill not found' }, 404)

  // If soft-deleted and user is not owner/admin, hide it
  const user = c.get('user')
  if (skill.moderationStatus !== 'active') {
    if (!user || (user.id !== skill.ownerUserId && user.role !== 'admin')) {
      return c.json({ error: 'Skill not found' }, 404)
    }
  }

  return c.json(skill)
})

// ─── List versions for a skill ──────────────────────────────────────────────
skillsRouter.get('/:slug/versions', async (c) => {
  const slug = c.req.param('slug')
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)

  const [skill] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)

  if (!skill) return c.json({ error: 'Skill not found' }, 404)

  const versions = await db
    .select({
      id: skillVersions.id,
      version: skillVersions.version,
      changelog: skillVersions.changelog,
      changelogSource: skillVersions.changelogSource,
      createdBy: skillVersions.createdBy,
      sha256hash: skillVersions.sha256hash,
      vtAnalysis: skillVersions.vtAnalysis,
      llmAnalysis: skillVersions.llmAnalysis,
      createdAt: skillVersions.createdAt,
    })
    .from(skillVersions)
    .where(
      and(eq(skillVersions.skillId, skill.id), isNull(skillVersions.softDeletedAt)),
    )
    .orderBy(desc(skillVersions.createdAt))
    .limit(limit)

  return c.json({ items: versions })
})

// ─── Get files for a specific version ───────────────────────────────────────
skillsRouter.get('/:slug/versions/:version/files', async (c) => {
  const slug = c.req.param('slug')
  const version = c.req.param('version')

  const [skill] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)

  if (!skill) return c.json({ error: 'Skill not found' }, 404)

  const [sv] = await db
    .select({ id: skillVersions.id, files: skillVersions.files })
    .from(skillVersions)
    .where(
      and(eq(skillVersions.skillId, skill.id), eq(skillVersions.version, version)),
    )
    .limit(1)

  if (!sv) return c.json({ error: 'Version not found' }, 404)

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

  // Validate slug
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return c.json({ error: 'Slug must be lowercase and url-safe' }, 400)
  }

  // Find or create skill
  let [existing] = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)

  if (existing && existing.ownerUserId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'You do not own this skill' }, 403)
  }

  const now = new Date()

  return await db.transaction(async (tx) => {
    if (!existing) {
      // Create skill
      const [created] = await tx
        .insert(skills)
        .values({
          slug,
          displayName: body.displayName,
          ownerUserId: user.id,
          tags: {},
          statsDownloads: 0,
          statsStars: 0,
          statsVersions: 0,
          statsComments: 0,
          moderationStatus: 'active',
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      existing = created
    }

    // Check for duplicate version
    const [dup] = await tx
      .select({ id: skillVersions.id })
      .from(skillVersions)
      .where(
        and(
          eq(skillVersions.skillId, existing.id),
          eq(skillVersions.version, body.version),
        ),
      )
      .limit(1)

    if (dup) {
      return c.json({ error: `Version ${body.version} already exists` }, 409)
    }

    // Create version
    const [sv] = await tx
      .insert(skillVersions)
      .values({
        skillId: existing.id,
        version: body.version,
        changelog: body.changelog,
        changelogSource: 'user',
        files: body.files,
        parsed: { frontmatter: {} },
        createdBy: user.id,
        createdAt: now,
      })
      .returning()

    // Update skill
    await tx
      .update(skills)
      .set({
        latestVersionId: sv.id,
        displayName: body.displayName,
        statsVersions: sql`${skills.statsVersions} + 1`,
        updatedAt: now,
      })
      .where(eq(skills.id, existing.id))

    // Generate embedding (async, don't block response)
    generateEmbedding(buildEmbeddingText(body.displayName, slug, null, null))
      .then(async (vector) => {
        // Mark old embeddings as not latest
        await db
          .update(skillEmbeddings)
          .set({ isLatest: false })
          .where(eq(skillEmbeddings.skillId, existing.id))

        await db.insert(skillEmbeddings).values({
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
})

// ─── Delete a skill (soft delete) ───────────────────────────────────────────
skillsRouter.delete('/:slug', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')

  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)

  if (!skill) return c.json({ error: 'Skill not found' }, 404)
  if (skill.ownerUserId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await db
    .update(skills)
    .set({ softDeletedAt: new Date() })
    .where(eq(skills.id, skill.id))

  return c.json({ ok: true })
})

// ─── Undelete a skill ───────────────────────────────────────────────────────
skillsRouter.post('/:slug/undelete', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')

  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)

  if (!skill) return c.json({ error: 'Skill not found' }, 404)
  if (skill.ownerUserId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await db
    .update(skills)
    .set({ softDeletedAt: null })
    .where(eq(skills.id, skill.id))

  return c.json({ ok: true })
})

// ─── Star/unstar a skill ────────────────────────────────────────────────────
skillsRouter.post('/:slug/stars', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')

  const [skill] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)

  if (!skill) return c.json({ error: 'Skill not found' }, 404)

  const [existing] = await db
    .select()
    .from(stars)
    .where(and(eq(stars.skillId, skill.id), eq(stars.userId, user.id)))
    .limit(1)

  if (existing) {
    // Unstar
    await db.delete(stars).where(eq(stars.id, existing.id))
    await db
      .update(skills)
      .set({ statsStars: sql`GREATEST(${skills.statsStars} - 1, 0)` })
      .where(eq(skills.id, skill.id))
    return c.json({ starred: false })
  }

  // Star
  await db.insert(stars).values({
    skillId: skill.id,
    userId: user.id,
  })
  await db
    .update(skills)
    .set({ statsStars: sql`${skills.statsStars} + 1` })
    .where(eq(skills.id, skill.id))
  return c.json({ starred: true })
})

// ─── Check star status ──────────────────────────────────────────────────────
skillsRouter.get('/:slug/stars/me', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')

  const [skill] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)

  if (!skill) return c.json({ error: 'Skill not found' }, 404)

  const [star] = await db
    .select()
    .from(stars)
    .where(and(eq(stars.skillId, skill.id), eq(stars.userId, user.id)))
    .limit(1)

  return c.json({ starred: !!star })
})

// ─── List comments ──────────────────────────────────────────────────────────
skillsRouter.get('/:slug/comments', async (c) => {
  const slug = c.req.param('slug')

  const [skill] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)

  if (!skill) return c.json({ error: 'Skill not found' }, 404)

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      userId: comments.userId,
      createdAt: comments.createdAt,
      userHandle: users.handle,
      userImage: users.image,
      userDisplayName: users.displayName,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.skillId, skill.id), isNull(comments.softDeletedAt)))
    .orderBy(desc(comments.createdAt))

  return c.json({ items: rows })
})

// ─── Add comment ────────────────────────────────────────────────────────────
skillsRouter.post('/:slug/comments', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const slug = c.req.param('slug')
  const body = await c.req.json<{ body: string }>()

  if (!body.body?.trim()) return c.json({ error: 'Comment body required' }, 400)

  const [skill] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)

  if (!skill) return c.json({ error: 'Skill not found' }, 404)

  const [comment] = await db
    .insert(comments)
    .values({
      skillId: skill.id,
      userId: user.id,
      body: body.body.trim(),
    })
    .returning()

  await db
    .update(skills)
    .set({ statsComments: sql`${skills.statsComments} + 1` })
    .where(eq(skills.id, skill.id))

  return c.json(comment)
})

// ─── Delete comment ─────────────────────────────────────────────────────────
skillsRouter.delete('/:slug/comments/:commentId', requireAuth, async (c) => {
  const user = c.get('user') as AuthUser
  const commentId = c.req.param('commentId')

  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1)

  if (!comment) return c.json({ error: 'Comment not found' }, 404)
  if (comment.userId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await db
    .update(comments)
    .set({ softDeletedAt: new Date(), deletedBy: user.id })
    .where(eq(comments.id, commentId))

  return c.json({ ok: true })
})
