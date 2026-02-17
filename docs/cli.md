---
summary: 'CLI reference: commands, flags, config, lockfile, sync behavior.'
read_when:
  - Working on CLI behavior
  - Debugging install/update/sync
---

# CLI

CLI package: `packages/bothub/` (published as `bothub`, bin: `bothub`).

From this repo you can run it via the wrapper script:

```bash
bun bothub --help
```

## Global flags

- `--workdir <dir>`: working directory (default: cwd; falls back to Clawdbot workspace if configured)
- `--dir <dir>`: install dir under workdir (default: `skills`)
- `--site <url>`: base URL for browser login (default: `https://hub.hanzo.bot`)
- `--registry <url>`: API base URL (default: discovered, else `https://hub.hanzo.bot`)
- `--no-input`: disable prompts

Env equivalents:

- `BOTHUB_SITE` (legacy `CLAWDHUB_SITE`)
- `BOTHUB_REGISTRY` (legacy `CLAWDHUB_REGISTRY`)
- `BOTHUB_WORKDIR` (legacy `CLAWDHUB_WORKDIR`)

## Config file

Stores your API token + cached registry URL.

- macOS: `~/Library/Application Support/bothub/config.json`
- override: `BOTHUB_CONFIG_PATH` (legacy `CLAWDHUB_CONFIG_PATH`)

## Commands

### `login` / `auth login`

- Default: opens browser to `<site>/cli/auth` and completes via loopback callback.
- Headless: `bothub login --token clh_...`

### `whoami`

- Verifies the stored token via `/api/v1/whoami`.

### `star <slug>` / `unstar <slug>`

- Adds/removes a skill from your highlights.
- Calls `POST /api/v1/stars/<slug>` and `DELETE /api/v1/stars/<slug>`.
- `--yes` skips confirmation.

### `search <query...>`

- Calls `/api/v1/search?q=...`.

### `explore`

- Lists latest updated skills via `/api/v1/skills?limit=...` (sorted by `updatedAt` desc).
- Flags:
- `--limit <n>` (1-200, default: 25)
  - `--sort newest|downloads|rating|installs|installsAllTime|trending` (default: newest)
  - `--json` (machine-readable output)
- Output: `<slug>  v<version>  <age>  <summary>` (summary truncated to 50 chars).

### `inspect <slug>`

- Fetches skill metadata and version files without installing.
- `--version <version>`: inspect a specific version (default: latest).
- `--tag <tag>`: inspect a tagged version (e.g. `latest`).
- `--versions`: list version history (first page).
- `--limit <n>`: max versions to list (1-200).
- `--files`: list files for the selected version.
- `--file <path>`: fetch raw file content (text files only; 200KB limit).
- `--json`: machine-readable output.

### `install <slug>`

- Resolves latest version via `/api/v1/skills/<slug>`.
- Downloads zip via `/api/v1/download`.
- Extracts into `<workdir>/<dir>/<slug>`.
- Writes:
  - `<workdir>/.bothub/lock.json` (legacy `.bothub`)
  - `<skill>/.bothub/origin.json` (legacy `.bothub`)

### `uninstall <slug>`

- Removes `<workdir>/<dir>/<slug>` and deletes the lockfile entry.
- Interactive: asks for confirmation.
- Non-interactive (`--no-input`): requires `--yes`.

### `list`

- Reads `<workdir>/.bothub/lock.json` (legacy `.bothub`).

### `update [slug]` / `update --all`

- Computes fingerprint from local files.
- If fingerprint matches a known version: no prompt.
- If fingerprint does not match:
  - refuses by default
  - overwrites with `--force` (or prompt, if interactive)

### `publish <path>`

- Publishes via `POST /api/v1/skills` (multipart).
- Requires semver: `--version 1.2.3`.

### `delete <slug>`

- Soft-delete a skill (moderator/admin only).
- Calls `DELETE /api/v1/skills/{slug}`.
- `--yes` skips confirmation.

### `undelete <slug>`

- Restore a hidden skill (moderator/admin only).
- Calls `POST /api/v1/skills/{slug}/undelete`.
- `--yes` skips confirmation.

### `hide <slug>`

- Hide a skill (moderator/admin only).
- Alias for `delete`.

### `unhide <slug>`

- Unhide a skill (moderator/admin only).
- Alias for `undelete`.

### `ban-user <handleOrId>`

- Ban a user and delete owned skills (moderator/admin only).
- Calls `POST /api/v1/users/ban`.
- `--id` treats the argument as a user id instead of a handle.
- `--fuzzy` resolves the handle via fuzzy user search (admin only).
- `--reason` records an optional ban reason.
- `--yes` skips confirmation.

### `set-role <handleOrId> <role>`

- Change a user role (admin only).
- Calls `POST /api/v1/users/role`.
- `--id` treats the argument as a user id instead of a handle.
- `--fuzzy` resolves the handle via fuzzy user search (admin only).
- `--yes` skips confirmation.

### `sync`

- Scans for local skill folders and publishes new/changed ones.
- Roots can be any folder: a skills directory or a single skill folder with `SKILL.md`.
- Auto-adds Clawdbot skill roots when `~/.clawdbot/clawdbot.json` is present:
  - `agent.workspace/skills` (main agent)
  - `routing.agents.*.workspace/skills` (per-agent)
  - `~/.clawdbot/skills` (shared)
  - `skills.load.extraDirs` (shared packs)
- Respects `CLAWDBOT_CONFIG_PATH` / `CLAWDBOT_STATE_DIR` and `HANZO_BOT_CONFIG_PATH` / `HANZO_BOT_STATE_DIR`.
- Flags:
  - `--root <dir...>` extra scan roots
  - `--all` upload without prompting
  - `--dry-run` show plan only
  - `--bump patch|minor|major` (default: patch)
  - `--changelog <text>` (non-interactive)
  - `--tags a,b,c` (default: latest)
  - `--concurrency <n>` (default: 4)

Telemetry:

- Sent during `sync` when logged in, unless `BOTHUB_DISABLE_TELEMETRY=1` (legacy `CLAWDHUB_DISABLE_TELEMETRY=1`).
- Details: `docs/telemetry.md`.
