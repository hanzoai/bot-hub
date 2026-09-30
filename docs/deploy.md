---
summary: 'Deploy: one image (Base + API + web), pinned by digest in hanzoai/universe.'
read_when:
  - Shipping to production
  - Debugging /v1 routing
---

# Deploy

One image, `ghcr.io/hanzoai/bot-hub`, runs three processes (`docker-entrypoint.sh`):

- Hanzo Base on 127.0.0.1:8090 (data; reachable only inside the pod)
- the API (Hono, `api/`) on :3001 — every route under `/v1/skills`, plus `/health`
- the web app (TanStack Start + Nitro) on :3000

`api.hanzo.ai/v1/skills` reaches :3001 (hanzoai/universe `infra/aws/routes/services.yaml`,
router `skills`). hub, market and skills.hanzo.bot serve the web from :3000, and their
`/v1/…` answers 308 to `api.hanzo.ai/v1/skills/…`. Nothing is served under `/api`.

Sign-in is Hanzo IAM: the API redirects to `https://hanzo.id/v1/iam/oauth/authorize`
as `hanzo-bothub`, and IAM calls back to `https://api.hanzo.ai/v1/skills/auth/callback`,
declared in universe `charts/app/values/hanzo/iam-provision.yaml`.

## Release

1. Build at the build door (`POST https://api.hanzo.ai/v1/build`), never on a workstation.
2. Pin the tag and digest in universe `charts/app/values/hanzo/bot-hub.yaml`; CD rolls it.

## Registry discovery

The CLI discovers the API base from `/.well-known/bothub.json`. Without it, set:

```bash
export BOTHUB_REGISTRY=https://api.hanzo.ai
```

## Post-deploy checks

```bash
curl -i https://api.hanzo.ai/v1/skills            # 200, public, ETag
curl -i https://api.hanzo.ai/v1/skills/auth/me    # 401, private, no-store
curl -i https://hub.hanzo.bot/v1/skills           # 308 -> https://api.hanzo.ai/v1/skills
```
