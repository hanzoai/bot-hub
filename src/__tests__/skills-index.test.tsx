/* @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SkillsIndex } from '../routes/skills/index'

const navigateMock = vi.fn()
const useQueryMock = vi.fn()
const useActionMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (_config: { component: unknown; validateSearch: unknown }) => ({
    useNavigate: () => navigateMock,
    useSearch: () => ({}),
  }),
  Link: (props: { children: unknown }) => <a href="/">{props.children}</a>,
}))

vi.mock('convex/react', () => ({
  useAction: (...args: unknown[]) => useActionMock(...args),
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

describe('SkillsIndex', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    useActionMock.mockReset()
    navigateMock.mockReset()
    useActionMock.mockReturnValue(() => Promise.resolve([]))
    useQueryMock.mockReturnValue({ items: [], nextCursor: null })
  })

  it('requests the first skills page', () => {
    render(<SkillsIndex />)
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), {
      cursor: undefined,
      limit: 50,
    })
  })
})
