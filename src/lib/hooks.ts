/**
 * React hooks replacing Convex's useQuery/useMutation/useAction
 * with TanStack Query + REST API calls.
 *
 * Drop-in replacements for the most common Convex patterns.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  authApi,
  clearStoredToken,
  getStoredToken,
  searchApi,
  setStoredToken,
  skillsApi,
  tokensApi,
  uploadApi,
  usersApi,
  type Skill,
  type SkillVersion,
} from './api'

// ─── Auth hooks ─────────────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser] = useState<(Awaited<ReturnType<typeof authApi.me>> & { _id: string; _creationTime: number }) | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for session token in URL (from OAuth callback)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const sessionToken = params.get('session')
      if (sessionToken) {
        setStoredToken(sessionToken)
        // Clean URL
        const url = new URL(window.location.href)
        url.searchParams.delete('session')
        url.searchParams.delete('state')
        window.history.replaceState(null, '', url.toString())
      }
    }

    const token = getStoredToken()
    if (!token) {
      setLoading(false)
      return
    }

    authApi
      .me()
      .then((data) => setUser({ ...data, _id: data.id, _creationTime: new Date(data.createdAt).getTime() }))
      .catch(() => {
        clearStoredToken()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(() => {
    window.location.href = authApi.loginUrl()
  }, [])

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => {})
    clearStoredToken()
    setUser(null)
  }, [])

  return { user, loading, isAuthenticated: !!user, signIn, signOut }
}

// ─── Skills hooks ───────────────────────────────────────────────────────────
export function useSkillsList(params?: { sort?: string; limit?: number }) {
  const [data, setData] = useState<{ items: Skill[]; hasMore: boolean }>({
    items: [],
    hasMore: false,
  })
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState<string | undefined>()

  useEffect(() => {
    setLoading(true)
    skillsApi
      .list({ ...params, cursor })
      .then((result) => {
        if (cursor) {
          setData((prev) => ({
            items: [...prev.items, ...result.items],
            hasMore: result.hasMore,
          }))
        } else {
          setData(result)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [params?.sort, params?.limit, cursor])

  const loadMore = useCallback(() => {
    if (data.items.length > 0) {
      setCursor(data.items[data.items.length - 1].updatedAt)
    }
  }, [data.items])

  return { ...data, loading, loadMore }
}

export function useSkill(slug: string | undefined) {
  const [skill, setSkill] = useState<Skill | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    setLoading(true)
    skillsApi
      .get(slug)
      .then(setSkill)
      .catch(() => setSkill(null))
      .finally(() => setLoading(false))
  }, [slug])

  return { skill, loading }
}

export function useSkillVersions(slug: string | undefined) {
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    setLoading(true)
    skillsApi
      .versions(slug)
      .then((r) => setVersions(r.items))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false))
  }, [slug])

  return { versions, loading }
}

export function useIsStarred(slug: string | undefined) {
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    if (!slug || !getStoredToken()) return
    skillsApi
      .isStarred(slug)
      .then((r) => setStarred(r.starred))
      .catch(() => {})
  }, [slug])

  const toggle = useCallback(async () => {
    if (!slug) return
    const result = await skillsApi.toggleStar(slug)
    setStarred(result.starred)
    return result.starred
  }, [slug])

  return { starred, toggle }
}

export function useSkillComments(slug: string | undefined) {
  const [items, setItems] = useState<
    Array<{
      id: string
      body: string
      userId: string
      createdAt: string
      userHandle: string | null
      userImage: string | null
      userDisplayName: string | null
    }>
  >([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!slug) return
    skillsApi
      .comments(slug)
      .then((r) => setItems(r.items))
      .catch(() => {})
  }, [slug])

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    setLoading(true)
    skillsApi
      .comments(slug)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [slug])

  const addComment = useCallback(
    async (body: string) => {
      if (!slug) return
      await skillsApi.addComment(slug, body)
      refresh()
    },
    [slug, refresh],
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!slug) return
      await skillsApi.deleteComment(slug, commentId)
      refresh()
    },
    [slug, refresh],
  )

  return { items, loading, addComment, deleteComment, refresh }
}

// ─── Search hooks ───────────────────────────────────────────────────────────
export function useSearch(query: string, limit = 20) {
  const [results, setResults] = useState<Array<Skill & { score: number }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    searchApi
      .skills(query, limit)
      .then((r) => setResults(r.items))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [query, limit])

  return { results, loading }
}

// ─── User hooks ─────────────────────────────────────────────────────────────
export function useUser(handle: string | undefined) {
  const [user, setUser] = useState<Awaited<ReturnType<typeof usersApi.get>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!handle) {
      setLoading(false)
      return
    }
    setLoading(true)
    usersApi
      .get(handle)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [handle])

  return { user, loading }
}

// ─── Upload hooks ───────────────────────────────────────────────────────────
export function useUpload() {
  const upload = useCallback(async (file: File) => {
    const { url, storageKey } = await uploadApi.getUploadUrl(file.name, file.type)

    await fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })

    return { storageKey, size: file.size, contentType: file.type }
  }, [])

  return { upload }
}

// ─── Token hooks ────────────────────────────────────────────────────────────
export function useApiTokens() {
  const [tokens, setTokens] = useState<
    Array<{ id: string; label: string; prefix: string; lastUsedAt: string | null; createdAt: string }>
  >([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    tokensApi
      .list()
      .then((r) => setTokens(r.items))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    tokensApi
      .list()
      .then((r) => setTokens(r.items))
      .catch(() => setTokens([]))
      .finally(() => setLoading(false))
  }, [])

  const create = useCallback(
    async (label: string) => {
      const result = await tokensApi.create(label)
      refresh()
      return result
    },
    [refresh],
  )

  const revoke = useCallback(
    async (id: string) => {
      await tokensApi.revoke(id)
      refresh()
    },
    [refresh],
  )

  return { tokens, loading, create, revoke }
}
