---
phase: 06-messaging-core
verified: 2026-04-21T14:15:00Z
status: complete
score: 5/5 must-haves verified
overrides_applied: 0
human_verification: []
---

# Phase 6: Messaging Core Verification Report

**Phase Goal:** Implement the message engine shared by rooms and direct dialogs, including history integrity primitives.
**Verified:** 2026-04-21T14:15:00Z
**Status:** complete
**Re-verification:** Yes — runtime gap recheck after targeted fixes

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Users can send multiline UTF-8 messages with reply references | VERIFIED | `MessagesService.sendMessage` validates content (MSG-02), validates reply_to_id same-conversation (MSG-03), persists via `createMessage`. `MessageComposer` handles shift-enter multiline. UAT Test 2 passed. |
| SC-2 | Room and DM chats share the same core message capabilities | VERIFIED | Single `messages` table with `conversation_type` discriminator. `RoomChatView` and `DmChatView` both import `MessageTimeline` + `MessageComposer`. `MessagesController` exposes parallel `/rooms/:id/…` and `/dm/:id/…` routes. |
| SC-3 | Users can edit their own messages and the UI shows edited state | VERIFIED | `editMessage` enforces author-only check (MSG-04). `messages.repository.ts` sets `edited_at` on update without touching watermark. `MessageTimeline` renders `edited` marker when `msg.editedAt` is non-null. UAT Test 4 passed. |
| SC-4 | Messages persist and render in chronological order | VERIFIED | `listHistory` orders by `conversation_watermark ASC` (reversed DESC fetch). `MessageTimeline` renders the array as received. UAT Test 10 (history after reload) passed. |
| SC-5 | Chat watermarks allow the client to detect missing ranges and trigger history recovery | VERIFIED | `computeHistoryRange` produces `{firstWatermark, lastWatermark, hasMoreBefore, totalCount}`. `MessageHistoryRange` type exported to web client. `MessageTimeline` exposes "Load older messages" button when `hasMoreBefore=true`. UAT Test 5 passed. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/api/src/messages/messages.types.ts` | VERIFIED | Defines `Message`, `MessageView`, `ReplyPreview`, `MessageHistoryRange`, `SendMessageInput`, `EditMessageInput`, `MessageHistoryQuery` — 184 lines, fully substantive |
| `apps/api/src/db/migrations/0005_messages_core.sql` | VERIFIED | Creates `messages` table with UUID PK, `conversation_type` CHECK, watermark UNIQUE constraint, 3 indexes. No attachment/delete columns. |
| `apps/api/src/messages/messages.repository.ts` | VERIFIED | `createMessage` (watermark CTE), `editMessage`, `findMessageById`, `listHistory` (JOIN + range), `findMessageViewById` (JOIN, added in 06-06), `resolveReplyMessage` — 325 lines |
| `apps/api/src/messages/messages.service.ts` | VERIFIED | `sendMessage` returns `MessageView` (calls `findMessageViewById` after insert), `listHistory`, `editMessage` with access guards D-30/D-31/D-32 |
| `apps/api/src/messages/messages.controller.ts` | VERIFIED | 6 routes: room/dm × history/send/edit. All behind `CurrentUserGuard`. Passes `MessageView` from service to gateway. |
| `apps/api/src/messages/messages.gateway.ts` | VERIFIED | `broadcastMessageCreated(MessageView)` emits `author_username` + `reply_preview` (fixed in 06-06). `broadcastMessageEdited(Message)`. Join/leave handlers for room and DM channels. |
| `apps/api/src/messages/messages.module.ts` | VERIFIED | Declares `MessagesController`, provides `MessagesRepository`, `MessagesService`, `MessagesGateway`. Imported into `AppModule`. |
| `apps/api/src/contacts/contacts.repository.ts` | VERIFIED | `unfreezeConversation` added (line 329) — plain UPDATE, pair-normalized. `findDmConversationById` present for DM access guard. |
| `apps/api/src/contacts/contacts.service.ts` | VERIFIED | `unbanUser` calls `unfreezeConversation` after `removeBan` (line 238). `checkDmEligibility()` now prioritizes `ban_exists` before `not_friends`, and `initiateDm` returns `{conversation, eligible:false}` for `ban_exists`. |
| `apps/web/src/features/messages/MessageTimeline.tsx` | VERIFIED | Renders `replyPreview` chip, `edited` marker, per-message Reply/Edit buttons, "Load older" affordance. 184 lines, substantive. |
| `apps/web/src/features/messages/MessageComposer.tsx` | VERIFIED | Handles `readOnly`, `replyTo` preview, multiline textarea, send on Enter. |
| `apps/web/src/features/messages/MessageEditor.tsx` | VERIFIED | Inline edit mode, pre-filled with current content, Save/Cancel. |
| `apps/web/src/features/messages/ReplyPreview.tsx` | VERIFIED | Reply chip component used by `MessageComposer`. |
| `apps/web/src/features/messages/RoomChatView.tsx` | VERIFIED | Loads history via `getRoomHistory`, handles send/edit/reply/loadOlder. Wired in `App.tsx` at tab `room-chat`. |
| `apps/web/src/features/messages/DmChatView.tsx` | VERIFIED | `openConversation` handles `!result.eligible` path (ban_exists) and `not_friends` catch translation. History loads via `getDmHistory`. Frozen state disables composer. |
| `apps/web/src/lib/api.ts` | VERIFIED | `mapMessageView` handles snake_case→camelCase (including `reply_preview`→`replyPreview`). All 6 messaging functions present: `getRoomHistory`, `sendRoomMessage`, `editRoomMessage`, `getDmHistory`, `sendDmMessage`, `editDmMessage`. |
| `apps/api/src/__tests__/messages/messages-domain.spec.ts` | VERIFIED | 284 lines. Tests explicitly named for MSG-01 through MSG-04. |
| `apps/api/src/__tests__/messages/messages-watermarks.spec.ts` | VERIFIED | 165 lines. Tests named for MSG-08 watermark monotonicity, per-conversation isolation, and `computeHistoryRange` metadata. |
| `apps/api/src/__tests__/messages/messages-transport.spec.ts` | VERIFIED | 664 lines. Tests authorized and rejected messaging paths. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `MessagesController.sendRoomMessage` | `MessagesService.sendMessage` | direct injection call | WIRED | Line 150 in controller |
| `MessagesService.sendMessage` | `MessagesRepository.createMessage` | `this.repo.createMessage(input)` | WIRED | Line 144 in service |
| `MessagesRepository.createMessage` | `MessagesRepository.findMessageViewById` | service call after insert (06-06) | WIRED | Lines 144-147 in service; `findMessageViewById` exists in repo at line 285 |
| `MessagesController.sendRoomMessage` | `MessagesGateway.broadcastMessageCreated` | `await this.messagesGateway.broadcastMessageCreated(message)` | WIRED | Line 158 in controller; gateway accepts `MessageView` |
| `MessagesGateway.broadcastMessageCreated` | `this.server.to(channel).emit('message-created', …)` | Socket.IO emit with `author_username` + `reply_preview` | WIRED | Lines 203-217 in gateway |
| `ContactsService.unbanUser` | `ContactsRepository.unfreezeConversation` | direct repo call after `removeBan` (06-06) | WIRED | Line 238 in service; method at line 329 in repo |
| `ContactsService.initiateDm` | returns `{conversation, eligible:false}` for `ban_exists` | two-branch eligibility check (06-07) | WIRED | Lines 280-287 in service |
| `DmChatView.openConversation` | `!result.eligible` path sets `setConversationId` + `setFrozen` | try-block result check | WIRED | Lines 94-107 in DmChatView.tsx |
| `DmChatView` useEffect `[conversationId]` | `loadHistory()` | fires on `conversationId` change | WIRED | Lines 154-159 in DmChatView.tsx — history loads for frozen convs too |
| `App.tsx` | `RoomChatView` | import + `tab === 'room-chat'` render | WIRED | Lines 56, 473-478 in App.tsx |
| `App.tsx` | `DmChatView` | import + `tab === 'dm'` render | WIRED | Lines 45, 482-490 in App.tsx |
| `MessagesModule` | `AppModule` | `MessagesModule` in `AppModule.imports` | WIRED | Line 48 in app.module.ts |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `MessageTimeline.tsx` | `messages: MessageView[]` | `listHistory` → `repo.listHistory` → PostgreSQL JOIN query | Yes — SQL JOIN returns real rows with `author_username` and `reply_preview` | FLOWING |
| `MessageTimeline.tsx` `replyPreview` chip | `msg.replyPreview` | `mapMessageView` maps `reply_preview` from send-time `findMessageViewById` or history JOIN | Yes — after 06-06, send-time response carries `reply_preview` | FLOWING |
| `RoomChatView.tsx` | `messages` state | `getRoomHistory` → `GET /api/v1/messages/rooms/:id/history` → DB query | Yes — real DB rows returned | FLOWING |
| `DmChatView.tsx` | `messages` state | `getDmHistory` → `GET /api/v1/messages/dm/:id/history` → DB query | Yes — real DB rows returned including frozen convs (allowFrozen=true) | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: RECHECKED on 2026-04-21.

Browser-backed Playwright recheck:
- `pnpm exec playwright test e2e/realtime/gap-verification.spec.ts --reporter=line`
- Passed the send-time reply-chip scenario, confirming the hydrated response / render path now works without reload.
- Passed the frozen-DM re-entry scenario after a real ban + reload, confirming the current DM navigation path reopens the conversation with a read-only badge and no raw eligibility error.

---

### Requirements Coverage

| Requirement | Phase | Plans Declaring It | Description | Status | Evidence |
|-------------|-------|-------------------|-------------|--------|----------|
| MSG-01 | 6 | 06-01 through 06-05 | Room and DM share same core message features | SATISFIED | Single `messages` table with `conversation_type`; shared `MessageTimeline`/`MessageComposer`; parallel REST routes |
| MSG-02 | 6 | 06-01 through 06-05 | UTF-8 text up to 3 KB | SATISFIED | `validateMessageContent` enforced in service; `MessagesService.sendMessage` + `editMessage` throw `BadRequestException` on violation; 3 KB limit in helpers |
| MSG-03 | 6 | 06-01 through 06-07 | Emoji and reply references | SATISFIED | `reply_to_id` optional FK on `messages` table; `validateReplyTarget` enforces same-conversation; `findMessageViewById` returns `reply_preview` in hydrated response; MessageTimeline renders reply chip |
| MSG-04 | 6 | 06-01 through 06-05 | Author-only edit; edited marker | SATISFIED | `editMessage` checks `caller_id === message.author_id`; updates `edited_at` only; watermark/`created_at` unchanged; `MessageTimeline` renders `edited` span |
| MSG-08 | 6 | 06-01 through 06-05 | Incremental watermarks for gap detection | SATISFIED | `conversation_watermark` BIGINT with UNIQUE constraint per (type, id, watermark); atomic CTE assignment in `createMessage`; `computeHistoryRange` returns `{firstWatermark, lastWatermark, hasMoreBefore}` |

**No orphaned requirements:** REQUIREMENTS.md traceability maps MSG-01, MSG-02, MSG-03, MSG-04, MSG-08 to Phase 6. All five are covered by plan frontmatter and implementation evidence.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `DmChatView.tsx` line 18 | Comment: "polling-on-focus as a lightweight placeholder until Phase 7 adds proper subscriptions" | Info | No placeholder code — WS client subscription is a planned Phase 7 feature, not a stub. Initial history loads correctly from REST. |
| `contacts.service.ts` lines 282-283 | Stray `/` character before comments (`/ D-32:` and `/ not_friends:`) | Warning | Syntactically valid (treated as division, then comment); TypeScript compiler would accept but it is misleading. Does not affect runtime behavior. Not a blocker. |

No missing implementations, empty handlers, or unrendered state detected.

---

### Gaps Summary

No remaining automated gaps found. All five ROADMAP success criteria are verified in the codebase:

- The shared message schema, repository, service, controller, gateway, and module are all fully implemented and wired.
- The send-time reply-chip gap is now re-verified by the Playwright runtime check on 2026-04-21.
- `checkDmEligibility()` now correctly prioritizes bans over friendship absence, which is required for FRND-05 frozen-history semantics after a real ban.
- The gap-closure plans' `must_haves` artifacts are all present and substantive:
  - `findMessageViewById` exists in `MessagesRepository` with the full JOIN query
  - `sendMessage` returns `Promise<MessageView>` via `findMessageViewById`
  - `broadcastMessageCreated` accepts `MessageView` and emits `author_username` + `reply_preview`
  - `unfreezeConversation` exists in `ContactsRepository` and is called by `unbanUser`
  - `initiateDm` returns `{conversation, eligible:false}` for `ban_exists`
  - `DmChatView` catch block translates `not_friends` to clean UI state

No remaining live messaging-core gaps remain after the 2026-04-21 browser recheck. The DM sidebar now preserves known conversation entry points after friendship removal, and the banned conversation opens as frozen read-only history.

---

_Verified: 2026-04-21T14:15:00Z_
_Verifier: Claude (gsd-verifier)_
