---
summary: 'Copy/paste CLI smoke checklist for local verification.'
read_when:
  - Pre-merge validation
  - Reproducing a reported CLI bug
---

# Manual testing (CLI)

## Setup
- Ensure logged in: `bun bothub whoami` (or `bun bothub login`).
- Optional: set env
  - `BOTHUB_SITE=https://hub.hanzo.bot`
  - `BOTHUB_REGISTRY=https://hub.hanzo.bot`

## Smoke
- `bun bothub --help`
- `bun bothub --cli-version`
- `bun bothub whoami`

## Search
- `bun bothub search gif --limit 5`

## Install / list / update
- `mkdir -p /tmp/bothub-manual && cd /tmp/bothub-manual`
- `bunx bothub@beta install gifgrep --force`
- `bunx bothub@beta list`
- `bunx bothub@beta update gifgrep --force`

## Publish (changelog optional)
- `mkdir -p /tmp/bothub-skill-demo/SKILL && cd /tmp/bothub-skill-demo`
- Create files:
  - `SKILL.md`
  - `notes.md`
- Publish:
  - `bun bothub publish . --slug bothub-manual-<ts> --name "Manual <ts>" --version 1.0.0 --tags latest`
- Publish update with empty changelog:
  - `bun bothub publish . --slug bothub-manual-<ts> --name "Manual <ts>" --version 1.0.1 --tags latest`

## Delete / undelete (owner/admin)
- `bun bothub delete bothub-manual-<ts> --yes`
- Verify hidden:
- `curl -i "https://hub.hanzo.bot/api/v1/skills/bothub-manual-<ts>"`
- Restore:
  - `bun bothub undelete bothub-manual-<ts> --yes`
- Cleanup:
  - `bun bothub delete bothub-manual-<ts> --yes`

## Sync
- `bun bothub sync --dry-run --all`

## Playwright (menu smoke)

Run against prod:

```
PLAYWRIGHT_BASE_URL=https://hub.hanzo.bot bun run test:pw
```

Run against a local preview server:

```
bun run test:e2e:local
```
