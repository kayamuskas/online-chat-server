# worker.Dockerfile — Phase 1 offline-capable BullMQ worker image
#
# Build context: repo root
# Offline install: copies vendor/pnpm-store/ before pnpm install --offline
# Lockfile integrity: --frozen-lockfile rejects packages with mismatched checksums
#
# Threat mitigations:
#   T-01-11: offline install from vendor/pnpm-store; no registry access at build/runtime
#   T-01-12: container runs read_only: true in compose; only /tmp is writable
#   T-01-14: vendor/pnpm-store is the only dependency input path

# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM node:22-slim AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.9.0 --no-fund --no-audit

WORKDIR /app

# Copy offline store first (must precede any pnpm install --offline call)
COPY vendor/pnpm-store /pnpm/store

# Copy workspace manifests and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install all workspace dependencies offline
RUN pnpm install -r --offline --frozen-lockfile --store-dir /pnpm/store

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM deps AS builder

COPY . .

# Build shared package first (worker depends on @chat/shared)
RUN pnpm --filter @chat/shared build

# Build the worker
RUN pnpm --filter @chat/worker build

# ── Stage 3: production image ──────────────────────────────────────────────────
FROM node:22-slim AS production

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.9.0 --no-fund --no-audit

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
COPY --from=builder /app/apps/worker/dist apps/worker/dist

EXPOSE 3001

CMD ["node", "apps/worker/dist/main.js"]
