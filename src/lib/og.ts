import { getBotHubSiteUrl, getPersonaHubSiteUrl } from './site'

type SkillMetaSource = {
  slug: string
  owner?: string | null
  ownerId?: string | null
  displayName?: string | null
  summary?: string | null
  version?: string | null
}

type SkillMeta = {
  title: string
  description: string
  image: string
  url: string
  owner: string | null
}

type PersonaMetaSource = {
  slug: string
  owner?: string | null
  displayName?: string | null
  summary?: string | null
  version?: string | null
}

type PersonaMeta = {
  title: string
  description: string
  image: string
  url: string
  owner: string | null
}

const DEFAULT_DESCRIPTION = 'Bot Hub — a fast skill registry for agents, with vector search.'
const DEFAULT_PERSONA_DESCRIPTION = 'PersonaHub — the home for PERSONA.md bundles and personal system lore.'
const OG_SKILL_IMAGE_LAYOUT_VERSION = '5'
const OG_PERSONA_IMAGE_LAYOUT_VERSION = '1'

export function getSiteUrl() {
  return getBotHubSiteUrl()
}

export function getPersonaSiteUrl() {
  return getPersonaHubSiteUrl()
}

export function getApiBase() {
  const explicit = (import.meta.env.VITE_API_URL ?? '').trim()
  return explicit || getSiteUrl()
}

export async function fetchSkillMeta(slug: string) {
  try {
    const apiBase = getApiBase()
    const url = new URL(`/api/v1/skills/${encodeURIComponent(slug)}`, apiBase)
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (!response.ok) return null
    const payload = (await response.json()) as {
      skill?: { displayName?: string; summary?: string | null } | null
      owner?: { handle?: string | null; userId?: string | null } | null
      latestVersion?: { version?: string | null } | null
    }
    return {
      displayName: payload.skill?.displayName ?? null,
      summary: payload.skill?.summary ?? null,
      owner: payload.owner?.handle ?? null,
      ownerId: payload.owner?.userId ?? null,
      version: payload.latestVersion?.version ?? null,
    }
  } catch {
    return null
  }
}

export async function fetchPersonaMeta(slug: string) {
  try {
    const apiBase = getApiBase()
    const url = new URL(`/api/v1/personas/${encodeURIComponent(slug)}`, apiBase)
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (!response.ok) return null
    const payload = (await response.json()) as {
      persona?: { displayName?: string; summary?: string | null } | null
      owner?: { handle?: string | null } | null
      latestVersion?: { version?: string | null } | null
    }
    return {
      displayName: payload.persona?.displayName ?? null,
      summary: payload.persona?.summary ?? null,
      owner: payload.owner?.handle ?? null,
      version: payload.latestVersion?.version ?? null,
    }
  } catch {
    return null
  }
}

export function buildSkillMeta(source: SkillMetaSource): SkillMeta {
  const siteUrl = getSiteUrl()
  const owner = clean(source.owner)
  const ownerId = clean(source.ownerId)
  const displayName = clean(source.displayName) || clean(source.slug)
  const summary = clean(source.summary)
  const version = clean(source.version)
  const title = `${displayName} — Bot Hub`
  const description =
    summary || (owner ? `Agent skill by @${owner} on Bot Hub.` : DEFAULT_DESCRIPTION)
  const ownerPath = owner || ownerId || 'unknown'
  const url = `${siteUrl}/${ownerPath}/${source.slug}`
  const imageParams = new URLSearchParams()
  imageParams.set('v', OG_SKILL_IMAGE_LAYOUT_VERSION)
  imageParams.set('slug', source.slug)
  if (owner) imageParams.set('owner', owner)
  if (version) imageParams.set('version', version)
  return {
    title,
    description: truncate(description, 200),
    image: `${siteUrl}/og/skill.png?${imageParams.toString()}`,
    url,
    owner: owner || null,
  }
}

export function buildPersonaMeta(source: PersonaMetaSource): PersonaMeta {
  const siteUrl = getPersonaSiteUrl()
  const owner = clean(source.owner)
  const displayName = clean(source.displayName) || clean(source.slug)
  const summary = clean(source.summary)
  const version = clean(source.version)
  const title = `${displayName} — PersonaHub`
  const description =
    summary || (owner ? `Persona by @${owner} on PersonaHub.` : DEFAULT_PERSONA_DESCRIPTION)
  const url = `${siteUrl}/personas/${source.slug}`
  const imageParams = new URLSearchParams()
  imageParams.set('v', OG_PERSONA_IMAGE_LAYOUT_VERSION)
  imageParams.set('slug', source.slug)
  if (owner) imageParams.set('owner', owner)
  if (version) imageParams.set('version', version)
  return {
    title,
    description: truncate(description, 200),
    image: `${siteUrl}/og/persona.png?${imageParams.toString()}`,
    url,
    owner: owner || null,
  }
}

function clean(value?: string | null) {
  return value?.trim() ?? ''
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trim()}…`
}
