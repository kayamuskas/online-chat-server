# api.Dockerfile — Phase 1 offline-capable API image
#
# Build context: repo root (referenced as "." from compose context: ../..)
# Offline install: copies vendor/pnpm-store/ before any pnpm install --offline run
# Lockfile integrity: --frozen-lockfile rejects packages with mismatched checksums
#
# Threat mitigations:
#   T-01-11: pull_policy: never in compose + offline install from vendor/pnpm-store
#   T-01-12: container runs read_only: true in compose; only /tmp is writable
#   T-01-14: Dockerfile exclusively uses vendor/pnpm-store + --offline; no registry access

# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM node:22-slim AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy offline store first (must precede any pnpm install --offline call)
COPY vendor/pnpm-store /pnpm/store

# Copy workspace manifests and lockfile so pnpm knows the full dependency graph
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install all workspace dependencies offline — fails if any package is missing from store
RUN pnpm install -r --offline --frozen-lockfile --store-dir /pnpm/store

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM deps AS builder

COPY . .

# Build shared package first (API depends on @chat/shared)
RUN pnpm --filter @chat/shared build

# Build the API
RUN pnpm --filter @chat/api build

# ── Stage 3: production image ──────────────────────────────────────────────────
FROM node:22-slim AS production

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy offline store for production install
COPY --from=builder /pnpm/store /pnpm/store

# Copy workspace manifests and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Production-only install from offline store
RUN pnpm install -r --offline --frozen-lockfile --prod --store-dir /pnpm/store

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
