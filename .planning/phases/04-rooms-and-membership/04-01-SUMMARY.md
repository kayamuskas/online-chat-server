---
phase: 04-rooms-and-membership
plan: "01"
subsystem: rooms-domain
tags:
  - rooms
  - schema
  - repository
  - service
  - tdd
dependency_graph:
  requires:
    - 03-01  # session metadata (PostgresService pattern)
    - 02-01  # user schema (FK targets)
  provides:
    - room identity and authority model
    - room-domain persistence boundary
    - room service policy layer
  affects:
    - 04-02  # public catalog and membership flows
    - 04-03  # private invites and admin/ban management API
    - 04-04  # room UI
tech_stack:
  added:
    - PostgreSQL room domain relations (rooms, room_memberships, room_invites, room_admins, room_bans)
    - NestJS RoomsModule, RoomsRepository, RoomsService
  patterns:
    - Policy-first service layer (all authority checks in service, not controller)
    - Explicit ban relation (separate from membership for leave/rejoin durability)
    - Bootstrap SQL pattern (postgres.service.ts extended for fresh-start compatibility)
key_files:
  created:
    - apps/api/src/db/migrations/0003_rooms_core.sql
    - apps/api/src/rooms/rooms.types.ts
    - apps/api/src/rooms/rooms.repository.ts
    - apps/api/src/rooms/rooms.service.ts
    - apps/api/src/rooms/rooms.module.ts
    - apps/api/src/__tests__/rooms/rooms-domain.spec.ts
  modified:
    - apps/api/src/db/postgres.service.ts
decisions:
  - "Room names use a single global UNIQUE constraint covering both public and private rooms — prevents name squatting across visibility boundaries"
  - "Ban state is a separate relation (room_bans) not a membership flag — ensures bans survive leave/rejoin cycles per research §Pitfall 3"
  - "room_admins is a separate relation from room_memberships — makes admin promotion/demotion explicit domain events rather than role flag flips"
  - "Owner is implicitly an admin even without an explicit room_admins row — isAdmin() checks owner_id first, then room_admins table"
  - "inviteToRoom validates against UserRepository.findByUsername — enforces project constraint that invites target only already-registered users"
  - "postgres.service.ts bootstrap SQL extended with Phase 4 room tables — fresh-start compatibility maintained alongside migration file"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_changed: 7
---

# Phase 4 Plan 01: Room Domain Foundation Summary

**One-liner:** PostgreSQL-backed room authority model (rooms/memberships/invites/admins/bans) with policy-first NestJS service layer enforcing owner-cannot-leave, public-default visibility, and registered-user invite constraints.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Room-domain schema and typed repository boundary | 49f6820 | 0003_rooms_core.sql, rooms.types.ts, rooms.repository.ts, postgres.service.ts |
| 2 | Core room service rules and RoomsModule wiring | 0ad1203 | rooms.service.ts, rooms.module.ts |

## TDD Gate Compliance

- **RED commit:** 6bc0f7a — `test(04-01): add failing tests for room domain foundation`
- **GREEN commit:** 49f6820 + 0ad1203 — implementation passes all 23 rooms-domain tests
- All 23 tests in `src/__tests__/rooms/rooms-domain.spec.ts` pass

## What Was Built

### Schema (migration 0003_rooms_core.sql)

Five explicit relations — not one collapsed table:
- `rooms` — room identity, name (globally UNIQUE), visibility check, owner_id FK
- `room_memberships` — participant rows with role check ('owner'|'admin'|'member')
- `room_invites` — pending/accepted/declined/expired lifecycle; invited_user_id FK ensures registered-user-only invites
- `room_admins` — explicit admin grant records separate from membership
- `room_bans` — durable ban state that survives leave/rejoin cycles

### Types (rooms.types.ts)

Full domain contract: `Room`, `RoomMembership`, `RoomInvite`, `RoomAdmin`, `RoomBan`, `RoomCatalogRow`, `RoomVisibility`, `RoomRole`, `InviteStatus`, and all input types.

### Repository (rooms.repository.ts)

Complete persistence boundary: CRUD for all five relations, catalog query with server-side member_count projection, isBanned/isAdmin existence checks, invite lifecycle operations.

### Service (rooms.service.ts)

Policy-first domain layer:
- `createRoom` — requires name, defaults visibility to 'public', bootstraps creator as owner membership
- `leaveRoom` — throws `BadRequestException` with explicit message when owner attempts to leave
- `inviteToRoom` — validates target via `UserRepository.findByUsername`; rejects unknown usernames
- `validateInviteTarget` — standalone registered-user lookup helper
- `banMember` / `unbanMember` — removes membership + records ban; unbans cleanly
- `makeAdmin` / `removeAdmin` — explicit grant/revoke operations
- `isOwner` / `isAdmin` — authority check helpers (isAdmin counts owner as implicit admin)

### Bootstrap SQL (postgres.service.ts)

Phase 4 room tables added to `AUTH_SCHEMA_BOOTSTRAP_SQL` using `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` patterns — fully idempotent for fresh-start compatibility.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is schema and service layer only. No UI surfaces or HTTP endpoints were added. Later plans (04-02 through 04-04) will consume these domain primitives.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: access-control-foundation | apps/api/src/rooms/rooms.service.ts | New service layer owns room-authority checks; controllers that consume RoomsService must not bypass these checks by querying RoomsRepository directly |

## Self-Check: PASSED

- `apps/api/src/db/migrations/0003_rooms_core.sql` — FOUND
- `apps/api/src/rooms/rooms.types.ts` — FOUND
- `apps/api/src/rooms/rooms.repository.ts` — FOUND
- `apps/api/src/rooms/rooms.service.ts` — FOUND
- `apps/api/src/rooms/rooms.module.ts` — FOUND
- `apps/api/src/__tests__/rooms/rooms-domain.spec.ts` — FOUND
- Commit 6bc0f7a (RED) — FOUND
- Commit 49f6820 (GREEN Task 1) — FOUND
- Commit 0ad1203 (GREEN Task 2) — FOUND
- All 23 rooms-domain tests PASS
