const WORD_RE = /[a-z0-9]+/g

function normalize(value: string) {
  return value.toLowerCase()
}

export function tokenize(value: string): string[] {
  if (!value) return []
  return normalize(value).match(WORD_RE) ?? []
}

export function matchesExactTokens(
  queryTokens: string[],
  parts: Array<string | null | undefined>,
): boolean {
  if (queryTokens.length === 0) return false
  const text = parts.filter((part) => Boolean(part?.trim())).join(' ')
  if (!text) return false
  const textTokens = tokenize(text)
  if (textTokens.length === 0) return false
  const textSet = new Set(textTokens)
  return queryTokens.every((token) => textSet.has(token))
}

export const __test = { normalize, tokenize, matchesExactTokens }
