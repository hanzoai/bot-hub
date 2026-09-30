import type { Context } from 'hono'
import { base, lit, type Row } from '../db/index.js'
import { embeddingsEnabled, generateEmbedding } from '../lib/embeddings.js'

// ─── Cosine similarity helper ───────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ─── Search skills (hybrid: vector + lexical) — GET /v1/skills/search ───────
export async function searchSkills(c: Context): Promise<Response> {
  const query = c.req.query('q')?.trim()
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  if (!query) return c.json({ items: [] })

  // Vector search, when embeddings are configured
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

  if (embeddingsEnabled()) {
    try {
      const queryVector = await generateEmbedding(query)

      // Fetch all latest embeddings (dataset is small enough for in-memory cosine)
      const embeddingsResult = await base.collection('skill_embeddings').getFullList<Row>({
        filter: 'isLatest = true && (visibility = "latest" || visibility = "latest-approved")',
      })

      // Score each embedding
      const scored = embeddingsResult
        .filter((e) => Array.isArray(e.embedding) && e.embedding.length > 0)
        .map((e) => ({
          skillId: e.skillId,
          score: cosineSimilarity(queryVector, e.embedding as number[]),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit * 3)

      // Fetch skill details
      for (const s of scored) {
        try {
          const skill = await base.collection('skills').getOne<Row>(s.skillId, {
            expand: 'ownerUserId',
          })
          if (skill.softDeletedAt || skill.moderationStatus !== 'active') continue
          const owner = skill.expand?.ownerUserId
          vectorResults.push({
            id: skill.id,
            slug: skill.slug,
            displayName: skill.displayName,
            summary: skill.summary,
            ownerHandle: owner?.handle ?? null,
            ownerImage: owner?.image ?? null,
            statsDownloads: skill.statsDownloads ?? 0,
            statsStars: skill.statsStars ?? 0,
            score: s.score,
          })
        } catch { /* skip missing skills */ }
      }
    } catch (err) {
      console.warn('Vector search failed, falling back to lexical:', err)
    }
  }

  // Lexical search
  const q = lit(query)
  const lexResult = await base.collection('skills').getList<Row>(1, limit, {
    filter: [
      'softDeletedAt = ""',
      'moderationStatus = "active"',
      `(slug ~ ${q} || displayName ~ ${q} || summary ~ ${q})`,
    ].join(' && '),
    sort: '-statsDownloads',
    expand: 'ownerUserId',
  })

  const lexicalResults = lexResult.items.map((s) => {
    const owner = s.expand?.ownerUserId
    return {
      id: s.id,
      slug: s.slug,
      displayName: s.displayName,
      summary: s.summary,
      ownerHandle: owner?.handle ?? null,
      ownerImage: owner?.image ?? null,
      statsDownloads: s.statsDownloads ?? 0,
      statsStars: s.statsStars ?? 0,
      score: 0,
    }
  })

  // Merge (vector first, lexical fills gaps)
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
    merged.push(row)
  }

  return c.json({ items: merged.slice(0, limit) })
}

// ─── Search personas — GET /v1/skills/personas/search ─────────────────────────
export async function searchPersonas(c: Context): Promise<Response> {
  const query = c.req.query('q')?.trim()
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  if (!query) return c.json({ items: [] })

  const q = lit(query)

  const result = await base.collection('personas').getList<Row>(1, limit, {
    filter: [
      'softDeletedAt = ""',
      `(slug ~ ${q} || displayName ~ ${q} || summary ~ ${q})`,
    ].join(' && '),
    sort: '-statsDownloads',
    expand: 'ownerUserId',
  })

  const items = result.items.map((s) => {
    const owner = s.expand?.ownerUserId
    return {
      id: s.id,
      slug: s.slug,
      displayName: s.displayName,
      summary: s.summary,
      ownerHandle: owner?.handle ?? null,
      ownerImage: owner?.image ?? null,
      statsDownloads: s.statsDownloads ?? 0,
      statsStars: s.statsStars ?? 0,
    }
  })

  return c.json({ items })
}
