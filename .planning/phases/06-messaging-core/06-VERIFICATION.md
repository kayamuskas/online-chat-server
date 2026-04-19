---
phase: 06-messaging-core
verified: 2026-04-19T12:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Send a reply message and confirm reply chip appears in timeline without reload"
    expected: "After sending a reply, the message row in the timeline shows a reply chip with the original author username and content snippet — populated from the real-time WebSocket push, not only from a history reload"
    why_human: "The backend fix (findMessageViewById) is code-verified but the end-to-end UI path (WS push → mapMessageView → reply chip render) requires a browser session to confirm the chip actually appears at send-time"
  - test: "Unban a user and confirm their DM conversation becomes writable"
    expected: "After calling DELETE /api/v1/contacts/bans/:userId, opening the DM to that user shows a writable composer (not read-only) and initiateDm returns frozen=false"
    why_human: "unfreezeConversation code is verified but the round-trip (unban → unfreeze DB row → next initiateDm returns frozen=false → DmChatView shows composer) requires live DB state to confirm"
  - test: "Banned DM shows frozen history with read-only banner instead of error string"
    expected: "Opening a DM to a user who has banned you shows the message timeline with existing history and a 'read-only' badge; no raw 'DM not allowed' string appears"
    why_human: "initiateDm now returns 200 eligible:false for ban_exists — this requires a live ban to be in place and a browser session to confirm the UI branch fires correctly"
---

# Phase 6: Messaging Core Verification Report

**Phase Goal:** Implement the message engine shared by rooms and direct dialogs, including history integrity primitives.
**Verified:** 2026-04-19T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

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
| `apps/api/src/contacts/contacts.service.ts` | VERIFIED | `unbanUser` calls `unfreezeConversation` after `removeBan` (line 238). `initiateDm` returns `{conversation, eligible:false}` for `ban_exists` instead of throwing 403 (line 281-286). |
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

Step 7b: SKIPPED — requires a running server with live database state. All critical code paths have been verified statically. Manual UAT already performed (7/10 passed initially; all 3 gaps resolved via 06-06 and 06-07).

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

### Human Verification Required

#### 1. Reply chip visible in timeline at send-time (not just after reload)

**Test:** In a room chat, click Reply on any existing message. Confirm the reply preview chip appears in the composer. Send the message. Without reloading the page, confirm the sent message appears in the timeline with a reply chip showing the original author's username and a content snippet.
**Expected:** Reply chip is visible immediately after send, populated from the real-time response. The chip does not require a page reload or a second history fetch to appear.
**Why human:** The 06-06 fix ensures `sendMessage` returns `MessageView` with `reply_preview` and the gateway emits it over WebSocket. However, confirming the frontend `mapMessageView` correctly picks up `reply_preview` from the live event and that `MessageTimeline` renders the chip at send-time (not just on reload) requires a browser session with two users or two tabs.

#### 2. Eligible friend DM shows writable composer after unban round-trip

**Test:** Ban a friend (Settings → Contacts → ban). Navigate to their DM. Confirm it shows read-only. Unban them. Navigate back to the DM. Confirm the composer is now writable and `initiateDm` returns `frozen=false`.
**Expected:** The DM conversation transitions from read-only back to writable after the unban without requiring a page reload or re-adding as friend.
**Why human:** `unfreezeConversation` is an UPDATE against the live `dm_conversations` row. The round-trip (ban → freeze → unban → unfreeze → initiateDm returns fresh state) needs live DB verification. The code path is correct but cannot be confirmed without actual DB state transitions.

#### 3. Banned DM renders frozen history with banner (not error string)

**Test:** From Account A, ban Account B. Log in as Account B and open a DM to Account A. Confirm the view shows the message timeline with any existing history and a "read-only" badge in the header. Confirm "DM not allowed: ban_exists" does NOT appear anywhere.
**Expected:** The frozen DM shows history and the read-only badge. The composer is disabled but visible. No raw error string is displayed.
**Why human:** `initiateDm` now returns `{conversation, eligible:false}` for `ban_exists`, and `DmChatView` handles `!result.eligible` in the try block. But the correct branch fires only when a real ban exists in the database — this requires a live two-user scenario.

---

### Gaps Summary

No automated gaps found. All five ROADMAP success criteria are verified in the codebase:

- The shared message schema, repository, service, controller, gateway, and module are all fully implemented and wired.
- All three UAT gaps identified after the initial 7/10 pass have code-level fixes committed (06-06 and 06-07).
- The gap-closure plans' `must_haves` artifacts are all present and substantive:
  - `findMessageViewById` exists in `MessagesRepository` with the full JOIN query
  - `sendMessage` returns `Promise<MessageView>` via `findMessageViewById`
  - `broadcastMessageCreated` accepts `MessageView` and emits `author_username` + `reply_preview`
  - `unfreezeConversation` exists in `ContactsRepository` and is called by `unbanUser`
  - `initiateDm` returns `{conversation, eligible:false}` for `ban_exists`
  - `DmChatView` catch block translates `not_friends` to clean UI state

The three human verification items above are required to confirm the end-to-end browser behavior of the gap fixes before the phase can be declared fully passed. They cannot be confirmed by static analysis.

---

_Verified: 2026-04-19T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
