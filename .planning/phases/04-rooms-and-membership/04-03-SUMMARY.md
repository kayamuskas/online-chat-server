---
phase: 04-rooms-and-membership
plan: "03"
subsystem: rooms-management
tags:
  - rooms
  - management
  - invite
  - admin
  - ban
  - tdd
dependency_graph:
  requires:
    - 04-01  # room domain foundation (RoomsService, RoomsRepository, schema)
    - 04-02  # room API surface (CurrentUserGuard, RoomsModule wiring)
  provides:
    - authenticated management HTTP surface for private-room invites (by username)
    - admin promotion/demotion with owner protection
    - member removal modeled as ban semantics
    - ban-list read with who-banned metadata
    - unban flow
  affects:
    - 04-04  # room UI (consumes these management endpoints)
tech_stack:
  added:
    - NestJS RoomsManagementController (6 endpoints under /api/v1/rooms/:id/manage/*)
  patterns:
    - Authorization middleware helpers (requireOwner / requireAdminOrOwner) in controller
    - Ban-as-removal: admin member removal creates a ban row, not a silent delete
    - Owner protection explicit at service layer (ForbiddenException on removeAdmin for owner)
    - listBanned returns full ban metadata (banned_by_user_id, reason, banned_at) for UI
key_files:
  created:
    - apps/api/src/rooms/rooms-management.controller.ts
    - apps/api/src/__tests__/rooms/rooms-management.spec.ts
  modified:
    - apps/api/src/rooms/rooms.service.ts
    - apps/api/src/rooms/rooms.repository.ts
    - apps/api/src/rooms/rooms.module.ts
decisions:
  - "removeMemberAsBan is a distinct service method from banMember — it enforces membership existence check and owner protection, whereas banMember is a lower-level primitive that also works on non-members"
  - "removeAdmin has explicit owner protection in the service layer — ForbiddenException when targetUserId matches room.owner_id — prevents admin stripping through the management flow"
  - "Authorization checks (requireOwner / requireAdminOrOwner) live in the controller as inline async helpers, not as separate guards — consistent with thin-guard pattern used in auth controller"
  - "Invite endpoint requires admin-or-owner, not just any member — prevents members from inviting without authority"
  - "Admin promotion/demotion requires owner (not just admin) — admins cannot self-promote peers without owner approval"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_changed: 5
---

# Phase 4 Plan 03: Room Management Authority Surface Summary

**One-liner:** Authenticated management REST surface for private-room invite-by-username, owner/admin promotion and demotion with owner protection, admin-removal-as-ban semantics, and queryable ban-list with who-banned metadata.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing tests for management endpoints and ban-list semantics | 191d768 | rooms-management.spec.ts (26 tests) |
| 1 + 2 | Management controller, service enhancements, repository listBanned | d435107 | rooms-management.controller.ts, rooms.service.ts, rooms.repository.ts, rooms.module.ts |

## TDD Gate Compliance

- **RED commit:** 191d768 — `test(04-03): add failing tests for management endpoints and ban-list semantics`
- **GREEN commit:** d435107 — `feat(04-03): add rooms management controller with invite, admin, and ban endpoints`
- All 26 tests in `src/__tests__/rooms/rooms-management.spec.ts` pass
- Total rooms test suite: 72 tests across 3 spec files, all green

## What Was Built

### RoomsManagementController (rooms-management.controller.ts)

Six endpoints under `@Controller('api/v1/rooms')` with class-level `@UseGuards(CurrentUserGuard)`:

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | /api/v1/rooms/:id/manage/invite | Admin or Owner | Invite registered user by username |
| POST | /api/v1/rooms/:id/manage/admins/:userId | Owner only | Promote member to admin |
| DELETE | /api/v1/rooms/:id/manage/admins/:userId | Owner only | Demote admin (owner protected) |
| DELETE | /api/v1/rooms/:id/manage/members/:userId | Admin or Owner | Remove member (creates ban row) |
| GET | /api/v1/rooms/:id/manage/bans | Admin or Owner | List banned users with metadata |
| DELETE | /api/v1/rooms/:id/manage/bans/:userId | Admin or Owner | Unban user |

### RoomsService additions

- `removeAdmin`: added owner protection — throws `ForbiddenException` when targeting room owner
- `removeMemberAsBan`: new method — validates membership exists, enforces owner protection, removes member AND creates ban row with `banned_by_user_id` recorded
- `listBanned`: new method — delegates to `RoomsRepository.listBanned`, returns full `RoomBan[]`

### RoomsRepository additions

- `listBanned(room_id)`: queries `room_bans` ordered by `banned_at DESC`, returns `RoomBan[]` with all metadata fields

### Test coverage (rooms-management.spec.ts, 26 tests)

- Invite: succeeds for registered username, rejects unknown username with NotFoundException and username in error message, rejects duplicate pending invite
- validateInviteTarget: returns user ID or null
- makeAdmin: delegates to repo.addAdmin with correct args
- removeAdmin: delegates removal; blocks owner removal (throws /owner|forbidden|cannot/i)
- isAdmin: owner is always admin without explicit admin row
- Controller shape: all 6 methods exist on RoomsManagementController.prototype
- banMember: removes membership AND adds ban row; works even if user not a member
- joinRoom: banned user cannot rejoin (BadRequestException)
- unbanMember: calls removeBan
- listBanned: returns ban records with all metadata fields
- removeMemberAsBan: removes member + creates ban; throws NotFoundException when not member; throws ForbiddenException when targeting owner

## Deviations from Plan

### Auto-added: Owner protection on removeAdmin (Rule 2 — Missing critical functionality)

- **Found during:** Task 1 implementation
- **Issue:** Original `removeAdmin` in Plan 01 did not enforce owner protection — the service allowed removing the owner's admin row, which would have violated the plan's invariant that "owner is always an admin."
- **Fix:** Added owner check in `removeAdmin` before delegating to repo; throws `ForbiddenException` with clear message.
- **Files modified:** `apps/api/src/rooms/rooms.service.ts`
- **Commit:** d435107

## Known Stubs

None — all endpoints delegate to real service layer with real policy enforcement. The management surface is fully wired through RoomsService to RoomsRepository SQL.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: authorization-on-management | apps/api/src/rooms/rooms-management.controller.ts | Authorization helpers (requireOwner, requireAdminOrOwner) are inline functions; they must always be called before service operations — no NestJS guard enforces this structurally. Future refactor could promote them to proper guards for compile-time safety. |

## Self-Check: PASSED

- `apps/api/src/rooms/rooms-management.controller.ts` — FOUND
- `apps/api/src/__tests__/rooms/rooms-management.spec.ts` — FOUND
- `apps/api/src/rooms/rooms.service.ts` modified — FOUND
- `apps/api/src/rooms/rooms.repository.ts` modified — FOUND
- `apps/api/src/rooms/rooms.module.ts` modified — FOUND
- Commit 191d768 (RED) — FOUND
- Commit d435107 (GREEN) — FOUND
- All 26 rooms-management tests PASS
- All 72 rooms tests PASS
