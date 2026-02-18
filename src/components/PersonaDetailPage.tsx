import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { personasApi } from '../lib/api'
import type { Doc } from '../lib/types'
import { PersonaStatsTripletLine } from './PersonaStats'
import type { PublicPersona, PublicUser } from '../lib/publicUser'
import { isModerator } from '../lib/roles'
import { useAuthStatus } from '../lib/useAuthStatus'
import { stripFrontmatter } from './skillDetailUtils'

type PersonaDetailPageProps = {
  slug: string
}

type PersonaBySlugResult = {
  persona: PublicPersona
  latestVersion: Doc<'personaVersions'> | null
  owner: PublicUser | null
} | null

export function PersonaDetailPage({ slug }: PersonaDetailPageProps) {
  const { isAuthenticated, me } = useAuthStatus()

  const [result, setResult] = useState<PersonaBySlugResult | undefined>(undefined)
  const [versions, setVersions] = useState<Doc<'personaVersions'>[] | undefined>(undefined)
  const [isStarred, setIsStarred] = useState<boolean | undefined>(undefined)
  const [comments, setComments] = useState<Array<{ comment: any; user: PublicUser | null }> | undefined>(undefined)
  const [readme, setReadme] = useState<string | null>(null)
  const [readmeError, setReadmeError] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  // Fetch persona detail
  useEffect(() => {
    setResult(undefined)
    personasApi
      .getDetail(slug)
      .then((data: any) => setResult(data as PersonaBySlugResult))
      .catch(() => setResult(null))
  }, [slug])

  const isLoadingPersona = result === undefined
  const persona = result?.persona
  const owner = result?.owner
  const latestVersion = result?.latestVersion

  // Fetch versions
  useEffect(() => {
    if (!persona) return
    personasApi
      .versions(slug, 50)
      .then((r) => setVersions(r.items as any))
      .catch(() => {})
  }, [persona, slug])

  // Fetch star status
  useEffect(() => {
    if (!isAuthenticated || !persona) return
    personasApi
      .isStarred(slug)
      .then((r) => setIsStarred(r.starred))
      .catch(() => setIsStarred(false))
  }, [isAuthenticated, persona, slug])

  // Fetch comments
  useEffect(() => {
    if (!persona) return
    personasApi
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
  }, [persona, slug])

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
    void personasApi
      .getReadme(slug, latestVersion._id)
      .then((data) => {
        if (cancelled) return
        setReadme(data.text)
      })
      .catch((error) => {
        if (cancelled) return
        setReadmeError(error instanceof Error ? error.message : 'Failed to load PERSONA.md')
        setReadme(null)
      })
    return () => {
      cancelled = true
    }
  }, [latestVersion, slug])

  if (isLoadingPersona) {
    return (
      <main className="section">
        <div className="card">
          <div className="loading-indicator">Loading persona…</div>
        </div>
      </main>
    )
  }

  if (result === null || !persona) {
    return (
      <main className="section">
        <div className="card">Persona not found.</div>
      </main>
    )
  }

  const ownerHandle = owner?.handle ?? owner?.name ?? null
  const apiBase = import.meta.env.VITE_API_URL ?? '/api'
  const downloadBase = `${apiBase}/v1/personas/${persona.slug}/file`

  return (
    <main className="section">
      <div className="skill-detail-stack">
        <div className="card skill-hero">
          <div className="skill-hero-header">
            <div className="skill-hero-title">
              <h1 className="section-title" style={{ margin: 0 }}>
                {persona.displayName}
              </h1>
              <p className="section-subtitle">{persona.summary ?? 'No summary provided.'}</p>
              <div className="stat">
                <PersonaStatsTripletLine stats={persona.stats} versionSuffix="versions" />
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
                    onClick={() => void personasApi.toggleStar(slug).then((r) => setIsStarred(r.starred))}
                    aria-label={isStarred ? 'Unstar persona' : 'Star persona'}
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
                href={`${downloadBase}?path=PERSONA.md`}
                aria-label="Download PERSONA.md"
              >
                Download PERSONA.md
              </a>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="skill-readme markdown">
            {readmeContent ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{readmeContent}</ReactMarkdown>
            ) : readmeError ? (
              <div className="stat">Failed to load PERSONA.md: {readmeError}</div>
            ) : (
              <div className="loading-indicator">Loading PERSONA.md…</div>
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
                      href={`${downloadBase}?path=PERSONA.md&version=${encodeURIComponent(
                        version.version,
                      )}`}
                    >
                      PERSONA.md
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
                void personasApi.addComment(slug, comment.trim()).then(() => {
                  setComment('')
                  // Refresh comments
                  personasApi.comments(slug).then((r) =>
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
                        void personasApi.deleteComment(slug, entry.comment._id).then(() => {
                          personasApi.comments(slug).then((r) =>
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
