/* @vitest-environment node */

import { describe, expect, it } from 'vitest'
import { tokenize } from './lib/searchText'
import { __test } from './search'

describe('search helpers', () => {
  it('advances candidate limit until max', () => {
    expect(__test.getNextCandidateLimit(50, 1000)).toBe(100)
    expect(__test.getNextCandidateLimit(800, 1000)).toBe(1000)
    expect(__test.getNextCandidateLimit(1000, 1000)).toBeNull()
  })

  it('boosts exact slug/name matches over loose matches', () => {
    const queryTokens = tokenize('notion')
    const exactScore = __test.scoreSkillResult(queryTokens, 0.4, 'Notion Sync', 'notion-sync', 5)
    const looseScore = __test.scoreSkillResult(queryTokens, 0.6, 'Notes Sync', 'notes-sync', 500)
    expect(exactScore).toBeGreaterThan(looseScore)
  })

  it('adds a popularity prior for equally relevant matches', () => {
    const queryTokens = tokenize('notion')
    const lowDownloads = __test.scoreSkillResult(
      queryTokens,
      0.5,
      'Notion Helper',
      'notion-helper',
      0,
    )
    const highDownloads = __test.scoreSkillResult(
      queryTokens,
      0.5,
      'Notion Helper',
      'notion-helper',
      1000,
    )
    expect(highDownloads).toBeGreaterThan(lowDownloads)
  })

  it('merges fallback matches without duplicate skill ids', () => {
    const primary = [
      {
        embeddingId: 'skillEmbeddings:1',
        skill: { _id: 'skills:1' },
      },
    ] as unknown as Parameters<typeof __test.mergeUniqueBySkillId>[0]
    const fallback = [
      {
        skill: { _id: 'skills:1' },
      },
      {
        skill: { _id: 'skills:2' },
      },
    ] as unknown as Parameters<typeof __test.mergeUniqueBySkillId>[1]

    const merged = __test.mergeUniqueBySkillId(primary, fallback)
    expect(merged).toHaveLength(2)
    expect(merged.map((entry) => entry.skill._id)).toEqual(['skills:1', 'skills:2'])
  })
})
