import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from 'drizzle-orm/pg-core'

// ─── Users ──────────────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name'),
    image: text('image'),
    email: text('email'),
    emailVerificationTime: timestamp('email_verification_time'),
    phone: text('phone'),
    phoneVerificationTime: timestamp('phone_verification_time'),
    isAnonymous: boolean('is_anonymous').default(false),
    handle: varchar('handle', { length: 64 }),
    displayName: text('display_name'),
    bio: text('bio'),
    role: varchar('role', { length: 16 }).default('user'), // admin | moderator | user
    githubId: text('github_id'),
    githubCreatedAt: timestamp('github_created_at'),
    githubFetchedAt: timestamp('github_fetched_at'),
    githubProfileSyncedAt: timestamp('github_profile_synced_at'),
    trustedPublisher: boolean('trusted_publisher').default(false),
    deactivatedAt: timestamp('deactivated_at'),
    purgedAt: timestamp('purged_at'),
    deletedAt: timestamp('deleted_at'),
    banReason: text('ban_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    index('users_phone_idx').on(t.phone),
    uniqueIndex('users_handle_idx').on(t.handle),
    uniqueIndex('users_github_id_idx').on(t.githubId),
  ],
)

// ─── Auth Sessions ──────────────────────────────────────────────────────────
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('sessions_token_idx').on(t.token)],
)

// ─── OAuth Accounts ─────────────────────────────────────────────────────────
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(), // github, hanzo
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('oauth_provider_account_idx').on(t.provider, t.providerAccountId),
    index('oauth_user_idx').on(t.userId),
  ],
)

// ─── Skills ─────────────────────────────────────────────────────────────────
export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 128 }).notNull(),
    displayName: text('display_name').notNull(),
    summary: text('summary'),
    resourceId: text('resource_id'),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    canonicalSkillId: uuid('canonical_skill_id'),
    forkOf: jsonb('fork_of'), // { skillId, kind, version?, at }
    latestVersionId: uuid('latest_version_id'),
    tags: jsonb('tags').default({}).notNull(), // Record<string, versionId>
    softDeletedAt: timestamp('soft_deleted_at'),
    badges: jsonb('badges').default({}), // { highlighted?, official?, deprecated?, redactionApproved? }
    moderationStatus: varchar('moderation_status', { length: 16 }).default('active'), // active | hidden | removed
    moderationNotes: text('moderation_notes'),
    moderationReason: text('moderation_reason'),
    quality: jsonb('quality'), // { score, decision, trustTier, similarRecentCount, reason, signals, evaluatedAt }
    moderationFlags: jsonb('moderation_flags'), // string[]
    lastReviewedAt: timestamp('last_reviewed_at'),
    scanLastCheckedAt: timestamp('scan_last_checked_at'),
    scanCheckCount: integer('scan_check_count').default(0),
    hiddenAt: timestamp('hidden_at'),
    hiddenBy: uuid('hidden_by'),
    reportCount: integer('report_count').default(0),
    lastReportedAt: timestamp('last_reported_at'),
    batch: text('batch'),
    // Denormalized stats for fast sorting
    statsDownloads: integer('stats_downloads').default(0).notNull(),
    statsStars: integer('stats_stars').default(0).notNull(),
    statsInstallsCurrent: integer('stats_installs_current').default(0),
    statsInstallsAllTime: integer('stats_installs_all_time').default(0),
    statsVersions: integer('stats_versions').default(0).notNull(),
    statsComments: integer('stats_comments').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('skills_slug_idx').on(t.slug),
    index('skills_owner_idx').on(t.ownerUserId),
    index('skills_updated_idx').on(t.updatedAt),
    index('skills_downloads_idx').on(t.statsDownloads, t.updatedAt),
    index('skills_stars_idx').on(t.statsStars, t.updatedAt),
    index('skills_active_updated_idx').on(t.softDeletedAt, t.updatedAt),
    index('skills_active_created_idx').on(t.softDeletedAt, t.createdAt),
    index('skills_canonical_idx').on(t.canonicalSkillId),
    index('skills_batch_idx').on(t.batch),
  ],
)

// ─── Skill Versions ─────────────────────────────────────────────────────────
export const skillVersions = pgTable(
  'skill_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 64 }).notNull(),
    fingerprint: text('fingerprint'),
    changelog: text('changelog').notNull(),
    changelogSource: varchar('changelog_source', { length: 8 }), // auto | user
    files: jsonb('files').notNull(), // Array<{ path, size, storageKey, sha256, contentType? }>
    parsed: jsonb('parsed').notNull(), // { frontmatter, metadata?, clawdis?, moltbot? }
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    sha256hash: text('sha256hash'),
    vtAnalysis: jsonb('vt_analysis'), // { status, verdict?, analysis?, source?, checkedAt }
    llmAnalysis: jsonb('llm_analysis'), // { status, verdict?, confidence?, summary?, dimensions?, ... }
    softDeletedAt: timestamp('soft_deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('sv_skill_idx').on(t.skillId),
    uniqueIndex('sv_skill_version_idx').on(t.skillId, t.version),
    index('sv_sha256_idx').on(t.sha256hash),
  ],
)

// ─── Personas ──────────────────────────────────────────────────────────────────
export const personas = pgTable(
  'personas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 128 }).notNull(),
    displayName: text('display_name').notNull(),
    summary: text('summary'),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    latestVersionId: uuid('latest_version_id'),
    tags: jsonb('tags').default({}).notNull(),
    softDeletedAt: timestamp('soft_deleted_at'),
    statsDownloads: integer('stats_downloads').default(0).notNull(),
    statsStars: integer('stats_stars').default(0).notNull(),
    statsVersions: integer('stats_versions').default(0).notNull(),
    statsComments: integer('stats_comments').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('personas_slug_idx').on(t.slug),
    index('personas_owner_idx').on(t.ownerUserId),
    index('personas_updated_idx').on(t.updatedAt),
  ],
)

// ─── Persona Versions ──────────────────────────────────────────────────────────
export const personaVersions = pgTable(
  'persona_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personaId: uuid('persona_id')
      .notNull()
      .references(() => personas.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 64 }).notNull(),
    fingerprint: text('fingerprint'),
    changelog: text('changelog').notNull(),
    changelogSource: varchar('changelog_source', { length: 8 }),
    files: jsonb('files').notNull(),
    parsed: jsonb('parsed').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    softDeletedAt: timestamp('soft_deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('souv_persona_idx').on(t.personaId),
    uniqueIndex('souv_persona_version_idx').on(t.personaId, t.version),
  ],
)

// ─── Skill Embeddings (pgvector) ────────────────────────────────────────────
export const skillEmbeddings = pgTable(
  'skill_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => skillVersions.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    isLatest: boolean('is_latest').default(false).notNull(),
    isApproved: boolean('is_approved').default(false).notNull(),
    visibility: varchar('visibility', { length: 32 }).default('latest').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('se_skill_idx').on(t.skillId),
    index('se_version_idx').on(t.versionId),
  ],
)

// ─── Persona Embeddings (pgvector) ─────────────────────────────────────────────
export const personaEmbeddings = pgTable(
  'persona_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personaId: uuid('persona_id')
      .notNull()
      .references(() => personas.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => personaVersions.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    isLatest: boolean('is_latest').default(false).notNull(),
    isApproved: boolean('is_approved').default(false).notNull(),
    visibility: varchar('visibility', { length: 32 }).default('latest').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('soue_persona_idx').on(t.personaId),
    index('soue_version_idx').on(t.versionId),
  ],
)

// ─── Skill Version Fingerprints ─────────────────────────────────────────────
export const skillVersionFingerprints = pgTable(
  'skill_version_fingerprints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => skillVersions.id, { onDelete: 'cascade' }),
    fingerprint: text('fingerprint').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('svf_version_idx').on(t.versionId),
    index('svf_fingerprint_idx').on(t.fingerprint),
    index('svf_skill_fingerprint_idx').on(t.skillId, t.fingerprint),
  ],
)

// ─── Persona Version Fingerprints ──────────────────────────────────────────────
export const personaVersionFingerprints = pgTable(
  'persona_version_fingerprints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personaId: uuid('persona_id')
      .notNull()
      .references(() => personas.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => personaVersions.id, { onDelete: 'cascade' }),
    fingerprint: text('fingerprint').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('souvf_version_idx').on(t.versionId),
    index('souvf_fingerprint_idx').on(t.fingerprint),
    index('souvf_persona_fingerprint_idx').on(t.personaId, t.fingerprint),
  ],
)

// ─── Skill Badges ───────────────────────────────────────────────────────────
export const skillBadges = pgTable(
  'skill_badges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 }).notNull(), // highlighted | official | deprecated | redactionApproved
    byUserId: uuid('by_user_id')
      .notNull()
      .references(() => users.id),
    at: timestamp('at').notNull(),
  },
  (t) => [
    index('sb_skill_idx').on(t.skillId),
    index('sb_skill_kind_idx').on(t.skillId, t.kind),
    index('sb_kind_at_idx').on(t.kind, t.at),
  ],
)

// ─── Comments ───────────────────────────────────────────────────────────────
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    softDeletedAt: timestamp('soft_deleted_at'),
    deletedBy: uuid('deleted_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('comments_skill_idx').on(t.skillId), index('comments_user_idx').on(t.userId)],
)

// ─── Persona Comments ──────────────────────────────────────────────────────────
export const personaComments = pgTable(
  'persona_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personaId: uuid('persona_id')
      .notNull()
      .references(() => personas.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    softDeletedAt: timestamp('soft_deleted_at'),
    deletedBy: uuid('deleted_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('persona_comments_persona_idx').on(t.personaId),
    index('persona_comments_user_idx').on(t.userId),
  ],
)

// ─── Stars ──────────────────────────────────────────────────────────────────
export const stars = pgTable(
  'stars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('stars_skill_idx').on(t.skillId),
    index('stars_user_idx').on(t.userId),
    uniqueIndex('stars_skill_user_idx').on(t.skillId, t.userId),
  ],
)

// ─── Persona Stars ─────────────────────────────────────────────────────────────
export const personaStars = pgTable(
  'persona_stars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personaId: uuid('persona_id')
      .notNull()
      .references(() => personas.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('persona_stars_persona_idx').on(t.personaId),
    index('persona_stars_user_idx').on(t.userId),
    uniqueIndex('persona_stars_persona_user_idx').on(t.personaId, t.userId),
  ],
)

// ─── Skill Reports ──────────────────────────────────────────────────────────
export const skillReports = pgTable(
  'skill_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    reason: text('reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('sr_skill_idx').on(t.skillId),
    index('sr_user_idx').on(t.userId),
    uniqueIndex('sr_skill_user_idx').on(t.skillId, t.userId),
  ],
)

// ─── Skill Daily Stats ─────────────────────────────────────────────────────
export const skillDailyStats = pgTable(
  'skill_daily_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    day: integer('day').notNull(), // YYYYMMDD
    downloads: integer('downloads').default(0).notNull(),
    installs: integer('installs').default(0).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('sds_skill_day_idx').on(t.skillId, t.day),
    index('sds_day_idx').on(t.day),
  ],
)

// ─── Skill Leaderboards ─────────────────────────────────────────────────────
export const skillLeaderboards = pgTable(
  'skill_leaderboards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: varchar('kind', { length: 32 }).notNull(),
    generatedAt: timestamp('generated_at').notNull(),
    rangeStartDay: integer('range_start_day').notNull(),
    rangeEndDay: integer('range_end_day').notNull(),
    items: jsonb('items').notNull(), // Array<{ skillId, score, installs, downloads }>
  },
  (t) => [index('sl_kind_generated_idx').on(t.kind, t.generatedAt)],
)

// ─── Skill Stat Events ──────────────────────────────────────────────────────
export const skillStatEvents = pgTable(
  'skill_stat_events',
  {
    id: serial('id').primaryKey(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 }).notNull(), // download | star | unstar | comment | install_* etc.
    delta: jsonb('delta'), // { allTime, current }
    occurredAt: timestamp('occurred_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (t) => [
    index('sse_unprocessed_idx').on(t.processedAt),
    index('sse_skill_idx').on(t.skillId),
  ],
)

// ─── Skill Stat Update Cursors ──────────────────────────────────────────────
export const skillStatUpdateCursors = pgTable(
  'skill_stat_update_cursors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 64 }).notNull(),
    cursorCreationTime: timestamp('cursor_creation_time'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('ssuc_key_idx').on(t.key)],
)

// ─── Skill Stat Backfill State ──────────────────────────────────────────────
export const skillStatBackfillState = pgTable(
  'skill_stat_backfill_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 64 }).notNull(),
    cursor: text('cursor'),
    doneAt: timestamp('done_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('ssbs_key_idx').on(t.key)],
)

// ─── Audit Logs ─────────────────────────────────────────────────────────────
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: text('target_id').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('al_actor_idx').on(t.actorUserId),
    index('al_target_idx').on(t.targetType, t.targetId),
  ],
)

// ─── VT Scan Logs ───────────────────────────────────────────────────────────
export const vtScanLogs = pgTable(
  'vt_scan_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 32 }).notNull(), // daily_rescan | backfill | pending_poll
    total: integer('total').notNull(),
    updated: integer('updated').notNull(),
    unchanged: integer('unchanged').notNull(),
    errors: integer('errors').notNull(),
    flaggedSkills: jsonb('flagged_skills'), // Array<{ slug, status }>
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('vsl_type_date_idx').on(t.type, t.createdAt)],
)

// ─── API Tokens ─────────────────────────────────────────────────────────────
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    prefix: varchar('prefix', { length: 16 }).notNull(),
    tokenHash: text('token_hash').notNull(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('at_user_idx').on(t.userId),
    uniqueIndex('at_hash_idx').on(t.tokenHash),
  ],
)

// ─── Rate Limits ────────────────────────────────────────────────────────────
export const rateLimits = pgTable(
  'rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 128 }).notNull(),
    windowStart: timestamp('window_start').notNull(),
    count: integer('count').default(0).notNull(),
    limit: integer('rate_limit').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('rl_key_window_idx').on(t.key, t.windowStart),
    index('rl_key_idx').on(t.key),
  ],
)

// ─── Download Dedupes ───────────────────────────────────────────────────────
export const downloadDedupes = pgTable(
  'download_dedupes',
  {
    id: serial('id').primaryKey(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    identityHash: text('identity_hash').notNull(),
    hourStart: timestamp('hour_start').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('dd_skill_identity_hour_idx').on(t.skillId, t.identityHash, t.hourStart),
    index('dd_hour_idx').on(t.hourStart),
  ],
)

// ─── Reserved Slugs ─────────────────────────────────────────────────────────
export const reservedSlugs = pgTable(
  'reserved_slugs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 128 }).notNull(),
    originalOwnerUserId: uuid('original_owner_user_id')
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp('deleted_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    reason: text('reason'),
    releasedAt: timestamp('released_at'),
  },
  (t) => [
    index('rs_slug_idx').on(t.slug),
    index('rs_owner_idx').on(t.originalOwnerUserId),
    index('rs_expiry_idx').on(t.expiresAt),
  ],
)

// ─── GitHub Backup Sync State ───────────────────────────────────────────────
export const githubBackupSyncState = pgTable(
  'github_backup_sync_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 64 }).notNull(),
    cursor: text('cursor'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('gbss_key_idx').on(t.key)],
)

// ─── User Sync Roots ────────────────────────────────────────────────────────
export const userSyncRoots = pgTable(
  'user_sync_roots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rootId: text('root_id').notNull(),
    label: text('label').notNull(),
    firstSeenAt: timestamp('first_seen_at').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull(),
    expiredAt: timestamp('expired_at'),
  },
  (t) => [
    index('usr_user_idx').on(t.userId),
    uniqueIndex('usr_user_root_idx').on(t.userId, t.rootId),
  ],
)

// ─── User Skill Installs ────────────────────────────────────────────────────
export const userSkillInstalls = pgTable(
  'user_skill_installs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    firstSeenAt: timestamp('first_seen_at').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull(),
    activeRoots: integer('active_roots').default(0).notNull(),
    lastVersion: varchar('last_version', { length: 64 }),
  },
  (t) => [
    index('usi_user_idx').on(t.userId),
    uniqueIndex('usi_user_skill_idx').on(t.userId, t.skillId),
    index('usi_skill_idx').on(t.skillId),
  ],
)

// ─── User Skill Root Installs ───────────────────────────────────────────────
export const userSkillRootInstalls = pgTable(
  'user_skill_root_installs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rootId: text('root_id').notNull(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    firstSeenAt: timestamp('first_seen_at').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull(),
    lastVersion: varchar('last_version', { length: 64 }),
    removedAt: timestamp('removed_at'),
  },
  (t) => [
    index('usri_user_idx').on(t.userId),
    index('usri_user_root_idx').on(t.userId, t.rootId),
    uniqueIndex('usri_user_root_skill_idx').on(t.userId, t.rootId, t.skillId),
    index('usri_user_skill_idx').on(t.userId, t.skillId),
    index('usri_skill_idx').on(t.skillId),
  ],
)
