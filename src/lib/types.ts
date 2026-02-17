/**
 * Domain types replacing Convex auto-generated Doc<> and Id<> types.
 * Fields match the Convex schema shape so existing components work
 * with minimal changes (just import path updates).
 */

// ─── ID types (plain strings replacing Convex Id<T>) ───────────────────────
export type Id<_T extends string> = string

// ─── User ──────────────────────────────────────────────────────────────────
export type User = {
  _id: string
  _creationTime: number
  name: string | null
  email: string | null
  phone: string | null
  handle: string | null
  displayName: string | null
  image: string | null
  bio: string | null
  role: string | null
  githubId: string | null
  githubCreatedAt: string | null
  trustedPublisher: boolean
  deactivatedAt: number | null
  purgedAt: number | null
  deletedAt: number | null
  banReason: string | null
}

// ─── Skill ─────────────────────────────────────────────────────────────────
export type Skill = {
  _id: string
  _creationTime: number
  slug: string
  displayName: string
  summary: string | null
  ownerUserId: string
  latestVersionId: string | null
  canonicalSkillId: string | null
  forkOf: { skillId: string; versionId: string; kind?: string } | null
  tags: Record<string, string>
  badges: Record<string, { byUserId: string; at: number }> | null
  stats: {
    downloads: number
    stars: number
    versions: number
    comments: number
  }
  quality: Record<string, unknown> | null
  moderationStatus: string | null
  moderationReason: string | null
  moderationFlags: string[] | null
  reportCount: number | null
  lastReportedAt: number | null
  softDeletedAt: number | null
  createdAt: string
  updatedAt: string
}

// ─── SkillVersion ──────────────────────────────────────────────────────────
export type SkillVersion = {
  _id: string
  _creationTime: number
  skillId: string
  version: string
  changelog: string
  changelogSource: string | null
  files: Array<{
    path: string
    size: number
    storageId: string
    sha256: string
    contentType?: string
  }>
  parsed: Record<string, unknown> | null
  createdBy: string
  vtAnalysis: Record<string, unknown> | null
  llmAnalysis: Record<string, unknown> | null
  sha256hash: string | null
  createdAt: string
}

// ─── Persona ──────────────────────────────────────────────────────────────────
export type Persona = {
  _id: string
  _creationTime: number
  slug: string
  displayName: string
  summary: string | null
  ownerUserId: string
  latestVersionId: string | null
  tags: Record<string, string>
  stats: {
    downloads: number
    stars: number
    versions: number
    comments: number
  }
  createdAt: string
  updatedAt: string
}

// ─── PersonaVersion ───────────────────────────────────────────────────────────
export type PersonaVersion = {
  _id: string
  _creationTime: number
  personaId: string
  version: string
  changelog: string
  changelogSource: string | null
  files: Array<{
    path: string
    size: number
    storageId: string
    sha256: string
    contentType?: string
  }>
  parsed: Record<string, unknown> | null
  createdBy: string
  createdAt: string
}

// ─── Comment ───────────────────────────────────────────────────────────────
export type Comment = {
  _id: string
  _creationTime: number
  skillId: string
  userId: string
  body: string
  createdAt: string
  softDeletedAt: number | null
  deletedBy: string | null
}

export type PersonaComment = {
  _id: string
  _creationTime: number
  personaId: string
  userId: string
  body: string
  createdAt: string
  softDeletedAt: number | null
  deletedBy: string | null
}

// ─── Star ──────────────────────────────────────────────────────────────────
export type Star = {
  _id: string
  _creationTime: number
  skillId: string
  userId: string
  createdAt: string
}

// ─── API Token ─────────────────────────────────────────────────────────────
export type ApiToken = {
  _id: string
  _creationTime: number
  userId: string
  label: string
  prefix: string
  tokenHash: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

// ─── Skill Badges ──────────────────────────────────────────────────────────
export type SkillBadge = {
  _id: string
  _creationTime: number
  skillId: string
  kind: 'highlighted' | 'official' | 'deprecated' | 'redactionApproved'
  byUserId: string
  at: number
}

// ─── Audit Log ─────────────────────────────────────────────────────────────
export type AuditLog = {
  _id: string
  _creationTime: number
  actorUserId: string
  action: string
  targetType: string
  targetId: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

// ─── Doc type helper (maps table name → type) ─────────────────────────────
export type Doc<T extends string> = T extends 'users'
  ? User
  : T extends 'skills'
    ? Skill
    : T extends 'skillVersions'
      ? SkillVersion
      : T extends 'personas'
        ? Persona
        : T extends 'personaVersions'
          ? PersonaVersion
          : T extends 'comments'
            ? Comment
            : T extends 'personaComments'
              ? PersonaComment
              : T extends 'stars'
                ? Star
                : T extends 'apiTokens'
                  ? ApiToken
                  : T extends 'skillBadges'
                    ? SkillBadge
                    : T extends 'auditLogs'
                      ? AuditLog
                      : Record<string, unknown>
