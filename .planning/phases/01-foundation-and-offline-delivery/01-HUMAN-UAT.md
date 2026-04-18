---
status: partial
phase: 01-foundation-and-offline-delivery
source: [01-VERIFICATION.md]
started: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. docker compose up --build succeeds offline
expected: Running `docker compose up --build --wait` with a pre-populated `vendor/pnpm-store/` and pre-pulled base images starts all five services (web, api, worker, postgres, redis) successfully — no external registry or CDN fetches required.
result: [pending]

**Pre-condition:** Run `pnpm fetch --store-dir ./vendor/pnpm-store` once with network access, and `docker pull` the base images, before testing offline mode. See `docs/offline-runtime.md`.

### 2. Live endpoints respond correctly
expected: After `docker compose up`: `GET /healthz` returns `{ status: "ok" }`, `GET /api/v1/meta` reports both `rest` and `websocket` transports, and a Socket.IO connection handshake succeeds.
result: [pending]

### 3. Queue end-to-end processing completes
expected: `POST /api/v1/system-jobs/echo` enqueues a job into the `system` BullMQ queue, and the worker process successfully consumes and logs the `echo` job result.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
