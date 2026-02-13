import { describe, expect, it, vi } from 'vitest'
import { approveSkillByHashInternal, insertVersion } from './skills'

type WrappedHandler<TArgs> = {
  _handler: (ctx: unknown, args: TArgs) => Promise<unknown>
}

const insertVersionHandler = (insertVersion as unknown as WrappedHandler<Record<string, unknown>>)
  ._handler
const approveSkillByHashHandler = (
  approveSkillByHashInternal as unknown as WrappedHandler<Record<string, unknown>>
)._handler

function createPublishArgs(overrides?: Partial<Record<string, unknown>>) {
  return {
    userId: 'users:owner',
    slug: 'spam-skill',
    displayName: 'Spam Skill',
    version: '1.0.0',
    changelog: 'Initial release',
    changelogSource: 'user',
    tags: ['latest'],
    fingerprint: 'f'.repeat(64),
    files: [
      {
        path: 'SKILL.md',
        size: 128,
        storageId: '_storage:1',
        sha256: 'a'.repeat(64),
        contentType: 'text/markdown',
      },
    ],
    parsed: {
      frontmatter: { description: 'test' },
      metadata: {},
      clawdis: {},
    },
    embedding: [0.1, 0.2],
    ...overrides,
  }
}

describe('skills anti-spam guards', () => {
  it('blocks low-trust users after hourly new-skill cap', async () => {
    const now = Date.now()
    const ownerSkills = Array.from({ length: 5 }, (_, i) => ({
      _id: `skills:${i}`,
      createdAt: now - i * 10_000,
    }))

    const db = {
      get: vi.fn(async () => ({
        _id: 'users:owner',
        _creationTime: now - 2 * 24 * 60 * 60 * 1000,
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
        deletedAt: undefined,
      })),
      query: vi.fn((table: string) => {
        if (table === 'skills') {
          return {
            withIndex: (name: string) => {
              if (name === 'by_slug') {
                return { unique: async () => null }
              }
              if (name === 'by_owner') {
                return {
                  order: () => ({
                    take: async () => ownerSkills,
                  }),
                }
              }
              throw new Error(`unexpected index ${name}`)
            },
          }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    await expect(
      insertVersionHandler({ db } as never, createPublishArgs() as never),
    ).rejects.toThrow(/max 5 new skills per hour/i)
  })

  it('auto-hides suspicious skills from low-trust publishers', async () => {
    const patch = vi.fn(async () => {})
    const version = { _id: 'skillVersions:1', skillId: 'skills:1' }
    const skill = {
      _id: 'skills:1',
      slug: 'spam-skill',
      ownerUserId: 'users:owner',
      moderationFlags: undefined,
      moderationReason: undefined,
    }
    const owner = {
      _id: 'users:owner',
      _creationTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      deletedAt: undefined,
    }

    const db = {
      get: vi.fn(async (id: string) => {
        if (id === 'skills:1') return skill
        if (id === 'users:owner') return owner
        return null
      }),
      query: vi.fn((table: string) => {
        if (table === 'skillVersions') {
          return {
            withIndex: () => ({
              unique: async () => version,
            }),
          }
        }
        if (table === 'skills') {
          return {
            withIndex: (name: string) => {
              if (name === 'by_owner') {
                return {
                  order: () => ({
                    take: async () => [],
                  }),
                }
              }
              throw new Error(`unexpected skills index ${name}`)
            },
          }
        }
        throw new Error(`unexpected table ${table}`)
      }),
      patch,
    }

    await approveSkillByHashHandler(
      { db, scheduler: { runAfter: vi.fn() } } as never,
      {
        sha256hash: 'h'.repeat(64),
        scanner: 'llm',
        status: 'suspicious',
      } as never,
    )

    expect(patch).toHaveBeenCalledWith(
      'skills:1',
      expect.objectContaining({
        moderationStatus: 'hidden',
        moderationReason: 'scanner.llm.suspicious',
      }),
    )
  })
})
