---
phase: 1
slug: foundation-and-offline-delivery
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
---

# Phase 1 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Compose smoke harness plus lightweight API/web/queue checks |
| **Config file** | `infra/compose/compose.yaml` |
| **Quick run command** | `docker compose up --build --wait` |
| **Full suite command** | `scripts/qa/phase1-smoke.sh` |
| **Estimated runtime** | ~60-180 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command or the matching Phase 1 smoke script once it exists.
- **After every plan wave:** Run `docker compose up --build --wait` plus queue and transport checks.
- **Before `$gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 180 seconds.

---

## Per-Task Verification Map

| Task ID | Plan/Task | Wave | Requirements | Threat Ref(s) | Secure Behavior | Test Type | Automated Command | Evidence Path | Status |
|---------|-----------|------|--------------|---------------|-----------------|-----------|-------------------|---------------|--------|
| 01-01-01 | 01 / Task 1 | 1 | OPS-01, OPS-02 | T-01-01, T-01-03 | Workspace manifests and shared scripts stay deterministic and aligned to one repo-local build graph. | static | `rg -n "\"packageManager\"|compose:smoke|apps/\\*|packages/\\*" package.json pnpm-workspace.yaml tsconfig.base.json apps/api/package.json apps/web/package.json packages/shared/package.json` | `package.json`, `pnpm-workspace.yaml`, app/shared package manifests | ✅ green |
| 01-01-02 | 01 / Task 2 | 1 | OPS-02, ARCH-01, ARCH-02 | T-01-02, T-01-13 | Shared runtime and queue contracts stay centralized, and the vendored dependency path includes a documented lockfile-linked refresh/verify procedure. | static | `rg -n "QUEUE_NAMES|SYSTEM_JOB_NAMES|SERVICE_PORTS|vendor/pnpm-store|pnpm-lock.yaml|checksum|verify" packages/shared/src/index.ts packages/shared/src/config.ts packages/shared/src/queue.ts docs/offline-runtime.md` | `packages/shared/src/*`, `docs/offline-runtime.md`, `vendor/pnpm-store/.gitkeep` | ✅ green |
| 01-02-01 | 02 / Task 1 | 2 | OPS-02 | T-01-04 | Frontend build scaffolding removes CDN, hosted font, and runtime Babel dependency paths. | static | `rg -n "unpkg|fonts.googleapis|babel" apps/web/index.html && exit 1 || true; rg -n "defineConfig|extends" apps/web/vite.config.ts apps/web/tsconfig.json` | `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json` | ✅ green |
| 01-02-02 | 02 / Task 2 | 2 | OPS-02, ARCH-02 | T-01-05, T-01-06 | Local web shell exposes only offline asset and transport-proof data, plus a deterministic web health target. | static | `rg -n "SERVICE_PORTS|WebSocket|offline|Phase 1" apps/web/src/App.tsx apps/web/src/main.tsx && test -f apps/web/public/healthz && ! rg -n "@import|fonts.googleapis|unpkg" apps/web/src/styles.css apps/web/index.html` | `apps/web/src/*`, `apps/web/public/healthz` | ✅ green |
| 01-03-01 | 03 / Task 1 | 2 | ARCH-01, ARCH-02 | T-01-07, T-01-09 | API exposes only health, meta, socket handshake, and one fixed enqueue endpoint for the queue smoke path. | integration | `rg -n "NestFactory|healthz|api/v1/meta|system-jobs/echo|WebSocketGateway|QUEUE_NAMES|SYSTEM_JOB_NAMES" apps/api/src/main.ts apps/api/src/app.module.ts apps/api/src/health/health.controller.ts apps/api/src/meta/meta.controller.ts apps/api/src/ws/app.gateway.ts apps/api/src/queue/queue.module.ts apps/api/src/queue/system-jobs.controller.ts` | `apps/api/src/*` | ✅ green |
| 01-03-02 | 03 / Task 2 | 2 | ARCH-01 | T-01-08 | Worker stays isolated from domain code and consumes only the fixed `system` echo job with BullMQ-safe Redis policy. | integration | `rg -n "\"@chat/worker\"|new Worker|QUEUE_NAMES|SYSTEM_JOB_NAMES|maxRetriesPerRequest: null|system" apps/worker/package.json apps/worker/src/main.ts apps/worker/src/system.worker.ts` | `apps/worker/package.json`, `apps/worker/src/*` | ✅ green |
| 01-04-01 | 04 / Task 1 | 3 | OPS-01, OPS-02 | T-01-10, T-01-11, T-01-12, T-01-14 | Compose uses health-gated startup, read-only defaults, and Dockerfiles constrained to the documented lockfile-backed offline dependency path. | smoke/static | `rg -n "^services:|pull_policy: never|service_healthy|read_only: true|vendor/pnpm-store|--offline" infra/compose/compose.yaml infra/docker/api.Dockerfile infra/docker/web.Dockerfile infra/docker/worker.Dockerfile` | `infra/compose/compose.yaml`, `infra/docker/*.Dockerfile` | ✅ green |
| 01-04-02 | 04 / Task 2 | 3 | OPS-01, OPS-02, ARCH-01, ARCH-02 | T-01-11, T-01-14 | Smoke scripts are executable, the queue test produces work through the API enqueue path, and the validation contract contains no unresolved placeholders. | smoke | `test -x scripts/qa/phase1-smoke.sh && test -x scripts/qa/phase1-offline-check.sh && test -x scripts/qa/phase1-queue-check.sh && test -x scripts/qa/phase1-transport-check.sh && rg -n "01-01-01\|01-01-02\|01-02-01\|01-02-02\|01-03-01\|01-03-02\|01-04-01\|01-04-02\|T-01-10\|T-01-11\|T-01-14\|system-jobs/echo" scripts/qa/phase1-queue-check.sh .planning/phases/01-foundation-and-offline-delivery/01-VALIDATION.md` | `scripts/qa/phase1-smoke.sh`, `scripts/qa/phase1-offline-check.sh`, `scripts/qa/phase1-queue-check.sh`, `scripts/qa/phase1-transport-check.sh`, `01-VALIDATION.md` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Verification Artifacts Created By The Plans

- `infra/compose/compose.yaml` - startup contract under test.
- `scripts/qa/phase1-smoke.sh` - covers OPS-01.
- `scripts/qa/phase1-offline-check.sh` - covers OPS-02 plus vendored-store verification path.
- `scripts/qa/phase1-queue-check.sh` - covers ARCH-01 through `POST /api/v1/system-jobs/echo`.
- `scripts/qa/phase1-transport-check.sh` - covers ARCH-02.
- `apps/api/src/health/health.controller.ts` and `apps/web/public/healthz` - health endpoints/targets.
- `apps/worker/src/system.worker.ts` - worker readiness/reporting signal.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Offline startup under a pull-blocked environment | OPS-02 | Depends on local Docker daemon/image state and host network conditions. | Disable network or otherwise block pulls, then run the offline-check script and confirm no external fetch is attempted. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify without Wave 0 placeholders.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Verification artifacts are assigned directly to plan tasks.
- [x] No watch-mode flags.
- [x] Feedback latency < 180s.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** complete — all wave 1/2/3 tasks have artifacts; smoke scripts created by 01-04
