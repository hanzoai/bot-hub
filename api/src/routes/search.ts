import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { skillEmbeddings, skills, personaEmbeddings, personas, users } from '../db/schema.js'
import { generateEmbedding } from '../lib/embeddings.js'

export const searchRouter = new Hono()

// ─── Search skills (hybrid: vector + lexical) ──────────────────────────────
searchRouter.get('/skills', async (c) => {
  const query = c.req.query('q')?.trim()
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  if (!query) return c.json({ items: [] })

  // Try vector search first
  let vectorResults: Array<{
    id: string
    slug: string
    displayName: string
    summary: string | null
    ownerHandle: string | null
    ownerImage: string | null
    statsDownloads: number
    statsStars: number
    score: number
  }> = []

  try {
    const vector = await generateEmbedding(query)

    // pgvector cosine distance search
    const rows = await db.execute(sql`
      SELECT
        s.id,
        s.slug,
        s.display_name as "displayName",
        s.summary,
        u.handle as "ownerHandle",
        u.image as "ownerImage",
        s.stats_downloads as "statsDownloads",
        s.stats_stars as "statsStars",
        1 - (se.embedding <=> ${JSON.stringify(vector)}::vector) as score
      FROM skill_embeddings se
      JOIN skills s ON se.skill_id = s.id
      LEFT JOIN users u ON s.owner_user_id = u.id
      WHERE se.visibility IN ('latest', 'latest-approved')
        AND s.soft_deleted_at IS NULL
        AND s.moderation_status = 'active'
      ORDER BY se.embedding <=> ${JSON.stringify(vector)}::vector
      LIMIT ${limit * 3}
    `)

    vectorResults = rows.rows as typeof vectorResults
  } catch (err) {
    console.warn('Vector search failed, falling back to lexical:', err)
  }

  // Lexical fallback / complement
  const lexicalResults = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      displayName: skills.displayName,
      summary: skills.summary,
      ownerHandle: users.handle,
      ownerImage: users.image,
      statsDownloads: skills.statsDownloads,
      statsStars: skills.statsStars,
    })
    .from(skills)
    .leftJoin(users, eq(skills.ownerUserId, users.id))
    .where(
      and(
        isNull(skills.softDeletedAt),
        eq(skills.moderationStatus, 'active'),
        or(
          ilike(skills.slug, `%${query}%`),
          ilike(skills.displayName, `%${query}%`),
          ilike(skills.summary, `%${query}%`),
        ),
      ),
    )
    .orderBy(desc(skills.statsDownloads))
    .limit(limit)

  // Merge results (vector first, lexical fills gaps)
  const seen = new Set<string>()
  const merged: typeof vectorResults = []

  for (const row of vectorResults) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }

  for (const row of lexicalResults) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push({ ...row, score: 0 })
  }

  return c.json({ items: merged.slice(0, limit) })
})

// ─── Search personas ───────────────────────────────────────────────────────────
searchRouter.get('/personas', async (c) => {
  const query = c.req.query('q')?.trim()
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  if (!query) return c.json({ items: [] })

  const results = await db
    .select({
      id: personas.id,
      slug: personas.slug,
      displayName: personas.displayName,
      summary: personas.summary,
      ownerHandle: users.handle,
      ownerImage: users.image,
      statsDownloads: personas.statsDownloads,
      statsStars: personas.statsStars,
    })
    .from(personas)
    .leftJoin(users, eq(personas.ownerUserId, users.id))
    .where(
      and(
        isNull(personas.softDeletedAt),
        or(
          ilike(personas.slug, `%${query}%`),
          ilike(personas.displayName, `%${query}%`),
          ilike(personas.summary, `%${query}%`),
        ),
      ),
    )
    .orderBy(desc(personas.statsDownloads))
    .limit(limit)

  return c.json({ items: results })
})
