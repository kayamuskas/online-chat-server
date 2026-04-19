---
phase: 06-messaging-core
plan: "04"
subsystem: messages
tags: [messages, frontend, api-client, react, timeline, composer, reply, edit, watermarks]
dependency_graph:
  requires:
    - 06-01  # MessageView / MessageHistoryRange types (API contracts)
    - 06-02  # MessagesService (access control backing the endpoints)
    - 06-03  # messages.controller.ts (REST endpoints consumed here)
  provides:
    - apps/web/src/lib/api.ts (Phase 6 messaging types + 6 API helper functions)
    - apps/web/src/features/messages/MessageTimeline.tsx
    - apps/web/src/features/messages/MessageComposer.tsx
    - apps/web/src/features/messages/ReplyPreview.tsx
    - apps/web/src/features/messages/MessageEditor.tsx
  affects:
    - apps/web/src/App.tsx (Phase 6 Plan 05 will wire these components into DM and room surfaces)
tech_stack:
  added: []
  patterns:
    - Conversation-agnostic components (same Timeline + Composer for room and DM)
    - Controlled reply state — parent owns replyTo, passes preview down to Composer
    - Controlled edit state — parent owns editingMessageId, Timeline renders MessageEditor inline
    - Watermark cursor (before_watermark query param) for load-older pagination (MSG-08)
    - 3072-byte client-side guard matching API MAX_MESSAGE_BYTES (MSG-02)
key_files:
  created:
    - apps/web/src/features/messages/MessageTimeline.tsx
    - apps/web/src/features/messages/MessageComposer.tsx
    - apps/web/src/features/messages/ReplyPreview.tsx
    - apps/web/src/features/messages/MessageEditor.tsx
  modified:
    - apps/web/src/lib/api.ts
decisions:
  - "MessageTimeline and MessageComposer are conversation-agnostic — both room and DM parent views will consume the same primitives (D-21, D-35)"
  - "Reply state and edit state are fully controlled from the parent — components do not own navigation or API calls (clean separation of concerns)"
  - "before_watermark cursor carried through to API helpers so Phase 9 can build gap detection and infinite scroll on the same contract (D-29)"
  - "Client-side 3072-byte guard in Composer matches API MAX_MESSAGE_BYTES for early feedback; server remains the authority (MSG-02)"
  - "MessageEditor disabled Save when content is unchanged — prevents spurious PATCH requests"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 06 Plan 04: Web Client Messaging Primitives Summary

**One-liner:** Typed Phase 6 API helpers (6 endpoints, watermark cursor pagination) plus four conversation-agnostic React primitives — MessageTimeline, MessageComposer, ReplyPreview, MessageEditor — covering MSG-01..04 and MSG-08; web build clean at 60 modules.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend web API client with messaging contracts | f608060 | apps/web/src/lib/api.ts |
| 2 | Create reusable message UI primitives | 75097e7 | MessageTimeline.tsx, MessageComposer.tsx, ReplyPreview.tsx, MessageEditor.tsx |

## What Was Built

### apps/web/src/lib/api.ts (Phase 6 additions)

New types:

- `ReplyPreview` — `{ id, authorUsername, contentSnippet }` for reply chip rendering (MSG-03)
- `MessageView` — enriched message row with `conversationType`, `authorUsername`, `replyPreview`, `editedAt`, `conversationWatermark` (MSG-01..04, MSG-08)
- `MessageHistoryRange` — `{ firstWatermark, lastWatermark, hasMoreBefore, totalCount }` (D-27, MSG-08)
- `MessageHistoryResponse` — `{ messages, range }` (returned by all history endpoints)

New API helpers:

- `getRoomHistory(roomId, opts?)` — GET with `before_watermark` + `limit` query params
- `sendRoomMessage(roomId, body)` — POST with `content` + optional `replyToId`
- `editRoomMessage(roomId, messageId, body)` — PATCH own message
- `getDmHistory(conversationId, opts?)` — parallel shape to room history; frozen DMs readable (D-32)
- `sendDmMessage(conversationId, body)` — POST; rejected server-side if frozen
- `editDmMessage(conversationId, messageId, body)` — PATCH own DM message

### MessageTimeline.tsx

Conversation-agnostic chronological list:

- Renders `MessageView[]` in watermark order (ascending — oldest top, newest bottom)
- Reply chip (`.msg-bubble__reply-chip`) from `replyPreview` field (MSG-03)
- "edited" marker from `editedAt` (D-25)
- Reply / Edit action buttons per message; Edit visible only for `currentUserId`'s messages (MSG-04)
- Inline `MessageEditor` when `editingMessageId` matches a message (controlled from parent)
- "Load older messages" button when `range.hasMoreBefore=true`; calls `onLoadOlder` (MSG-08, D-29)
- `formatTimestamp` — shows time-only for today, date+time for older messages

### MessageComposer.tsx

Multiline send surface:

- `<textarea>` with Enter-to-send, Shift+Enter newline (D-22)
- `ReplyPreview` chip when `replyTo` prop is set; `onCancelReply` dismisses it (D-23)
- `readOnly=true` disables all controls and shows frozen message (D-32)
- Client-side UTF-8 byte-length guard at 3072; inline warning shown when exceeded (MSG-02)
- `onSend(content, replyToId)` callback; parent owns persistence and error display

### ReplyPreview.tsx

Reply chip component shown inside the composer when replying:

- Displays `authorUsername` + `contentSnippet` from `ReplyPreview` data
- Cancel (`×`) button calls `onCancel` — always reversible before submit (D-23)

### MessageEditor.tsx

Inline edit mode for a single message:

- Pre-filled textarea with current content (D-24)
- Save/Cancel buttons; Save disabled when content is empty or unchanged
- Esc cancels; Ctrl/Cmd+Enter saves (keyboard-accessible)
- `onSave(newContent)` callback; parent owns the PATCH call and dismiss (MSG-04)

## Build Verification

```
pnpm --filter @chat/web build
vite v7.3.2 — 60 modules transformed
dist/assets/index-BhQWG8rJ.js  249.53 kB | gzip: 72.71 kB
built in 636ms
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components implement real logic. The components are not yet wired into any conversation view (that is Plan 05). No data flows to the UI in this plan; the primitives are exported and ready for Plan 05 to consume.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. The four new components are purely client-side React with no direct network calls; all API calls go through the existing authenticated helpers in api.ts which forward session cookies.

## Self-Check: PASSED

- [x] `apps/web/src/lib/api.ts` modified with Phase 6 types and helpers (commit f608060)
- [x] `apps/web/src/features/messages/MessageTimeline.tsx` exists (commit 75097e7)
- [x] `apps/web/src/features/messages/MessageComposer.tsx` exists (commit 75097e7)
- [x] `apps/web/src/features/messages/ReplyPreview.tsx` exists (commit 75097e7)
- [x] `apps/web/src/features/messages/MessageEditor.tsx` exists (commit 75097e7)
- [x] All commits verified: f608060, 75097e7
- [x] `pnpm --filter @chat/web build` — clean (60 modules)
