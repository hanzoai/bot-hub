/* @vitest-environment node */

import { describe, expect, it } from 'vitest'
import { __test, matchesExactTokens, tokenize } from './searchText'

describe('searchText', () => {
  it('tokenize lowercases and splits on punctuation', () => {
    expect(tokenize('Minimax Usage /minimax-usage')).toEqual([
      'minimax',
      'usage',
      'minimax',
      'usage',
    ])
  })

  it('matchesExactTokens requires all query tokens', () => {
    const queryTokens = tokenize('Remind Me')
    expect(matchesExactTokens(queryTokens, ['Remind Me', '/remind-me', 'Short summary'])).toBe(true)
    expect(matchesExactTokens(queryTokens, ['Reminder tool', '/reminder', 'Short summary'])).toBe(
      false,
    )
  })

  it('matchesExactTokens ignores empty inputs', () => {
    expect(matchesExactTokens([], ['text'])).toBe(false)
    expect(matchesExactTokens(['token'], ['  ', null, undefined])).toBe(false)
  })

  it('normalize uses lowercase', () => {
    expect(__test.normalize('AbC')).toBe('abc')
  })
})
