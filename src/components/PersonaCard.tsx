import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { PublicPersona } from '../lib/publicUser'

type PersonaCardProps = {
  persona: PublicPersona
  summaryFallback: string
  meta: ReactNode
}

export function PersonaCard({ persona, summaryFallback, meta }: PersonaCardProps) {
  return (
    <Link to="/personas/$slug" params={{ slug: persona.slug }} className="card skill-card">
      <h3 className="skill-card-title">{persona.displayName}</h3>
      <p className="skill-card-summary">{persona.summary ?? summaryFallback}</p>
      <div className="skill-card-footer">{meta}</div>
    </Link>
  )
}
