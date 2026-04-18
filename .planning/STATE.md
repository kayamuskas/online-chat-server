---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 5 - Contacts and DM Policy
status: in-progress
last_updated: "2026-04-18T21:39:10.000Z"
progress:
  total_phases: 10
  completed_phases: 4
  total_plans: 21
  completed_plans: 18
  percent: 43
---

# State

**Updated:** 2026-04-18
**Current phase:** Phase 5 - Contacts and DM Policy
**Status:** Phase 5 in progress — plan 01 (schema, types, TDD scaffold) complete

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** A fresh clone must start a fully functional classic chat system locally, offline, and in a way that matches the written requirements more strictly than any existing prototype.
**Current focus:** Phase 5 in progress. Plan 01 complete (schema + types + TDD scaffold).

## Phase 1 Plans Completed

- [x] 01-01: Monorepo workspace, shared contracts, offline vendor docs
- [x] 01-02: Local Vite+React web shell, no CDN dependencies
- [x] 01-03: NestJS hybrid API + BullMQ worker (TDD)
- [x] 01-04: Docker Compose topology, offline Dockerfiles, QA smoke scripts

## Phase 2 Plans Completed

- [x] 02-01: PostgreSQL auth schema, password helper, session-policy helper
- [x] 02-02: Registration, sign-in, current-user, logout endpoints + tests
- [x] 02-03: Password reset, password change, mock mail outbox
- [x] 02-04: React auth/account UI, API client, phase smoke script

## Phase 3 Plans Completed

- [x] 03-01: Session metadata, inventory, and revoke backend (COMPLETE)
- [x] 03-02: Realtime presence engine and durable last seen (COMPLETE)
- [x] 03-03: Active sessions web UI (COMPLETE)
- [x] 03-04: Presence presentation and validation (COMPLETE)

## Phase 4 Plans Completed

- [x] 04-01: Room schema, durable domain contracts, and globally unique room identity (COMPLETE)
- [x] 04-02: Public catalog, room creation contract, and join/leave backend flows (COMPLETE)
- [x] 04-03: Private invites, admin authority, and ban-list backend flows (COMPLETE)
- [x] 04-04: Phase 4 room shell, public/private room views, and management UI (COMPLETE)
- [x] 04-05: Gap closure for recipient invite acceptance and private-room membership loading (COMPLETE)

## Phase 5 Plans

- [x] 05-01: Contacts schema, domain types, and TDD scaffold (COMPLETE)
- [ ] 05-02: Contacts service and repository implementation
- [ ] 05-03: Contacts controller, module wiring, and API endpoints
- [ ] 05-04: Contacts and DM frontend UI

## Key Decisions (Phase 4)

- Room names remain globally unique across public and private spaces at the database layer, with service-layer pre-checks for clearer UX.
- Owner/admin/member and ban-list mechanics were intentionally pulled into Phase 4 as foundational room authority, even though later roadmap text still assigns ROOM-07/ROOM-08 to Phase 8.
- Recipient invite actions live in the main rooms controller, while owner/admin actions stay in the management controller.
- `App.tsx` owns private-room and pending-invite loading so room shell state refreshes centrally after accept, decline, create, and leave actions.

## Key Decisions (Phase 5)

- DmConversation table created in Phase 5 (not Phase 6) so banUser() can freeze DM history before the message engine ships.
- Ban is directional — separate rows for each direction — DM eligibility checks both directions via findBanBetween().
- Friendship and DmConversation use normalized ordering (user_a_id < user_b_id) enforced by UNIQUE constraint and application canonicalization.

## Next Up

- Phase 5 Plan 02: Contacts service and repository implementation (FRND-01 through FRND-06)

---
*State initialized: 2026-04-18 | Updated: 2026-04-18T21:39:10Z*
