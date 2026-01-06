import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { assertRole, requireUser, requireUserFromAction } from './lib/access'
import { generateChangelogPreview as buildChangelogPreview } from './lib/changelog'
import { getFrontmatterValue } from './lib/skills'
import {
  fetchText,
  publishVersionForUser,
  queueHighlightedWebhook,
  type PublishResult,
} from './lib/skillPublish'

export { publishVersionForUser } from './lib/skillPublish'

type ReadmeResult = { path: string; text: string }

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const skill = await ctx.db
      .query('skills')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
    if (!skill || skill.softDeletedAt) return null
    const latestVersion = skill.latestVersionId ? await ctx.db.get(skill.latestVersionId) : null
    const owner = await ctx.db.get(skill.ownerUserId)
    return { skill, latestVersion, owner }
  },
})

export const getSkillBySlugInternal = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('skills')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
  },
})

export const list = query({
  args: {
    batch: v.optional(v.string()),
    ownerUserId: v.optional(v.id('users')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 24
    if (args.batch) {
      const entries = await ctx.db
        .query('skills')
        .withIndex('by_batch', (q) => q.eq('batch', args.batch))
        .order('desc')
        .take(limit * 5)
      return entries.filter((skill) => !skill.softDeletedAt).slice(0, limit)
    }
    const ownerUserId = args.ownerUserId
    if (ownerUserId) {
      const entries = await ctx.db
        .query('skills')
        .withIndex('by_owner', (q) => q.eq('ownerUserId', ownerUserId))
        .order('desc')
        .take(limit * 5)
      return entries.filter((skill) => !skill.softDeletedAt).slice(0, limit)
    }
    const entries = await ctx.db
      .query('skills')
      .order('desc')
      .take(limit * 5)
    return entries.filter((skill) => !skill.softDeletedAt).slice(0, limit)
  },
})

export const listVersions = query({
  args: { skillId: v.id('skills'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20
    return ctx.db
      .query('skillVersions')
      .withIndex('by_skill', (q) => q.eq('skillId', args.skillId))
      .order('desc')
      .take(limit)
  },
})

export const getVersionById = query({
  args: { versionId: v.id('skillVersions') },
  handler: async (ctx, args) => ctx.db.get(args.versionId),
})

export const getVersionByIdInternal = internalQuery({
  args: { versionId: v.id('skillVersions') },
  handler: async (ctx, args) => ctx.db.get(args.versionId),
})

export const getVersionBySkillAndVersion = query({
  args: { skillId: v.id('skills'), version: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('skillVersions')
      .withIndex('by_skill_version', (q) =>
        q.eq('skillId', args.skillId).eq('version', args.version),
      )
      .unique()
  },
})

export const publishVersion: ReturnType<typeof action> = action({
  args: {
    slug: v.string(),
    displayName: v.string(),
    version: v.string(),
    changelog: v.string(),
    tags: v.optional(v.array(v.string())),
    files: v.array(
      v.object({
        path: v.string(),
        size: v.number(),
        storageId: v.id('_storage'),
        sha256: v.string(),
        contentType: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<PublishResult> => {
    const { userId } = await requireUserFromAction(ctx)
    return publishVersionForUser(ctx, userId, args)
  },
})

export const generateChangelogPreview = action({
  args: {
    slug: v.string(),
    version: v.string(),
    readmeText: v.string(),
    filePaths: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireUserFromAction(ctx)
    const changelog = await buildChangelogPreview(ctx, {
      slug: args.slug.trim().toLowerCase(),
      version: args.version.trim(),
      readmeText: args.readmeText,
      filePaths: args.filePaths?.map((value) => value.trim()).filter(Boolean),
    })
    return { changelog, source: 'auto' as const }
  },
})

export const getReadme: ReturnType<typeof action> = action({
  args: { versionId: v.id('skillVersions') },
  handler: async (ctx, args): Promise<ReadmeResult> => {
    const version = (await ctx.runQuery(internal.skills.getVersionByIdInternal, {
      versionId: args.versionId,
    })) as Doc<'skillVersions'> | null
    if (!version) throw new ConvexError('Version not found')
    const readmeFile = version.files.find(
      (file) => file.path.toLowerCase() === 'skill.md' || file.path.toLowerCase() === 'skills.md',
    )
    if (!readmeFile) throw new ConvexError('SKILL.md not found')
    const text = await fetchText(ctx, readmeFile.storageId)
    return { path: readmeFile.path, text }
  },
})

export const updateTags = mutation({
  args: {
    skillId: v.id('skills'),
    tags: v.array(v.object({ tag: v.string(), versionId: v.id('skillVersions') })),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx)
    const skill = await ctx.db.get(args.skillId)
    if (!skill) throw new Error('Skill not found')
    if (skill.ownerUserId !== user._id) {
      assertRole(user, ['admin', 'moderator'])
    }

    const nextTags = { ...skill.tags }
    for (const entry of args.tags) {
      nextTags[entry.tag] = entry.versionId
    }

    const latestEntry = args.tags.find((entry) => entry.tag === 'latest')
    await ctx.db.patch(skill._id, {
      tags: nextTags,
      latestVersionId: latestEntry ? latestEntry.versionId : skill.latestVersionId,
      updatedAt: Date.now(),
    })

    if (latestEntry) {
      const embeddings = await ctx.db
        .query('skillEmbeddings')
        .withIndex('by_skill', (q) => q.eq('skillId', skill._id))
        .collect()
      for (const embedding of embeddings) {
        const isLatest = embedding.versionId === latestEntry.versionId
        await ctx.db.patch(embedding._id, {
          isLatest,
          visibility: visibilityFor(isLatest, embedding.isApproved),
          updatedAt: Date.now(),
        })
      }
    }
  },
})

export const setRedactionApproved = mutation({
  args: { skillId: v.id('skills'), approved: v.boolean() },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx)
    assertRole(user, ['admin', 'moderator'])

    const skill = await ctx.db.get(args.skillId)
    if (!skill) throw new Error('Skill not found')

    const badge = args.approved ? { byUserId: user._id, at: Date.now() } : undefined

    await ctx.db.patch(skill._id, {
      badges: { ...skill.badges, redactionApproved: badge },
      updatedAt: Date.now(),
    })

    const embeddings = await ctx.db
      .query('skillEmbeddings')
      .withIndex('by_skill', (q) => q.eq('skillId', skill._id))
      .collect()
    for (const embedding of embeddings) {
      await ctx.db.patch(embedding._id, {
        isApproved: Boolean(badge),
        visibility: visibilityFor(embedding.isLatest, Boolean(badge)),
        updatedAt: Date.now(),
      })
    }

    await ctx.db.insert('auditLogs', {
      actorUserId: user._id,
      action: args.approved ? 'badge.set' : 'badge.unset',
      targetType: 'skill',
      targetId: skill._id,
      metadata: { badge: 'redactionApproved', approved: args.approved },
      createdAt: Date.now(),
    })
  },
})

export const setBatch = mutation({
  args: { skillId: v.id('skills'), batch: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx)
    assertRole(user, ['admin', 'moderator'])
    const skill = await ctx.db.get(args.skillId)
    if (!skill) throw new Error('Skill not found')
    const previousBatch = skill.batch ?? undefined
    const nextBatch = args.batch?.trim() || undefined
    await ctx.db.patch(skill._id, {
      batch: nextBatch,
      updatedAt: Date.now(),
    })
    await ctx.db.insert('auditLogs', {
      actorUserId: user._id,
      action: 'batch.set',
      targetType: 'skill',
      targetId: skill._id,
      metadata: { batch: args.batch?.trim() ?? null },
      createdAt: Date.now(),
    })

    if (nextBatch === 'highlighted' && previousBatch !== 'highlighted') {
      void queueHighlightedWebhook(ctx, skill._id)
    }
  },
})

export const insertVersion = internalMutation({
  args: {
    userId: v.id('users'),
    slug: v.string(),
    displayName: v.string(),
    version: v.string(),
    changelog: v.string(),
    changelogSource: v.optional(v.union(v.literal('auto'), v.literal('user'))),
    tags: v.optional(v.array(v.string())),
    files: v.array(
      v.object({
        path: v.string(),
        size: v.number(),
        storageId: v.id('_storage'),
        sha256: v.string(),
        contentType: v.optional(v.string()),
      }),
    ),
    parsed: v.object({
      frontmatter: v.record(v.string(), v.any()),
      metadata: v.optional(v.any()),
      clawdis: v.optional(v.any()),
    }),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId
    const user = await ctx.db.get(userId)
    if (!user || user.deletedAt) throw new Error('User not found')

    let skill = await ctx.db
      .query('skills')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()

    if (skill && skill.ownerUserId !== userId) {
      throw new Error('Only the owner can publish updates')
    }

    const now = Date.now()
    if (!skill) {
      const summary = getFrontmatterValue(args.parsed.frontmatter, 'description')
      const skillId = await ctx.db.insert('skills', {
        slug: args.slug,
        displayName: args.displayName,
        summary: summary ?? undefined,
        ownerUserId: userId,
        latestVersionId: undefined,
        tags: {},
        softDeletedAt: undefined,
        badges: { redactionApproved: undefined },
        stats: {
          downloads: 0,
          installsCurrent: 0,
          installsAllTime: 0,
          stars: 0,
          versions: 0,
          comments: 0,
        },
        createdAt: now,
        updatedAt: now,
      })
      skill = await ctx.db.get(skillId)
    }

    if (!skill) throw new Error('Skill creation failed')

    const existingVersion = await ctx.db
      .query('skillVersions')
      .withIndex('by_skill_version', (q) => q.eq('skillId', skill._id).eq('version', args.version))
      .unique()
    if (existingVersion) {
      throw new Error('Version already exists')
    }

    const versionId = await ctx.db.insert('skillVersions', {
      skillId: skill._id,
      version: args.version,
      changelog: args.changelog,
      changelogSource: args.changelogSource,
      files: args.files,
      parsed: args.parsed,
      createdBy: userId,
      createdAt: now,
      softDeletedAt: undefined,
    })

    const nextTags: Record<string, Id<'skillVersions'>> = { ...skill.tags }
    nextTags.latest = versionId
    for (const tag of args.tags ?? []) {
      nextTags[tag] = versionId
    }

    const latestBefore = skill.latestVersionId

    await ctx.db.patch(skill._id, {
      displayName: args.displayName,
      summary: getFrontmatterValue(args.parsed.frontmatter, 'description') ?? skill.summary,
      latestVersionId: versionId,
      tags: nextTags,
      stats: { ...skill.stats, versions: skill.stats.versions + 1 },
      softDeletedAt: undefined,
      updatedAt: now,
    })

    const embeddingId = await ctx.db.insert('skillEmbeddings', {
      skillId: skill._id,
      versionId,
      ownerId: userId,
      embedding: args.embedding,
      isLatest: true,
      isApproved: Boolean(skill.badges.redactionApproved),
      visibility: visibilityFor(true, Boolean(skill.badges.redactionApproved)),
      updatedAt: now,
    })

    if (latestBefore) {
      const previousEmbedding = await ctx.db
        .query('skillEmbeddings')
        .withIndex('by_version', (q) => q.eq('versionId', latestBefore))
        .unique()
      if (previousEmbedding) {
        await ctx.db.patch(previousEmbedding._id, {
          isLatest: false,
          visibility: visibilityFor(false, previousEmbedding.isApproved),
          updatedAt: now,
        })
      }
    }

    return { skillId: skill._id, versionId, embeddingId }
  },
})

export const setSkillSoftDeletedInternal = internalMutation({
  args: {
    userId: v.id('users'),
    slug: v.string(),
    deleted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user || user.deletedAt) throw new Error('User not found')

    const slug = args.slug.trim().toLowerCase()
    if (!slug) throw new Error('Slug required')

    const skill = await ctx.db
      .query('skills')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (!skill) throw new Error('Skill not found')

    if (skill.ownerUserId !== args.userId) {
      assertRole(user, ['admin', 'moderator'])
    }

    const now = Date.now()
    await ctx.db.patch(skill._id, {
      softDeletedAt: args.deleted ? now : undefined,
      updatedAt: now,
    })

    const embeddings = await ctx.db
      .query('skillEmbeddings')
      .withIndex('by_skill', (q) => q.eq('skillId', skill._id))
      .collect()
    for (const embedding of embeddings) {
      await ctx.db.patch(embedding._id, {
        visibility: args.deleted
          ? 'deleted'
          : visibilityFor(embedding.isLatest, embedding.isApproved),
        updatedAt: now,
      })
    }

    await ctx.db.insert('auditLogs', {
      actorUserId: args.userId,
      action: args.deleted ? 'skill.delete' : 'skill.undelete',
      targetType: 'skill',
      targetId: skill._id,
      metadata: { slug, softDeletedAt: args.deleted ? now : null },
      createdAt: now,
    })

    return { ok: true as const }
  },
})

function visibilityFor(isLatest: boolean, isApproved: boolean) {
  if (isLatest && isApproved) return 'latest-approved'
  if (isLatest) return 'latest'
  if (isApproved) return 'archived-approved'
  return 'archived'
}
