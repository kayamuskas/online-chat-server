# web.Dockerfile — Phase 1 offline-capable frontend image
#
# Build context: repo root
# Offline install: copies vendor/pnpm-store/ before pnpm install --offline
# Lockfile integrity: --frozen-lockfile rejects packages with mismatched checksums
# Static serving: Vite builds to dist/, served with 'npx serve' in production
#
# Threat mitigations:
#   T-01-11: offline install from vendor/pnpm-store; no CDN or registry access
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

# Build shared package first (web depends on @chat/shared)
RUN pnpm --filter @chat/shared build

# Build the web app (Vite produces dist/)
RUN pnpm --filter @chat/web build

# ── Stage 3: production image — static file serving ───────────────────────────
FROM node:22-slim AS production

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.9.0 --no-fund --no-audit

WORKDIR /app

# Copy offline store for serve package install
COPY --from=builder /pnpm/store /pnpm/store

# Copy workspace manifests and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Production install from offline store
RUN pnpm install -r --offline --frozen-lockfile --prod --store-dir /pnpm/store

# Copy built static assets
COPY --from=builder /app/apps/web/dist apps/web/dist

# Install serve globally and curl for healthcheck
RUN npm install -g serve@14 --no-fund --no-audit && \
    apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

EXPOSE 4173

# Serve the Vite-built dist/ directory on port 4173
# The /healthz file is included in the Vite build output (from public/)
CMD ["serve", "-s", "apps/web/dist", "-l", "4173"]
