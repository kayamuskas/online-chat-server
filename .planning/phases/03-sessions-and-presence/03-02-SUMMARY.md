---
phase: 03-sessions-and-presence
plan: 02
subsystem: presence
tags: [websocket, nestjs, redis-ready, presence, tdd, session-auth, runtime-state]

requires:
  - phase: 03-sessions-and-presence
    plan: 01
    provides: sessions table with last_seen_at, AuthService.getCurrentUser, SessionRepository

provides:
  - PresenceService: runtime online/AFK/offline aggregation across multiple tabs (in-memory)
  - PresenceRepository: durable last_seen write-behind on offline transition (PostgreSQL)
  - PresenceConfig/PRESENCE_CONFIG_TOKEN: configurable timing (afkTimeoutMs, offlineSweepMs)
  - presence.types.ts: PresenceStatus, TabRecord, UserTabMap, PresenceMap
  - ws/ws-auth.ts: cookie-based session token extraction for WebSocket handshakes
  - AppGateway (upgraded): authenticated presence transport with tabConnected/tabDisconnected/tabActivity/getPresence
  - PresenceModule: NestJS module wiring the above

affects:
  - 03-03-session-ui (can now show live presence status in session list)
  - 03-04-presence-presentation (presence primitives are ready to be consumed by UI)
  - future room/contacts phases (PresenceService.getUsersPresence provides batch presence map)

tech-stack:
  added: []
  patterns:
    - "Per-tab runtime aggregation: each socket gets its own TabRecord with lastActivityAt timestamp"
    - "User-level presence derived on-demand from all tabs — no single mutable status flag"
    - "Write-behind last seen: PostgreSQL written only on offline transition, not on every activity"
    - "Configurable timing via PRESENCE_CONFIG_TOKEN injection — production = 60s AFK, tests = 10ms"
    - "Auth gate at WebSocket connect: invalid/missing session cookie triggers immediate disconnect"
    - "socketUserMap (socket.id → userId) avoids re-validating session on every message"

key-files:
  created:
    - apps/api/src/presence/presence-config.ts
    - apps/api/src/presence/presence.types.ts
    - apps/api/src/presence/presence.service.ts
    - apps/api/src/presence/presence.repository.ts
    - apps/api/src/presence/presence.module.ts
    - apps/api/src/ws/ws-auth.ts
    - apps/api/src/__tests__/presence/presence.service.spec.ts
    - apps/api/src/__tests__/presence/presence.gateway.spec.ts
  modified:
    - apps/api/src/ws/app.gateway.ts
    - apps/api/src/app.module.ts

key-decisions:
  - "Per-tab aggregation (not per-user flag): satisfies the raw-spec 'most active tab' and 'all tabs inactive' rules"
  - "Live presence reads never touch PostgreSQL — getUserPresence/getUsersPresence read only the in-memory tabs Map"
  - "Durable last seen written fire-and-forget only when the last tab disconnects (offline transition)"
  - "afkTimeoutMs and offlineSweepMs injected via PRESENCE_CONFIG_TOKEN so production one-minute rule cannot be bypassed"
  - "socketUserMap pattern: single auth check at connect time, socket.id lookup on all subsequent events"
  - "Threat T-03-05: unauthenticated sockets disconnected with disconnect(true) before any presence registration"

patterns-established:
  - "Pattern: Runtime presence aggregator over per-tab state (from research Pattern 3)"
  - "Pattern: Durable last seen on state transition only (from research Pattern 4)"
  - "Pattern: Auth gate at WebSocket connect (from threat model T-03-05)"

requirements-completed:
  - SESS-03
  - SESS-04
  - SESS-05
  - SESS-06

duration: 7min
completed: 2026-04-18
---

# Phase 3 Plan 02: Realtime Presence Engine and Durable Last Seen Summary

**Authenticated WebSocket presence transport with per-tab runtime aggregation and write-behind durable last-seen persistence — live presence never touches PostgreSQL**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-18T16:58:02Z
- **Completed:** 2026-04-18T17:05:00Z
- **Tasks:** 2 (both TDD)
- **Files created:** 8, modified: 2

## Accomplishments

- `presence-config.ts` introduces `PRESENCE_CONFIG_TOKEN` and `PresenceConfig` with `afkTimeoutMs`/`offlineSweepMs` — production defaults are 60 000 ms AFK and 5 000 ms sweep; tests used 10 ms AFK
- `presence.types.ts` defines `PresenceStatus` (`online | afk | offline`), `TabRecord`, `UserTabMap`, `PresenceMap`
- `presence.service.ts` owns the runtime state Map (userId → Map<socketId, TabRecord>), derives presence on-demand from `lastActivityAt` timestamps; calls `repo.persistLastSeen` fire-and-forget when the last tab disconnects
- `presence.repository.ts` writes `last_seen_at` to the most-recently-active sessions row on offline transition — single responsibility, no live presence reads
- `ws/ws-auth.ts` parses the `session` cookie from the Socket.IO handshake header
- `app.gateway.ts` upgraded from Phase 1 handshake-only to full authenticated presence transport: rejects unauthenticated sockets, registers/deregisters tabs, handles `activity` and `getPresence` events
- `presence.module.ts` wires the module and provides `DEFAULT_PRESENCE_CONFIG` via `PRESENCE_CONFIG_TOKEN`
- `app.module.ts` imports `PresenceModule`
- 27 unit tests passing: 17 service tests (single-tab state machine, multi-tab aggregation, durable last seen, live reads without DB) and 10 gateway tests (auth gate, tabConnected/Disconnected/Activity, getPresence)

## Task Commits

1. **RED: Failing presence service and gateway tests** — `9553a79` (test)
2. **GREEN: Realtime presence engine and durable last seen** — `0705681` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Batch-query test assertion was too broad**
- **Found during:** Task 1 GREEN
- **Issue:** The `getUsersPresence` test called `tabDisconnected` in setup (which legitimately triggers `persistLastSeen` per the offline-transition rule) and then asserted `persistLastSeen` was never called. The assertion was correct in intent — `getUsersPresence` itself must not touch the DB — but the mock needed to be cleared between setup and the assertion under test.
- **Fix:** Added `vi.mocked(repo.persistLastSeen).mockClear()` between setup and the `getUsersPresence` call; added a comment explaining why.
- **Files modified:** `apps/api/src/__tests__/presence/presence.service.spec.ts`
- **Commit:** `0705681` (included in GREEN)

## Known Stubs

None — all presence state flows from real runtime tabConnected/tabActivity/tabDisconnected events. The `PresenceRepository.persistLastSeen` writes to the real sessions table. No hardcoded or placeholder presence data exists.

The UI surfaces that render presence (compact dot, detailed text, last seen label) are deferred to Plan 04 (Presence presentation) as per the roadmap.

## Threat Flags

All three threat-model mitigations from the plan were implemented:

| Flag | File | Description |
|------|------|-------------|
| T-03-05 mitigated | ws/app.gateway.ts | Unauthenticated sockets rejected with disconnect(true) before any presence registration |
| T-03-06 mitigated | presence.service.ts, presence-config.ts | Per-tab heartbeat semantics with configurable expiry; production = one-minute AFK threshold |
| T-03-07 mitigated | presence.service.ts, presence.repository.ts | PostgreSQL written only on offline transition; getUserPresence reads only runtime memory |

## Self-Check

Files exist:
- apps/api/src/presence/presence.service.ts — FOUND
- apps/api/src/presence/presence.repository.ts — FOUND
- apps/api/src/presence/presence-config.ts — FOUND
- apps/api/src/ws/app.gateway.ts (upgraded) — FOUND
- apps/api/src/ws/ws-auth.ts — FOUND

Commits exist:
- 9553a79 (RED: failing tests) — in git log
- 0705681 (GREEN: implementation) — in git log

Test results: 27/27 presence tests passing.

## Self-Check: PASSED

## Next Phase Readiness

- Plan 03 (active sessions UI) can use PresenceService to show live presence badges next to session rows
- Plan 04 (presence presentation) has the PresenceService.getUsersPresence batch API it needs for rendering presence in contacts/rooms
- The configurable timing contract (PRESENCE_CONFIG_TOKEN) is already in place for any future test suites that need accelerated AFK thresholds

---
*Phase: 03-sessions-and-presence*
*Completed: 2026-04-18*
