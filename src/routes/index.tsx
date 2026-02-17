import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { skillsApi, searchApi, type Skill } from '../lib/api'
import { InstallSwitcher } from '../components/InstallSwitcher'
import { SkillCard } from '../components/SkillCard'
import { SkillStatsTripletLine } from '../components/SkillStats'
import { SoulCard } from '../components/SoulCard'
import { SoulStatsTripletLine } from '../components/SoulStats'
import { UserBadge } from '../components/UserBadge'
import { getSkillBadges } from '../lib/badges'
import type { PublicSoul } from '../lib/publicUser'
import { getSiteMode } from '../lib/site'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const mode = getSiteMode()
  return mode === 'souls' ? <OnlyCrabsHome /> : <SkillsHome />
}

function SkillsHome() {
  const [highlighted, setHighlighted] = useState<Skill[]>([])
  const [popular, setPopular] = useState<Skill[]>([])

  useEffect(() => {
    skillsApi
      .list({ sort: 'stars', limit: 6 })
      .then((r) => setHighlighted(r.items))
      .catch(() => {})
    skillsApi
      .list({ sort: 'downloads', limit: 12 })
      .then((r) => setPopular(r.items))
      .catch(() => {})
  }, [])

  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy fade-up" data-delay="1">
            <span className="hero-badge">Lobster-light. Agent-right.</span>
            <h1 className="hero-title">Bot Hub, the skill dock for sharp agents.</h1>
            <p className="hero-subtitle">
              Upload AgentSkills bundles, version them like npm, and make them searchable with
              vectors. No gatekeeping, just signal.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
                Publish a skill
              </Link>
              <Link
                to="/skills"
                search={{
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  highlighted: undefined,
                  nonSuspicious: true,
                  view: undefined,
                  focus: undefined,
                }}
                className="btn"
              >
                Browse skills
              </Link>
            </div>
          </div>
          <div className="hero-card hero-search-card fade-up" data-delay="2">
            <div className="hero-install" style={{ marginTop: 18 }}>
              <div className="stat">Search skills. Versioned, rollback-ready.</div>
              <InstallSwitcher exampleSlug="sonoscli" />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Highlighted skills</h2>
        <p className="section-subtitle">Curated signal — highlighted for quick trust.</p>
        <div className="grid">
          {highlighted.length === 0 ? (
            <div className="card">No highlighted skills yet.</div>
          ) : (
            highlighted.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={{ ...skill, _id: skill.id, stats: { downloads: skill.statsDownloads, stars: skill.statsStars, versions: skill.statsVersions, comments: skill.statsComments } } as any}
                badge={getSkillBadges({ badges: skill.badges as any })}
                summaryFallback="A fresh skill bundle."
                meta={
                  <div className="skill-card-footer-rows">
                    <UserBadge
                      user={null}
                      fallbackHandle={skill.ownerHandle ?? null}
                      prefix="by"
                      link={false}
                    />
                    <div className="stat">
                      <SkillStatsTripletLine stats={{ downloads: skill.statsDownloads, stars: skill.statsStars, versions: skill.statsVersions, comments: skill.statsComments }} />
                    </div>
                  </div>
                }
              />
            ))
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Popular skills</h2>
        <p className="section-subtitle">Most-downloaded, non-suspicious picks.</p>
        <div className="grid">
          {popular.length === 0 ? (
            <div className="card">No skills yet. Be the first.</div>
          ) : (
            popular.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={{ ...skill, _id: skill.id, stats: { downloads: skill.statsDownloads, stars: skill.statsStars, versions: skill.statsVersions, comments: skill.statsComments } } as any}
                summaryFallback="Agent-ready skill pack."
                meta={
                  <div className="skill-card-footer-rows">
                    <UserBadge
                      user={null}
                      fallbackHandle={skill.ownerHandle ?? null}
                      prefix="by"
                      link={false}
                    />
                    <div className="stat">
                      <SkillStatsTripletLine stats={{ downloads: skill.statsDownloads, stars: skill.statsStars, versions: skill.statsVersions, comments: skill.statsComments }} />
                    </div>
                  </div>
                }
              />
            ))
          )}
        </div>
        <div className="section-cta">
          <Link
            to="/skills"
            search={{
              q: undefined,
              sort: undefined,
              dir: undefined,
              highlighted: undefined,
              nonSuspicious: true,
              view: undefined,
              focus: undefined,
            }}
            className="btn"
          >
            See all skills
          </Link>
        </div>
      </section>
    </main>
  )
}

function OnlyCrabsHome() {
  const navigate = Route.useNavigate()
  const [latest, setLatest] = useState<PublicSoul[]>([])
  const [query, setQuery] = useState('')
  const trimmedQuery = useMemo(() => query.trim(), [query])

  useEffect(() => {
    searchApi
      .souls('', 12)
      .then((r) => setLatest(r.items as unknown as PublicSoul[]))
      .catch(() => {})
  }, [])

  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy fade-up" data-delay="1">
            <span className="hero-badge">SOUL.md, shared.</span>
            <h1 className="hero-title">SoulHub, where system lore lives.</h1>
            <p className="hero-subtitle">
              Share SOUL.md bundles, version them like docs, and keep personal system lore in one
              public place.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
                Publish a soul
              </Link>
              <Link
                to="/souls"
                search={{
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  view: undefined,
                  focus: undefined,
                }}
                className="btn"
              >
                Browse souls
              </Link>
            </div>
          </div>
          <div className="hero-card hero-search-card fade-up" data-delay="2">
            <form
              className="search-bar"
              onSubmit={(event) => {
                event.preventDefault()
                void navigate({
                  to: '/souls',
                  search: {
                    q: trimmedQuery || undefined,
                    sort: undefined,
                    dir: undefined,
                    view: undefined,
                    focus: undefined,
                  },
                })
              }}
            >
              <span className="mono">/</span>
              <input
                className="search-input"
                placeholder="Search souls, prompts, or lore"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
            <div className="hero-install" style={{ marginTop: 18 }}>
              <div className="stat">Search souls. Versioned, readable, easy to remix.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Latest souls</h2>
        <p className="section-subtitle">Newest SOUL.md bundles across the hub.</p>
        <div className="grid">
          {latest.length === 0 ? (
            <div className="card">No souls yet. Be the first.</div>
          ) : (
            latest.map((soul) => (
              <SoulCard
                key={soul._id}
                soul={soul}
                summaryFallback="A SOUL.md bundle."
                meta={
                  <div className="stat">
                    <SoulStatsTripletLine stats={soul.stats} />
                  </div>
                }
              />
            ))
          )}
        </div>
        <div className="section-cta">
          <Link
            to="/souls"
            search={{
              q: undefined,
              sort: undefined,
              dir: undefined,
              view: undefined,
              focus: undefined,
            }}
            className="btn"
          >
            See all souls
          </Link>
        </div>
      </section>
    </main>
  )
}
