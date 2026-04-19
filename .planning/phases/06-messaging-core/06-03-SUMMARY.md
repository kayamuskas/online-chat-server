---
phase: 06-messaging-core
plan: "03"
subsystem: messages
tags: [messages, controller, gateway, websocket, fanout, transport, rest, auth]
dependency_graph:
  requires:
    - 06-01  # messages.types.ts, messages.helpers.ts
    - 06-02  # messages.repository.ts, messages.service.ts
    - 04-01  # RoomsModule / RoomsRepository (D-30 room access)
    - 05-01  # ContactsModule / ContactsRepository (D-31/D-32 DM access)
  provides:
    - messages.controller.ts (6 REST endpoints: room/DM history, send, edit)
    - messages.gateway.ts (WebSocket fanout: joinRoom/leaveRoom/joinDm/leaveDm + broadcast helpers)
    - messages.module.ts (NestJS module wiring)
  affects:
    - apps/api/src/app.module.ts (MessagesModule imported)
    - apps/api/src/contacts/contacts.module.ts (ContactsRepository exported for MessagesService DI)
    - apps/api/src/ws/app.gateway.ts (socketUserMap made public readonly)
    - apps/api/src/__tests__/messages/ (31 new transport tests)
tech_stack:
  added: []
  patterns:
    - Parallel REST route shapes for room/DM (same controller, different conversation target)
    - WebSocket fanout gateway with own connection auth (session cookie) independent of AppGateway
    - Socket.IO named channel pattern (room:<id> / dm:<id>) for scoped message fanout
    - Controller-calls-gateway pattern: HTTP write path triggers WebSocket broadcast after persist
key_files:
  created:
    - apps/api/src/messages/messages.controller.ts
    - apps/api/src/messages/messages.gateway.ts
    - apps/api/src/messages/messages.module.ts
    - apps/api/src/__tests__/messages/messages-transport.spec.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/contacts/contacts.module.ts
    - apps/api/src/ws/app.gateway.ts
decisions:
  - "MessagesGateway has its own session-cookie auth (handleConnection) rather than sharing AppGateway.socketUserMap — avoids tight coupling between presence and messaging gateways"
  - "ContactsRepository added to ContactsModule exports (Rule 2) — MessagesService depends on it directly for DM access guards (D-31/D-32)"
  - "app.gateway.ts socketUserMap made public readonly — future agents (Phase 6+) may read it without coupling, though MessagesGateway ultimately chose independent auth"
  - "MessagesController injects MessagesGateway directly — broadcast is fire-and-forget after successful service write (D-34: REST owns mutation, WS owns fanout)"
  - "Socket.IO room channel naming: room:<roomId> and dm:<conversationId> — scoped fanout without global namespace pollution"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 06 Plan 03: HTTP and Realtime Transport Summary

**One-liner:** Six authenticated REST endpoints (room/DM history/send/edit) wired to MessagesService, plus MessagesGateway WebSocket fanout emitting `message-created`/`message-edited` to scoped Socket.IO channels, with 31 transport tests all passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add message HTTP endpoints and module wiring | 3698584 | messages.controller.ts, messages.gateway.ts, messages.module.ts, app.module.ts, contacts.module.ts, app.gateway.ts |
| 2 | Add realtime message fanout and transport tests | ba00909 | messages-transport.spec.ts |

## What Was Built

### messages.controller.ts

Six authenticated REST endpoints under `/api/v1/messages`:

**Room endpoints:**
- `GET    /rooms/:roomId/history` — paginated history with `before_watermark` and `limit` query params (D-27, MSG-08)
- `POST   /rooms/:roomId/messages` — send a room message (201); fans out `message-created` via WebSocket (D-34)
- `PATCH  /rooms/:roomId/messages/:messageId` — edit a room message; fans out `message-edited` (MSG-04, D-25)

**DM endpoints:**
- `GET    /dm/:conversationId/history` — paginated DM history; frozen DM allowed for reads (D-32)
- `POST   /dm/:conversationId/messages` — send a DM message (201); fans out `message-created`
- `PATCH  /dm/:conversationId/messages/:messageId` — edit a DM message; fans out `message-edited`

Route shapes are deliberately parallel (D-33: REST owns mutations). `author_id` / `caller_id` always sourced from session — never from body (T-06-04).

### messages.gateway.ts

WebSocket gateway for subscription management and fanout:

- `handleConnection` / `handleDisconnect`: same session-cookie auth pattern as AppGateway; unauthenticated sockets disconnected immediately (T-06-05)
- `handleJoinRoom` / `handleLeaveRoom`: subscribe/unsubscribe socket to `room:<roomId>` Socket.IO channel
- `handleJoinDm` / `handleLeaveDm`: subscribe/unsubscribe socket to `dm:<conversationId>` channel
- `broadcastMessageCreated(message)`: called by controller after persist; emits `message-created` to channel subscribers
- `broadcastMessageEdited(message)`: called by controller after edit persist; emits `message-edited` to channel subscribers

### messages.module.ts

NestJS module wiring: DbModule + AuthModule + RoomsModule + ContactsModule → MessagesRepository + MessagesService + MessagesGateway + MessagesController. Exports MessagesService for downstream modules (Phase 6 Plans 04/05).

### messages-transport.spec.ts (31 tests)

Stub-based unit tests (no NestJS DI, no DB, no real sockets):

- **Controller tests (20):** room/DM history/send/edit happy paths; BadRequestException on missing body fields; ForbiddenException propagation from service; broadcast not called on service error
- **Gateway tests (11):** handleConnection auth (no cookie → disconnect, invalid token → disconnect, valid → register); handleDisconnect cleanup; joinRoom/leaveDm with auth and without; broadcastMessageCreated/broadcastMessageEdited emitting to correct `room:*` / `dm:*` channels with correct DTO shape

## Test Results

```
Test Files  1 passed (1)
     Tests  31 passed (31)
```

Verification commands passed:
- `pnpm --filter @chat/api exec vitest run src/__tests__/messages/messages-transport.spec.ts` — 31/31
- `pnpm --filter @chat/api build` — clean build

## Deviations from Plan

### Auto-added ContactsRepository export

**1. [Rule 2 - Missing module export] Added ContactsRepository to ContactsModule exports**

- **Found during:** Task 1 — MessagesService injects ContactsRepository directly (established in Plan 06-02). ContactsModule only exported ContactsService, so NestJS DI would fail at startup.
- **Fix:** Added `ContactsRepository` to `exports` array in `contacts.module.ts`.
- **Files modified:** `apps/api/src/contacts/contacts.module.ts`
- **Commit:** 3698584

### MessagesGateway with independent auth (architectural simplification)

**2. [Rule 1 - Design improvement] MessagesGateway uses own session-cookie auth instead of sharing AppGateway.socketUserMap**

- **Found during:** Task 1 — initial design required MessagesGateway to read AppGateway's socketUserMap. This created a circular provider dependency (AppGateway → MessagesGateway through MessagesModule → AppGateway in AppModule).
- **Fix:** MessagesGateway replicates the session-cookie auth pattern from AppGateway (same extractSessionToken helper + AuthService injection). This avoids the circular dependency and keeps the two gateways independently testable.
- **Files modified:** `apps/api/src/messages/messages.gateway.ts` (redesigned), `apps/api/src/ws/app.gateway.ts` (socketUserMap public — retained for future agents, unused by MessagesGateway)
- **Commit:** 3698584

## Known Stubs

None — all endpoints implement real policy delegation to MessagesService. No data flows to UI in this plan (backend transport layer only; Plans 04/05 wire the frontend).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-http-endpoints | apps/api/src/messages/messages.controller.ts | 6 new authenticated REST endpoints under /api/v1/messages; all protected by CurrentUserGuard at class level; access control enforced by MessagesService (D-30/D-31/D-32) |
| threat_flag: new-ws-gateway | apps/api/src/messages/messages.gateway.ts | New WebSocket gateway; disconnects unauthenticated connections on handleConnection; subscription events (joinRoom/joinDm) ignore unauthenticated sockets; fanout is write-only from server side |

## Self-Check: PASSED

- [x] `apps/api/src/messages/messages.controller.ts` exists (commit 3698584)
- [x] `apps/api/src/messages/messages.gateway.ts` exists (commit 3698584)
- [x] `apps/api/src/messages/messages.module.ts` exists (commit 3698584)
- [x] `apps/api/src/__tests__/messages/messages-transport.spec.ts` exists (commit ba00909)
- [x] All commits verified: 3698584, ba00909
- [x] 31/31 transport tests pass
- [x] `pnpm --filter @chat/api build` clean
