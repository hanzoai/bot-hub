/* @vitest-environment node */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveClawdbotSkillRoots } from './clawdbotConfig.js'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('resolveClawdbotSkillRoots', () => {
  it('reads JSON5 config and resolves per-agent + shared skill roots', async () => {
    const base = await mkdtemp(join(tmpdir(), 'clawdhub-clawdbot-'))
    const home = join(base, 'home')
    const stateDir = join(base, 'state')
    const configPath = join(base, 'clawdbot.json')

    process.env.HOME = home
    process.env.CLAWDBOT_STATE_DIR = stateDir
    process.env.CLAWDBOT_CONFIG_PATH = configPath

    const config = `{
      // JSON5 comments + trailing commas supported
      agent: { workspace: '~/clawd-main', },
      routing: {
        agents: {
          work: { name: 'Work Bot', workspace: '~/clawd-work', },
          family: { workspace: '~/clawd-family' },
        },
      },
      skills: {
        load: { extraDirs: ['~/shared/skills', '/opt/skills',], },
      },
    }`
    await writeFile(configPath, config, 'utf8')

    const { roots, labels } = await resolveClawdbotSkillRoots()

    const expectedRoots = [
      resolve(stateDir, 'skills'),
      resolve(home, 'clawd-main', 'skills'),
      resolve(home, 'clawd-work', 'skills'),
      resolve(home, 'clawd-family', 'skills'),
      resolve(home, 'shared', 'skills'),
      resolve('/opt/skills'),
    ]

    expect(roots).toEqual(expect.arrayContaining(expectedRoots))
    expect(labels[resolve(stateDir, 'skills')]).toBe('Shared skills')
    expect(labels[resolve(home, 'clawd-main', 'skills')]).toBe('Agent: main')
    expect(labels[resolve(home, 'clawd-work', 'skills')]).toBe('Agent: Work Bot')
    expect(labels[resolve(home, 'clawd-family', 'skills')]).toBe('Agent: family')
    expect(labels[resolve(home, 'shared', 'skills')]).toBe('Extra: skills')
    expect(labels[resolve('/opt/skills')]).toBe('Extra: skills')
  })
})
