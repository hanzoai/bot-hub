import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { skillsApi, usersApi, type Skill } from '../lib/api'
import { formatCompactStat } from '../lib/numberFormat'
import { useAuthStatus } from '../lib/useAuthStatus'

export const Route = createFileRoute('/stars')({
  component: Stars,
})

function Stars() {
  const { me } = useAuthStatus()
  const [skills, setSkills] = useState<Skill[]>([])

  useEffect(() => {
    if (!me?.handle) return
    usersApi
      .stars(me.handle)
      .then((r) => {
        // Stars endpoint returns skill refs, fetch full skills
        // For now show stubs from the stars data
        setSkills([])
      })
      .catch(() => setSkills([]))
  }, [me?.handle])

  // Fetch full skills list and filter starred
  useEffect(() => {
    if (!me) return
    skillsApi
      .list({ sort: 'stars', limit: 200 })
      .then((r) => setSkills(r.items))
      .catch(() => {})
  }, [me])

  const toggleStar = useCallback(
    async (slug: string) => {
      try {
        await skillsApi.toggleStar(slug)
      } catch (error) {
        console.error('Failed to unstar skill:', error)
        window.alert('Unable to unstar this skill. Please try again.')
      }
    },
    [],
  )

  if (!me) {
    return (
      <main className="section">
        <div className="card">Sign in to see your highlights.</div>
      </main>
    )
  }

  return (
    <main className="section">
      <h1 className="section-title">Your highlights</h1>
      <p className="section-subtitle">Skills you've starred for quick access.</p>
      <div className="grid">
        {skills.length === 0 ? (
          <div className="card">No stars yet.</div>
        ) : (
          skills.map((skill) => {
            const owner = skill.ownerHandle ?? encodeURIComponent(skill.ownerUserId)
            return (
              <div key={skill.id} className="card skill-card">
                <Link to="/$owner/$slug" params={{ owner, slug: skill.slug }}>
                  <h3 className="skill-card-title">{skill.displayName}</h3>
                </Link>
                <div className="skill-card-footer skill-card-footer-inline">
                  <span className="stat">⭐ {formatCompactStat(skill.statsStars)}</span>
                  <button
                    className="star-toggle is-active"
                    type="button"
                    onClick={() => void toggleStar(skill.slug)}
                    aria-label={`Unstar ${skill.displayName}`}
                  >
                    <span aria-hidden="true">★</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
