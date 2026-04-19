---
phase: 06-messaging-core
plan: "06"
type: gap_closure
subsystem: backend-messaging
tags: [gap-closure, messages, contacts, reply-preview, unban]
dependency_graph:
  requires: ["06-05"]
  provides: ["hydrated-send-response", "unfreeze-on-unban"]
  affects: ["apps/api/src/messages", "apps/api/src/contacts"]
tech_stack:
  added: []
  patterns: ["findMessageViewById JOIN pattern", "UPDATE no-op unfreeze"]
key_files:
  created: []
  modified:
    - apps/api/src/messages/messages.repository.ts
    - apps/api/src/messages/messages.service.ts
    - apps/api/src/messages/messages.gateway.ts
    - apps/api/src/contacts/contacts.repository.ts
    - apps/api/src/contacts/contacts.service.ts
    - apps/api/src/__tests__/messages/messages-service.spec.ts
decisions:
  - "findMessageViewById uses LIMIT 1 JOIN query matching listHistory pattern — reuses rowToMessageView helper"
  - "unfreezeConversation uses plain UPDATE (not upsert) — no-op if no row exists, which is correct"
  - "sendMessage return type changed from Promise<Message> to Promise<MessageView> — controller passes result directly to gateway, no controller changes needed"
metrics:
  duration_seconds: 242
  completed_date: "2026-04-19"
  tasks_completed: 2
  files_modified: 6
---

# Phase 06 Plan 06: Gap Closure — Reply Chip and Unban Unfreeze Summary

Backend-only fix restoring reply_preview hydration on send-time responses and dm_conversations.frozen=FALSE reset after unban.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add findMessageViewById and update sendMessage return type | 49111d6 | messages.repository.ts, messages.service.ts, messages.gateway.ts |
| 2 | Add unfreezeConversation and call from unbanUser | 9e516d0 | contacts.repository.ts, contacts.service.ts |
| fix | Update messages-service spec mock | d58b7be | messages-service.spec.ts |

## What Was Built

**Gap 1 (Test 3 — Reply chip missing after send):**

`MessagesRepository.findMessageViewById` was added using the same JOIN query as `listHistory` but scoped to a single row (`WHERE m.id = $1 LIMIT 1`). The existing `rowToMessageView` helper maps the raw row to a fully-hydrated `MessageView` with `author_username` and `reply_preview`.

`MessagesService.sendMessage` now returns `Promise<MessageView>` instead of `Promise<Message>`. After `createMessage` inserts the row, it immediately calls `findMessageViewById(created.id)` to fetch the enriched view. A `NotFoundException` guard handles the (theoretical) race condition where the row disappears between insert and read.

`MessagesGateway.broadcastMessageCreated` was updated to accept `MessageView` and emit `author_username` and `reply_preview` in the `message-created` payload, so the frontend `mapMessageView` can build the reply chip without a history reload.

**Gap 2 (Test 6 — Eligible friend DM always read-only after unban):**

`ContactsRepository.unfreezeConversation` was added immediately after `freezeDmConversation`. It normalizes the pair ordering (same `userAId < userBId` pattern) and issues a plain `UPDATE dm_conversations SET frozen = FALSE`. Using UPDATE (not upsert) is intentional: if no conversation row exists yet, the UPDATE is a no-op and the next `createDmConversation` call will correctly create it with `frozen=FALSE`.

`ContactsService.unbanUser` now calls `this.repo.unfreezeConversation(callerId, targetId)` after `this.repo.removeBan`. After unban, the next `initiateDm` call returns `frozen=false`, making the conversation writable again.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock missing findMessageViewById stub**
- **Found during:** Task 1 verification (test run)
- **Issue:** `makeMessagesRepoStub` in `messages-service.spec.ts` did not include `findMessageViewById`, causing 4 test cases to fail with `TypeError: this.repo.findMessageViewById is not a function`
- **Fix:** Added `makeMessageView` fixture, imported `MessageView` type, added `findMessageViewById: vi.fn().mockResolvedValue(makeMessageView())` to the stub
- **Files modified:** `apps/api/src/__tests__/messages/messages-service.spec.ts`
- **Commit:** d58b7be

## Test Results

- Before this plan: 334 passing, 9 failing
- After this plan: 338 passing, 5 failing
- 4 new passes restored (messages-service sendMessage tests)
- 5 pre-existing failures remain (gateway.spec, health.spec, system-jobs.spec, change-password.spec, db-schema.spec) — all due to missing env vars or test infrastructure unrelated to this plan

## Known Stubs

None — all changes wire real data paths.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED
