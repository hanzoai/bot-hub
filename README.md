# Bot Hub

<p align="center">
  <a href="https://github.com/hanzo-bot/bothub/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/hanzo-bot/bothub/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

Bot Hub is the **public skill registry for Clawdbot**: publish, version, and search text-based agent skills (a `SKILL.md` plus supporting files).
It’s designed for fast browsing + a CLI-friendly API, with moderation hooks and vector search.

personas.hanzo.ai is the **PERSONA.md registry**: publish and share system lore the same way you publish skills.

Live: `https://hub.hanzo.bot`
personas.hanzo.ai: `https://personas.hanzo.ai`

## What you can do with it

- Browse skills + render their `SKILL.md`.
- Publish new skill versions with changelogs + tags (including `latest`).
- Browse personas + render their `PERSONA.md`.
- Publish new persona versions with changelogs + tags.
- Search via embeddings (vector index) instead of brittle keywords.
- Star + comment; admins/mods can curate and approve skills.

## personas.hanzo.ai (PERSONA.md registry)

- Entry point is host-based: `personas.hanzo.ai`.
- On the personas.hanzo.ai host, the home page and nav default to personas.
- On Bot Hub, personas live under `/personas`.
- Persona bundles only accept `PERSONA.md` for now (no extra files).

## How it works (high level)

- Web app: TanStack Start (React, Vite/Nitro).
- Backend: Convex (DB + file storage + HTTP actions) + Convex Auth (GitHub OAuth).
- Search: OpenAI embeddings (`text-embedding-3-small`) + Convex vector search.
- API schema + routes: `packages/schema` (`bothub-schema`).

## CLI

Common CLI flows:

- Auth: `bothub login`, `bothub whoami`
- Discover: `bothub search ...`, `bothub explore`
- Manage local installs: `bothub install <slug>`, `bothub uninstall <slug>`, `bothub list`, `bothub update --all`
- Inspect without installing: `bothub inspect <slug>`
- Publish/sync: `bothub publish <path>`, `bothub sync`

Docs: `docs/quickstart.md`, `docs/cli.md`.


## Telemetry

Bot Hub tracks minimal **install telemetry** (to compute install counts) when you run `bothub sync` while logged in.
Disable via:

```bash
export BOTHUB_DISABLE_TELEMETRY=1
```

Details: `docs/telemetry.md`.

## Repo layout

- `src/` — TanStack Start app (routes, components, styles).
- `convex/` — schema + queries/mutations/actions + HTTP API routes.
- `packages/schema/` — shared API types/routes for the CLI and app.
- `docs/spec.md` — product + implementation spec (good first read).

## Local dev

Prereqs: Bun + Convex CLI.

```bash
bun install
cp .env.local.example .env.local

# terminal A: web app
bun run dev

# terminal B: Convex dev deployment
bunx convex dev
```

## Auth (GitHub OAuth) setup

Create a GitHub OAuth App, set `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`, then:

```bash
bunx auth --deployment-name <deployment> --web-server-url http://localhost:3000
```

This writes `JWT_PRIVATE_KEY` + `JWKS` to the deployment and prints values for your local `.env.local`.

## Environment

- `VITE_CONVEX_URL`: Convex deployment URL (`https://<deployment>.convex.cloud`).
- `VITE_CONVEX_SITE_URL`: Convex site URL (`https://<deployment>.convex.site`).
- `VITE_PERSONAHUB_SITE_URL`: personas.hanzo.ai site URL (`https://personas.hanzo.ai`).
- `VITE_PERSONAHUB_HOST`: personas.hanzo.ai host match (`personas.hanzo.ai`).
- `VITE_SITE_MODE`: Optional override (`skills` or `personas`) for SSR builds.
- `CONVEX_SITE_URL`: same as `VITE_CONVEX_SITE_URL` (auth + cookies).
- `SITE_URL`: App URL (local: `http://localhost:3000`).
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`: GitHub OAuth App.
- `JWT_PRIVATE_KEY` / `JWKS`: Convex Auth keys.
- `OPENAI_API_KEY`: embeddings for search + indexing.

## Nix plugins (nixmode skills)

Bot Hub can store a nix-clawdbot plugin pointer in SKILL frontmatter so the registry knows which
Nix package bundle to install. A nix plugin is different from a regular skill pack: it bundles the
skill pack, the CLI binary, and its config flags/requirements together.

Add this to `SKILL.md`:

```yaml
---
name: peekaboo
description: Capture and automate macOS UI with the Peekaboo CLI.
metadata: {"clawdbot":{"nix":{"plugin":"github:clawdbot/nix-steipete-tools?dir=tools/peekaboo","systems":["aarch64-darwin"]}}}
---
```

Install via nix-clawdbot:

```nix
programs.clawdbot.plugins = [
  { source = "github:clawdbot/nix-steipete-tools?dir=tools/peekaboo"; }
];
```

You can also declare config requirements + an example snippet:

```yaml
---
name: padel
description: Check padel court availability and manage bookings via Playtomic.
metadata: {"clawdbot":{"config":{"requiredEnv":["PADEL_AUTH_FILE"],"stateDirs":[".config/padel"],"example":"config = { env = { PADEL_AUTH_FILE = \\\"/run/agenix/padel-auth\\\"; }; };"}}}
---
```

To show CLI help (recommended for nix plugins), include the `cli --help` output:

```yaml
---
name: padel
description: Check padel court availability and manage bookings via Playtomic.
metadata: {"clawdbot":{"cliHelp":"padel --help\\nUsage: padel [command]\\n"}}
---
```

`metadata.clawdbot` is preferred, but `metadata.clawdis` and `metadata.hanzo-bot` are accepted as aliases.

## Skill metadata

Skills declare their runtime requirements (env vars, binaries, install specs) in the `SKILL.md` frontmatter. Bot Hub's security analysis checks these declarations against actual skill behavior.

Full reference: [`docs/skill-format.md`](docs/skill-format.md#frontmatter-metadata)

Quick example:

```yaml
---
name: my-skill
description: Does a thing with an API.
metadata:
  hanzo-bot:
    requires:
      env:
        - MY_API_KEY
      bins:
        - curl
    primaryEnv: MY_API_KEY
---
```

## Scripts

```bash
bun run dev
bun run build
bun run test
bun run coverage
bun run lint
```
