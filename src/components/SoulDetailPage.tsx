import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { soulsApi } from '../lib/api'
import type { Doc } from '../lib/types'
import { SoulStatsTripletLine } from './SoulStats'
import type { PublicSoul, PublicUser } from '../lib/publicUser'
import { isModerator } from '../lib/roles'
import { useAuthStatus } from '../lib/useAuthStatus'
import { stripFrontmatter } from './skillDetailUtils'

type SoulDetailPageProps = {
  slug: string
}

type SoulBySlugResult = {
  soul: PublicSoul
  latestVersion: Doc<'soulVersions'> | null
  owner: PublicUser | null
} | null

export function SoulDetailPage({ slug }: SoulDetailPageProps) {
  const { isAuthenticated, me } = useAuthStatus()

  const [result, setResult] = useState<SoulBySlugResult | undefined>(undefined)
  const [versions, setVersions] = useState<Doc<'soulVersions'>[] | undefined>(undefined)
  const [isStarred, setIsStarred] = useState<boolean | undefined>(undefined)
  const [comments, setComments] = useState<Array<{ comment: any; user: PublicUser | null }> | undefined>(undefined)
  const [readme, setReadme] = useState<string | null>(null)
  const [readmeError, setReadmeError] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  // Fetch soul detail
  useEffect(() => {
    setResult(undefined)
    soulsApi
      .getDetail(slug)
      .then((data: any) => setResult(data as SoulBySlugResult))
      .catch(() => setResult(null))
  }, [slug])

  const isLoadingSoul = result === undefined
  const soul = result?.soul
  const owner = result?.owner
  const latestVersion = result?.latestVersion

  // Fetch versions
  useEffect(() => {
    if (!soul) return
    soulsApi
      .versions(slug, 50)
      .then((r) => setVersions(r.items as any))
      .catch(() => {})
  }, [soul, slug])

  // Fetch star status
  useEffect(() => {
    if (!isAuthenticated || !soul) return
    soulsApi
      .isStarred(slug)
      .then((r) => setIsStarred(r.starred))
      .catch(() => setIsStarred(false))
  }, [isAuthenticated, soul, slug])

  // Fetch comments
  useEffect(() => {
    if (!soul) return
    soulsApi
      .comments(slug)
      .then((r) =>
        setComments(
          r.items.map((item: any) => ({
            comment: { _id: item.id ?? item._id, body: item.body, userId: item.userId, createdAt: item.createdAt },
            user: item.user ?? { handle: item.userHandle, name: item.userDisplayName, _id: item.userId },
          })),
        ),
      )
      .catch(() => setComments([]))
  }, [soul, slug])

  const readmeContent = useMemo(() => {
    if (!readme) return null
    return stripFrontmatter(readme)
  }, [readme])

  // Fetch readme
  useEffect(() => {
    if (!latestVersion) return
    setReadme(null)
    setReadmeError(null)
    let cancelled = false
    void soulsApi
      .getReadme(slug, latestVersion._id)
      .then((data) => {
        if (cancelled) return
        setReadme(data.text)
      })
      .catch((error) => {
        if (cancelled) return
        setReadmeError(error instanceof Error ? error.message : 'Failed to load SOUL.md')
        setReadme(null)
      })
    return () => {
      cancelled = true
    }
  }, [latestVersion, slug])

  if (isLoadingSoul) {
    return (
      <main className="section">
        <div className="card">
          <div className="loading-indicator">Loading soul…</div>
        </div>
      </main>
    )
  }

  if (result === null || !soul) {
    return (
      <main className="section">
        <div className="card">Soul not found.</div>
      </main>
    )
  }

  const ownerHandle = owner?.handle ?? owner?.name ?? null
  const apiBase = import.meta.env.VITE_API_URL ?? '/api'
  const downloadBase = `${apiBase}/v1/souls/${soul.slug}/file`

  return (
    <main className="section">
      <div className="skill-detail-stack">
        <div className="card skill-hero">
          <div className="skill-hero-header">
            <div className="skill-hero-title">
              <h1 className="section-title" style={{ margin: 0 }}>
                {soul.displayName}
              </h1>
              <p className="section-subtitle">{soul.summary ?? 'No summary provided.'}</p>
              <div className="stat">
                <SoulStatsTripletLine stats={soul.stats} versionSuffix="versions" />
              </div>
              {ownerHandle ? (
                <div className="stat">
                  by <a href={`/u/${ownerHandle}`}>@{ownerHandle}</a>
                </div>
              ) : null}
              <div className="skill-actions">
                {isAuthenticated ? (
                  <button
                    className={`star-toggle${isStarred ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => void soulsApi.toggleStar(slug).then((r) => setIsStarred(r.starred))}
                    aria-label={isStarred ? 'Unstar soul' : 'Star soul'}
                  >
                    <span aria-hidden="true">★</span>
                  </button>
                ) : null}
              </div>
            </div>
            <div className="skill-hero-cta">
              <div className="skill-version-pill">
                <span className="skill-version-label">Current version</span>
                <strong>v{latestVersion?.version ?? '—'}</strong>
              </div>
              <a
                className="btn btn-primary"
                href={`${downloadBase}?path=SOUL.md`}
                aria-label="Download SOUL.md"
              >
                Download SOUL.md
              </a>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="skill-readme markdown">
            {readmeContent ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{readmeContent}</ReactMarkdown>
            ) : readmeError ? (
              <div className="stat">Failed to load SOUL.md: {readmeError}</div>
            ) : (
              <div className="loading-indicator">Loading SOUL.md…</div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title" style={{ fontSize: '1.2rem', marginBottom: 8 }}>
            Versions
          </h2>
          <div className="version-scroll">
            <div className="version-list">
              {(versions ?? []).map((version) => (
                <div key={version._id} className="version-row">
                  <div className="version-info">
                    <div>
                      v{version.version} · {new Date(version.createdAt).toLocaleDateString()}
                      {version.changelogSource === 'auto' ? (
                        <span style={{ color: 'var(--ink-soft)' }}> · auto</span>
                      ) : null}
                    </div>
                    <div style={{ color: '#5c554e', whiteSpace: 'pre-wrap' }}>
                      {version.changelog}
                    </div>
                  </div>
                  <div className="version-actions">
                    <a
                      className="btn version-zip"
                      href={`${downloadBase}?path=SOUL.md&version=${encodeURIComponent(
                        version.version,
                      )}`}
                    >
                      SOUL.md
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
            Comments
          </h2>
          {isAuthenticated ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!comment.trim()) return
                void soulsApi.addComment(slug, comment.trim()).then(() => {
                  setComment('')
                  // Refresh comments
                  soulsApi.comments(slug).then((r) =>
                    setComments(
                      r.items.map((item: any) => ({
                        comment: { _id: item.id ?? item._id, body: item.body, userId: item.userId, createdAt: item.createdAt },
                        user: item.user ?? { handle: item.userHandle, name: item.userDisplayName, _id: item.userId },
                      })),
                    ),
                  )
                })
              }}
              className="comment-form"
            >
              <textarea
                className="comment-input"
                rows={4}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Leave a note…"
              />
              <button className="btn comment-submit" type="submit">
                Post comment
              </button>
            </form>
          ) : (
            <p className="section-subtitle">Sign in to comment.</p>
          )}
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {(comments ?? []).length === 0 ? (
              <div className="stat">No comments yet.</div>
            ) : (
              (comments ?? []).map((entry) => (
                <div key={entry.comment._id} className="comment-item">
                  <div className="comment-body">
                    <strong>@{entry.user?.handle ?? entry.user?.name ?? 'user'}</strong>
                    <div className="comment-body-text">{entry.comment.body}</div>
                  </div>
                  {isAuthenticated && me && (me._id === entry.comment.userId || isModerator(me)) ? (
                    <button
                      className="btn comment-delete"
                      type="button"
                      onClick={() => {
                        void soulsApi.deleteComment(slug, entry.comment._id).then(() => {
                          soulsApi.comments(slug).then((r) =>
                            setComments(
                              r.items.map((item: any) => ({
                                comment: { _id: item.id ?? item._id, body: item.body, userId: item.userId, createdAt: item.createdAt },
                                user: item.user ?? { handle: item.userHandle, name: item.userDisplayName, _id: item.userId },
                              })),
                            ),
                          )
                        })
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
