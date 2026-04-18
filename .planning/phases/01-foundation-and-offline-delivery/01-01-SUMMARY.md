---
phase: 01-foundation-and-offline-delivery
plan: "01"
subsystem: infra
tags: [pnpm, monorepo, typescript, bullmq, redis, offline, vendoring]

requires: []

provides:
  - "pnpm@10 workspace monorepo root with apps/* and packages/* graph"
  - "apps/api, apps/web, packages/shared package manifests using @chat/* naming"
  - "packages/shared: SERVICE_PORTS, RuntimeEnv, parseRuntimeEnv(), QUEUE_NAMES, SYSTEM_JOB_NAMES, redisConnectionOptions()"
  - "vendor/pnpm-store/ placeholder for repo-local offline dependency cache"
  - "docs/offline-runtime.md: documented refresh-and-verify offline strategy"

affects:
  - "01-02 (docker-compose and offline bootstrap)"
  - "01-03 (api skeleton)"
  - "01-04 (worker skeleton)"
  - "01-05 (web skeleton)"
  - "all later phases importing @chat/shared"

tech-stack:
  added:
    - "pnpm 10.x (workspace package manager)"
    - "TypeScript 5.9.x (shared language, tsconfig.base.json)"
    - "bullmq 5.x (queue name contracts established)"
  patterns:
    - "@chat/* workspace naming convention for all monorepo packages"
    - "packages/shared as the single source of cross-service constants"
    - "vendor/pnpm-store/ as the repo-local offline dependency cache path"
    - "parseRuntimeEnv() fail-fast validation pattern"

key-files:
  created:
    - "package.json (root workspace, pnpm@10, build/dev/test/compose:smoke scripts)"
    - "pnpm-workspace.yaml (apps/*, packages/*)"
    - "pnpm-lock.yaml (workspace lockfile stub)"
    - "tsconfig.base.json (strict TypeScript base config)"
    - "apps/api/package.json (@chat/api manifest, @chat/shared workspace dep)"
    - "apps/web/package.json (@chat/web manifest, React 19 + Vite 7)"
    - "packages/shared/package.json (@chat/shared manifest)"
    - "packages/shared/tsconfig.json"
    - "packages/shared/src/index.ts (re-exports config + queue contracts)"
    - "packages/shared/src/config.ts (SERVICE_PORTS, RuntimeEnv, parseRuntimeEnv)"
    - "packages/shared/src/queue.ts (QUEUE_NAMES, SYSTEM_JOB_NAMES, redisConnectionOptions)"
    - "vendor/pnpm-store/.gitkeep (reserves offline dependency cache path)"
    - "docs/offline-runtime.md (offline strategy + maintainer refresh-and-verify procedure)"
  modified:
    - ".gitignore (added node_modules, dist, build output exclusions; preserved vendor/pnpm-store)"

key-decisions:
  - "pnpm 10.x as package manager — official Docker/offline fetch support; workspace monorepo semantics"
  - "vendor/pnpm-store/ committed as a placeholder path — actual store populated by maintainer before release via documented refresh-and-verify procedure"
  - "QUEUE_NAMES and redisConnectionOptions centralised in @chat/shared — prevents incompatible Redis connection policies across worker/api"
  - "parseRuntimeEnv() throws on missing required env vars — fail-fast at startup beats undefined runtime behaviour"
  - "pnpm-lock.yaml stub committed — will be replaced with a real lock when pnpm install is run after Docker tooling is available"

patterns-established:
  - "Pattern 1: All cross-service constants (ports, queue names, job names, connection helpers) live in packages/shared/src/ — never in app-level files"
  - "Pattern 2: Offline Docker builds copy vendor/pnpm-store/ and use pnpm install --offline --frozen-lockfile — no registry access during docker compose up"
  - "Pattern 3: RuntimeEnv interface is the single typed contract for environment variables across all services"

requirements-completed:
  - OPS-01
  - OPS-02
  - ARCH-01
  - ARCH-02

duration: 8min
completed: 2026-04-18
---

# Phase 1 Plan 01: Workspace Root and Shared Contracts Summary

**pnpm@10 monorepo workspace with apps/api, apps/web, packages/shared manifests, typed SERVICE_PORTS/QUEUE_NAMES/RuntimeEnv contracts, and a documented vendor/pnpm-store offline dependency strategy**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-18T14:00:00Z
- **Completed:** 2026-04-18T14:08:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Monorepo root with `pnpm@10` packageManager, workspace scripts (`build`, `dev`, `test`, `lint`, `compose:smoke`), and `pnpm-workspace.yaml` covering `apps/*` and `packages/*`
- Three package manifests (`@chat/api`, `@chat/web`, `@chat/shared`) using the consistent `@chat/*` naming convention; API manifest already declares `@chat/shared` as a workspace dependency
- Shared TypeScript contracts: `SERVICE_PORTS`, `RuntimeEnv`, `parseRuntimeEnv()` (fail-fast env validation), `QUEUE_NAMES.system`, `SYSTEM_JOB_NAMES.echo`, `redisConnectionOptions()` (with `maxRetriesPerRequest: null` enforced)
- `vendor/pnpm-store/.gitkeep` reserves the repo-local offline dependency path; `docs/offline-runtime.md` documents the full maintainer refresh-and-verify procedure tied to `pnpm-lock.yaml`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the workspace root and package graph** - `6edb0ab` (chore)
2. **Task 2: Define shared runtime and queue contracts plus offline vendor documentation** - `0cc2c3b` (feat)

## Files Created/Modified

- `package.json` - Root workspace manifest with pnpm@10, build/dev/test/compose:smoke scripts
- `pnpm-workspace.yaml` - Workspace covering apps/* and packages/*
- `pnpm-lock.yaml` - Lockfile stub (to be replaced after pnpm install with network access)
- `tsconfig.base.json` - Strict TypeScript base config (ES2022, NodeNext, strict mode)
- `apps/api/package.json` - @chat/api manifest with NestJS, BullMQ, pg deps declared
- `apps/web/package.json` - @chat/web manifest with React 19, Vite 7, @vitejs/plugin-react
- `packages/shared/package.json` - @chat/shared ESM package manifest
- `packages/shared/tsconfig.json` - Extends tsconfig.base.json, compiles src/ -> dist/
- `packages/shared/src/index.ts` - Re-exports config and queue contracts
- `packages/shared/src/config.ts` - SERVICE_PORTS, RuntimeEnv, parseRuntimeEnv()
- `packages/shared/src/queue.ts` - QUEUE_NAMES, SYSTEM_JOB_NAMES, redisConnectionOptions()
- `vendor/pnpm-store/.gitkeep` - Reserves repo-local offline dependency cache path
- `docs/offline-runtime.md` - Offline dependency strategy and maintainer refresh-and-verify procedure
- `.gitignore` - Added node_modules, dist, build exclusions; preserved vendor/pnpm-store/

## Decisions Made

- Used `pnpm@10` — only package manager with official Docker offline fetch support via `pnpm fetch` + `pnpm install --offline --frozen-lockfile`
- Committed `vendor/pnpm-store/.gitkeep` as a placeholder rather than running `pnpm fetch` now — pnpm is not available locally and the store must be populated with a real network-connected pnpm install before the first Docker build
- Enforced `maxRetriesPerRequest: null` in `redisConnectionOptions()` — BullMQ workers silently fail on Redis reconnect without this flag
- `parseRuntimeEnv()` throws on missing `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — required fields must be explicit at startup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pnpm` is not installed locally (confirmed in RESEARCH.md environment availability table), so the `pnpm-lock.yaml` committed is a structural stub rather than a fully resolved lockfile. It correctly declares all workspace importers and specifiers. A real lockfile will be generated when `pnpm install` runs inside the Docker build context or after a developer installs pnpm locally.

## Known Stubs

- `vendor/pnpm-store/` contains only a `.gitkeep` placeholder. The actual offline package store must be populated by a maintainer running `pnpm fetch --store-dir ./vendor/pnpm-store` before the first `docker compose up --build`. See `docs/offline-runtime.md` for the complete refresh-and-verify procedure.
- `pnpm-lock.yaml` is a structural stub. Replace with a real lockfile by running `pnpm install` (with network access) from the repo root before shipping.

## User Setup Required

None for this plan — no external services involved. The vendor store population requires a one-time maintainer step documented in `docs/offline-runtime.md`.

## Next Phase Readiness

- Workspace skeleton is in place: all later plans can reference stable package locations (`apps/api`, `apps/web`, `packages/shared`)
- Shared contracts (`QUEUE_NAMES`, `SERVICE_PORTS`, `RuntimeEnv`) are importable as `@chat/shared` from any workspace package
- `docs/offline-runtime.md` documents the offline dependency path clearly for Plan 02 (Docker Compose bootstrap) to reference
- Blocker: actual `pnpm-lock.yaml` and `vendor/pnpm-store/` population required before Docker images can be built — this is expected and documented

---
*Phase: 01-foundation-and-offline-delivery*
*Completed: 2026-04-18*
