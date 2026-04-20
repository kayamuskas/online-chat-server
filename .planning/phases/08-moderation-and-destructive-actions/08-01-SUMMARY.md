---
phase: 08-moderation-and-destructive-actions
plan: "01"
subsystem: api-backend
tags: [schema-migration, permissions, rooms, auth]
dependency_graph:
  requires: []
  provides: [FK-SET-NULL-author_id, FK-SET-NULL-uploader_id, D-17-admin-ban-fix]
  affects: [AUTH-08-account-deletion, ROOM-07-permission-matrix]
tech_stack:
  added: []
  patterns: [idempotent-bootstrap-sql, service-layer-permission-check]
key_files:
  created:
    - apps/api/src/db/migrations/0008_destructive_actions_fk.sql
  modified:
    - apps/api/src/db/postgres.service.ts
    - apps/api/src/rooms/rooms.service.ts
decisions:
  - "Bootstrap SQL updated to reflect new nullable FK columns; idempotent ALTER TABLE block appended for existing databases"
  - "D-17 fix uses roomsRepo.isAdmin (explicit admins table only) for target check — correctly excludes owner from the admin check"
  - "removeMemberAsBan() inherits D-17 fix automatically via its internal banMember() delegation"
metrics:
  duration: "2m 30s"
  completed: "2026-04-20"
  tasks_completed: 2
  files_changed: 3
---

# Phase 08 Plan 01: FK Migration and Admin-Ban-Admin Fix Summary

FK constraints changed from ON DELETE RESTRICT to ON DELETE SET NULL for messages.author_id and attachments.uploader_id, plus D-17 admin-cannot-ban-admin enforcement added to banMember().

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create FK migration and update bootstrap SQL | 3ee4a95 | 0008_destructive_actions_fk.sql, postgres.service.ts |
| 2 | Fix banMember admin-cannot-ban-admin (D-17) for ROOM-07 | 1d82bd9 | rooms.service.ts |

## What Was Built

### Task 1: FK Migration (0008_destructive_actions_fk.sql)

Created `apps/api/src/db/migrations/0008_destructive_actions_fk.sql` with idempotent ALTER TABLE statements for both tables:
- `messages.author_id`: dropped NOT NULL, dropped old FK constraint, re-added with ON DELETE SET NULL
- `attachments.uploader_id`: dropped NOT NULL, dropped old FK constraint, re-added with ON DELETE SET NULL

Updated `AUTH_SCHEMA_BOOTSTRAP_SQL` in `postgres.service.ts`:
- `author_id UUID REFERENCES users (id) ON DELETE SET NULL` (removed NOT NULL, changed RESTRICT to SET NULL)
- `uploader_id UUID REFERENCES users(id) ON DELETE SET NULL` (removed NOT NULL, changed RESTRICT to SET NULL)
- Appended Phase 8 idempotent ALTER TABLE block so existing databases are upgraded on next bootstrap

This is the hard prerequisite for AUTH-08 account deletion: without SET NULL, deleting a user row while DM messages exist would fail with a PostgreSQL FK constraint violation.

### Task 2: D-17 Admin-Cannot-Ban-Admin Fix (rooms.service.ts)

Added D-17 check in `banMember()` immediately after `getRoom()` and before `removeMember()`:

```typescript
// D-17: admin cannot ban another admin — only owner can ban an admin
const targetIsAdmin = await this.roomsRepo.isAdmin(roomId, targetUserId);
if (targetIsAdmin) {
  const callerIsOwner = await this.isOwner(roomId, bannedByUserId);
  if (!callerIsOwner) {
    throw new ForbiddenException('Only the room owner can ban an admin');
  }
}
```

Key implementation details:
- Uses `roomsRepo.isAdmin()` (checks only `room_admins` table — explicit admins, NOT owner) for target check
- Uses `isOwner()` service method for caller check
- `removeMemberAsBan()` delegates to `banMember()` internally, so ROOM-08 inherits the fix
- TypeScript compilation verified with `tsc --noEmit` — zero errors

## Verification

All acceptance criteria met:

- `grep -c "ON DELETE SET NULL" apps/api/src/db/postgres.service.ts` → 5 matches
- `grep "ON DELETE SET NULL" apps/api/src/db/migrations/0008_destructive_actions_fk.sql | wc -l` → 4 matches
- `grep "Only the room owner can ban an admin" apps/api/src/rooms/rooms.service.ts` → 1 match
- No `ON DELETE RESTRICT` for author_id or uploader_id remains in bootstrap SQL
- TypeScript compiles without errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. T-08-01 (Elevation of Privilege) and T-08-02 (Tampering) from the plan's threat register are both mitigated by the changes in this plan.

## Self-Check: PASSED

- `apps/api/src/db/migrations/0008_destructive_actions_fk.sql` — FOUND
- `apps/api/src/db/postgres.service.ts` — modified, FOUND
- `apps/api/src/rooms/rooms.service.ts` — modified, FOUND
- commit 3ee4a95 — FOUND in git log
- commit 1d82bd9 — FOUND in git log
