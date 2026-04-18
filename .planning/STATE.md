---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 3 - Sessions and Presence
status: complete
last_updated: "2026-04-18T17:34:00.000Z"
progress:
  total_phases: 10
  completed_phases: 3
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# State

**Updated:** 2026-04-18
**Current phase:** Phase 3 - Sessions and Presence
**Status:** Phase 3 COMPLETE — all 4 plans executed

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** A fresh clone must start a fully functional classic chat system locally, offline, and in a way that matches the written requirements more strictly than any existing prototype.
**Current focus:** Phase 3 complete. Phase 4 (rooms and contacts) is next.

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

## Key Decisions (Phase 3)

- Session metadata (IP, user-agent) captured at session creation time, not lazily at inventory-read time
- IP extraction centralized in session-metadata.ts using X-Forwarded-For → request.ip → socket.remoteAddress priority
- revokeSession verifies ownership via findAllByUserId before deleteById (defense in depth beyond SQL predicate)
- Bootstrap SQL in postgres.service.ts kept in sync with migration files for offline fresh-start compatibility
- Per-tab aggregation (not per-user flag): satisfies the raw-spec 'most active tab' and 'all tabs inactive' rules
- Live presence reads never touch PostgreSQL — getUserPresence/getUsersPresence read only the in-memory tabs Map
- Durable last seen written fire-and-forget only when the last tab disconnects (offline transition)
- afkTimeoutMs and offlineSweepMs injected via PRESENCE_CONFIG_TOKEN so production one-minute rule cannot be bypassed
- socketUserMap pattern: single auth check at connect time, socket.id lookup on all subsequent events
- Inline confirm block chosen over modal for session revoke (D-04 agent discretion): faster, contextual, no overlay state
- Current-session revoke calls onSignedOut directly (T-03-09): reuses same sign-in return path as POST /sign-out
- Sign out all other sessions button hidden when only one session exists (otherSessionCount === 0)
- PresenceDot used without PresenceLabel in CompactPresenceList — compact contract (D-10) enforced at component boundary
- DetailedPresencePanel shows PresenceTimestamp only when status === 'offline' — prevents last-seen leakage (D-13)

## Next Up

- Phase 4: Rooms and Contacts — room creation, membership, contacts/DM workflows

---
*State initialized: 2026-04-18 | Updated: 2026-04-18T17:34:00Z*
