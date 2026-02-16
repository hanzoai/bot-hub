import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./lib/access', async () => {
  const actual = await vi.importActual<typeof import('./lib/access')>('./lib/access')
  return { ...actual, requireUser: vi.fn() }
})

const { requireUser } = await import('./lib/access')
const { ensureHandler, list } = await import('./users')

function makeCtx() {
  const patch = vi.fn()
  const get = vi.fn()
  return { ctx: { db: { patch, get } } as never, patch, get }
}

function makeListCtx(users: Array<Record<string, unknown>>) {
  const take = vi.fn(async (n: number) => users.slice(0, n))
  const collect = vi.fn(async () => users)
  const order = vi.fn(() => ({ take, collect }))
  const query = vi.fn(() => ({ order }))
  return {
    ctx: { db: { query } } as never,
    take,
    collect,
    order,
    query,
  }
}

describe('ensureHandler', () => {
  afterEach(() => {
    vi.mocked(requireUser).mockReset()
  })

  it('updates handle and display name when GitHub login changes', async () => {
    const { ctx, patch } = makeCtx()
    vi.mocked(requireUser).mockResolvedValue({
      userId: 'users:1',
      user: {
        _creationTime: 1,
        handle: 'old-handle',
        displayName: 'old-handle',
        name: 'new-handle',
        email: 'old@example.com',
        role: 'user',
        createdAt: 1,
      },
    } as never)

    await ensureHandler(ctx)

    expect(patch).toHaveBeenCalledWith('users:1', {
      handle: 'new-handle',
      displayName: 'new-handle',
      updatedAt: expect.any(Number),
    })
  })

  it('does not override a custom display name when syncing handle', async () => {
    const { ctx, patch } = makeCtx()
    vi.mocked(requireUser).mockResolvedValue({
      userId: 'users:2',
      user: {
        _creationTime: 1,
        handle: 'old-handle',
        displayName: 'Custom Name',
        name: 'new-handle',
        role: 'user',
        createdAt: 1,
      },
    } as never)

    await ensureHandler(ctx)

    expect(patch).toHaveBeenCalledWith('users:2', {
      handle: 'new-handle',
      updatedAt: expect.any(Number),
    })
  })

  it('fills display name from existing handle when missing', async () => {
    const { ctx, patch } = makeCtx()
    vi.mocked(requireUser).mockResolvedValue({
      userId: 'users:3',
      user: {
        _creationTime: 1,
        handle: 'steady-handle',
        displayName: undefined,
        name: undefined,
        email: undefined,
        role: 'user',
        createdAt: 1,
      },
    } as never)

    await ensureHandler(ctx)

    expect(patch).toHaveBeenCalledWith('users:3', {
      displayName: 'steady-handle',
      updatedAt: expect.any(Number),
    })
  })
})

describe('users.list', () => {
  afterEach(() => {
    vi.mocked(requireUser).mockReset()
  })

  it('uses take(limit) without full collect when search is empty', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      userId: 'users:admin',
      user: { _id: 'users:admin', role: 'admin' },
    } as never)
    const users = [
      { _id: 'users:1', _creationTime: 3, handle: 'alice', role: 'user' },
      { _id: 'users:2', _creationTime: 2, handle: 'bob', role: 'user' },
      { _id: 'users:3', _creationTime: 1, handle: 'carol', role: 'user' },
    ]
    const { ctx, take, collect } = makeListCtx(users)
    const listHandler = (list as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })
      ._handler

    const result = (await listHandler(ctx, { limit: 2 })) as {
      items: Array<Record<string, unknown>>
      total: number
    }

    expect(take).toHaveBeenCalledWith(2)
    expect(collect).not.toHaveBeenCalled()
    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)
  })

  it('uses bounded scan for search instead of full collect', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      userId: 'users:admin',
      user: { _id: 'users:admin', role: 'admin' },
    } as never)
    const users = [
      { _id: 'users:1', _creationTime: 3, handle: 'alice', role: 'user' },
      { _id: 'users:2', _creationTime: 2, handle: 'bob', role: 'user' },
      { _id: 'users:3', _creationTime: 1, handle: 'carol', role: 'user' },
    ]
    const { ctx, take, collect } = makeListCtx(users)
    const listHandler = (list as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })
      ._handler

    const result = (await listHandler(ctx, { limit: 50, search: 'ali' })) as {
      items: Array<Record<string, unknown>>
      total: number
    }

    expect(take).toHaveBeenCalledWith(500)
    expect(collect).not.toHaveBeenCalled()
    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.handle).toBe('alice')
  })

  it('clamps large limit and search scan size', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      userId: 'users:admin',
      user: { _id: 'users:admin', role: 'admin' },
    } as never)
    const users = Array.from({ length: 8_000 }, (_value, index) => ({
      _id: `users:${index}`,
      _creationTime: 10_000 - index,
      handle: `user-${index}`,
      role: 'user',
    }))
    const { ctx, take } = makeListCtx(users)
    const listHandler = (list as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })
      ._handler

    await listHandler(ctx, { limit: 999, search: 'user' })

    expect(take).toHaveBeenCalledWith(2_000)
  })
})
