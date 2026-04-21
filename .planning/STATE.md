---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 10 - Performance, QA, and Release Hardening
status: planning
last_updated: "2026-04-20T17:01:43Z"
progress:
  total_phases: 11
  completed_phases: 10
  total_plans: 56
  completed_plans: 51
  percent: 91
---

# State

**Updated:** 2026-04-20
**Current phase:** Phase 10 - Performance, QA, and Release Hardening
**Status:** Planning

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** A fresh clone must start a fully functional classic chat system locally and in a way that matches the written requirements more strictly than any existing prototype.
**Current focus:** Phase 10 planning and release-hardening execution. Phases 1 through 9 are complete in planning artifacts, with remaining work concentrated in performance, QA, and release evidence.

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
- [x] 05-02: Contacts service and repository implementation (COMPLETE)
- [x] 05-03: Contacts controller, module wiring, and API endpoints (COMPLETE)
- [x] 05-04: Contacts and DM frontend UI (COMPLETE)
- [x] 05-05: App.tsx wiring — contacts sidebar, notification badge, DM stub, inline Add friend (COMPLETE)

## Key Decisions (Phase 4)

- Room names remain globally unique across public and private spaces at the database layer, with service-layer pre-checks for clearer UX.
- Owner/admin/member and ban-list mechanics were intentionally pulled into Phase 4 as foundational room authority, even though later roadmap text still assigns ROOM-07/ROOM-08 to Phase 8.
- Recipient invite actions live in the main rooms controller, while owner/admin actions stay in the management controller.
- `App.tsx` owns private-room and pending-invite loading so room shell state refreshes centrally after accept, decline, create, and leave actions.

## Key Decisions (Phase 5)

- DmConversation table created in Phase 5 (not Phase 6) so banUser() can freeze DM history before the message engine ships.
- Ban is directional — separate rows for each direction — DM eligibility checks both directions via findBanBetween().
- Friendship and DmConversation use normalized ordering (user_a_id < user_b_id) enforced by UNIQUE constraint and application canonicalization.
- ContactsService db parameter is optional to allow 2-argument test instantiation; banUser uses non-null assertion since NestJS DI always injects all 3 in production.
- SqlExecutor type matches QueryResult<R> return type from pg to be assignable to PostgresService.

## Key Decisions (Phase 5, Plan 04)

- del<T> helper added to api.ts — contacts functions required a generic DELETE wrapper; follows same 204/error pattern as get<T>/post<T>
- ContactsView displays ban.banned_user_id as display name in Blocked Users (UserBan DTO lacks username); needs backend enrichment in future plan

## Key Decisions (Phase 5, Plan 05)

- dmEligible hardcoded to true in ContactsSidebar — all confirmed friends are DM-eligible by definition; ban enforcement happens server-side at POST /contacts/dm/:userId
- addFriendTarget stores username string in ManageRoomView to avoid prop-drilling contacts list through room management hierarchy
- RoomMembersTable Add friend button is optional (onSendFriendRequest?) — fully backward-compatible with existing call sites

## Phase 6 Plans

- [x] 06-01: Messages schema, watermark types, and TDD scaffold (COMPLETE)
- [x] 06-02: MessagesRepository and MessagesService implementation (COMPLETE)
- [x] 06-03: MessagesController and MessagesModule wiring (COMPLETE)
- [x] 06-04: Frontend message engine — RoomChatView, DmChatView, useMessages hook (COMPLETE)
- [x] 06-05: Shell integration — RoomChatView wired into room nav, DM stub wired (COMPLETE)
- [x] 06-06: Gap closure — reply_preview hydration at send-time + unfreeze after unban (COMPLETE)

## Key Decisions (Phase 6, Plan 06)

- findMessageViewById uses LIMIT 1 JOIN matching listHistory — reuses rowToMessageView helper
- unfreezeConversation uses plain UPDATE (not upsert) — no-op if no conversation row exists, correct behavior
- sendMessage return type changed to Promise<MessageView>; controller passes result directly to gateway without changes

  - [x] 06-07: Gap closure — banned DM returns 200 eligible:false; DmChatView renders frozen history (COMPLETE)

## Phase 6.1 Plans

- [x] 06.1-01: Gateway CORS fix + socket.io-client dependency (COMPLETE)
- [x] 06.1-02: socket singleton, SocketProvider, authenticated-shell wiring (COMPLETE)
- [x] 06.1-03: MessageTimeline smart autoscroll + new-messages indicator (COMPLETE)
- [x] 06.1-04: RoomChatView and DmChatView WebSocket subscriptions + reconnect recovery (COMPLETE)
- [x] 06.1-05: ContactsSidebar getPresence polling + App presence wiring (COMPLETE)

## Key Decisions (Phase 6, Plan 07)

- ban_exists returns HTTP 200 with eligible:false instead of 403 — client renders frozen read-only history (D-32)
- not_friends still returns 403 but catch block now translates it to setIneligibleReason instead of setInitError
- createDmConversation idempotent upsert preserves existing frozen=TRUE state set by banUser

## Key Decisions (Phase 6.1)

- One root-namespace Socket.IO client connection is shared across the authenticated shell via `lib/socket.ts` + `SocketProvider`.
- Both NestJS gateways use credentialed localhost CORS (`http://localhost:4173`, `credentials: true`) so the browser can send the session cookie in the handshake.
- MessageTimeline owns scroll-state detection and the `↓ новые сообщения` affordance; room/DM views only manage unseen-message flags.
- Reconnect recovery refetches the latest history page after a 500ms debounce and merges by message id because `after_watermark` is not available yet.
- Contacts presence stays request/response based: `getPresence` immediately and every 30 seconds; no push presence or friend-request events were added in Phase 6.1.

## Phase 7 Plans

- [x] 07-01: Attachments migration, repository, Multer upload path, and Docker volume persistence (COMPLETE)
- [x] 07-02: Durable delivery via `after_watermark` history catch-up (COMPLETE)
- [x] 07-03: Attachment ACL enforcement, upload/download endpoints, and module wiring (COMPLETE)
- [x] 07-04: Message attachments hydration and gateway fanout integration (COMPLETE)
- [x] 07-05: Frontend upload/paste flow, attachment rendering, and reconnect catch-up wiring (COMPLETE)

## Phase 8 Plans

- [x] 08-01: FK migration and room moderation rule hardening, including the final D-17 re-verification fix (COMPLETE)
- [x] 08-02: Message deletion across backend, WS broadcast, and frontend controls (COMPLETE)
- [x] 08-03: Room deletion cascade with WS-first broadcast and danger-zone UI (COMPLETE)
- [x] 08-04: Account deletion cascade with password confirmation and shell sign-out handoff (COMPLETE)

## Phase 9 Plans

- [x] 09-01: Product shell and three-column layout contract (COMPLETE)
- [x] 09-02: Design-baseline convergence from `requirements/desing_v1/` (COMPLETE)
- [x] 09-03: Unread indicators for known rooms and DM contacts (COMPLETE)
- [x] 09-04: Infinite upward history loading with scroll-position preservation (COMPLETE)
- [x] 09-05: Modal room-management UX aligned to the design baseline (COMPLETE)
- [x] 09-06: Account hub integration for password, sessions, presence, and current-browser sign-out (COMPLETE)

## Phase 10 Plans

- [ ] 10-01: Startup preflight and release-gate foundation
- [ ] 10-02: Perf-lite smoke and latency probe evidence
- [ ] 10-03: 100k-history seed path and Playwright proof
- [ ] 10-04: Artifact reduction and blocking release-gate orchestration
- [ ] 10-05: Release docs and verification record sync

## Roadmap Evolution

- Phase 6.1 inserted after Phase 6: WebSocket Real-Time Client (URGENT) — WS client deferred from Phase 6, discovered during UAT
- Current local `gsd-sdk` exposes `state`, `init`, and other point commands, but still does not expose the newer `query` subcommand expected by some workflow wrappers. Always verify command availability before assuming either path.
- Temporary execution override on 2026-04-20 was fully consumed: Phases 7, 8, and 9 are now complete, and the active phase is 10.
- Phase 10 formalizes release evidence for already-implemented product capabilities rather than adding new end-user features.

## Next Up

- Phase 10: execute startup gate, perf-lite smoke, latency probe, and 100k-history proof
- Phase 10: generate release artifacts in `artifacts/perf/` and release docs in `docs/release/`
- Project milestone close-out after Phase 10 verification

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260420-h12 | Add Playwright as mandatory E2E test framework to requirements and project docs | 2026-04-20 | — | [260420-h12-playwright-testing-requirement](./quick/260420-h12-playwright-testing-requirement/) |
| 260421-jld | Reply button should focus message input field | 2026-04-21 | — | [260421-jld-reply-button-should-focus-message-input-](./quick/260421-jld-reply-button-should-focus-message-input-/) |

---
Last activity: 2026-04-21 - Completed quick task 260421-jld: Reply button should focus message input field
*State initialized: 2026-04-18 | Updated: 2026-04-20 — synchronized active phase to Phase 10 and aligned completed phase summaries through Phase 9*
