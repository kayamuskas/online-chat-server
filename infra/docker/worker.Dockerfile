# worker.Dockerfile — Phase 1 BullMQ worker image
#
# Build context: repo root
# Lockfile integrity: --frozen-lockfile rejects packages with mismatched checksums
#
# Threat mitigations:
#   T-01-11: deterministic install from pnpm-lock.yaml during Docker build
#   T-01-12: container runs read_only: true in compose; only /tmp is writable
#   T-01-14: dependency graph is pinned by pnpm-lock.yaml

# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM node:22-slim AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.9.0 --no-fund --no-audit

WORKDIR /app

# Copy workspace manifests and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Install all workspace dependencies from the lockfile
RUN pnpm install -r --frozen-lockfile

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

# Copy workspace manifests and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Production-only install from the lockfile
RUN pnpm install -r --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/worker/dist apps/worker/dist

EXPOSE 3001

CMD ["node", "apps/worker/dist/main.js"]
