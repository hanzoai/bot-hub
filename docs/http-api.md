---
summary: 'HTTP API reference (public + CLI endpoints + auth).'
read_when:
  - Adding/changing endpoints
  - Debugging CLI ↔ registry requests
---

# HTTP API

Base URL: `https://api.hanzo.ai` (default).

Every path is under `/v1/skills/...`, served by the API in `api/src`. Nothing is served under `/api`.
OpenAPI: `/openapi.json`.

## Rate limits

Enforced per IP + per API key:

- Read: 120/min per IP, 600/min per key
- Write: 30/min per IP, 120/min per key
- Download: 20/min per IP, 120/min per key (`/v1/skills/download`)

Headers:

- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (when limited)

IP source:

- Uses `cf-connecting-ip` (Cloudflare) for client IP by default.
- Set `TRUST_FORWARDED_IPS=true` to opt in to `x-real-ip`, `x-forwarded-for`, or `fly-client-ip` (non-Cloudflare deployments).

## Public endpoints (no auth)

### `GET /v1/skills/search`

Query params:

- `q` (required): query string
- `limit` (optional): integer
- `highlightedOnly` (optional): `true` to filter to highlighted skills

Response:

```json
{ "results": [{ "score": 0.123, "slug": "gifgrep", "displayName": "GifGrep", "summary": "…", "version": "1.2.3", "updatedAt": 1730000000000 }] }
```

Notes:

- Results are returned in relevance order (embedding similarity + exact slug/name token boosts + popularity prior from downloads).

### `GET /v1/skills`

Query params:

- `limit` (optional): integer (1–200)
- `cursor` (optional): pagination cursor (only for `sort=updated`)
- `sort` (optional): `updated` (default), `downloads`, `stars` (alias: `rating`), `installsCurrent` (alias: `installs`), `installsAllTime`, `trending`

Notes:

- `trending` ranks by installs in the last 7 days (telemetry-based).

Response:

```json
{ "items": [{ "slug": "gifgrep", "displayName": "GifGrep", "summary": "…", "tags": { "latest": "1.2.3" }, "stats": {}, "createdAt": 0, "updatedAt": 0, "latestVersion": { "version": "1.2.3", "createdAt": 0, "changelog": "…" } }], "nextCursor": null }
```

### `GET /v1/skills/{slug}`

Response:

```json
{ "skill": { "slug": "gifgrep", "displayName": "GifGrep", "summary": "…", "tags": { "latest": "1.2.3" }, "stats": {}, "createdAt": 0, "updatedAt": 0 }, "latestVersion": { "version": "1.2.3", "createdAt": 0, "changelog": "…" }, "owner": { "handle": "steipete", "displayName": "Peter", "image": null } }
```

### `GET /v1/skills/{slug}/versions`

Query params:

- `limit` (optional): integer
- `cursor` (optional): pagination cursor

### `GET /v1/skills/{slug}/versions/{version}`

Returns version metadata + files list.

### `GET /v1/skills/{slug}/file`

Returns raw text content.

Query params:

- `path` (required)
- `version` (optional)
- `tag` (optional)

Notes:

- Defaults to latest version.
- File size limit: 200KB.

### `GET /v1/skills/resolve`

Used by the CLI to map a local fingerprint to a known version.

Query params:

- `slug` (required)
- `hash` (required): 64-char hex sha256 of the bundle fingerprint

Response:

```json
{ "slug": "gifgrep", "match": { "version": "1.2.2" }, "latestVersion": { "version": "1.2.3" } }
```

### `GET /v1/skills/download`

Downloads a zip of a skill version.

Query params:

- `slug` (required)
- `version` (optional): semver string
- `tag` (optional): tag name (e.g. `latest`)

Notes:

- If neither `version` nor `tag` is provided, the latest version is used.
- Soft-deleted versions return `410`.
- Download stats are counted as unique identities per hour (`userId` when API token is valid, otherwise IP).

## Auth endpoints (Bearer token)

All endpoints require:

```
Authorization: Bearer clh_...
```

### `GET /v1/skills/whoami`

Validates token and returns the user handle.

### `POST /v1/skills`

Publishes a new version.

- Preferred: `multipart/form-data` with `payload` JSON + `files[]` blobs.
- JSON body with `files` (storageId-based) is also accepted.

### `DELETE /v1/skills/{slug}` / `POST /v1/skills/{slug}/undelete`

Soft-delete / restore a skill (moderator/admin only).

Status codes:

- `200`: ok
- `401`: unauthorized
- `403`: forbidden
- `404`: skill/user not found
- `500`: internal server error

### `POST /v1/skills/users/ban`

Ban a user and hard-delete owned skills (moderator/admin only).

Body:

```json
{ "handle": "user_handle", "reason": "optional ban reason" }
```

or

```json
{ "userId": "users_...", "reason": "optional ban reason" }
```

Response:

```json
{ "ok": true, "alreadyBanned": false, "deletedSkills": 3 }
```

### `POST /v1/skills/users/role`

Change a user role (admin only).

Body:

```json
{ "handle": "user_handle", "role": "moderator" }
```

or

```json
{ "userId": "users_...", "role": "admin" }
```

Response:

```json
{ "ok": true, "role": "moderator" }
```

### `GET /v1/skills/users`

List or search users (admin only).

Query params:

- `q` (optional): search query
- `query` (optional): alias for `q`
- `limit` (optional): max results (default 20, max 200)

Response:

```json
{
  "items": [
    {
      "userId": "users_...",
      "handle": "user_handle",
      "displayName": "User",
      "name": "User",
      "role": "moderator"
    }
  ],
  "total": 1
}
```

### `POST /v1/skills/stars/{slug}` / `DELETE /v1/skills/stars/{slug}`

Add/remove a star (highlights). Both endpoints are idempotent.

Responses:

```json
{ "ok": true, "starred": true, "alreadyStarred": false }
```

```json
{ "ok": true, "unstarred": true, "alreadyUnstarred": false }
```

## Registry discovery (`/.well-known/bothub.json`)

The CLI can discover registry/auth settings from the site:

- `/.well-known/bothub.json` (JSON, preferred)
- `/.well-known/bothub.json` (legacy)

Schema:

```json
{ "apiBase": "https://api.hanzo.ai", "authBase": "https://hub.hanzo.bot", "registry": "https://api.hanzo.ai", "minCliVersion": "0.1.0" }
```

If you self-host, serve this file (or set `BOTHUB_REGISTRY` explicitly; legacy `CLAWDHUB_REGISTRY`).
