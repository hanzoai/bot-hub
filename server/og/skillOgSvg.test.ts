import { describe, expect, it } from 'vitest'
import { buildSkillOgSvg } from './skillOgSvg'

describe('skill OG SVG', () => {
  it('includes title, description, and labels', () => {
    const svg = buildSkillOgSvg({
      markDataUrl: 'data:image/png;base64,AAA=',
      title: 'Discord Doctor',
      description: 'Quick diagnosis and repair for Discord bot.',
      ownerLabel: '@jhillock',
      versionLabel: 'v1.2.3',
      footer: 'clawdhub.com/jhillock/discord-doctor',
    })

    expect(svg).toContain('Discord Doctor')
    expect(svg).toContain('Quick diagnosis and repair')
    expect(svg).toContain('@jhillock')
    expect(svg).toContain('v1.2.3')
    expect(svg).toContain('clawdhub.com/jhillock/discord-doctor')
  })
})
