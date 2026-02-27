# ─── Stage 1: Build Base (Go) ────────────────────────────────────────────────
FROM golang:1.24-alpine AS base-build
WORKDIR /build
# Copy Base source from the hanzo/base repo (built separately or vendored)
# For now, download and build from the existing binary or use a prebuilt image
# In CI, this stage can be replaced with COPY --from=ghcr.io/hanzoai/base:latest
ARG BASE_VERSION=latest
RUN apk add --no-cache git
COPY base/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /base examples/base/main.go

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
ENV VITE_API_URL=/api
RUN bun --bun run build

# ─── Stage 4: Production ────────────────────────────────────────────────────
FROM oven/bun:1 AS production
WORKDIR /app

# Base binary
COPY --from=base-build /base /usr/local/bin/base

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
ENV BASE_PORT=8090

EXPOSE 3000 3001 8090

ENTRYPOINT ["/docker-entrypoint.sh"]
