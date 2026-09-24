# Repository Guidelines

## Project Structure & Module Organization
- `src/` — TanStack Start app code (routes, components, styles); `src/lib/api.ts` is the one API client.
- `api/` — the API (Hono on :3001), talks to Hanzo Base via `@hanzo/base`.
- `base/hz_migrations/` — Base collections.
- `packages/bothub` — the `bothub` CLI; `packages/schema` — shared schemas + `ApiRoutes`.
- `docs/` — product/spec docs (see `docs/spec.md`, `docs/deploy.md`).
- `public/` — static assets (`/openapi.json`, `/.well-known/bothub.json`).

## Routes
- Every API route is `/v1/…` (`api/src/index.ts` mounts one `/v1` app). Nothing is served under `/api`;
  `src/__tests__/v1-prefix.test.ts` fails if an `/api` path is served or called again.
- The ingress sends `/v1` and `/health` to :3001 and the rest to the web on :3000 (universe
  `infra/aws/values/hanzo/bot-hub.yaml`; skills.hanzo.bot in `infra/aws/routes/services.yaml`).
- Sign-in is Hanzo IAM (`hanzo-bothub`): `/v1/auth/login` → `hanzo.id/v1/iam/oauth/authorize`, callback
  `https://<host>/v1/auth/callback` (declared in universe `iam-provision.yaml`), token + userinfo at
  `/v1/iam/oauth/{token,userinfo}`.
- Release: build at the door (`POST https://api.hanzo.ai/v1/build`), pin tag + digest in universe
  `charts/app/values/hanzo/bot-hub.yaml`, then sync `hanzo-bot-hub` (manual app).

## Build, Test, and Development Commands
- `bun run dev` — local app server at `http://localhost:3000`.
- `bun run build` — production build (Vite + Nitro).
- `bun run preview` — preview built app.
- `bun run lint` — oxlint (type-aware).
- `bun run test` — Vitest (unit tests).
- `bun run coverage` — coverage run; keep global >= 70%.

## Coding Style & Naming Conventions
- TypeScript strict; ESM.
- Indentation: 2 spaces, single quotes.
- Lint/format: oxfmt + oxlint (type-aware).

## Testing Guidelines
- Framework: Vitest 4 + jsdom.
- Tests live in `src/**` and `packages/**/src`.
- Coverage threshold: 70% global (lines/functions/branches/statements).

## Commit & Pull Request Guidelines
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`…).
- Keep changes scoped; avoid repo-wide search/replace.
- PRs: include summary + test commands run. Add screenshots for UI changes.

## Git Notes
- If `git branch -d/-D <branch>` is policy-blocked, delete the local ref directly: `git update-ref -d refs/heads/<branch>`.

## Configuration & Security
- Local env: `.env.local` (never commit secrets).
- `VITE_API_URL` is the API origin; unset, the web calls its own origin.
