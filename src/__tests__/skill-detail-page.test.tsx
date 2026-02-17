import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { SkillDetailPage } from '../components/SkillDetailPage'

const navigateMock = vi.fn()
const useAuthStatusMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

const getDetailMock = vi.fn()
const versionsMock = vi.fn()
const isStarredMock = vi.fn()
const toggleStarMock = vi.fn()
const reportMock = vi.fn()
const getReadmeMock = vi.fn()
const updateTagsMock = vi.fn()
const getFileTextMock = vi.fn()

vi.mock('../lib/api', () => ({
  skillsApi: {
    getDetail: (...args: unknown[]) => getDetailMock(...args),
    versions: (...args: unknown[]) => versionsMock(...args),
    isStarred: (...args: unknown[]) => isStarredMock(...args),
    toggleStar: (...args: unknown[]) => toggleStarMock(...args),
    report: (...args: unknown[]) => reportMock(...args),
    getReadme: (...args: unknown[]) => getReadmeMock(...args),
    updateTags: (...args: unknown[]) => updateTagsMock(...args),
    getFileText: (...args: unknown[]) => getFileTextMock(...args),
  },
}))

vi.mock('../lib/useAuthStatus', () => ({
  useAuthStatus: () => useAuthStatusMock(),
}))

const skillData = {
  skill: {
    _id: 'skills:1',
    slug: 'weather',
    displayName: 'Weather',
    summary: 'Get current weather.',
    ownerUserId: 'users:1',
    tags: {},
    stats: { stars: 0, downloads: 0 },
  },
  owner: { handle: 'steipete', name: 'Peter' },
  latestVersion: { _id: 'skillVersions:1', version: '1.0.0', parsed: {}, files: [] },
  forkOf: null,
  canonical: null,
  moderationInfo: null,
}

describe('SkillDetailPage', () => {
  beforeEach(() => {
    getDetailMock.mockReset()
    versionsMock.mockReset()
    isStarredMock.mockReset()
    toggleStarMock.mockReset()
    reportMock.mockReset()
    getReadmeMock.mockReset()
    updateTagsMock.mockReset()
    getFileTextMock.mockReset()
    navigateMock.mockReset()
    useAuthStatusMock.mockReset()

    getDetailMock.mockReturnValue(new Promise(() => {})) // never resolves by default
    versionsMock.mockResolvedValue({ items: [] })
    isStarredMock.mockResolvedValue({ starred: false })
    getReadmeMock.mockResolvedValue({ text: '' })

    useAuthStatusMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      me: null,
    })
  })

  it('shows a loading indicator while loading', () => {
    render(<SkillDetailPage slug="weather" />)
    expect(screen.getByText(/Loading skill/i)).toBeTruthy()
    expect(screen.queryByText(/Skill not found/i)).toBeNull()
  })

  it('shows not found when skill query resolves to null', async () => {
    getDetailMock.mockRejectedValue(new Error('not found'))

    render(<SkillDetailPage slug="missing-skill" />)
    expect(await screen.findByText(/Skill not found/i)).toBeTruthy()
  })

  it('redirects legacy routes to canonical owner/slug', async () => {
    getDetailMock.mockResolvedValue(skillData)

    render(<SkillDetailPage slug="weather" redirectToCanonical />)
    expect(screen.getByText(/Loading skill/i)).toBeTruthy()

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled()
    })
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/$owner/$slug',
      params: { owner: 'steipete', slug: 'weather' },
      replace: true,
    })
  })

  it('opens report dialog for authenticated users', async () => {
    useAuthStatusMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1', role: 'user' },
    })
    getDetailMock.mockResolvedValue(skillData)

    render(<SkillDetailPage slug="weather" />)

    expect(screen.queryByText(/Reports require a reason\. Abuse may result in a ban\./i)).toBeNull()

    fireEvent.click(await screen.findByRole('button', { name: /report/i }))

    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/Report skill/i)).toBeTruthy()
  })
})
