# Roadmap: Online Chat Server

**Created:** 2026-04-18
**Mode:** YOLO
**Granularity:** Fine
**Coverage:** 61 / 61 v1 requirements mapped

## Summary

This roadmap assumes a greenfield implementation using the existing requirements and design prototype only as input material. The first milestone creates a production-like fresh-clone baseline; later phases layer domain rules, realtime behavior, UI flows, and final QA hardening.

Execution note as of 2026-04-20: Phases 1 through 9 are complete in planning artifacts. Phase 10 is the active execution target for release hardening, performance evidence, and milestone close-out.

## Phases

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Foundation and Delivery Bootstrap | Create a real repo structure, deterministic Docker packaging, queue foundation, and Docker Compose bootstrap that QA can start | OPS-01, OPS-02, ARCH-01, ARCH-02 | 5 |
| 2 | Authentication Core | Implement account lifecycle, durable login behavior, and mockable mail flows | AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, OPS-04 | 4 |
| 3 | Sessions and Presence | Implement multi-session management, IP tracking, last-seen persistence, and correct online/AFK/offline semantics | SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06, SESS-07 | 5 |
| 4 | Rooms and Membership | Implement room catalog, global uniqueness, invite constraints, join/leave behavior, and room state model | ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05, ROOM-06, ROOM-10, ROOM-11 | 5 |
| 5 | Contacts and DM Policy | Implement friendships, friend requests, user bans, and DM eligibility rules | FRND-01, FRND-02, FRND-03, FRND-04, FRND-05, FRND-06 | 4 |
| 6 | Messaging Core | Implement the message engine shared by rooms and direct dialogs, including history integrity primitives | MSG-01, MSG-02, MSG-03, MSG-04, MSG-08 | 5 |
| 7 | Attachments and Durable Delivery | Add attachment flow, ACL enforcement, offline delivery, bounded queue strategy, and filesystem-backed persistence | MSG-06, MSG-09, FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06, OPS-03 | 5 |
| 8 | Moderation and Destructive Actions | Complete admin controls, bans, message deletion, room deletion, and account deletion side effects | ROOM-07, ROOM-08, ROOM-09, MSG-05, AUTH-08 | 4 |
| 9 | Frontend Productization | Replace the prototype shell with the real app UI, navigation, unread indicators, infinite scroll, session screens, and modal admin UX | MSG-07, NOTF-01, NOTF-02, UI-01, UI-02, UI-03 | 5 |
| 10 | Performance, QA, and Release Hardening | Validate latency, history scale, startup determinism, and full QA acceptance | PERF-01, PERF-02 | 5 |

## Phase Details

### Phase 1: Foundation and Delivery Bootstrap

Goal: Establish a runnable monorepo/application structure with Docker Compose, local asset strategy, queue foundation, and deterministic startup from a fresh clone.

Requirements: `OPS-01`, `OPS-02`, `ARCH-01`, `ARCH-02`

Plans: 4 plans

- [x] `01-01-PLAN.md` — Create the monorepo workspace, shared contracts, and Docker dependency strategy. *(complete 2026-04-18)*
- [x] `01-02-PLAN.md` — Replace CDN/runtime frontend delivery with a local bundled web shell. *(complete 2026-04-18)*
- [x] `01-03-PLAN.md` — Bootstrap the Nest REST/WebSocket API and BullMQ worker foundation. *(complete 2026-04-18)*
- [x] `01-04-PLAN.md` — Package the stack with Docker Compose, lockfile-backed Dockerfiles, and QA smoke scripts. *(complete 2026-04-18)*

Success criteria:
1. Repository contains backend, frontend, infra, and docs structure that supports planned implementation.
2. `docker compose up` starts the stack from a fresh clone using the committed manifests and lockfile.
3. Frontend build no longer depends on CDN scripts or hosted fonts.
4. Fresh-clone startup and lockfile-backed dependency strategy are documented and testable.
5. Foundation explicitly supports queued async work and a mixed REST/WebSocket boundary.

### Phase 2: Authentication Core

Goal: Implement credentials, login, persistence, password lifecycle, and mockable mail behavior.

Requirements: `AUTH-01`, `AUTH-02`, `AUTH-03`, `AUTH-04`, `AUTH-05`, `AUTH-06`, `AUTH-07`, `OPS-04`

Success criteria:
1. User can register with unique email and immutable username.
2. User can sign in, remain signed in across browser restart, and sign out only the current browser session.
3. Password reset and password change work through tested flows.
4. Backend stores credentials securely and exposes only the required auth surfaces.
5. Password-reset and related mail flows are testable without real SMTP.

### Phase 3: Sessions and Presence

Goal: Make session inventory, IP tracking, last-seen persistence, and multi-tab presence semantics correct.

Requirements: `SESS-01`, `SESS-02`, `SESS-03`, `SESS-04`, `SESS-05`, `SESS-06`, `SESS-07`

Plans: 4 plans

- [x] `03-01-PLAN.md` — Session metadata, inventory, and revoke backend (SESS-01, SESS-02, SESS-07). *(complete 2026-04-18)*
- [x] `03-02-PLAN.md` — Realtime presence engine and durable last seen (SESS-03, SESS-04, SESS-05, SESS-06). *(complete 2026-04-18)*
- [x] `03-03-PLAN.md` — Active sessions web UI. *(complete 2026-04-18)*
- [x] `03-04-PLAN.md` — Presence presentation and validation. *(complete 2026-04-18)*

Success criteria:
1. User can inspect active sessions with browser/IP details.
2. User can revoke selected sessions without invalidating unrelated sessions.
3. Presence is aggregated across multiple tabs according to the specification, including tab hibernation cases.
4. Live presence is served from runtime state while `last seen` is persisted durably.
5. Presence transitions propagate within the required latency budget in local tests.

### Phase 4: Rooms and Membership

Goal: Model rooms, catalog behavior, global room uniqueness, invite constraints, and basic membership changes.

Requirements: `ROOM-01`, `ROOM-02`, `ROOM-03`, `ROOM-04`, `ROOM-05`, `ROOM-06`, `ROOM-10`, `ROOM-11`

Plans: 5 plans

- [x] `04-01-PLAN.md` — Room schema, durable domain contracts, and globally unique room identity. *(complete 2026-04-18)*
- [x] `04-02-PLAN.md` — Public catalog, room creation contract, and join/leave backend flows. *(complete 2026-04-18)*
- [x] `04-03-PLAN.md` — Private invites, admin authority, and ban-list backend flows. *(complete 2026-04-18)*
- [x] `04-04-PLAN.md` — Phase 4 room shell, public/private room views, and management UI. *(complete 2026-04-18)*
- [x] `04-05-PLAN.md` — Gap closure for recipient invite acceptance and real private-room membership loading. *(complete 2026-04-18)*

Success criteria:
1. User can create rooms with required metadata and role model.
2. Public room catalog supports search and displays member counts.
3. Public join, private invite, and leave-owner restrictions all behave as specified.
4. Room names are globally unique across public and private rooms.
5. Invitations can target only already registered users.

### Phase 5: Contacts and DM Policy

Goal: Implement friendship workflow and direct-message access rules.

Requirements: `FRND-01`, `FRND-02`, `FRND-03`, `FRND-04`, `FRND-05`, `FRND-06`

Plans: 7 plans

- [x] `05-01-PLAN.md` — Contacts schema migration, domain type definitions, and test scaffold. *(complete 2026-04-18)*
- [x] `05-02-PLAN.md` — ContactsRepository (SQL) and ContactsService (policy layer, DM eligibility). *(complete 2026-04-18)*
- [x] `05-03-PLAN.md` — ContactsController (REST endpoints) and ContactsModule registration in AppModule. *(complete 2026-04-19)*
- [x] `05-04-PLAN.md` — API client extensions and contacts feature components (sidebar, dropdown, modals, DM stub). *(complete 2026-04-19)*
- [x] `05-05-PLAN.md` — App.tsx wiring and RoomMembersTable inline friend-request action. *(complete 2026-04-19)*
- [x] `05-06-PLAN.md` — Contacts frontend discoverability, management handoff, and blocked-user username projection. *(complete 2026-04-19)*
- [x] `05-07-PLAN.md` — Ban/request consistency and regression coverage for blocked-user request suppression. *(complete 2026-04-19)*

Success criteria:
1. Friend requests can be sent, accepted, and removed.
2. User-to-user bans immediately block new contact attempts.
3. DM eligibility depends on friendship and mutual non-ban state.
4. Existing DM history becomes read-only after a user ban without data loss.

### Phase 6: Messaging Core

Goal: Implement the message engine shared by rooms and direct dialogs, including history integrity primitives.

Requirements: `MSG-01`, `MSG-02`, `MSG-03`, `MSG-04`, `MSG-08`

Plans: 7 plans

- [x] `06-01-PLAN.md` — Messages schema, watermark types, and TDD scaffold. *(complete 2026-04-19)*
- [x] `06-02-PLAN.md` — MessagesRepository and MessagesService implementation. *(complete 2026-04-19)*
- [x] `06-03-PLAN.md` — MessagesController and MessagesModule wiring. *(complete 2026-04-19)*
- [x] `06-04-PLAN.md` — Frontend message engine — RoomChatView, DmChatView, useMessages hook. *(complete 2026-04-19)*
- [x] `06-05-PLAN.md` — Shell integration — RoomChatView wired into room nav, DM stub wired. *(complete 2026-04-19)*
- [x] `06-06-PLAN.md` — Gap closure — reply_preview hydration at send-time + unfreeze after unban. *(complete 2026-04-19)*
- [x] `06-07-PLAN.md` — Remaining gap closure items: banned-DM eligibility response and frozen-history UX closure. *(complete 2026-04-19)*

Success criteria:
1. Users can send multiline UTF-8 messages with reply references.
2. Room and DM chats share the same core message capabilities.
3. Users can edit their own messages and the UI shows edited state.
4. Messages persist and render in chronological order.
5. Chat watermarks allow the client to detect missing ranges and trigger history recovery.

### Phase 6.1: WebSocket Real-Time Client (INSERTED)

Goal: Wire the frontend to the existing Socket.IO gateways so messages, edits, friend-request notifications, and presence updates arrive in real-time without a page refresh.

Requirements: `MSG-01`, `MSG-03`, `MSG-07`

Plans: 5 plans

- [x] `06.1-01-PLAN.md` — CORS fix on both gateways + install socket.io-client@4.8.3 (Wave 0 blocker). *(complete 2026-04-19)*
- [x] `06.1-02-PLAN.md` — socket.ts singleton + SocketProvider + useSocket hook + App.tsx wiring. *(complete 2026-04-19)*
- [x] `06.1-03-PLAN.md` — MessageTimeline smart autoscroll + new messages indicator (D-05, MSG-07). *(complete 2026-04-19)*
- [x] `06.1-04-PLAN.md` — RoomChatView + DmChatView WS subscriptions, reconnect recovery (D-04, D-06). *(complete 2026-04-19)*
- [x] `06.1-05-PLAN.md` — ContactsSidebar getPresence polling + App.tsx presence state wiring (D-03). *(complete 2026-04-19)*

Success criteria:
1. Sending a message in a room or DM appears in the timeline immediately via WebSocket push — no reload required.
2. Editing a message updates in-place for all participants in real-time.
3. Incoming friend requests show the notification badge without a page refresh.
4. Presence status of contacts updates live as friends connect/disconnect.

### Phase 7: Attachments and Durable Delivery

Goal: Add attachment upload/download, ACL enforcement, offline delivery, bounded queue strategy, and persistent storage.

Requirements: `MSG-06`, `MSG-09`, `FILE-01`, `FILE-02`, `FILE-03`, `FILE-04`, `FILE-05`, `FILE-06`, `OPS-03`

Plans: 5 plans

- [x] `07-01-PLAN.md` — Attachments migration, domain types, repository, Multer install, Docker volume *(complete 2026-04-20)*
- [x] `07-02-PLAN.md` — Durable delivery: after_watermark on messages history endpoint *(complete 2026-04-20)*
- [x] `07-03-PLAN.md` — AttachmentsService (ACL + upload logic), AttachmentsController, module wiring *(complete 2026-04-20)*
- [x] `07-04-PLAN.md` — Messages module extension: MessageView.attachments[], sendMessage binding, gateway fanout *(complete 2026-04-20)*
- [x] `07-05-PLAN.md` — Frontend: upload API, MessageComposer file/paste, attachment rendering, reconnect catch-up *(complete 2026-04-20)*

Success criteria:
1. Users can upload files and images by button and paste, with comments and preserved filenames.
2. Attachment downloads are authorized against current membership or DM participation.
3. Files stay stored when required and become inaccessible immediately after access loss.
4. Offline recipients receive persisted messages after reconnect.
5. Filesystem storage persists correctly across container restarts.
6. Transient queues remain bounded even for users absent for very long periods.

### Phase 8: Moderation and Destructive Actions

Goal: Complete admin tooling and destructive flows with correct cascades.

Requirements: `ROOM-07`, `ROOM-08`, `ROOM-09`, `MSG-05`, `AUTH-08`

Plans: 4 plans

- [x] `08-01-PLAN.md` — FK migration (SET NULL) and ROOM-07 admin-cannot-ban-admin fix. *(complete 2026-04-20)*
- [x] `08-02-PLAN.md` — Message deletion (MSG-05): backend, WS broadcast, and UI delete button. *(complete 2026-04-20)*
- [x] `08-03-PLAN.md` — Room deletion (ROOM-09): cascade with WS-first broadcast, FS cleanup, and danger zone UI. *(complete 2026-04-20)*
- [x] `08-04-PLAN.md` — Account deletion (AUTH-08): full cascade and danger zone UI with password confirm. *(complete 2026-04-20)*

Success criteria:
1. Owner/admin permissions match the written rules exactly.
2. Member removal behaves as a ban until explicitly reversed.
3. Room deletion permanently deletes room messages and attachments.
4. Account deletion removes owned rooms and detaches remaining memberships safely.

### Phase 9: Frontend Productization

Goal: Build the real frontend shell and chat UX from the wireframe direction, aligned strictly to requirements.

Execution note: this phase is complete; the active execution target is now Phase 10.

Requirements: `MSG-07`, `NOTF-01`, `NOTF-02`, `UI-01`, `UI-02`, `UI-03`

Plans: 6 plans

- [x] `09-01-PLAN.md` — Product shell and three-column layout contract. *(complete 2026-04-20)*
- [x] `09-02-PLAN.md` — Visual baseline adoption from `requirements/desing_v1/`. *(complete 2026-04-20)*
- [x] `09-03-PLAN.md` — Unread indicators for known rooms and DM contacts. *(complete 2026-04-20)*
- [x] `09-04-PLAN.md` — Infinite upward history loading with scroll-position preservation. *(complete 2026-04-20)*
- [x] `09-05-PLAN.md` — Modal room-management UX with tabs aligned to the design baseline. *(complete 2026-04-20)*
- [x] `09-06-PLAN.md` — Account hub integration for password, sessions, presence, and current-browser sign-out. *(complete 2026-04-20)*

Success criteria:
1. Shipped UI follows the classic chat layout and not the prototype's implementation shortcuts.
2. Infinite scroll and smart autoscroll behavior work in long histories.
3. Unread indicators work for rooms and DMs and clear on open.
4. Admin actions are accessible through menus and modal dialogs.
5. Session-management and account-destruction flows are exposed cleanly in the shipped UI.

### Phase 10: Performance, QA, and Release Hardening

Goal: Make the system defensible against the stated QA and non-functional acceptance bar.

Requirements: `PERF-01`, `PERF-02`

Plans: 5 plans

- [ ] `10-01-PLAN.md` — Startup preflight and release-gate foundation.
- [ ] `10-02-PLAN.md` — Perf-lite smoke and latency probe evidence.
- [ ] `10-03-PLAN.md` — 100k-history seed path and dedicated Playwright proof.
- [ ] `10-04-PLAN.md` — Artifact reduction and blocking release-gate orchestration.
- [ ] `10-05-PLAN.md` — Release docs and verification record sync.

Success criteria:
1. Local load and integration checks cover the 300-user / 1000-member / 10k-history targets proportionally.
2. Message delivery and presence update latencies are measured against the stated limits.
3. Fresh-clone startup is tested as a release gate.
4. A dedicated test covers progressive scrolling and integrity over 100,000+ message histories.
5. Critical flows have automated coverage plus a QA checklist for manual verification.
6. The repository is ready for public handoff with documentation aligned to actual behavior.

## Notes

- Session and account capabilities are implemented in their owning domain phases and surfaced in the real frontend during Phase 9.
- Jabber/federation intentionally stays out of this roadmap and should be introduced in a later roadmap revision for v2.
- The temporary working-order override used on 2026-04-20 has been consumed; historical numbering remains unchanged, but the active phase is now 10.

---
*Roadmap created: 2026-04-18*
