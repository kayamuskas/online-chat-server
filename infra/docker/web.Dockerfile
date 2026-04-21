# web.Dockerfile — Phase 1 frontend image
#
# Build context: repo root
# Lockfile integrity: --frozen-lockfile rejects packages with mismatched checksums
# Static serving: Vite builds to dist/, served with 'npx serve' in production
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

ARG VITE_API_BASE_URL=http://localhost:3000
ARG VITE_SOCKET_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

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

# Copy workspace manifests and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Production install from the lockfile
RUN pnpm install -r --frozen-lockfile --prod

# Copy built static assets
COPY --from=builder /app/apps/web/dist apps/web/dist

# Install serve globally and curl for healthcheck
RUN npm install -g serve@14 --no-fund --no-audit && \
    apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

EXPOSE 4173

# Serve the Vite-built dist/ directory on port 4173
# The /healthz file is included in the Vite build output (from public/)
CMD ["serve", "-s", "apps/web/dist", "-l", "4173"]
