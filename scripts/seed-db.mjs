#!/usr/bin/env node
/**
 * Seed the Bot Hub PostgreSQL database with skills and personas.
 *
 * Run from the api/ directory (needs postgres driver):
 *   cd api && DATABASE_URL=... node ../scripts/seed-db.mjs
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, basename, relative } from 'node:path'
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

// Bot skills (SKILL.md in top-level dirs)
const BOT_SKILLS_DIR = process.env.BOT_SKILLS_DIR || join(import.meta.dirname, '../../hanzobot/bot/skills')
// Polymath skills (nested .md files)
const SKILLS_REPO_DIR = process.env.SKILLS_REPO_DIR || '/tmp/hanzo-skills/skills'
const PERSONAS_DIR = process.env.PERSONAS_DIR || join(import.meta.dirname, '../../hanzo/personas/personas')
const INTEGRATIONS_DIR = process.env.INTEGRATIONS_DIR || join(import.meta.dirname, '../../hanzo/flow/packages/pieces/community')

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

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractTitle(content) {
  const h1 = content.match(/^#\s+(.+)$/m)
  return h1 ? h1[1].trim() : null
}

async function insertSkill(slug, displayName, summary, content, userId) {
  const existing = await sql`SELECT id FROM skills WHERE slug = ${slug}`
  if (existing.length > 0) return false

  const [skill] = await sql`
    INSERT INTO skills (slug, display_name, summary, owner_user_id, moderation_status)
    VALUES (${slug}, ${displayName}, ${summary}, ${userId}, 'active')
    RETURNING id`

  const files = [{ path: 'SKILL.md', size: content.length, storageKey: `skills/${slug}/SKILL.md`, sha256: null }]
  const { frontmatter, body } = parseFrontmatter(content)
  const parsed = { frontmatter, body: body.slice(0, 500) }

  const [ver] = await sql`
    INSERT INTO skill_versions (skill_id, version, changelog, files, parsed, created_by)
    VALUES (${skill.id}, '1.0.0', 'Initial seed', ${JSON.stringify(files)}, ${JSON.stringify(parsed)}, ${userId})
    RETURNING id`

  await sql`UPDATE skills SET latest_version_id = ${ver.id}, stats_versions = 1 WHERE id = ${skill.id}`
  return true
}

async function seedBotSkills(userId) {
  let dirs
  try { dirs = await readdir(BOT_SKILLS_DIR, { withFileTypes: true }) } catch { return 0 }

  let count = 0
  for (const dir of dirs.filter(d => d.isDirectory())) {
    const slug = dir.name
    let content
    try { content = await readFile(join(BOT_SKILLS_DIR, slug, 'SKILL.md'), 'utf8') } catch { continue }

    const { frontmatter } = parseFrontmatter(content)
    const displayName = frontmatter.name || slug
    const summary = frontmatter.description || null

    if (await insertSkill(slug, displayName, summary, content, userId)) count++
  }
  return count
}

async function walkDir(dir) {
  const results = []
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return results }

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...await walkDir(full))
    } else if (entry.name.endsWith('.md') && !entry.name.startsWith('_') && entry.name !== 'INDEX.md' && entry.name !== 'README.md') {
      // Skip resource/reference files
      if (!full.includes('/resources/')) {
        results.push(full)
      }
    }
  }
  return results
}

async function seedRepoSkills(userId) {
  const files = await walkDir(SKILLS_REPO_DIR)
  let count = 0

  for (const filePath of files) {
    let content
    try { content = await readFile(filePath, 'utf8') } catch { continue }

    const relPath = relative(SKILLS_REPO_DIR, filePath)
    const { frontmatter, body } = parseFrontmatter(content)

    // Determine slug from path
    const pathParts = relPath.replace(/\.md$/, '').split('/')
    let slug
    if (basename(filePath) === 'SKILL.md') {
      // dir/SKILL.md → use dir name
      slug = slugify(pathParts.slice(0, -1).join('-'))
    } else {
      // dir/name.md → use full path
      slug = slugify(pathParts.join('-'))
    }

    if (!slug) continue

    const title = frontmatter.name || extractTitle(body || content) || pathParts[pathParts.length - 1].replace(/-/g, ' ')
    const displayName = title.charAt(0).toUpperCase() + title.slice(1)
    const summary = frontmatter.description || null

    if (await insertSkill(slug, displayName, summary, content, userId)) count++
  }
  return count
}

async function seedPersonas(userId) {
  let dirs
  try { dirs = await readdir(PERSONAS_DIR, { withFileTypes: true }) } catch { return 0 }

  let count = 0
  for (const dir of dirs.filter(d => d.isDirectory())) {
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

function extractPieceMeta(source) {
  // Extract displayName, description, logoUrl from createPiece({ ... })
  const meta = {}
  const nameMatch = source.match(/displayName\s*:\s*['"`]([^'"`]+)['"`]/)
  if (nameMatch) meta.displayName = nameMatch[1]
  const descMatch = source.match(/description\s*:\s*['"`]([^'"`]+)['"`]/)
  if (descMatch) meta.description = descMatch[1]
  const logoMatch = source.match(/logoUrl\s*:\s*['"`]([^'"`]+)['"`]/)
  if (logoMatch) meta.logoUrl = logoMatch[1]
  // Extract categories
  const catMatch = source.match(/categories\s*:\s*\[([^\]]*)\]/)
  if (catMatch) {
    meta.categories = catMatch[1]
      .split(',')
      .map(s => s.trim().replace(/.*\./, '').replace(/['"]/g, ''))
      .filter(Boolean)
  }
  // Count actions/triggers
  const actionsMatch = source.match(/actions\s*:\s*\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/s)
  if (actionsMatch) {
    meta.actionCount = (actionsMatch[1].match(/\w+Action|createAction|create\w+Action/g) || []).length
    if (meta.actionCount === 0) meta.actionCount = (actionsMatch[1].match(/,/g) || []).length + 1
  }
  const triggersMatch = source.match(/triggers\s*:\s*\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/s)
  if (triggersMatch) {
    meta.triggerCount = (triggersMatch[1].match(/\w+Trigger|createTrigger|create\w+Trigger|new\w+Trigger/g) || []).length
    if (meta.triggerCount === 0) meta.triggerCount = (triggersMatch[1].match(/,/g) || []).length + 1
  }
  return meta
}

async function seedIntegrations(userId) {
  let dirs
  try { dirs = await readdir(INTEGRATIONS_DIR, { withFileTypes: true }) } catch { return 0 }

  let count = 0
  for (const dir of dirs.filter(d => d.isDirectory())) {
    const slug = 'integration-' + dir.name
    const existing = await sql`SELECT id FROM skills WHERE slug = ${slug}`
    if (existing.length > 0) continue

    // Read package.json for basic metadata
    let pkg = {}
    try { pkg = JSON.parse(await readFile(join(INTEGRATIONS_DIR, dir.name, 'package.json'), 'utf8')) } catch { continue }

    // Read src/index.ts for createPiece metadata
    let source = ''
    try { source = await readFile(join(INTEGRATIONS_DIR, dir.name, 'src', 'index.ts'), 'utf8') } catch {
      try { source = await readFile(join(INTEGRATIONS_DIR, dir.name, 'src', 'index.tsx'), 'utf8') } catch { }
    }

    const meta = extractPieceMeta(source)
    const displayName = meta.displayName || pkg.displayName || dir.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const summary = meta.description || pkg.description || null

    const [skill] = await sql`
      INSERT INTO skills (slug, display_name, summary, owner_user_id, moderation_status, batch)
      VALUES (${slug}, ${displayName}, ${summary}, ${userId}, 'active', 'integration')
      RETURNING id`

    const parsed = {
      frontmatter: { name: displayName, description: summary },
      integration: {
        package: pkg.name || null,
        version: pkg.version || null,
        logoUrl: meta.logoUrl || `https://cdn.activepieces.com/pieces/${dir.name}.png`,
        categories: meta.categories || [],
        actionCount: meta.actionCount || 0,
        triggerCount: meta.triggerCount || 0,
      }
    }
    const files = [{ path: 'package.json', size: JSON.stringify(pkg).length, storageKey: `integrations/${dir.name}/package.json`, sha256: null }]

    const [ver] = await sql`
      INSERT INTO skill_versions (skill_id, version, changelog, files, parsed, created_by)
      VALUES (${skill.id}, ${pkg.version || '1.0.0'}, 'Initial seed', ${JSON.stringify(files)}, ${JSON.stringify(parsed)}, ${userId})
      RETURNING id`

    await sql`UPDATE skills SET latest_version_id = ${ver.id}, stats_versions = 1 WHERE id = ${skill.id}`
    count++
  }
  return count
}

async function main() {
  console.log('Seeding Bot Hub database...')
  const userId = await ensureSeedUser()
  console.log(`Seed user: ${userId}`)

  const botSkills = await seedBotSkills(userId)
  console.log(`Bot skills: ${botSkills} new`)

  const repoSkills = await seedRepoSkills(userId)
  console.log(`Repo skills: ${repoSkills} new`)

  const personaCount = await seedPersonas(userId)
  console.log(`Personas: ${personaCount} (new + existing)`)

  const integrations = await seedIntegrations(userId)
  console.log(`Integrations: ${integrations} new`)

  const [{ count: totalSkills }] = await sql`SELECT count(*) FROM skills WHERE batch IS NULL OR batch != 'integration'`
  const [{ count: totalIntegrations }] = await sql`SELECT count(*) FROM skills WHERE batch = 'integration'`
  const [{ count: totalPersonas }] = await sql`SELECT count(*) FROM personas`
  console.log(`\nTotals: ${totalSkills} skills, ${totalIntegrations} integrations, ${totalPersonas} personas`)

  await sql.end()
  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
