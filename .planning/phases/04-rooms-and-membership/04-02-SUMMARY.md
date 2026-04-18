---
phase: 04-rooms-and-membership
plan: "02"
subsystem: rooms-api
tags:
  - rooms
  - controller
  - catalog
  - join
  - leave
  - tdd
dependency_graph:
  requires:
    - 04-01  # room domain foundation (RoomsService, RoomsRepository, schema)
    - 03-01  # session/auth patterns (CurrentUserGuard, CurrentUser decorator)
  provides:
    - authenticated HTTP surface for room create/catalog/join/leave
    - public room catalog with member_count projection and search
    - owner-cannot-leave enforcement at HTTP boundary
  affects:
    - 04-03  # private invites and admin/ban management API
    - 04-04  # room UI (consumes these endpoints)
tech_stack:
  added:
    - NestJS RoomsController with POST /api/v1/rooms, GET /api/v1/rooms, POST /api/v1/rooms/:id/join, POST /api/v1/rooms/:id/leave
  patterns:
    - Thin controller — all domain policy stays in RoomsService
    - CurrentUserGuard at class level — all 4 endpoints require authentication
    - Visibility default-to-public enforced in service, not controller
    - parseCreateRoomBody inline validator — rejects missing name, invalid visibility
key_files:
  created:
    - apps/api/src/rooms/rooms.controller.ts
    - apps/api/src/__tests__/rooms/rooms-catalog.spec.ts
  modified:
    - apps/api/src/rooms/rooms.module.ts
    - apps/api/src/app.module.ts
decisions:
  - "Controller uses class-level @UseGuards(CurrentUserGuard) so all room endpoints require auth without per-handler repetition"
  - "Inline parseCreateRoomBody validation instead of a separate DTO class — keeps the controller thin and consistent with auth controller patterns already in the codebase"
  - "catalog() uses GET /api/v1/rooms with optional ?search= query — matches both name and description via ILIKE in repository layer"
  - "leave() returns 204 No Content — no membership state to return after removal"
  - "join() returns 200 with { membership } — caller needs the membership row for role display"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_changed: 4
---

# Phase 4 Plan 02: Room API Surface Summary

**One-liner:** Authenticated REST surface for room creation (POST /api/v1/rooms), public catalog with member_count and ?search= (GET /api/v1/rooms), join-public-room with ban check (POST /:id/join), and leave-room with explicit owner-cannot-leave enforcement (POST /:id/leave).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing tests for catalog, join/leave, controller contract | 7a0bf3d | rooms-catalog.spec.ts (23 tests) |
| 1+2 | RoomsController + RoomsModule + AppModule wiring | 6c558c4 | rooms.controller.ts, rooms.module.ts, app.module.ts |

## TDD Gate Compliance

- **RED commit:** 7a0bf3d — `test(04-02): add failing tests for catalog, join/leave flows and controller contract`
- **GREEN commit:** 6c558c4 — `feat(04-02): add RoomsController with create/catalog/join/leave endpoints`
- All 23 tests in `src/__tests__/rooms/rooms-catalog.spec.ts` pass

## What Was Built

### RoomsController (rooms.controller.ts)

Four endpoints under `@Controller('api/v1/rooms')` with class-level `@UseGuards(CurrentUserGuard)`:

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/v1/rooms | 201 | Create room — name required, visibility defaults to public |
| GET | /api/v1/rooms | 200 | Public catalog with optional ?search= |
| POST | /api/v1/rooms/:id/join | 200 | Join public room; rejects banned users and private rooms |
| POST | /api/v1/rooms/:id/leave | 204 | Leave room; owner leave throws BadRequestException |

Input validation (`parseCreateRoomBody`) rejects missing `name`, empty strings, and invalid `visibility` values.

### Test coverage (rooms-catalog.spec.ts, 23 tests)

- Catalog returns only public rooms with name/description/member_count fields
- Search query is passed through to repository ILIKE filter
- Private rooms absent from catalog (repository-level filter)
- createRoom defaults to public, accepts explicit private, throws on duplicate name
- createRoom bootstraps owner membership
- joinRoom: success for non-banned user on public room
- joinRoom: BadRequestException for banned user
- joinRoom: BadRequestException for private room
- joinRoom: ConflictException for already-member
- joinRoom: NotFoundException for unknown room
- leaveRoom: removes ordinary-member membership cleanly
- leaveRoom: BadRequestException when owner attempts to leave
- Owner error message references "delete" (UI-surfaceable instruction)
- leaveRoom: NotFoundException when user not a member
- leaveRoom: does not delete the room
- Controller shape: `createRoom`, `catalog`, `join`, `leave` methods exist

### Module wiring

- `RoomsModule` updated: added `RoomsController` to `controllers` array
- `AppModule` updated: imports `RoomsModule`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all endpoints delegate to real service layer with full policy enforcement. The `listPublicRooms` and membership operations are backed by RoomsRepository SQL introduced in Plan 01.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: missing-authorization-on-join | apps/api/src/rooms/rooms.controller.ts | join() verifies authentication and ban state but not room membership capacity limits — not required by Phase 4 spec, documented for future awareness |

## Self-Check: PASSED

- `apps/api/src/rooms/rooms.controller.ts` — FOUND
- `apps/api/src/__tests__/rooms/rooms-catalog.spec.ts` — FOUND
- `apps/api/src/rooms/rooms.module.ts` modified — FOUND
- `apps/api/src/app.module.ts` modified — FOUND
- Commit 7a0bf3d (RED) — FOUND
- Commit 6c558c4 (GREEN) — FOUND
- All 23 rooms-catalog tests PASS
