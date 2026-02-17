import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import JSON5 from 'json5'
import { resolveHome } from '../homedir.js'

type BotConfig = {
  agent?: { workspace?: string }
  agents?: {
    defaults?: { workspace?: string }
    list?: Array<{
      id?: string
      name?: string
      workspace?: string
      default?: boolean
    }>
  }
  routing?: {
    agents?: Record<
      string,
      {
        name?: string
        workspace?: string
      }
    >
  }
  skills?: {
    load?: {
      extraDirs?: string[]
    }
  }
}

export type ClawdbotSkillRoots = {
  roots: string[]
  labels: Record<string, string>
}

export async function resolveClawdbotSkillRoots(): Promise<ClawdbotSkillRoots> {
  const roots: string[] = []
  const labels: Record<string, string> = {}

  const botStateDir = resolveClawdbotStateDir()
  const sharedSkills = resolveUserPath(join(botStateDir, 'skills'))
  pushRoot(roots, labels, sharedSkills, 'Shared skills')

  const hanzoBotStateDir = resolveBotStateDir()
  const hanzo-botShared = resolveUserPath(join(hanzoBotStateDir, 'skills'))
  pushRoot(roots, labels, hanzo-botShared, 'Hanzo Bot: Shared skills')

  const [botConfig, hanzoBotConfig] = await Promise.all([
    readBotConfig(),
    readBotConfig(),
  ])
  if (!botConfig && !hanzoBotConfig) return { roots, labels }

  if (botConfig) {
    addConfigRoots(botConfig, roots, labels)
  }
  if (hanzoBotConfig) {
    addConfigRoots(hanzoBotConfig, roots, labels, 'Hanzo Bot')
  }

  return { roots, labels }
}

export async function resolveClawdbotDefaultWorkspace(): Promise<string | null> {
  const config = await readBotConfig()
  const hanzoBotConfig = await readBotConfig()
  if (!config && !hanzoBotConfig) return null

  const defaultsWorkspace = resolveUserPath(
    config?.agents?.defaults?.workspace ?? config?.agent?.workspace ?? '',
  )
  if (defaultsWorkspace) return defaultsWorkspace

  const listedAgents = config?.agents?.list ?? []
  const defaultAgent =
    listedAgents.find((entry) => entry.default) ?? listedAgents.find((entry) => entry.id === 'main')
  const listWorkspace = resolveUserPath(defaultAgent?.workspace ?? '')
  if (listWorkspace) return listWorkspace

  if (!hanzoBotConfig) return null
  const hanzo-botDefaults = resolveUserPath(
    hanzoBotConfig.agents?.defaults?.workspace ?? hanzoBotConfig.agent?.workspace ?? '',
  )
  if (hanzo-botDefaults) return hanzo-botDefaults
  const hanzo-botAgents = hanzoBotConfig.agents?.list ?? []
  const hanzo-botDefaultAgent =
    hanzo-botAgents.find((entry) => entry.default) ??
    hanzo-botAgents.find((entry) => entry.id === 'main')
  const hanzo-botWorkspace = resolveUserPath(hanzo-botDefaultAgent?.workspace ?? '')
  return hanzo-botWorkspace || null
}

function resolveClawdbotStateDir() {
  const override = process.env.CLAWDBOT_STATE_DIR?.trim()
  if (override) return resolveUserPath(override)
  return join(resolveHome(), '.bot')
}

function resolveBotConfigPath() {
  const override = process.env.CLAWDBOT_CONFIG_PATH?.trim()
  if (override) return resolveUserPath(override)
  return join(resolveClawdbotStateDir(), 'bot.json')
}

function resolveBotStateDir() {
  const override = process.env.HANZO_BOT_STATE_DIR?.trim()
  if (override) return resolveUserPath(override)
  return join(resolveHome(), '.hanzo-bot')
}

function resolveBotConfigPath() {
  const override = process.env.HANZO_BOT_CONFIG_PATH?.trim()
  if (override) return resolveUserPath(override)
  return join(resolveBotStateDir(), 'bot.json')
}

function resolveUserPath(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('~')) {
    return resolve(trimmed.replace(/^~(?=$|[\\/])/, resolveHome()))
  }
  return resolve(trimmed)
}

async function readBotConfig(): Promise<BotConfig | null> {
  return readConfigFile(resolveBotConfigPath())
}

async function readBotConfig(): Promise<BotConfig | null> {
  return readConfigFile(resolveBotConfigPath())
}

async function readConfigFile(path: string): Promise<BotConfig | null> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON5.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as BotConfig
  } catch {
    return null
  }
}

function addConfigRoots(
  config: BotConfig,
  roots: string[],
  labels: Record<string, string>,
  labelPrefix?: string,
) {
  const prefix = labelPrefix ? `${labelPrefix}: ` : ''

  const mainWorkspace = resolveUserPath(
    config.agents?.defaults?.workspace ?? config.agent?.workspace ?? '',
  )
  if (mainWorkspace) {
    pushRoot(roots, labels, join(mainWorkspace, 'skills'), `${prefix}Agent: main`)
  }

  const listedAgents = config.agents?.list ?? []
  for (const entry of listedAgents) {
    const workspace = resolveUserPath(entry?.workspace ?? '')
    if (!workspace) continue
    const name = entry?.name?.trim() || entry?.id?.trim() || 'agent'
    pushRoot(roots, labels, join(workspace, 'skills'), `${prefix}Agent: ${name}`)
  }

  const agents = config.routing?.agents ?? {}
  for (const [agentId, entry] of Object.entries(agents)) {
    const workspace = resolveUserPath(entry?.workspace ?? '')
    if (!workspace) continue
    const name = entry?.name?.trim() || agentId
    pushRoot(roots, labels, join(workspace, 'skills'), `${prefix}Agent: ${name}`)
  }

  const extraDirs = config.skills?.load?.extraDirs ?? []
  for (const dir of extraDirs) {
    const resolved = resolveUserPath(String(dir))
    if (!resolved) continue
    const label = `${prefix}Extra: ${basename(resolved) || resolved}`
    pushRoot(roots, labels, resolved, label)
  }
}

function pushRoot(roots: string[], labels: Record<string, string>, root: string, label?: string) {
  const resolved = resolveUserPath(root)
  if (!resolved) return
  if (!roots.includes(resolved)) roots.push(resolved)
  if (!label) return
  const existing = labels[resolved]
  if (!existing) {
    labels[resolved] = label
    return
  }
  const parts = existing
    .split(', ')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.includes(label)) return
  labels[resolved] = `${existing}, ${label}`
}
