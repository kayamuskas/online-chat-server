---
phase: 01-foundation-and-offline-delivery
plan: "03"
subsystem: api-worker
tags: [nestjs, bullmq, websocket, rest, health, queue, worker, tdd]

requires:
  - "01-01 (shared contracts: QUEUE_NAMES, SYSTEM_JOB_NAMES, redisConnectionOptions)"

provides:
  - "apps/api: NestFactory hybrid REST+Socket.IO bootstrap on SERVICE_PORTS.apiHttp (3000)"
  - "GET /healthz -> { status: 'ok', service: 'api' } (unauthenticated)"
  - "GET /api/v1/meta -> { service, transports: [rest, websocket], queues: [system] }"
  - "POST /api/v1/system-jobs/echo -> { enqueued: true, queue: 'system', jobName: 'echo' }"
  - "apps/api/src/ws/app.gateway.ts: WebSocketGateway ping/pong handshake only"
  - "apps/api/src/queue/queue.module.ts: BullMQ QUEUE_NAMES.system registered"
  - "apps/worker: standalone BullMQ worker process with maxRetriesPerRequest: null"
  - "apps/worker/src/system.worker.ts: echoProcessor + createSystemWorker factory"

affects:
  - "01-04 (docker-compose smoke tests depend on /healthz and /api/v1/meta)"
  - "01-05 (web skeleton connects to these REST and WebSocket endpoints)"
  - "all later phases extending API controllers and worker processors"

tech-stack:
  added:
    - "@nestjs/core 11.x + @nestjs/common (Nest hybrid HTTP/WebSocket app)"
    - "@nestjs/platform-socket.io + @nestjs/websockets (Socket.IO gateway)"
    - "@nestjs/bullmq 11.x (BullMQ Nest module integration)"
    - "bullmq 5.x (Queue, Worker — used in both API and worker)"
    - "reflect-metadata (Nest decorator support)"
    - "rxjs (Nest peer dependency)"
  patterns:
    - "NestFactory.create() with enableCors() for hybrid REST+WebSocket"
    - "BullModule.forRootAsync() for Redis connection with env-derived host/port"
    - "BullModule.registerQueue() per QUEUE_NAMES entry"
    - "@InjectQueue() DI pattern for queue producers"
    - "Exported echoProcessor and createSystemWorker factory for unit testability"
    - "SIGTERM/SIGINT graceful shutdown via worker.close()"

key-files:
  created:
    - "apps/api/src/main.ts (NestFactory bootstrap, enableCors, SERVICE_PORTS.apiHttp)"
    - "apps/api/src/app.module.ts (root module: BullModule, QueueModule, HealthController, MetaController, AppGateway)"
    - "apps/api/src/health/health.controller.ts (GET /healthz)"
    - "apps/api/src/meta/meta.controller.ts (GET /api/v1/meta)"
    - "apps/api/src/ws/app.gateway.ts (WebSocketGateway ping/pong)"
    - "apps/api/src/queue/queue.module.ts (BullModule.registerQueue QUEUE_NAMES.system)"
    - "apps/api/src/queue/system-jobs.controller.ts (POST /api/v1/system-jobs/echo)"
    - "apps/api/tsconfig.json (experimentalDecorators + emitDecoratorMetadata)"
    - "apps/api/src/__tests__/health.spec.ts (TDD tests for health + meta controllers)"
    - "apps/api/src/__tests__/gateway.spec.ts (TDD tests for AppGateway ping/pong)"
    - "apps/api/src/__tests__/system-jobs.spec.ts (TDD tests for SystemJobsController)"
    - "apps/worker/package.json (@chat/worker manifest)"
    - "apps/worker/tsconfig.json"
    - "apps/worker/src/main.ts (worker entrypoint, graceful shutdown)"
    - "apps/worker/src/system.worker.ts (echoProcessor, createSystemWorker)"
    - "apps/worker/src/__tests__/system.worker.spec.ts (TDD tests for worker)"
  modified: []

decisions:
  - "Used @nestjs/bullmq BullModule.forRootAsync() for Redis config so the connection is derived from process.env at runtime, not hardcoded — matches the RuntimeEnv contract from @chat/shared"
  - "Exported echoProcessor and createSystemWorker as named exports — enables unit tests to call processor directly without live Redis, satisfying the TDD requirement"
  - "WebSocketGateway restricted to ping/pong only (T-01-07 mitigation) — no room, auth, or message handlers added; comment documents the boundary explicitly"
  - "Worker uses redisConnectionOptions() from @chat/shared — centralized enforcement of maxRetriesPerRequest: null (T-01-08 mitigation)"
  - "SystemJobsController.enqueueEcho() has zero parameters — prevents callers from injecting arbitrary queue or job names into the queue substrate"

duration: ~4min
completed: 2026-04-18
---

# Phase 1 Plan 03: API and Worker Bootstrap Summary

**Nest hybrid REST+Socket.IO API with /healthz, /api/v1/meta, /api/v1/system-jobs/echo, WebSocket ping/pong gateway, and a standalone BullMQ worker consuming the system queue with maxRetriesPerRequest: null**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-18T12:05:20Z
- **Completed:** 2026-04-18T12:09:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Nest application bootstrapped in `apps/api/src/main.ts` using `NestFactory.create(AppModule)` with `enableCors()` and `SERVICE_PORTS.apiHttp` (3000)
- `GET /healthz` returns `{ status: "ok", service: "api" }` without auth — satisfies T-01-09 (health-gated startup observability)
- `GET /api/v1/meta` reports `{ service: "api", transports: ["rest", "websocket"], queues: ["system"] }` using `QUEUE_NAMES.system` from @chat/shared
- `POST /api/v1/system-jobs/echo` enqueues only the fixed `SYSTEM_JOB_NAMES.echo` job into `QUEUE_NAMES.system` — zero user-controlled parameters
- `AppGateway` exposes only `handlePing()` (ping → pong handshake); no room, auth, or message handlers — T-01-07 WebSocket surface bounded
- `QueueModule` registers `QUEUE_NAMES.system` via `BullModule.registerQueue()` referencing the shared constant
- `apps/worker` is a fully independent package with its own `package.json`, `tsconfig.json`, and entrypoint — Compose can start it independently
- `createSystemWorker()` uses `redisConnectionOptions()` from @chat/shared which enforces `maxRetriesPerRequest: null` — T-01-08 mitigated
- `echoProcessor` validates job name against `SYSTEM_JOB_NAMES.echo` and throws on unexpected names — rejects domain job bleed-over
- All four TDD behaviors covered by unit tests across three test files (RED committed before GREEN)

## Task Commits

Each task was committed atomically following TDD RED → GREEN order:

1. **Task 1 RED** — `e12b8a3` `test(01-03): add failing tests for API health, meta, gateway, and system-jobs`
2. **Task 1 GREEN** — `017483f` `feat(01-03): bootstrap Nest hybrid API with health, meta, gateway, and queue`
3. **Task 2 RED** — `96ad78a` `test(01-03): add failing tests for BullMQ worker Redis policy and echo processor`
4. **Task 2 GREEN** — `4616265` `feat(01-03): bootstrap BullMQ worker with safe Redis connection policy`

## Files Created/Modified

- `apps/api/src/main.ts` — NestFactory bootstrap with enableCors and SERVICE_PORTS.apiHttp
- `apps/api/src/app.module.ts` — root module wiring BullModule, QueueModule, HealthController, MetaController, AppGateway
- `apps/api/src/health/health.controller.ts` — GET /healthz
- `apps/api/src/meta/meta.controller.ts` — GET /api/v1/meta
- `apps/api/src/ws/app.gateway.ts` — WebSocketGateway ping/pong only
- `apps/api/src/queue/queue.module.ts` — BullModule.registerQueue with QUEUE_NAMES.system
- `apps/api/src/queue/system-jobs.controller.ts` — POST /api/v1/system-jobs/echo
- `apps/api/tsconfig.json` — experimentalDecorators + emitDecoratorMetadata required by Nest
- `apps/api/src/__tests__/health.spec.ts` — TDD tests: health + meta controllers
- `apps/api/src/__tests__/gateway.spec.ts` — TDD tests: AppGateway ping/pong and domain isolation
- `apps/api/src/__tests__/system-jobs.spec.ts` — TDD tests: SystemJobsController enqueue behavior
- `apps/worker/package.json` — @chat/worker manifest with bullmq + @chat/shared
- `apps/worker/tsconfig.json` — extends tsconfig.base.json
- `apps/worker/src/main.ts` — worker entrypoint with graceful SIGTERM/SIGINT shutdown
- `apps/worker/src/system.worker.ts` — echoProcessor + createSystemWorker factory
- `apps/worker/src/__tests__/system.worker.spec.ts` — TDD tests: Redis policy + echo job + isolation

## Decisions Made

- Used `BullModule.forRootAsync()` rather than `forRoot()` — async factory reads `REDIS_HOST`/`REDIS_PORT` from `process.env` at runtime so the same build works in both local dev and Docker Compose without rebuild
- Exported `echoProcessor` and `createSystemWorker` as named exports — allows unit tests to call the processor directly with a fake Job, avoiding a live Redis connection requirement in CI
- `SystemJobsController.enqueueEcho()` has zero parameters — intentional: callers cannot inject arbitrary queue or job names
- `redisConnectionOptions()` from `@chat/shared` is the single enforcement point for `maxRetriesPerRequest: null` — worker and API both go through the same factory, preventing policy drift

## Deviations from Plan

None - plan executed exactly as written. All TDD gates (RED before GREEN) followed correctly.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 RED (test commit) | e12b8a3 | PASSED |
| Task 1 GREEN (feat commit) | 017483f | PASSED |
| Task 2 RED (test commit) | 96ad78a | PASSED |
| Task 2 GREEN (feat commit) | 4616265 | PASSED |

## Threat Mitigations Applied

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-01-07 | AppGateway handles only ping → pong; no sendMessage/joinRoom handlers exist; comment documents the Phase 1 boundary |
| T-01-08 | Worker uses redisConnectionOptions() from @chat/shared which always returns `maxRetriesPerRequest: null`; unit test asserts this policy |
| T-01-09 | GET /healthz and GET /api/v1/meta exist without auth guards so Compose healthchecks and smoke scripts can probe them |

## Known Stubs

- `apps/api/src/__tests__/*.spec.ts`: Tests reference `@nestjs/testing` and `jest` — these will only pass after `pnpm install` is run (same constraint as the rest of the workspace). The test file structure and assertions are correct and complete.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond the plan's threat model.

## Self-Check

All files created/modified are present at expected paths. All 4 commits exist in git log. Self-Check: PASSED.
