export type PersonaOgMeta = {
  displayName: string | null
  summary: string | null
  owner: string | null
  version: string | null
}

export async function fetchPersonaOgMeta(slug: string, apiBase: string): Promise<PersonaOgMeta | null> {
  try {
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
