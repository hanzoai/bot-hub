/// <reference path="../pb_data/types.d.ts" />

// Bot Hub collections migration — maps the Drizzle schema to Base collections.
// Run: ./base serve --migrationsDir ./hz_migrations

migrate((app) => {
  // ─── Users (auth collection) ───────────────────────────────────────────────
  const users = new Collection({
    id: "hub_users",
    name: "users",
    type: "auth",
    system: false,
    fields: [
      { name: "handle",              type: "text",   options: { maxSize: 64 } },
      { name: "displayName",         type: "text",   options: { maxSize: 256 } },
      { name: "bio",                 type: "text",   options: { maxSize: 2000 } },
      { name: "role",                type: "select",  options: { values: ["user","moderator","admin"], maxSelect: 1 } },
      { name: "image",               type: "url" },
      { name: "githubId",            type: "text",   options: { maxSize: 64 } },
      { name: "githubCreatedAt",     type: "date" },
      { name: "githubFetchedAt",     type: "date" },
      { name: "githubProfileSyncedAt", type: "date" },
      { name: "trustedPublisher",    type: "bool" },
      { name: "deactivatedAt",       type: "date" },
      { name: "purgedAt",            type: "date" },
      { name: "deletedAt",           type: "date" },
      { name: "banReason",           type: "text" },
      { name: "phone",               type: "text",   options: { maxSize: 32 } },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_users_handle ON users (handle) WHERE handle != ''",
      "CREATE UNIQUE INDEX idx_users_github ON users (githubId) WHERE githubId != ''",
    ],
    authRule: "",
    manageRule: '@request.auth.role = "admin"',
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: 'id = @request.auth.id || @request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
    passwordAuth: { enabled: true, identityFields: ["email"] },
    oauth2: { enabled: true },
  })
  app.save(users)

  // ─── Skills ────────────────────────────────────────────────────────────────
  const skills = new Collection({
    id: "hub_skills",
    name: "skills",
    type: "base",
    fields: [
      { name: "slug",              type: "text",     options: { maxSize: 128 } },
      { name: "displayName",       type: "text",     options: { maxSize: 256 } },
      { name: "summary",           type: "text",     options: { maxSize: 4000 } },
      { name: "resourceId",        type: "text" },
      { name: "ownerUserId",       type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "canonicalSkillId",  type: "text" },
      { name: "forkOf",            type: "json" },
      { name: "latestVersionId",   type: "text" },
      { name: "tags",              type: "json" },
      { name: "softDeletedAt",     type: "date" },
      { name: "badges",            type: "json" },
      { name: "moderationStatus",  type: "select",   options: { values: ["active","hidden","removed"], maxSelect: 1 } },
      { name: "moderationNotes",   type: "text" },
      { name: "moderationReason",  type: "text" },
      { name: "quality",           type: "json" },
      { name: "moderationFlags",   type: "json" },
      { name: "lastReviewedAt",    type: "date" },
      { name: "scanLastCheckedAt", type: "date" },
      { name: "scanCheckCount",    type: "number",   options: { min: 0 } },
      { name: "hiddenAt",          type: "date" },
      { name: "hiddenBy",          type: "text" },
      { name: "reportCount",       type: "number",   options: { min: 0 } },
      { name: "lastReportedAt",    type: "date" },
      { name: "batch",             type: "text" },
      { name: "statsDownloads",    type: "number",   options: { min: 0 } },
      { name: "statsStars",        type: "number",   options: { min: 0 } },
      { name: "statsInstallsCurrent", type: "number", options: { min: 0 } },
      { name: "statsInstallsAllTime", type: "number", options: { min: 0 } },
      { name: "statsVersions",     type: "number",   options: { min: 0 } },
      { name: "statsComments",     type: "number",   options: { min: 0 } },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_skills_slug ON skills (slug)",
      "CREATE INDEX idx_skills_owner ON skills (ownerUserId)",
      "CREATE INDEX idx_skills_updated ON skills (updated)",
      "CREATE INDEX idx_skills_downloads ON skills (statsDownloads, updated)",
      "CREATE INDEX idx_skills_stars ON skills (statsStars, updated)",
      "CREATE INDEX idx_skills_batch ON skills (batch)",
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != ""',
    updateRule: 'ownerUserId = @request.auth.id || @request.auth.role = "admin"',
    deleteRule: 'ownerUserId = @request.auth.id || @request.auth.role = "admin"',
  })
  app.save(skills)

  // ─── Skill Versions ────────────────────────────────────────────────────────
  const skillVersions = new Collection({
    id: "hub_skill_versions",
    name: "skill_versions",
    type: "base",
    fields: [
      { name: "skillId",         type: "relation",  options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "version",         type: "text",      options: { maxSize: 64 } },
      { name: "fingerprint",     type: "text" },
      { name: "changelog",       type: "text" },
      { name: "changelogSource", type: "select",    options: { values: ["auto","user"], maxSelect: 1 } },
      { name: "files",           type: "json" },
      { name: "parsed",          type: "json" },
      { name: "createdBy",       type: "relation",  options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "sha256hash",      type: "text" },
      { name: "vtAnalysis",      type: "json" },
      { name: "llmAnalysis",     type: "json" },
      { name: "softDeletedAt",   type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_sv_skill ON skill_versions (skillId)",
      "CREATE UNIQUE INDEX idx_sv_skill_version ON skill_versions (skillId, version)",
      "CREATE INDEX idx_sv_sha256 ON skill_versions (sha256hash)",
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  })
  app.save(skillVersions)

  // ─── Personas ──────────────────────────────────────────────────────────────
  const personas = new Collection({
    id: "hub_personas",
    name: "personas",
    type: "base",
    fields: [
      { name: "slug",            type: "text",     options: { maxSize: 128 } },
      { name: "displayName",     type: "text",     options: { maxSize: 256 } },
      { name: "summary",         type: "text",     options: { maxSize: 4000 } },
      { name: "ownerUserId",     type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "latestVersionId", type: "text" },
      { name: "tags",            type: "json" },
      { name: "softDeletedAt",   type: "date" },
      { name: "statsDownloads",  type: "number",   options: { min: 0 } },
      { name: "statsStars",      type: "number",   options: { min: 0 } },
      { name: "statsVersions",   type: "number",   options: { min: 0 } },
      { name: "statsComments",   type: "number",   options: { min: 0 } },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_personas_slug ON personas (slug)",
      "CREATE INDEX idx_personas_owner ON personas (ownerUserId)",
      "CREATE INDEX idx_personas_updated ON personas (updated)",
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != ""',
    updateRule: 'ownerUserId = @request.auth.id || @request.auth.role = "admin"',
    deleteRule: 'ownerUserId = @request.auth.id || @request.auth.role = "admin"',
  })
  app.save(personas)

  // ─── Persona Versions ──────────────────────────────────────────────────────
  const personaVersions = new Collection({
    id: "hub_persona_versions",
    name: "persona_versions",
    type: "base",
    fields: [
      { name: "personaId",      type: "relation",  options: { collectionId: "hub_personas", maxSelect: 1, cascadeDelete: true } },
      { name: "version",        type: "text",      options: { maxSize: 64 } },
      { name: "fingerprint",    type: "text" },
      { name: "changelog",      type: "text" },
      { name: "changelogSource", type: "select",   options: { values: ["auto","user"], maxSelect: 1 } },
      { name: "files",          type: "json" },
      { name: "parsed",         type: "json" },
      { name: "createdBy",      type: "relation",  options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "softDeletedAt",  type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_pv_persona ON persona_versions (personaId)",
      "CREATE UNIQUE INDEX idx_pv_persona_version ON persona_versions (personaId, version)",
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  })
  app.save(personaVersions)

  // ─── Comments ──────────────────────────────────────────────────────────────
  const comments = new Collection({
    id: "hub_comments",
    name: "comments",
    type: "base",
    fields: [
      { name: "skillId",       type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "userId",        type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "body",          type: "text" },
      { name: "softDeletedAt", type: "date" },
      { name: "deletedBy",     type: "text" },
    ],
    indexes: [
      "CREATE INDEX idx_comments_skill ON comments (skillId)",
      "CREATE INDEX idx_comments_user ON comments (userId)",
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != ""',
    updateRule: 'userId = @request.auth.id || @request.auth.role = "admin"',
    deleteRule: 'userId = @request.auth.id || @request.auth.role = "admin"',
  })
  app.save(comments)

  // ─── Persona Comments ─────────────────────────────────────────────────────
  const personaComments = new Collection({
    id: "hub_persona_comments",
    name: "persona_comments",
    type: "base",
    fields: [
      { name: "personaId",     type: "relation", options: { collectionId: "hub_personas", maxSelect: 1, cascadeDelete: true } },
      { name: "userId",        type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "body",          type: "text" },
      { name: "softDeletedAt", type: "date" },
      { name: "deletedBy",     type: "text" },
    ],
    indexes: [
      "CREATE INDEX idx_pc_persona ON persona_comments (personaId)",
      "CREATE INDEX idx_pc_user ON persona_comments (userId)",
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != ""',
    updateRule: 'userId = @request.auth.id || @request.auth.role = "admin"',
    deleteRule: 'userId = @request.auth.id || @request.auth.role = "admin"',
  })
  app.save(personaComments)

  // ─── Stars ─────────────────────────────────────────────────────────────────
  const stars = new Collection({
    id: "hub_stars",
    name: "stars",
    type: "base",
    fields: [
      { name: "skillId", type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "userId",  type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
    ],
    indexes: [
      "CREATE INDEX idx_stars_skill ON stars (skillId)",
      "CREATE INDEX idx_stars_user ON stars (userId)",
      "CREATE UNIQUE INDEX idx_stars_skill_user ON stars (skillId, userId)",
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != ""',
    updateRule: null,
    deleteRule: 'userId = @request.auth.id',
  })
  app.save(stars)

  // ─── Persona Stars ────────────────────────────────────────────────────────
  const personaStars = new Collection({
    id: "hub_persona_stars",
    name: "persona_stars",
    type: "base",
    fields: [
      { name: "personaId", type: "relation", options: { collectionId: "hub_personas", maxSelect: 1, cascadeDelete: true } },
      { name: "userId",    type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
    ],
    indexes: [
      "CREATE INDEX idx_ps_persona ON persona_stars (personaId)",
      "CREATE INDEX idx_ps_user ON persona_stars (userId)",
      "CREATE UNIQUE INDEX idx_ps_persona_user ON persona_stars (personaId, userId)",
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != ""',
    updateRule: null,
    deleteRule: 'userId = @request.auth.id',
  })
  app.save(personaStars)

  // ─── Skill Reports ────────────────────────────────────────────────────────
  const skillReports = new Collection({
    id: "hub_skill_reports",
    name: "skill_reports",
    type: "base",
    fields: [
      { name: "skillId", type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "userId",  type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "reason",  type: "text" },
    ],
    indexes: [
      "CREATE INDEX idx_sr_skill ON skill_reports (skillId)",
      "CREATE UNIQUE INDEX idx_sr_skill_user ON skill_reports (skillId, userId)",
    ],
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin"',
    createRule: '@request.auth.id != ""',
    updateRule: null,
    deleteRule: '@request.auth.role = "admin"',
  })
  app.save(skillReports)

  // ─── Skill Embeddings ─────────────────────────────────────────────────────
  const skillEmbeddings = new Collection({
    id: "hub_skill_embeddings",
    name: "skill_embeddings",
    type: "base",
    fields: [
      { name: "skillId",    type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "versionId",  type: "relation", options: { collectionId: "hub_skill_versions", maxSelect: 1, cascadeDelete: true } },
      { name: "ownerId",    type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "embedding",  type: "json" },
      { name: "isLatest",   type: "bool" },
      { name: "isApproved", type: "bool" },
      { name: "visibility",  type: "select", options: { values: ["latest","latest-approved","all"], maxSelect: 1 } },
    ],
    indexes: [
      "CREATE INDEX idx_se_skill ON skill_embeddings (skillId)",
      "CREATE INDEX idx_se_version ON skill_embeddings (versionId)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(skillEmbeddings)

  // ─── Persona Embeddings ───────────────────────────────────────────────────
  const personaEmbeddings = new Collection({
    id: "hub_persona_embeddings",
    name: "persona_embeddings",
    type: "base",
    fields: [
      { name: "personaId",  type: "relation", options: { collectionId: "hub_personas", maxSelect: 1, cascadeDelete: true } },
      { name: "versionId",  type: "relation", options: { collectionId: "hub_persona_versions", maxSelect: 1, cascadeDelete: true } },
      { name: "ownerId",    type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "embedding",  type: "json" },
      { name: "isLatest",   type: "bool" },
      { name: "isApproved", type: "bool" },
      { name: "visibility",  type: "select", options: { values: ["latest","latest-approved","all"], maxSelect: 1 } },
    ],
    indexes: [
      "CREATE INDEX idx_pe_persona ON persona_embeddings (personaId)",
      "CREATE INDEX idx_pe_version ON persona_embeddings (versionId)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(personaEmbeddings)

  // ─── Skill Badges ─────────────────────────────────────────────────────────
  const skillBadges = new Collection({
    id: "hub_skill_badges",
    name: "skill_badges",
    type: "base",
    fields: [
      { name: "skillId",   type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "kind",      type: "select",   options: { values: ["highlighted","official","deprecated","redactionApproved"], maxSelect: 1 } },
      { name: "byUserId",  type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "at",        type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_sb_skill ON skill_badges (skillId)",
      "CREATE INDEX idx_sb_skill_kind ON skill_badges (skillId, kind)",
    ],
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  })
  app.save(skillBadges)

  // ─── API Tokens ───────────────────────────────────────────────────────────
  const apiTokens = new Collection({
    id: "hub_api_tokens",
    name: "api_tokens",
    type: "base",
    fields: [
      { name: "userId",     type: "relation", options: { collectionId: "hub_users", maxSelect: 1, cascadeDelete: true } },
      { name: "label",      type: "text" },
      { name: "prefix",     type: "text",     options: { maxSize: 16 } },
      { name: "tokenHash",  type: "text" },
      { name: "lastUsedAt", type: "date" },
      { name: "revokedAt",  type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_at_user ON api_tokens (userId)",
      "CREATE UNIQUE INDEX idx_at_hash ON api_tokens (tokenHash)",
    ],
    listRule: 'userId = @request.auth.id',
    viewRule: 'userId = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: 'userId = @request.auth.id',
    deleteRule: 'userId = @request.auth.id',
  })
  app.save(apiTokens)

  // ─── Skill Daily Stats ────────────────────────────────────────────────────
  const skillDailyStats = new Collection({
    id: "hub_skill_daily_stats",
    name: "skill_daily_stats",
    type: "base",
    fields: [
      { name: "skillId",   type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "day",       type: "number" },
      { name: "downloads", type: "number", options: { min: 0 } },
      { name: "installs",  type: "number", options: { min: 0 } },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_sds_skill_day ON skill_daily_stats (skillId, day)",
      "CREATE INDEX idx_sds_day ON skill_daily_stats (day)",
    ],
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(skillDailyStats)

  // ─── Skill Leaderboards ───────────────────────────────────────────────────
  const skillLeaderboards = new Collection({
    id: "hub_skill_leaderboards",
    name: "skill_leaderboards",
    type: "base",
    fields: [
      { name: "kind",          type: "text",   options: { maxSize: 32 } },
      { name: "generatedAt",   type: "date" },
      { name: "rangeStartDay", type: "number" },
      { name: "rangeEndDay",   type: "number" },
      { name: "items",         type: "json" },
    ],
    indexes: [
      "CREATE INDEX idx_sl_kind ON skill_leaderboards (kind, generatedAt)",
    ],
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(skillLeaderboards)

  // ─── Skill Stat Events ────────────────────────────────────────────────────
  const skillStatEvents = new Collection({
    id: "hub_skill_stat_events",
    name: "skill_stat_events",
    type: "base",
    fields: [
      { name: "skillId",     type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "kind",        type: "text",     options: { maxSize: 32 } },
      { name: "delta",       type: "json" },
      { name: "occurredAt",  type: "date" },
      { name: "processedAt", type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_sse_unprocessed ON skill_stat_events (processedAt)",
      "CREATE INDEX idx_sse_skill ON skill_stat_events (skillId)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(skillStatEvents)

  // ─── Audit Logs ───────────────────────────────────────────────────────────
  const auditLogs = new Collection({
    id: "hub_audit_logs",
    name: "audit_logs",
    type: "base",
    fields: [
      { name: "actorUserId", type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "action",      type: "text",     options: { maxSize: 64 } },
      { name: "targetType",  type: "text",     options: { maxSize: 32 } },
      { name: "targetId",    type: "text" },
      { name: "metadata",    type: "json" },
    ],
    indexes: [
      "CREATE INDEX idx_al_actor ON audit_logs (actorUserId)",
      "CREATE INDEX idx_al_target ON audit_logs (targetType, targetId)",
    ],
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin"',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(auditLogs)

  // ─── VT Scan Logs ────────────────────────────────────────────────────────
  const vtScanLogs = new Collection({
    id: "hub_vt_scan_logs",
    name: "vt_scan_logs",
    type: "base",
    fields: [
      { name: "scanType",      type: "select", options: { values: ["daily_rescan","backfill","pending_poll"], maxSelect: 1 } },
      { name: "total",         type: "number" },
      { name: "scanUpdated",   type: "number" },
      { name: "unchanged",     type: "number" },
      { name: "errors",        type: "number" },
      { name: "flaggedSkills", type: "json" },
      { name: "durationMs",    type: "number" },
    ],
    indexes: [
      "CREATE INDEX idx_vsl_type ON vt_scan_logs (scanType, created)",
    ],
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin"',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(vtScanLogs)

  // ─── Download Dedupes ─────────────────────────────────────────────────────
  const downloadDedupes = new Collection({
    id: "hub_download_dedupes",
    name: "download_dedupes",
    type: "base",
    fields: [
      { name: "skillId",      type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "identityHash", type: "text" },
      { name: "hourStart",    type: "date" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_dd_skill_hash_hour ON download_dedupes (skillId, identityHash, hourStart)",
      "CREATE INDEX idx_dd_hour ON download_dedupes (hourStart)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(downloadDedupes)

  // ─── Reserved Slugs ───────────────────────────────────────────────────────
  const reservedSlugs = new Collection({
    id: "hub_reserved_slugs",
    name: "reserved_slugs",
    type: "base",
    fields: [
      { name: "slug",                type: "text",     options: { maxSize: 128 } },
      { name: "originalOwnerUserId", type: "relation", options: { collectionId: "hub_users", maxSelect: 1 } },
      { name: "deletedAt",           type: "date" },
      { name: "expiresAt",           type: "date" },
      { name: "reason",              type: "text" },
      { name: "releasedAt",          type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_rs_slug ON reserved_slugs (slug)",
      "CREATE INDEX idx_rs_expiry ON reserved_slugs (expiresAt)",
    ],
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin"',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(reservedSlugs)

  // ─── Skill Version Fingerprints ───────────────────────────────────────────
  const skillVersionFingerprints = new Collection({
    id: "hub_svf",
    name: "skill_version_fingerprints",
    type: "base",
    fields: [
      { name: "skillId",     type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "versionId",   type: "relation", options: { collectionId: "hub_skill_versions", maxSelect: 1, cascadeDelete: true } },
      { name: "fingerprint", type: "text" },
    ],
    indexes: [
      "CREATE INDEX idx_svf_version ON skill_version_fingerprints (versionId)",
      "CREATE INDEX idx_svf_fp ON skill_version_fingerprints (fingerprint)",
      "CREATE INDEX idx_svf_skill_fp ON skill_version_fingerprints (skillId, fingerprint)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(skillVersionFingerprints)

  // ─── Persona Version Fingerprints ─────────────────────────────────────────
  const personaVersionFingerprints = new Collection({
    id: "hub_pvf",
    name: "persona_version_fingerprints",
    type: "base",
    fields: [
      { name: "personaId",   type: "relation", options: { collectionId: "hub_personas", maxSelect: 1, cascadeDelete: true } },
      { name: "versionId",   type: "relation", options: { collectionId: "hub_persona_versions", maxSelect: 1, cascadeDelete: true } },
      { name: "fingerprint", type: "text" },
    ],
    indexes: [
      "CREATE INDEX idx_pvf_version ON persona_version_fingerprints (versionId)",
      "CREATE INDEX idx_pvf_fp ON persona_version_fingerprints (fingerprint)",
      "CREATE INDEX idx_pvf_persona_fp ON persona_version_fingerprints (personaId, fingerprint)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(personaVersionFingerprints)

  // ─── User Sync Roots ──────────────────────────────────────────────────────
  const userSyncRoots = new Collection({
    id: "hub_user_sync_roots",
    name: "user_sync_roots",
    type: "base",
    fields: [
      { name: "userId",      type: "relation", options: { collectionId: "hub_users", maxSelect: 1, cascadeDelete: true } },
      { name: "rootId",      type: "text" },
      { name: "label",       type: "text" },
      { name: "firstSeenAt", type: "date" },
      { name: "lastSeenAt",  type: "date" },
      { name: "expiredAt",   type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_usr_user ON user_sync_roots (userId)",
      "CREATE UNIQUE INDEX idx_usr_user_root ON user_sync_roots (userId, rootId)",
    ],
    listRule: 'userId = @request.auth.id',
    viewRule: 'userId = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: 'userId = @request.auth.id',
    deleteRule: 'userId = @request.auth.id',
  })
  app.save(userSyncRoots)

  // ─── User Skill Installs ──────────────────────────────────────────────────
  const userSkillInstalls = new Collection({
    id: "hub_user_skill_installs",
    name: "user_skill_installs",
    type: "base",
    fields: [
      { name: "userId",      type: "relation", options: { collectionId: "hub_users", maxSelect: 1, cascadeDelete: true } },
      { name: "skillId",     type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "firstSeenAt", type: "date" },
      { name: "lastSeenAt",  type: "date" },
      { name: "activeRoots", type: "number",   options: { min: 0 } },
      { name: "lastVersion", type: "text",     options: { maxSize: 64 } },
    ],
    indexes: [
      "CREATE INDEX idx_usi_user ON user_skill_installs (userId)",
      "CREATE UNIQUE INDEX idx_usi_user_skill ON user_skill_installs (userId, skillId)",
      "CREATE INDEX idx_usi_skill ON user_skill_installs (skillId)",
    ],
    listRule: 'userId = @request.auth.id',
    viewRule: 'userId = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: 'userId = @request.auth.id',
    deleteRule: 'userId = @request.auth.id',
  })
  app.save(userSkillInstalls)

  // ─── User Skill Root Installs ─────────────────────────────────────────────
  const userSkillRootInstalls = new Collection({
    id: "hub_usri",
    name: "user_skill_root_installs",
    type: "base",
    fields: [
      { name: "userId",      type: "relation", options: { collectionId: "hub_users", maxSelect: 1, cascadeDelete: true } },
      { name: "rootId",      type: "text" },
      { name: "skillId",     type: "relation", options: { collectionId: "hub_skills", maxSelect: 1, cascadeDelete: true } },
      { name: "firstSeenAt", type: "date" },
      { name: "lastSeenAt",  type: "date" },
      { name: "lastVersion", type: "text",     options: { maxSize: 64 } },
      { name: "removedAt",   type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_usri_user ON user_skill_root_installs (userId)",
      "CREATE UNIQUE INDEX idx_usri_user_root_skill ON user_skill_root_installs (userId, rootId, skillId)",
      "CREATE INDEX idx_usri_skill ON user_skill_root_installs (skillId)",
    ],
    listRule: 'userId = @request.auth.id',
    viewRule: 'userId = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: 'userId = @request.auth.id',
    deleteRule: 'userId = @request.auth.id',
  })
  app.save(userSkillRootInstalls)

  // ─── GitHub Backup Sync State ─────────────────────────────────────────────
  const githubBackupSyncState = new Collection({
    id: "hub_github_sync",
    name: "github_backup_sync_state",
    type: "base",
    fields: [
      { name: "key",    type: "text", options: { maxSize: 64 } },
      { name: "cursor", type: "text" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_gbss_key ON github_backup_sync_state (key)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(githubBackupSyncState)

  // ─── Skill Stat Cursors ───────────────────────────────────────────────────
  const skillStatCursors = new Collection({
    id: "hub_stat_cursors",
    name: "skill_stat_update_cursors",
    type: "base",
    fields: [
      { name: "key",                 type: "text", options: { maxSize: 64 } },
      { name: "cursorCreationTime",  type: "date" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_ssuc_key ON skill_stat_update_cursors (key)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(skillStatCursors)

  // ─── Skill Stat Backfill State ────────────────────────────────────────────
  const skillStatBackfill = new Collection({
    id: "hub_stat_backfill",
    name: "skill_stat_backfill_state",
    type: "base",
    fields: [
      { name: "key",    type: "text",  options: { maxSize: 64 } },
      { name: "cursor", type: "text" },
      { name: "doneAt", type: "date" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_ssbs_key ON skill_stat_backfill_state (key)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(skillStatBackfill)

}, (app) => {
  // DOWN migration — delete all hub collections in reverse order
  const names = [
    "skill_stat_backfill_state", "skill_stat_update_cursors",
    "github_backup_sync_state", "user_skill_root_installs",
    "user_skill_installs", "user_sync_roots",
    "persona_version_fingerprints", "skill_version_fingerprints",
    "reserved_slugs", "download_dedupes", "vt_scan_logs",
    "audit_logs", "skill_stat_events", "skill_leaderboards",
    "skill_daily_stats", "api_tokens", "skill_badges",
    "persona_embeddings", "skill_embeddings",
    "persona_stars", "stars", "persona_comments", "comments",
    "skill_reports", "persona_versions", "personas",
    "skill_versions", "skills", "users",
  ]
  for (const name of names) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch {}
  }
})
