import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import JSON5 from 'json5'

type ClawdbotConfig = {
  agent?: { workspace?: string }
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

  const stateDir = resolveClawdbotStateDir()
  const sharedSkills = resolveUserPath(join(stateDir, 'skills'))
  pushRoot(roots, labels, sharedSkills, 'Shared skills')

  const config = await readClawdbotConfig()
  if (!config) return { roots, labels }

  const mainWorkspace = resolveUserPath(config.agent?.workspace ?? '')
  if (mainWorkspace) {
    pushRoot(roots, labels, join(mainWorkspace, 'skills'), 'Agent: main')
  }

  const agents = config.routing?.agents ?? {}
  for (const [agentId, entry] of Object.entries(agents)) {
    const workspace = resolveUserPath(entry?.workspace ?? '')
    if (!workspace) continue
    const name = entry?.name?.trim() || agentId
    pushRoot(roots, labels, join(workspace, 'skills'), `Agent: ${name}`)
  }

  const extraDirs = config.skills?.load?.extraDirs ?? []
  for (const dir of extraDirs) {
    const resolved = resolveUserPath(String(dir))
    if (!resolved) continue
    const label = `Extra: ${basename(resolved) || resolved}`
    pushRoot(roots, labels, resolved, label)
  }

  return { roots, labels }
}

function resolveClawdbotStateDir() {
  const override = process.env.CLAWDBOT_STATE_DIR?.trim()
  if (override) return resolveUserPath(override)
  return join(homedir(), '.clawdbot')
}

function resolveClawdbotConfigPath() {
  const override = process.env.CLAWDBOT_CONFIG_PATH?.trim()
  if (override) return resolveUserPath(override)
  return join(resolveClawdbotStateDir(), 'clawdbot.json')
}

function resolveUserPath(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('~')) {
    return resolve(trimmed.replace(/^~(?=$|[\\/])/, homedir()))
  }
  return resolve(trimmed)
}

async function readClawdbotConfig(): Promise<ClawdbotConfig | null> {
  try {
    const raw = await readFile(resolveClawdbotConfigPath(), 'utf8')
    const parsed = JSON5.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as ClawdbotConfig
  } catch {
    return null
  }
}

function pushRoot(roots: string[], labels: Record<string, string>, root: string, label?: string) {
  const resolved = resolveUserPath(root)
  if (!resolved) return
  roots.push(resolved)
  if (!label) return
  const existing = labels[resolved]
  labels[resolved] = existing ? `${existing}, ${label}` : label
}
