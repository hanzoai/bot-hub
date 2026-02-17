/* @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SkillsIndex } from '../routes/skills/index'

const navigateMock = vi.fn()
const listMock = vi.fn()
const searchMock = vi.fn()
let searchStateMock: Record<string, unknown> = {}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (_config: { component: unknown; validateSearch: unknown }) => ({
    useNavigate: () => navigateMock,
    useSearch: () => searchStateMock,
  }),
  redirect: (options: unknown) => ({ redirect: options }),
  Link: (props: { children: ReactNode }) => <a href="/">{props.children}</a>,
}))

vi.mock('../../lib/api', async () => {
  return {
    skillsApi: {
      list: (...args: unknown[]) => listMock(...args),
    },
    searchApi: {
      skills: (...args: unknown[]) => searchMock(...args),
    },
  }
})

describe('SkillsIndex load-more observer', () => {
  beforeEach(() => {
    listMock.mockReset()
    searchMock.mockReset()
    navigateMock.mockReset()
    searchStateMock = { sort: 'downloads' }
    searchMock.mockResolvedValue({ items: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('triggers one additional request for intersection callback', async () => {
    listMock
      .mockResolvedValueOnce({
        items: [makeListItem('skill-0', 'Skill 0')],
        hasMore: true,
        nextCursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        items: [makeListItem('skill-1', 'Skill 1')],
        hasMore: false,
        nextCursor: undefined,
      })

    type ObserverInstance = {
      callback: IntersectionObserverCallback
      observe: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
    }

    const observers: ObserverInstance[] = []
    class IntersectionObserverMock {
      callback: IntersectionObserverCallback
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = '0px'
      thresholds: number[] = []

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
        observers.push(this)
      }
    }
    vi.stubGlobal(
      'IntersectionObserver',
      IntersectionObserverMock as unknown as typeof IntersectionObserver,
    )

    render(<SkillsIndex />)
    await act(async () => {})

    // First call was the initial list fetch
    expect(listMock).toHaveBeenCalledTimes(1)

    // Simulate intersection
    const observer = observers[observers.length - 1]
    if (observer) {
      const entries = [{ isIntersecting: true }] as Array<IntersectionObserverEntry>
      await act(async () => {
        observer.callback(entries, observer as unknown as IntersectionObserver)
      })
    }

    // Second call should be the load-more
    expect(listMock).toHaveBeenCalledTimes(2)
    expect(listMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1' }),
    )
  })
})

function makeListItem(slug: string, displayName: string) {
  return {
    id: `skill_${slug}`,
    slug,
    displayName,
    summary: `${displayName} summary`,
    ownerUserId: 'user:1',
    ownerHandle: 'test',
    statsDownloads: 0,
    statsStars: 0,
    statsVersions: 1,
    statsComments: 0,
    badges: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }
}
