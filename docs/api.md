---
summary: 'Public REST API (v1) overview and conventions.'
read_when:
  - Building API clients
  - Adding endpoints or schemas
---

# API v1

Base: `https://hub.hanzo.bot`

OpenAPI: `/openapi.json`

## Auth

- Public read: no token required.
- Write + account: `Authorization: Bearer clh_...`.

## Rate limits

Per IP + per API key:

- Read: 120/min per IP, 600/min per key
- Write: 30/min per IP, 120/min per key

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (on 429).

## Endpoints

Public read:

- `GET /v1/search?q=...`
- `GET /v1/skills?limit=&cursor=&sort=`
  - `sort`: `updated` (default), `downloads`, `stars` (`rating`), `installsCurrent` (`installs`), `installsAllTime`, `trending`
- `GET /v1/skills/{slug}`
- `GET /v1/skills/{slug}/versions?limit=&cursor=`
- `GET /v1/skills/{slug}/versions/{version}`
- `GET /v1/skills/{slug}/file?path=&version=&tag=`
- `GET /v1/resolve?slug=&hash=`
- `GET /v1/download?slug=&version=&tag=`

Auth required:

- `POST /v1/skills` (publish, multipart preferred)
- `DELETE /v1/skills/{slug}`
- `POST /v1/skills/{slug}/undelete`
- `GET /v1/whoami`

