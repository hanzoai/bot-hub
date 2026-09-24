---
summary: 'Deploy: one image (Base + API + web), pinned by digest in hanzoai/universe.'
read_when:
  - Shipping to production
  - Debugging /v1 routing
---

# Deploy

One image, `ghcr.io/hanzoai/bot-hub`, runs three processes (`docker-entrypoint.sh`):

- Hanzo Base on :8090 (data)
- the API (Hono, `api/`) on :3001 — every route under `/v1`, plus `/health`
- the web app (TanStack Start + Nitro) on :3000

The ingress sends `/v1` and `/health` to :3001 and everything else to :3000
(hanzoai/universe `infra/aws/values/hanzo/bot-hub.yaml`; skills.hanzo.bot in
`infra/aws/routes/services.yaml`). Nothing is served under `/api`.

Sign-in is Hanzo IAM: the API redirects to `https://hanzo.id/v1/iam/oauth/authorize`
as `hanzo-bothub`, and IAM calls back to `https://<host>/v1/auth/callback`. Those
redirect URIs are declared in universe `charts/app/values/hanzo/iam-provision.yaml`.

## Release

1. Build at the build door (`POST https://api.hanzo.ai/v1/build`), never on a workstation.
2. Pin the tag and digest in universe `charts/app/values/hanzo/bot-hub.yaml`; CD rolls it.

## Registry discovery

The CLI discovers the API base from `/.well-known/bothub.json`. Without it, set:

```bash
export BOTHUB_REGISTRY=https://your-site.example
```

## Post-deploy checks

```bash
curl -i https://hub.hanzo.bot/health       # 200
curl -i https://hub.hanzo.bot/v1/auth/me   # 401
curl -i https://hub.hanzo.bot/api/auth/me  # 404
```
