import { Hono } from 'hono'
import { pb, ensureAdminAuth } from '../db/index.js'
import { generateEmbedding } from '../lib/embeddings.js'

export const searchRouter = new Hono()

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

// ─── Search skills (hybrid: vector + lexical) ──────────────────────────────
searchRouter.get('/skills', async (c) => {
  const query = c.req.query('q')?.trim()
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  if (!query) return c.json({ items: [] })

  await ensureAdminAuth()

  // Try vector search
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
    const queryVector = await generateEmbedding(query)

    // Fetch all latest embeddings (dataset is small enough for in-memory cosine)
    const embeddingsResult = await pb.collection('skill_embeddings').getFullList({
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
        const skill = await pb.collection('skills').getOne(s.skillId, {
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

  // Lexical search
  const escapedQuery = query.replace(/"/g, '\\"')
  const lexResult = await pb.collection('skills').getList(1, limit, {
    filter: [
      'softDeletedAt = ""',
      'moderationStatus = "active"',
      `(slug ~ "${escapedQuery}" || displayName ~ "${escapedQuery}" || summary ~ "${escapedQuery}")`,
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
})

// ─── Search personas ───────────────────────────────────────────────────────────
searchRouter.get('/personas', async (c) => {
  const query = c.req.query('q')?.trim()
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)

  if (!query) return c.json({ items: [] })

  await ensureAdminAuth()
  const escapedQuery = query.replace(/"/g, '\\"')

  const result = await pb.collection('personas').getList(1, limit, {
    filter: [
      'softDeletedAt = ""',
      `(slug ~ "${escapedQuery}" || displayName ~ "${escapedQuery}" || summary ~ "${escapedQuery}")`,
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
})
