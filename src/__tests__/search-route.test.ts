import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { beforeLoad?: unknown }) => ({ __config: config }),
  redirect: (options: unknown) => ({ redirect: options }),
}))

import { Route } from '../routes/search'

describe('search route', () => {
  it('redirects to home with search mode enabled', () => {
    const beforeLoad = Route.__config.beforeLoad as (args: {
      search: { q?: string; highlighted?: boolean }
    }) => void
    let thrown: unknown

    try {
      beforeLoad({ search: { q: 'crab', highlighted: true } })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toEqual({
      redirect: {
        to: '/',
        search: {
          q: 'crab',
          highlighted: true,
          search: true,
        },
        replace: true,
      },
    })
  })

  it('redirects to home with search flag even without query', () => {
    const beforeLoad = Route.__config.beforeLoad as (args: {
      search: { q?: string; highlighted?: boolean }
    }) => void
    let thrown: unknown

    try {
      beforeLoad({ search: {} })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toEqual({
      redirect: {
        to: '/',
        search: {
          q: undefined,
          highlighted: undefined,
          search: true,
        },
        replace: true,
      },
    })
  })
})
