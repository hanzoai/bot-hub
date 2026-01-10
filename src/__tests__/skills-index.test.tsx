/* @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SkillsIndex } from '../routes/skills/index'

const navigateMock = vi.fn()
const useQueryMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (_config: { component: unknown; validateSearch: unknown }) => ({
    useNavigate: () => navigateMock,
    useSearch: () => ({}),
  }),
  Link: (props: { children: unknown }) => <a href="/">{props.children}</a>,
}))

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

describe('SkillsIndex', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    navigateMock.mockReset()
    useQueryMock.mockReturnValue([])
  })

  it('caps listWithLatest query limit', () => {
    render(<SkillsIndex />)
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), { limit: 200 })
  })
})
