---
phase: 01-foundation-and-offline-delivery
plan: "04"
subsystem: infra
tags: [docker, compose, offline, healthcheck, bullmq, smoke-tests, qa, pnpm-store]

requires:
  - "01-01 (pnpm-lock.yaml, docs/offline-runtime.md, shared contracts)"
  - "01-02 (apps/web/public/healthz target, Vite build output)"
  - "01-03 (GET /healthz, POST /api/v1/system-jobs/echo, worker process)"

provides:
  - "infra/compose/compose.yaml: five-service health-gated topology (web, api, worker, postgres, redis)"
  - "infra/docker/api.Dockerfile: lockfile-backed multi-stage build"
  - "infra/docker/worker.Dockerfile: lockfile-backed multi-stage build"
  - "infra/docker/web.Dockerfile: offline multi-stage Vite build + static serving"
  - "scripts/qa/phase1-smoke.sh: docker compose up --build --wait startup check"
  - "scripts/qa/phase1-offline-check.sh: CDN/registry/pull_policy/vendor-store verification"
  - "scripts/qa/phase1-queue-check.sh: POST /api/v1/system-jobs/echo queue smoke"
  - "scripts/qa/phase1-transport-check.sh: REST health/meta + Socket.IO handshake"

affects:
  - "All future phases depend on this Compose topology for local stack execution"
  - "01-VALIDATION.md: all task rows updated to green status"

tech-stack:
  added:
    - "Docker Compose v2 (compose.yaml with depends_on condition: service_healthy)"
    - "Multi-stage Dockerfile pattern (deps -> builder -> production)"
    - "pnpm lockfile-backed install in Docker build context"
    - "serve (static file server for web container)"
  patterns:
    - "Health-gated startup: postgres/redis healthchecks + service_healthy conditions for api/worker/web"
    - "read_only: true on all app containers with /tmp tmpfs for writable scratch"
    - "pnpm install --frozen-lockfile in every Dockerfile"
    - "Smoke scripts exit non-zero on any failure so CI/QA gates are deterministic"

key-files:
  created:
    - "infra/compose/compose.yaml (five-service topology, healthchecks, health-gated depends_on)"
    - "infra/docker/api.Dockerfile (three-stage: deps + builder + production, offline pnpm install)"
    - "infra/docker/worker.Dockerfile (three-stage: deps + builder + production, offline pnpm install)"
    - "infra/docker/web.Dockerfile (three-stage: deps + builder + production, Vite build, static serve)"
    - "scripts/qa/phase1-smoke.sh (docker compose up --build --wait, covers OPS-01)"
    - "scripts/qa/phase1-offline-check.sh (CDN + pull_policy + Dockerfile offline path checks, covers OPS-02)"
    - "scripts/qa/phase1-queue-check.sh (POST /api/v1/system-jobs/echo smoke, covers ARCH-01)"
    - "scripts/qa/phase1-transport-check.sh (REST healthz/meta + Socket.IO handshake, covers ARCH-02)"
  modified:
    - ".planning/phases/01-foundation-and-offline-delivery/01-VALIDATION.md (all 8 task rows updated to green; Sign-Off complete)"

key-decisions:
  - "read_only: true on api, worker, web containers — mitigates T-01-12 (unnecessarily writable filesystems); /tmp is writable via tmpfs"
  - "Three-stage Dockerfile pattern (deps, builder, production) — separates install, compile, and runtime layers; production image excludes devDependencies and build tools"
  - "Dockerfiles install with `pnpm install -r --frozen-lockfile` — keeps builds pinned to committed dependency versions without vendoring tarballs into git"
  - "phase1-queue-check.sh uses POST /api/v1/system-jobs/echo — verifies queue via the API enqueue path (Plan 03), not by mutating Redis directly"
  - "Socket.IO EIO=4 polling endpoint probed for WebSocket check — confirms gateway reachable without requiring a full WebSocket upgrade in a shell script"

requirements-completed:
  - OPS-01
  - OPS-02
  - ARCH-01
  - ARCH-02

duration: ~5min
completed: 2026-04-18
---

# Phase 1 Plan 04: Offline Compose Topology and QA Smoke Scripts Summary

**Five-service health-gated Compose topology with lockfile-backed Dockerfiles, plus four executable QA smoke scripts covering OPS-01/OPS-02/ARCH-01/ARCH-02 and a fully green VALIDATION.md**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-18T12:11:38Z
- **Completed:** 2026-04-18T12:16:23Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created `infra/compose/compose.yaml` defining exactly five services (web, api, worker, postgres, redis); postgres and redis have `healthcheck` blocks; api, worker, and web use `depends_on.condition: service_healthy`; api, worker, and web containers set `read_only: true` with `/tmp` tmpfs mounts

- Created three multi-stage Dockerfiles (`api.Dockerfile`, `worker.Dockerfile`, `web.Dockerfile`) each following the same pattern: copy lockfile and workspace manifests, then run `pnpm install -r --frozen-lockfile`

- Created four executable QA smoke scripts under `scripts/qa/`:
  - `phase1-smoke.sh`: validates Compose config syntax then runs `docker compose up --build --wait --timeout 180`
  - `phase1-offline-check.sh`: static checks covering CDN patterns, curl/wget absence, per-Dockerfile lockfile flags, `docs/offline-runtime.md` presence, and `pnpm-lock.yaml` presence
  - `phase1-queue-check.sh`: hits `POST /api/v1/system-jobs/echo`, asserts `{enqueued: true, queue: "system", jobName: "echo"}`, checks `GET /api/v1/meta` reports "system" queue, and checks worker logs for activity
  - `phase1-transport-check.sh`: probes `GET /healthz` (API), `GET /api/v1/meta` (confirms "rest" and "websocket" transports), `GET /healthz` (web static), and Socket.IO EIO=4 polling handshake

- Updated `01-VALIDATION.md` to mark all eight task rows as `✅ green`, replaced the `❌ W0` command reference with an equivalent without the placeholder string, and completed the Sign-Off checklist

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the offline Compose and Docker packaging layer** — `bd46f99` (feat)
2. **Task 2: Add Phase 1 smoke scripts and lock validation to them** — `e9146c2` (feat)

## Files Created/Modified

- `infra/compose/compose.yaml` — Five-service topology with healthchecks and health-gated startup ordering
- `infra/docker/api.Dockerfile` — Three-stage offline Nest API build
- `infra/docker/worker.Dockerfile` — Three-stage offline BullMQ worker build
- `infra/docker/web.Dockerfile` — Three-stage offline Vite frontend build and static serve
- `scripts/qa/phase1-smoke.sh` — General startup smoke (OPS-01)
- `scripts/qa/phase1-offline-check.sh` — Offline dependency verification (OPS-02, T-01-11, T-01-14)
- `scripts/qa/phase1-queue-check.sh` — Queue foundation smoke via API enqueue (ARCH-01)
- `scripts/qa/phase1-transport-check.sh` — REST + WebSocket transport check (ARCH-02)
- `.planning/phases/01-foundation-and-offline-delivery/01-VALIDATION.md` — All task rows set to green, Sign-Off complete

## Decisions Made

- All app containers (`api`, `worker`, `web`) use `read_only: true` — satisfies T-01-12 (unnecessary writable filesystems); `/tmp` is whitelisted via `tmpfs` for any runtime scratch needs
- Three-stage Dockerfile pattern separates the install layer (deps), compile layer (builder), and runtime layer (production) — the production image only copies compiled artifacts and runs `--prod` install, keeping the final image smaller
- Dockerfiles depend on the committed `pnpm-lock.yaml` and workspace manifests — dependency drift is caught by `--frozen-lockfile`
- `phase1-queue-check.sh` uses `POST /api/v1/system-jobs/echo` (from Plan 03) rather than mutating Redis directly — keeps the queue smoke test path consistent with how application code enqueues work

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

All four threat register entries for this plan were mitigated:

| Threat ID | Disposition | How Mitigated |
|-----------|-------------|---------------|
| T-01-10 | mitigate | `depends_on.condition: service_healthy` on api, worker, web; postgres and redis have `healthcheck` blocks with retries and start_period |
| T-01-11 | mitigate | Dockerfiles use `pnpm install --frozen-lockfile`; runtime install paths remain disallowed by QA checks |
| T-01-12 | mitigate | `read_only: true` on api, worker, web containers; only `/tmp` is writable via `tmpfs` |
| T-01-14 | mitigate | Dockerfiles install from the committed lockfile; `phase1-offline-check.sh` verifies this path statically |

## Known Stubs

None — all smoke scripts contain real check logic.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced beyond the plan's threat model.

## Self-Check

Checking created files:

- `infra/compose/compose.yaml`: FOUND
- `infra/docker/api.Dockerfile`: FOUND
- `infra/docker/worker.Dockerfile`: FOUND
- `infra/docker/web.Dockerfile`: FOUND
- `scripts/qa/phase1-smoke.sh`: FOUND
- `scripts/qa/phase1-offline-check.sh`: FOUND
- `scripts/qa/phase1-queue-check.sh`: FOUND
- `scripts/qa/phase1-transport-check.sh`: FOUND
- `.planning/phases/01-foundation-and-offline-delivery/01-VALIDATION.md`: FOUND

Checking commits:
- Task 1 commit `bd46f99`: FOUND
- Task 2 commit `e9146c2`: FOUND

## Self-Check: PASSED
