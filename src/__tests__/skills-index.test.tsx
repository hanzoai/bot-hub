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

describe('SkillsIndex', () => {
  beforeEach(() => {
    listMock.mockReset()
    searchMock.mockReset()
    navigateMock.mockReset()
    searchStateMock = { sort: 'downloads' }
    searchMock.mockResolvedValue({ items: [] })
    listMock.mockResolvedValue({ items: [], hasMore: false, nextCursor: undefined })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('calls skillsApi.list on initial load', async () => {
    render(<SkillsIndex />)
    await act(async () => {})
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'downloads', limit: 25 }),
    )
  })

  it('renders an empty state when no skills are returned', async () => {
    render(<SkillsIndex />)
    await act(async () => {})
    expect(screen.getByText('No skills match that filter.')).toBeTruthy()
  })

  it('shows loading state while fetching', () => {
    listMock.mockReturnValue(new Promise(() => {}))
    render(<SkillsIndex />)
    expect(screen.getByText('Loading skills…')).toBeTruthy()
    expect(screen.queryByText('No skills match that filter.')).toBeNull()
  })

  it('shows empty state when search returns no results', async () => {
    searchStateMock = { q: 'nonexistent-skill-xyz', sort: 'relevance' }
    searchMock.mockResolvedValue({ items: [] })
    vi.useFakeTimers()

    render(<SkillsIndex />)
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(screen.getByText('No skills match that filter.')).toBeTruthy()
    expect(screen.queryByText('Loading skills…')).toBeNull()
  })

  it('calls searchApi.skills when query is set', async () => {
    searchStateMock = { q: 'remind', sort: 'relevance' }
    searchMock.mockResolvedValue({ items: [] })
    vi.useFakeTimers()

    render(<SkillsIndex />)
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(searchMock).toHaveBeenCalledWith('remind', 25)
  })

  it('sorts search results by stars and breaks ties by slug', async () => {
    searchStateMock = { q: 'remind', sort: 'stars', dir: 'desc' }
    searchMock.mockResolvedValue({
      items: [
        makeSearchItem({ slug: 'skill-a', displayName: 'Skill A', statsStars: 5 }),
        makeSearchItem({ slug: 'skill-b', displayName: 'Skill B', statsStars: 5 }),
        makeSearchItem({ slug: 'skill-c', displayName: 'Skill C', statsStars: 4 }),
      ],
    })
    vi.useFakeTimers()

    render(<SkillsIndex />)
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    const links = screen.getAllByRole('link')
    expect(links[0]?.textContent).toContain('Skill B')
    expect(links[1]?.textContent).toContain('Skill A')
    expect(links[2]?.textContent).toContain('Skill C')
  })
})

function makeSearchItem(params: {
  slug: string
  displayName: string
  statsStars?: number
  statsDownloads?: number
}) {
  return {
    id: `skill_${params.slug}`,
    slug: params.slug,
    displayName: params.displayName,
    summary: `${params.displayName} summary`,
    ownerUserId: 'user:1',
    ownerHandle: 'test',
    statsDownloads: params.statsDownloads ?? 0,
    statsStars: params.statsStars ?? 0,
    statsVersions: 1,
    statsComments: 0,
    badges: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    score: 0.9,
  }
}
