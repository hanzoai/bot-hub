import { formatPersonaStatsTriplet, type PersonaStatsTriplet } from '../lib/numberFormat'

export function PersonaStatsTripletLine({
  stats,
  versionSuffix = 'v',
}: {
  stats: PersonaStatsTriplet
  versionSuffix?: 'v' | 'versions'
}) {
  const formatted = formatPersonaStatsTriplet(stats)
  return (
    <>
      ⭐ {formatted.stars} · ⤓ {formatted.downloads} · {formatted.versions} {versionSuffix}
    </>
  )
}

export function PersonaMetricsRow({ stats }: { stats: PersonaStatsTriplet }) {
  const formatted = formatPersonaStatsTriplet(stats)
  return (
    <>
      <span>⤓ {formatted.downloads}</span>
      <span>★ {formatted.stars}</span>
      <span>{formatted.versions} v</span>
    </>
  )
}
