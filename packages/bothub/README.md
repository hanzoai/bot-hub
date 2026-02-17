# `bothub`

Bot Hub CLI — install, update, search, and publish agent skills as folders.

## Install

```bash
# From this repo (shortcut script at repo root)
bun bothub --help

# Once published to npm
# npm i -g bothub
```

## Auth (publish)

```bash
bothub login
# or
bothub auth login

# Headless / token paste
# or (token paste / headless)
bothub login --token clh_...
```

Notes:

- Browser login opens `https://hub.hanzo.bot/cli/auth` and completes via a loopback callback.
- Token stored in `~/Library/Application Support/bothub/config.json` on macOS (override via `BOTHUB_CONFIG_PATH`, legacy `CLAWDHUB_CONFIG_PATH`).

## Examples

```bash
bothub search "postgres backups"
bothub install my-skill-pack
bothub update --all
bothub update --all --no-input --force
bothub publish ./my-skill-pack --slug my-skill-pack --name "My Skill Pack" --version 1.2.0 --changelog "Fixes + docs"
```

## Sync (upload local skills)

```bash
# Start anywhere; scans workdir first, then legacy Clawdis/Clawd/Hanzo Bot/Moltbot locations.
bothub sync

# Explicit roots + non-interactive dry-run
bothub sync --root ../clawdis/skills --all --dry-run
```

## Defaults

- Site: `https://hub.hanzo.bot` (override via `--site` or `BOTHUB_SITE`, legacy `CLAWDHUB_SITE`)
- Registry: discovered from `/.well-known/bothub.json` on the site (legacy `/.well-known/bothub.json`; override via `--registry` or `BOTHUB_REGISTRY`)
- Workdir: current directory (falls back to Clawdbot workspace if configured; override via `--workdir` or `BOTHUB_WORKDIR`)
- Install dir: `./skills` under workdir (override via `--dir`)
