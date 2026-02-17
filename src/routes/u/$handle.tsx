import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { skillsApi, telemetryApi, usersApi, type Skill } from '../../lib/api'
import { SkillCard } from '../../components/SkillCard'
import { SkillStatsTripletLine } from '../../components/SkillStats'
import { getSkillBadges } from '../../lib/badges'
import type { PublicSkill, PublicUser } from '../../lib/publicUser'
import { useAuthStatus } from '../../lib/useAuthStatus'

export const Route = createFileRoute('/u/$handle')({
  component: UserProfile,
})

/** Convert flat API Skill to PublicSkill shape expected by SkillCard */
function apiSkillToPublic(s: Skill): PublicSkill {
  return {
    _id: s.id,
    _creationTime: new Date(s.createdAt).getTime(),
    slug: s.slug,
    displayName: s.displayName,
    summary: s.summary,
    ownerUserId: s.ownerUserId,
    canonicalSkillId: null,
    forkOf: null,
    latestVersionId: null,
    tags: {},
    badges: s.badges as any,
    stats: {
      downloads: s.statsDownloads,
      stars: s.statsStars,
      versions: s.statsVersions,
      comments: s.statsComments,
    },
    createdAt: new Date(s.createdAt).getTime(),
    updatedAt: new Date(s.updatedAt).getTime(),
  } as any
}

function UserProfile() {
  const { handle } = Route.useParams()
  const { me } = useAuthStatus()

  const [user, setUser] = useState<PublicUser | null | undefined>(undefined)
  const [publishedSkills, setPublishedSkills] = useState<PublicSkill[] | undefined>(undefined)
  const [starredSkills, setStarredSkills] = useState<PublicSkill[] | undefined>(undefined)
  const [tab, setTab] = useState<'stars' | 'installed'>('stars')
  const [includeRemoved, setIncludeRemoved] = useState(false)
  const [installed, setInstalled] = useState<TelemetryResponse | null | undefined>(undefined)

  const isSelf = Boolean(me && user && me._id === (user as any)._id)

  // Fetch user profile
  useEffect(() => {
    setUser(undefined)
    usersApi
      .get(handle)
      .then((data) =>
        setUser({
          _id: data.id,
          _creationTime: new Date(data.createdAt).getTime(),
          handle: data.handle,
          name: data.displayName,
          displayName: data.displayName,
          image: data.image,
          bio: data.bio,
        } as PublicUser),
      )
      .catch(() => setUser(null))
  }, [handle])

  // Fetch published skills
  useEffect(() => {
    if (user === undefined || user === null) return
    usersApi
      .skills(handle)
      .then((r) => setPublishedSkills(r.items.map(apiSkillToPublic)))
      .catch(() => setPublishedSkills([]))
  }, [user, handle])

  // Fetch starred skills
  useEffect(() => {
    if (user === undefined || user === null) return
    usersApi
      .starredSkills(handle, 50)
      .then((r) => setStarredSkills(r.items.map(apiSkillToPublic)))
      .catch(() => setStarredSkills([]))
  }, [user, handle])

  // Fetch installed telemetry (self only)
  useEffect(() => {
    if (!isSelf || tab !== 'installed') return
    setInstalled(undefined)
    telemetryApi
      .getMyInstalled(includeRemoved)
      .then((data: any) => setInstalled(data as TelemetryResponse))
      .catch(() => setInstalled(null))
  }, [isSelf, tab, includeRemoved])

  useEffect(() => {
    if (!isSelf && tab === 'installed') setTab('stars')
  }, [isSelf, tab])

  if (user === undefined) {
    return (
      <main className="section">
        <div className="card">
          <div className="loading-indicator">Loading user…</div>
        </div>
      </main>
    )
  }

  if (user === null) {
    return (
      <main className="section">
        <div className="card">User not found.</div>
      </main>
    )
  }

  const avatar = user.image
  const displayName = user.displayName ?? user.name ?? user.handle ?? 'User'
  const displayHandle = user.handle ?? user.name ?? handle
  const initial = displayName.charAt(0).toUpperCase()
  const isLoadingSkills = starredSkills === undefined
  const skills = starredSkills ?? []
  const isLoadingPublished = publishedSkills === undefined
  const published = publishedSkills ?? []

  return (
    <main className="section">
      <div className="card settings-profile" style={{ marginBottom: 22 }}>
        <div className="settings-avatar" aria-hidden="true">
          {avatar ? <img src={avatar} alt="" /> : <span>{initial}</span>}
        </div>
        <div className="settings-profile-body">
          <div className="settings-name">{displayName}</div>
          <div className="settings-handle">@{displayHandle}</div>
        </div>
      </div>

      {isSelf ? (
        <div className="profile-tabs" role="tablist" aria-label="Profile tabs">
          <button
            className={tab === 'stars' ? 'profile-tab is-active' : 'profile-tab'}
            type="button"
            role="tab"
            aria-selected={tab === 'stars'}
            onClick={() => setTab('stars')}
          >
            Stars
          </button>
          <button
            className={tab === 'installed' ? 'profile-tab is-active' : 'profile-tab'}
            type="button"
            role="tab"
            aria-selected={tab === 'installed'}
            onClick={() => setTab('installed')}
          >
            Installed
          </button>
        </div>
      ) : null}

      {tab === 'installed' && isSelf ? (
        <InstalledSection
          includeRemoved={includeRemoved}
          onToggleRemoved={() => setIncludeRemoved((value) => !value)}
          data={installed}
        />
      ) : (
        <>
          <h2 className="section-title" style={{ fontSize: '1.3rem' }}>
            Published
          </h2>
          <p className="section-subtitle">Skills published by this user.</p>

          {isLoadingPublished ? (
            <div className="card">
              <div className="loading-indicator">Loading published skills…</div>
            </div>
          ) : published.length > 0 ? (
            <div className="grid" style={{ marginBottom: 18 }}>
              {published.map((skill) => (
                <SkillCard
                  key={skill._id}
                  skill={skill}
                  badge={getSkillBadges(skill)}
                  summaryFallback="Agent-ready skill pack."
                  meta={
                    <div className="stat">
                      <SkillStatsTripletLine stats={skill.stats} />
                    </div>
                  }
                />
              ))}
            </div>
          ) : null}

          <h2 className="section-title" style={{ fontSize: '1.3rem' }}>
            Stars
          </h2>
          <p className="section-subtitle">Skills this user has starred.</p>

          {isLoadingSkills ? (
            <div className="card">
              <div className="loading-indicator">Loading stars…</div>
            </div>
          ) : skills.length === 0 ? (
            <div className="card">No stars yet.</div>
          ) : (
            <div className="grid">
              {skills.map((skill) => (
                <SkillCard
                  key={skill._id}
                  skill={skill}
                  badge={getSkillBadges(skill)}
                  summaryFallback="Agent-ready skill pack."
                  meta={
                    <div className="stat">
                      <SkillStatsTripletLine stats={skill.stats} />
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}

function InstalledSection(props: {
  includeRemoved: boolean
  onToggleRemoved: () => void
  data: TelemetryResponse | null | undefined
}) {
  const [showRaw, setShowRaw] = useState(false)
  const data = props.data
  if (data === undefined) {
    return (
      <>
        <h2 className="section-title" style={{ fontSize: '1.3rem' }}>
          Installed
        </h2>
        <div className="card">
          <div className="loading-indicator">Loading telemetry…</div>
        </div>
      </>
    )
  }

  if (data === null) {
    return (
      <>
        <h2 className="section-title" style={{ fontSize: '1.3rem' }}>
          Installed
        </h2>
        <div className="card">Sign in to view your installed skills.</div>
      </>
    )
  }

  return (
    <>
      <h2 className="section-title" style={{ fontSize: '1.3rem' }}>
        Installed
      </h2>
      <p className="section-subtitle" style={{ maxWidth: 760 }}>
        Private view. Only you can see your folders/roots. Everyone else only sees aggregated
        install counts per skill.
      </p>
      <div className="profile-actions">
        <button className="btn" type="button" onClick={props.onToggleRemoved}>
          {props.includeRemoved ? 'Hide removed' : 'Show removed'}
        </button>
        <button className="btn" type="button" onClick={() => setShowRaw((value) => !value)}>
          {showRaw ? 'Hide JSON' : 'Show JSON'}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            if (!window.confirm('Delete all telemetry data?')) return
            void telemetryApi.clearMyTelemetry()
          }}
        >
          Delete telemetry
        </button>
      </div>

      {showRaw ? (
        <div className="card telemetry-json" style={{ marginBottom: 18 }}>
          <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      ) : null}

      {data.roots.length === 0 ? (
        <div className="card">No telemetry yet. Run `bothub sync` from the CLI.</div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {data.roots.map((root) => (
            <div key={root.rootId} className="card telemetry-root">
              <div className="telemetry-root-header">
                <div>
                  <div className="telemetry-root-title">{root.label}</div>
                  <div className="telemetry-root-meta">
                    Last sync {new Date(root.lastSeenAt).toLocaleString()}
                    {root.expiredAt ? ' · stale' : ''}
                  </div>
                </div>
                <div className="tag">{root.skills.length} skills</div>
              </div>
              {root.skills.length === 0 ? (
                <div className="stat">No skills found in this root.</div>
              ) : (
                <div className="telemetry-skill-list">
                  {root.skills.map((entry) => (
                    <div key={`${root.rootId}:${entry.skill.slug}`} className="telemetry-skill-row">
                      <a
                        className="telemetry-skill-link"
                        href={`/${encodeURIComponent(String(entry.skill.ownerUserId))}/${entry.skill.slug}`}
                      >
                        <span>{entry.skill.displayName}</span>
                        <span className="telemetry-skill-slug">/{entry.skill.slug}</span>
                      </a>
                      <div className="telemetry-skill-meta mono">
                        {entry.lastVersion ? `v${entry.lastVersion}` : 'v?'}{' '}
                        {entry.removedAt ? '· removed' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

type TelemetryResponse = {
  roots: Array<{
    rootId: string
    label: string
    firstSeenAt: number
    lastSeenAt: number
    expiredAt?: number
    skills: Array<{
      skill: {
        slug: string
        displayName: string
        summary?: string
        stats: unknown
        ownerUserId: string
      }
      firstSeenAt: number
      lastSeenAt: number
      lastVersion?: string
      removedAt?: number
    }>
  }>
  cutoffDays: number
}
