/** API client for the Bot Hub backend, replacing Convex hooks */

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

type FetchOptions = {
  method?: string
  body?: unknown
  token?: string | null
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = opts.token ?? getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new ApiError(response.status, (error as { error?: string }).error ?? 'Request failed')
  }

  return response.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Token storage ──────────────────────────────────────────────────────────
const TOKEN_KEY = 'bothub.session.token'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

// ─── Auth API ───────────────────────────────────────────────────────────────
export const authApi = {
  me: () => apiFetch<{
    id: string
    handle: string | null
    displayName: string | null
    email: string | null
    image: string | null
    bio: string | null
    role: string | null
    trustedPublisher: boolean
    createdAt: string
  }>('/auth/me'),

  loginUrl: () => `${API_BASE}/auth/login?redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/callback')}`,

  logout: () => apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
}

// ─── Skills API ─────────────────────────────────────────────────────────────
export type Skill = {
  id: string
  slug: string
  displayName: string
  summary: string | null
  ownerUserId: string
  badges: Record<string, unknown>
  moderationStatus: string
  statsDownloads: number
  statsStars: number
  statsVersions: number
  statsComments: number
  createdAt: string
  updatedAt: string
  ownerHandle: string | null
  ownerImage: string | null
  ownerDisplayName?: string | null
}

export type SkillVersion = {
  id: string
  version: string
  changelog: string
  changelogSource: string | null
  createdBy: string
  sha256hash: string | null
  vtAnalysis: unknown
  llmAnalysis: unknown
  createdAt: string
}

export const skillsApi = {
  list: (params?: { sort?: string; limit?: number; cursor?: string }) => {
    const qs = new URLSearchParams()
    if (params?.sort) qs.set('sort', params.sort)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.cursor) qs.set('cursor', params.cursor)
    return apiFetch<{ items: Skill[]; nextCursor?: string; hasMore: boolean }>(
      `/v1/skills?${qs}`,
    )
  },

  get: (slug: string) => apiFetch<Skill>(`/v1/skills/${slug}`),

  versions: (slug: string, limit = 50) =>
    apiFetch<{ items: SkillVersion[] }>(`/v1/skills/${slug}/versions?limit=${limit}`),

  files: (slug: string, version: string) =>
    apiFetch<{ files: Array<{ path: string; size: number; storageKey: string; sha256: string }> }>(
      `/v1/skills/${slug}/versions/${version}/files`,
    ),

  publish: (slug: string, data: {
    displayName: string
    version: string
    changelog: string
    tags?: string[]
    files: Array<{ path: string; size: number; storageKey: string; sha256: string; contentType?: string }>
  }) => apiFetch<{ skillId: string; versionId: string; version: string }>(
    `/v1/skills/${slug}/publish`,
    { method: 'POST', body: data },
  ),

  delete: (slug: string) =>
    apiFetch<{ ok: boolean }>(`/v1/skills/${slug}`, { method: 'DELETE' }),

  undelete: (slug: string) =>
    apiFetch<{ ok: boolean }>(`/v1/skills/${slug}/undelete`, { method: 'POST' }),

  toggleStar: (slug: string) =>
    apiFetch<{ starred: boolean }>(`/v1/skills/${slug}/stars`, { method: 'POST' }),

  isStarred: (slug: string) =>
    apiFetch<{ starred: boolean }>(`/v1/skills/${slug}/stars/me`),

  comments: (slug: string) =>
    apiFetch<{ items: Array<{
      id: string
      body: string
      userId: string
      createdAt: string
      userHandle: string | null
      userImage: string | null
      userDisplayName: string | null
    }> }>(`/v1/skills/${slug}/comments`),

  addComment: (slug: string, body: string) =>
    apiFetch<{ id: string }>(`/v1/skills/${slug}/comments`, { method: 'POST', body: { body } }),

  deleteComment: (slug: string, commentId: string) =>
    apiFetch<{ ok: boolean }>(`/v1/skills/${slug}/comments/${commentId}`, { method: 'DELETE' }),
}

// ─── Search API ─────────────────────────────────────────────────────────────
export const searchApi = {
  skills: (query: string, limit = 20) =>
    apiFetch<{ items: Array<Skill & { score: number }> }>(
      `/v1/search/skills?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),

  souls: (query: string, limit = 20) =>
    apiFetch<{ items: Array<{ id: string; slug: string; displayName: string; summary: string | null; score?: number }> }>(
      `/v1/search/souls?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),
}

// ─── Users API ──────────────────────────────────────────────────────────────
export const usersApi = {
  get: (handle: string) =>
    apiFetch<{
      id: string
      handle: string
      displayName: string | null
      image: string | null
      bio: string | null
      createdAt: string
    }>(`/v1/users/${handle}`),

  skills: (handle: string) =>
    apiFetch<{ items: Skill[] }>(`/v1/users/${handle}/skills`),

  stars: (handle: string) =>
    apiFetch<{ items: Array<{ skillId: string; skillSlug: string; skillDisplayName: string; starredAt: string }> }>(
      `/v1/users/${handle}/stars`,
    ),

  updateProfile: (data: { displayName?: string; bio?: string; handle?: string }) =>
    apiFetch<{ ok: boolean }>('/v1/users/me', { method: 'PATCH', body: data }),
}

// ─── Upload API ─────────────────────────────────────────────────────────────
export const uploadApi = {
  getUploadUrl: (filename: string, contentType?: string) =>
    apiFetch<{ url: string; storageKey: string }>('/v1/upload/url', {
      method: 'POST',
      body: { filename, contentType },
    }),
}

// ─── Tokens API ─────────────────────────────────────────────────────────────
export const tokensApi = {
  list: () =>
    apiFetch<{ items: Array<{ id: string; label: string; prefix: string; lastUsedAt: string | null; createdAt: string }> }>(
      '/v1/tokens',
    ),

  create: (label: string) =>
    apiFetch<{ id: string; token: string; prefix: string; label: string }>('/v1/tokens', {
      method: 'POST',
      body: { label },
    }),

  revoke: (id: string) =>
    apiFetch<{ ok: boolean }>(`/v1/tokens/${id}`, { method: 'DELETE' }),
}
