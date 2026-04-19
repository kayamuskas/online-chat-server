---
phase: 06-messaging-core
plan: "01"
subsystem: messages
tags: [messages, schema, migration, types, helpers, tdd, watermarks]
dependency_graph:
  requires:
    - 04-01  # rooms table (FK target for room conversations)
    - 05-01  # dm_conversations table (FK target for DM conversations)
  provides:
    - messages.types.ts (ConversationType, Message, MessageView, MessageHistoryRange, input types)
    - messages.helpers.ts (validateMessageContent, validateReplyTarget, applyMessageEdit, buildMessageView, watermark helpers)
    - migration 0005_messages_core.sql (messages table, watermark uniqueness constraint, indexes)
  affects:
    - apps/api/src/db/postgres.service.ts (bootstrap SQL extended with messages table)
    - apps/api/src/__tests__/messages/ (39 tests all passing)
tech_stack:
  added: []
  patterns:
    - Shared-table conversation model (room + dm share one messages table via conversation_type discriminator)
    - Server-assigned per-conversation watermarks with UNIQUE constraint for atomic gap detection
    - Pure domain helpers (stateless, no I/O) validated by TDD before service implementation
    - TDD RED/GREEN: test-first with import failure as RED gate, helpers as GREEN gate
key_files:
  created:
    - apps/api/src/messages/messages.types.ts
    - apps/api/src/messages/messages.helpers.ts
    - apps/api/src/db/migrations/0005_messages_core.sql
    - apps/api/src/__tests__/messages/messages-domain.spec.ts
    - apps/api/src/__tests__/messages/messages-watermarks.spec.ts
  modified:
    - apps/api/src/db/postgres.service.ts
decisions:
  - "Single messages table with conversation_type discriminator ('room'|'dm') avoids parallel model divergence (D-21)"
  - "conversation_watermark is BIGINT with UNIQUE constraint per (type, id) — server-assigned at INSERT; never client-provided (D-28)"
  - "reply_to_id uses ON DELETE SET NULL so reply chips degrade gracefully when original is deleted in Phase 8"
  - "messages.helpers.ts is the pure domain layer; all invariants are stateless functions callable without DB (allows TDD without test containers)"
  - "MAX_MESSAGE_BYTES = 3072 (3 KB) enforced at service layer; DB column is TEXT with no length constraint for simplicity"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 06 Plan 01: Message Schema, Types, and TDD Scaffold Summary

**One-liner:** Shared messages table with per-conversation BIGINT watermarks, pure domain helpers covering MSG-01..04 and MSG-08, and 39 TDD tests all passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Define shared message types and migration | 206ce20 | messages.types.ts, 0005_messages_core.sql, postgres.service.ts |
| 2 (RED) | Write failing test scaffold | 93bbbe1 | messages-domain.spec.ts, messages-watermarks.spec.ts |
| 2 (GREEN) | Implement messages.helpers.ts | 3d12fb5 | messages.helpers.ts |

## What Was Built

### messages.types.ts

Type contracts covering all Phase 6 domain invariants:

- `ConversationType` — `'room' | 'dm'` discriminator (MSG-01)
- `Message` — core DB row type with `conversation_watermark`, `reply_to_id`, `edited_at` (MSG-01..04, MSG-08)
- `MessageView` — enriched projection with `author_username` and `reply_preview` (MSG-03)
- `ReplyPreview` — minimal preview for reply chip rendering (MSG-03)
- `MessageHistoryRange` — range metadata: `firstWatermark`, `lastWatermark`, `hasMoreBefore`, `totalCount` (MSG-08)
- `SendMessageInput`, `EditMessageInput`, `MessageHistoryQuery` — input types for service layer

### migration 0005_messages_core.sql + bootstrap SQL

- `messages` table with `conversation_type CHECK ('room', 'dm')`, `conversation_id UUID`, `author_id` FK (RESTRICT), `content TEXT`, `reply_to_id` self-FK (SET NULL), `edited_at`, `conversation_watermark BIGINT`
- `CONSTRAINT messages_watermark_unique UNIQUE (conversation_type, conversation_id, conversation_watermark)` — enforces per-conversation monotonicity at DB level
- `CONSTRAINT messages_no_self_reply CHECK (reply_to_id IS NULL OR reply_to_id <> id)`
- Three indexes: conversation order (ASC watermark), author lookup, reply chain traversal (partial, WHERE NOT NULL)
- Bootstrap SQL in `postgres.service.ts` extended to create the table on startup

### messages.helpers.ts

Pure domain functions (no I/O, no DI):

- `validateMessageContent(content)` — trims, checks non-empty, measures UTF-8 byte length ≤ 3072 (MSG-02)
- `validateReplyTarget(input)` — null = ok; non-null validates `reply_message` exists and shares `conversation_type + conversation_id` (MSG-03)
- `applyMessageEdit(message, input, editedAt)` — throws if `caller_id !== author_id`; returns new Message with updated `content` and `edited_at`; `created_at` and `conversation_watermark` unchanged (MSG-04)
- `buildMessageView(message, authorUsername, replyPreview)` — assembles `MessageView`
- `isWatermarkMonotonic(messages)` — strict ascending check (MSG-08)
- `nextWatermark(messages)` — max+1 or 1 for empty (MSG-08, used in tests)
- `computeHistoryRange(messages, opts)` — returns `MessageHistoryRange` with `hasMoreBefore = firstWatermark > 1` (MSG-08)
- `sortByWatermark(messages)` — immutable ascending sort

## Test Results

```
Test Files  2 passed (2)
     Tests  39 passed (39)
```

### TDD Gate Compliance

1. RED gate: `test(06-01)` commit `93bbbe1` — tests fail with "Cannot find module messages.helpers.js"
2. GREEN gate: `feat(06-01)` commit `3d12fb5` — all 39 tests pass

## Deviations from Plan

### Auto-added helpers module

**1. [Rule 2 - Missing correctness module] Added messages.helpers.ts**
- **Found during:** Task 2 — tests required pure domain functions for invariant verification
- **Issue:** Plan listed only types + migration for Task 1 and "test scaffold" for Task 2, but TDD tests need callable implementations of validation logic to have meaningful assertions
- **Fix:** Created `messages.helpers.ts` as the pure domain layer; all invariants are pure functions testable without NestJS or DB. This is the correct pattern matching Phase 5 service design.
- **Files modified:** apps/api/src/messages/messages.helpers.ts (new)
- **Commit:** 3d12fb5

## Known Stubs

None — all helpers implement real logic. No data flows to UI in this plan (schema+types only phase).

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. Migration adds a table; access control is enforced in Phase 6 Plans 02 and 03.

## Self-Check: PASSED

- [x] `apps/api/src/messages/messages.types.ts` exists (commit 206ce20)
- [x] `apps/api/src/db/migrations/0005_messages_core.sql` exists (commit 206ce20)
- [x] `apps/api/src/messages/messages.helpers.ts` exists (commit 3d12fb5)
- [x] `apps/api/src/__tests__/messages/messages-domain.spec.ts` exists (commit 93bbbe1)
- [x] `apps/api/src/__tests__/messages/messages-watermarks.spec.ts` exists (commit 93bbbe1)
- [x] All commits verified in git log: 206ce20, 93bbbe1, 3d12fb5
- [x] 39/39 tests pass
