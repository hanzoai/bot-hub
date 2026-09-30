# ─── Stage 1: Get Base binary ────────────────────────────────────────────────
# Pinned: base/hz_migrations is written against this release's schema API.
FROM ghcr.io/hanzoai/base:1.5.91@sha256:8d042b1c62d4c2eeac41128eaa2a6b99f2b73e53f311058441197662e4d34690 AS base-build

# ─── Stage 2: Build API ──────────────────────────────────────────────────────
FROM node:22-slim AS api-build
WORKDIR /app/api
COPY api/package.json api/tsconfig.json ./
RUN npm install --production=false
COPY api/src ./src
RUN npx tsc

# ─── Stage 3: Build Web (TanStack Start + Nitro) ────────────────────────────
FROM oven/bun:1 AS web-build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ ./packages/
RUN bun install --frozen-lockfile
COPY . .
RUN bun --bun run build

# ─── Stage 4: Production ────────────────────────────────────────────────────
FROM oven/bun:1 AS production
WORKDIR /app

# Base binary
COPY --from=base-build /app/base /usr/local/bin/base

# Base migrations
COPY base/hz_migrations ./hz_migrations

# API server
COPY --from=api-build /app/api/dist ./api/dist
COPY --from=api-build /app/api/package.json ./api/
COPY --from=api-build /app/api/node_modules ./api/node_modules

# Web build
COPY --from=web-build /app/.output ./.output

# Startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001
ENV WEB_PORT=3000

EXPOSE 3000 3001

ENTRYPOINT ["/docker-entrypoint.sh"]
