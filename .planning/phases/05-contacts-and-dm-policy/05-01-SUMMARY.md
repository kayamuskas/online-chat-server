---
phase: 05-contacts-and-dm-policy
plan: "01"
subsystem: contacts
tags: [schema, types, tdd, contacts, friendships, bans, dm]
dependency_graph:
  requires:
    - 04-01  # users table (FK target for all contacts tables)
  provides:
    - contacts.types.ts (domain contracts for 05-02 service implementation)
    - 0004_contacts_core.sql (schema for friendship lifecycle and DM stub)
    - contacts-domain.spec.ts (TDD scaffold for FRND-01 through FRND-05)
    - contacts-eligibility.spec.ts (TDD scaffold for FRND-06)
  affects:
    - apps/api/src/db/postgres.service.ts (bootstrap SQL extended)
tech_stack:
  added: []
  patterns:
    - string-union types matching DB CHECK constraints
    - normalized pair ordering (user_a_id < user_b_id) for symmetric relations
    - directional ban table (two independent rows for A-bans-B vs B-bans-A)
    - ON CONFLICT upsert pattern for idempotent freezeDmConversation
    - plain object stub factories for vitest TDD without NestJS testing module
key_files:
  created:
    - apps/api/src/contacts/contacts.types.ts
    - apps/api/src/db/migrations/0004_contacts_core.sql
    - apps/api/src/__tests__/contacts/contacts-domain.spec.ts
    - apps/api/src/__tests__/contacts/contacts-eligibility.spec.ts
  modified:
    - apps/api/src/db/postgres.service.ts
decisions:
  - "DmConversation table created in Phase 5 (not Phase 6) so banUser() can freeze DM history before the message engine ships"
  - "FriendRequestStatus union matches the DB CHECK constraint exactly: pending/accepted/declined/cancelled"
  - "Friendship and DmConversation use normalized ordering (user_a_id < user_b_id) enforced by UNIQUE constraint and application canonicalization"
  - "Ban is directional — separate rows for each direction — DM eligibility checks both directions via findBanBetween()"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-18"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 05 Plan 01: Contacts Schema, Types, and TDD Scaffold Summary

**One-liner:** Contacts domain foundation — 4-table SQL schema with normalized friendship ordering and directional bans, 10 TypeScript type exports, and TDD scaffold with 4 passing type-shape tests ready for FRND-01 through FRND-06.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write contacts domain type definitions | b4f766a | apps/api/src/contacts/contacts.types.ts |
| 2 | Write contacts schema migration | 097c1bc | apps/api/src/db/migrations/0004_contacts_core.sql, apps/api/src/db/postgres.service.ts |
| 3 | Write contacts test scaffold | e9fad71 | apps/api/src/__tests__/contacts/contacts-domain.spec.ts, apps/api/src/__tests__/contacts/contacts-eligibility.spec.ts |

## What Was Built

### contacts.types.ts
Exports 10 TypeScript types/interfaces:
- `FriendRequestStatus` — string union `'pending' | 'accepted' | 'declined' | 'cancelled'`
- `FriendRequest`, `Friendship`, `UserBan`, `DmConversation` — core domain interfaces
- `FriendWithPresence`, `IncomingFriendRequestView` — projection/view types for API responses
- `SendFriendRequestInput`, `CreateBanInput`, `DmEligibilityResult` — input/result types

`DmConversation.frozen: boolean` is mandatory for FRND-05 ban freeze support in Phase 5 before Phase 6 ships the message engine.

### 0004_contacts_core.sql
4 tables with full constraints:
- `friend_requests` — CONSTRAINT `friend_requests_pair_unique` prevents duplicate pending requests
- `friendships` — CONSTRAINT `friendships_no_self` + normalized `user_a_id < user_b_id` ordering
- `user_bans` — directional, CONSTRAINT `user_bans_no_self` prevents self-ban at DB level
- `dm_conversations` — stub with `frozen BOOLEAN NOT NULL DEFAULT FALSE`

`AUTH_SCHEMA_BOOTSTRAP_SQL` in `postgres.service.ts` updated with all 4 tables under the `-- Phase 5: Contacts domain tables (migration 0004_contacts_core)` comment block.

### Test Scaffold
- `contacts-domain.spec.ts`: type-shape tests (4 passed) + service tests for FRND-01 through FRND-05
- `contacts-eligibility.spec.ts`: DM eligibility matrix for FRND-06 (4 cases)
- Service-level tests fail gracefully with `ERR_MODULE_NOT_FOUND` until `contacts.service.ts` ships in plan 05-02

## Test Results

```
Tests  9 failed | 4 passed (13)
```

4 type-shape tests pass immediately. 9 service tests fail with `ERR_MODULE_NOT_FOUND` because `contacts.service.ts` does not exist yet — this is the expected TDD RED state.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan intentionally creates type definitions and schema only. `DmConversation` is a documented stub table for Phase 5 ban freeze; it is not a data stub that blocks the plan's goal.

## Threat Flags

All three STRIDE mitigations in the plan threat model are implemented:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-05-01 | `CONSTRAINT friend_requests_pair_unique UNIQUE (requester_id, target_id)` | Applied in migration and bootstrap SQL |
| T-05-02 | `CONSTRAINT user_bans_no_self CHECK (banner_user_id <> banned_user_id)` | Applied in migration and bootstrap SQL |
| T-05-03 | `CONSTRAINT friendships_no_self CHECK (user_a_id <> user_b_id)` | Applied in migration and bootstrap SQL |

## Self-Check: PASSED

- [x] `apps/api/src/contacts/contacts.types.ts` exists (commit b4f766a)
- [x] `apps/api/src/db/migrations/0004_contacts_core.sql` exists (commit 097c1bc)
- [x] `apps/api/src/__tests__/contacts/contacts-domain.spec.ts` exists (commit e9fad71)
- [x] `apps/api/src/__tests__/contacts/contacts-eligibility.spec.ts` exists (commit e9fad71)
- [x] `apps/api/src/db/postgres.service.ts` updated (commit 097c1bc)
- [x] All 3 task commits verified in git log
