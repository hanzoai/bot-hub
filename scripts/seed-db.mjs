#!/usr/bin/env node
/**
 * Seed the Bot Hub PostgreSQL database with skills and personas.
 *
 * Run from the api/ directory (needs postgres driver):
 *   cd api && DATABASE_URL=... node ../scripts/seed-db.mjs
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const SKILLS_DIR = process.env.SKILLS_DIR || join(import.meta.dirname, '../../hanzobot/bot/skills')
const PERSONAS_DIR = process.env.PERSONAS_DIR || join(import.meta.dirname, '../../hanzo/personas/personas')

const sql = postgres(DATABASE_URL)

async function ensureSeedUser() {
  const existing = await sql`SELECT id FROM users WHERE handle = 'hanzo'`
  if (existing.length > 0) return existing[0].id

  const res = await sql`
    INSERT INTO users (handle, display_name, name, role, trusted_publisher)
    VALUES ('hanzo', 'Hanzo', 'Hanzo AI', 'admin', true)
    RETURNING id`
  return res[0].id
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const fm = {}
  const raw = match[1]
  const nameMatch = raw.match(/^name:\s*(.+)$/m)
  if (nameMatch) fm.name = nameMatch[1].trim()
  const descMatch = raw.match(/^description:\s*(.+)$/m)
  if (descMatch) fm.description = descMatch[1].trim()

  return { frontmatter: fm, body: match[2] }
}

async function seedSkills(userId) {
  let dirs
  try {
    dirs = await readdir(SKILLS_DIR, { withFileTypes: true })
  } catch {
    console.log(`Skills dir not found: ${SKILLS_DIR}, skipping`)
    return 0
  }

  const skillDirs = dirs.filter(d => d.isDirectory())
  let count = 0

  for (const dir of skillDirs) {
    const slug = dir.name
    const skillMdPath = join(SKILLS_DIR, slug, 'SKILL.md')

    let content
    try { content = await readFile(skillMdPath, 'utf8') } catch { continue }

    const { frontmatter, body } = parseFrontmatter(content)
    const displayName = frontmatter.name || slug
    const summary = frontmatter.description || null

    const existing = await sql`SELECT id FROM skills WHERE slug = ${slug}`
    if (existing.length > 0) { count++; continue }

    const [skill] = await sql`
      INSERT INTO skills (slug, display_name, summary, owner_user_id, moderation_status)
      VALUES (${slug}, ${displayName}, ${summary}, ${userId}, 'active')
      RETURNING id`

    const files = [{ path: 'SKILL.md', size: content.length, storageKey: `skills/${slug}/SKILL.md`, sha256: null }]
    const parsed = { frontmatter, body: body.slice(0, 500) }

    const [ver] = await sql`
      INSERT INTO skill_versions (skill_id, version, changelog, files, parsed, created_by)
      VALUES (${skill.id}, '1.0.0', 'Initial seed', ${JSON.stringify(files)}, ${JSON.stringify(parsed)}, ${userId})
      RETURNING id`

    await sql`UPDATE skills SET latest_version_id = ${ver.id}, stats_versions = 1 WHERE id = ${skill.id}`
    count++
  }

  return count
}

async function seedPersonas(userId) {
  let dirs
  try {
    dirs = await readdir(PERSONAS_DIR, { withFileTypes: true })
  } catch {
    console.log(`Personas dir not found: ${PERSONAS_DIR}, skipping`)
    return 0
  }

  const personaDirs = dirs.filter(d => d.isDirectory())
  let count = 0

  for (const dir of personaDirs) {
    const slug = dir.name

    let profile = {}
    try { profile = JSON.parse(await readFile(join(PERSONAS_DIR, slug, 'profile.json'), 'utf8')) } catch { continue }

    let personaMd = ''
    try { personaMd = await readFile(join(PERSONAS_DIR, slug, 'PERSONA.md'), 'utf8') } catch {}

    const displayName = profile.name || slug.replace(/_/g, ' ')
    const summary = profile.tagline || profile.description || null

    const existing = await sql`SELECT id FROM personas WHERE slug = ${slug}`
    if (existing.length > 0) { count++; continue }

    const [persona] = await sql`
      INSERT INTO personas (slug, display_name, summary, owner_user_id)
      VALUES (${slug}, ${displayName}, ${summary}, ${userId})
      RETURNING id`

    const files = [{ path: 'profile.json', size: JSON.stringify(profile).length, storageKey: `personas/${slug}/profile.json`, sha256: null }]
    if (personaMd) files.push({ path: 'PERSONA.md', size: personaMd.length, storageKey: `personas/${slug}/PERSONA.md`, sha256: null })

    const parsed = { frontmatter: { name: displayName, description: summary }, profile }

    const [ver] = await sql`
      INSERT INTO persona_versions (persona_id, version, changelog, files, parsed, created_by)
      VALUES (${persona.id}, '1.0.0', 'Initial seed', ${JSON.stringify(files)}, ${JSON.stringify(parsed)}, ${userId})
      RETURNING id`

    await sql`UPDATE personas SET latest_version_id = ${ver.id}, stats_versions = 1 WHERE id = ${persona.id}`
    count++
  }

  return count
}

async function main() {
  console.log('Seeding Bot Hub database...')
  const userId = await ensureSeedUser()
  console.log(`Seed user: ${userId}`)

  const skillCount = await seedSkills(userId)
  console.log(`Skills: ${skillCount} seeded`)

  const personaCount = await seedPersonas(userId)
  console.log(`Personas: ${personaCount} seeded`)

  await sql.end()
  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
