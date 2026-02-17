/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  detectSiteMode,
  detectSiteModeFromUrl,
  getBotHubSiteUrl,
  getPersonaHubHost,
  getPersonaHubSiteUrl,
  getSiteDescription,
  getSiteMode,
  getSiteName,
  getSiteUrlForMode,
} from './site'

function withMetaEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const env = import.meta.env as unknown as Record<string, unknown>
  const previous = new Map<string, unknown>()
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, env[key])
    if (value === undefined) {
      delete env[key]
    } else {
      env[key] = value
    }
  }
  try {
    return run()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete env[key]
      else env[key] = value
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('site helpers', () => {
  it('returns default and env configured site URLs', () => {
    expect(getBotHubSiteUrl()).toBe('https://hub.hanzo.bot')
    withMetaEnv({ VITE_SITE_URL: 'https://example.com' }, () => {
      expect(getBotHubSiteUrl()).toBe('https://example.com')
    })
    withMetaEnv({ VITE_SITE_URL: 'https://hub.hanzo.bot' }, () => {
      expect(getBotHubSiteUrl()).toBe('https://hub.hanzo.bot')
    })
    withMetaEnv({ VITE_SITE_URL: 'https://auth.hub.hanzo.bot' }, () => {
      expect(getBotHubSiteUrl()).toBe('https://hub.hanzo.bot')
    })
  })

  it('picks PersonaHub URL from explicit env', () => {
    withMetaEnv({ VITE_PERSONAHUB_SITE_URL: 'https://personas.example.com' }, () => {
      expect(getPersonaHubSiteUrl()).toBe('https://personas.example.com')
    })
  })

  it('derives PersonaHub URL from local VITE_SITE_URL', () => {
    withMetaEnv({ VITE_SITE_URL: 'http://localhost:3000' }, () => {
      expect(getPersonaHubSiteUrl()).toBe('http://localhost:3000')
    })
    withMetaEnv({ VITE_SITE_URL: 'http://127.0.0.1:3000' }, () => {
      expect(getPersonaHubSiteUrl()).toBe('http://127.0.0.1:3000')
    })
    withMetaEnv({ VITE_SITE_URL: 'http://0.0.0.0:3000' }, () => {
      expect(getPersonaHubSiteUrl()).toBe('http://0.0.0.0:3000')
    })
  })

  it('falls back to default PersonaHub URL for invalid VITE_SITE_URL', () => {
    withMetaEnv({ VITE_SITE_URL: 'not a url' }, () => {
      expect(getPersonaHubSiteUrl()).toBe('https://personas.hanzo.ai')
    })
  })

  it('detects site mode from host and URLs', () => {
    expect(detectSiteMode(null)).toBe('skills')

    withMetaEnv({ VITE_PERSONAHUB_HOST: 'personas.example.com' }, () => {
      expect(getPersonaHubHost()).toBe('personas.example.com')
      expect(detectSiteMode('personas.example.com')).toBe('personas')
      expect(detectSiteMode('sub.personas.example.com')).toBe('personas')
      expect(detectSiteMode('hub.hanzo.bot')).toBe('skills')

      expect(detectSiteModeFromUrl('https://personas.example.com/x')).toBe('personas')
      expect(detectSiteModeFromUrl('personas.example.com')).toBe('personas')
      expect(detectSiteModeFromUrl('https://hub.hanzo.bot')).toBe('skills')
    })
  })

  it('detects site mode from window when available', () => {
    withMetaEnv({ VITE_PERSONAHUB_HOST: 'personas.hanzo.ai' }, () => {
      vi.stubGlobal('window', { location: { hostname: 'personas.hanzo.ai' } } as unknown as Window)
      expect(getSiteMode()).toBe('personas')
    })
  })

  it('detects site mode from env on the server', () => {
    withMetaEnv({ VITE_SITE_MODE: 'personas', VITE_PERSONAHUB_HOST: 'personas.hanzo.ai' }, () => {
      expect(getSiteMode()).toBe('personas')
    })
    withMetaEnv({ VITE_SITE_MODE: 'skills', VITE_PERSONAHUB_HOST: 'personas.hanzo.ai' }, () => {
      expect(getSiteMode()).toBe('skills')
    })
  })

  it('detects site mode from VITE_PERSONAHUB_SITE_URL and SITE_URL fallback', () => {
    withMetaEnv(
      { VITE_SITE_MODE: undefined, VITE_PERSONAHUB_SITE_URL: 'https://personas.hanzo.ai' },
      () => {
        expect(getSiteMode()).toBe('personas')
      },
    )

    withMetaEnv({ VITE_PERSONAHUB_SITE_URL: undefined, VITE_SITE_URL: undefined }, () => {
      vi.stubEnv('SITE_URL', 'https://personas.hanzo.ai')
      expect(getSiteMode()).toBe('personas')
    })
  })

  it('derives site metadata from mode', () => {
    expect(getSiteName('skills')).toBe('Bot Hub')
    expect(getSiteName('personas')).toBe('PersonaHub')

    expect(getSiteDescription('skills')).toContain('Bot Hub')
    expect(getSiteDescription('personas')).toContain('PersonaHub')

    expect(getSiteUrlForMode('skills')).toBe('https://hub.hanzo.bot')
    expect(getSiteUrlForMode('personas')).toBe('https://personas.hanzo.ai')
  })
})
