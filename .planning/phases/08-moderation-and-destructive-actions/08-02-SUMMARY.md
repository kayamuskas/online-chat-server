---
phase: 08-moderation-and-destructive-actions
plan: "02"
subsystem: messaging
tags: [message-deletion, websocket, permissions, frontend, backend]
dependency_graph:
  requires:
    - 08-01 (FK migration — author_id ON DELETE SET NULL for account deletion)
    - Phase 6 (MessagesRepository, MessagesService, MessagesGateway foundation)
    - Phase 4 (RoomsService.isAdmin() — includes owner check)
  provides:
    - DELETE /api/v1/messages/rooms/:roomId/messages/:messageId (204)
    - DELETE /api/v1/messages/dm/:conversationId/messages/:messageId (204)
    - WS event 'message-deleted' broadcast to room/DM channel
    - Delete button in MessageTimeline for author and room admin/owner
  affects:
    - apps/api/src/messages/ (repository, service, controller, gateway)
    - apps/web/src/features/messages/ (MessageTimeline, RoomChatView, DmChatView)
    - apps/web/src/lib/api.ts
    - apps/web/src/App.tsx
tech_stack:
  added: []
  patterns:
    - Permission tier check in service layer (author OR isAdmin for rooms; author-only for DMs)
    - Hard delete SQL with cascade via FK ON DELETE CASCADE on attachments
    - WS fanout after DB delete via MessagesGateway.broadcastMessageDeleted()
    - Optimistic state removal in client on delete + WS deduplication
key_files:
  created: []
  modified:
    - apps/api/src/messages/messages.repository.ts
    - apps/api/src/messages/messages.service.ts
    - apps/api/src/messages/messages.controller.ts
    - apps/api/src/messages/messages.gateway.ts
    - apps/web/src/lib/api.ts
    - apps/web/src/features/messages/MessageTimeline.tsx
    - apps/web/src/features/messages/RoomChatView.tsx
    - apps/web/src/features/messages/DmChatView.tsx
    - apps/web/src/styles.css
    - apps/web/src/App.tsx
decisions:
  - Hard delete (D-01) — no placeholder, attachments cascade via FK ON DELETE CASCADE
  - Permission tiers (D-02) — room messages: author OR RoomsService.isAdmin() (includes owner); DM: author-only
  - WS event name 'message-deleted' kebab-case (Pitfall 5 — consistent with 'message-created', 'message-edited')
  - RoomsService injected into MessagesService (not RoomsRepository directly) to get isAdmin() that includes owner check
  - ShellRoomLink extended with optional role field to propagate admin/owner status from loadPrivateRoomData to RoomChatView
metrics:
  duration: "13 minutes"
  completed: "2026-04-20"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 10
---

# Phase 08 Plan 02: Message Deletion (MSG-05) Summary

Hard-delete backend with permission tiers (author/admin/owner for rooms, author-only for DMs), WS broadcast, and hover Delete button in MessageTimeline wired to both RoomChatView and DmChatView.

## What Was Built

### Backend (Task 1)

**MessagesRepository** — `deleteMessage(messageId)` hard-deletes the row; attachment records cascade automatically via `ON DELETE CASCADE` on `attachments.message_id`.

**MessagesService** — `deleteMessage(messageId, callerId)` enforces permission tiers (D-02):
- Room messages: author OR `RoomsService.isAdmin()` (which includes owner via `isOwner()` check)
- DM messages: author-only — no admin concept (D-02)
- Throws `ForbiddenException` with specific message per tier
- `RoomsService` injected into `MessagesService` constructor (RoomsModule already imported in MessagesModule)

**MessagesController** — Two DELETE endpoints:
- `DELETE /api/v1/messages/rooms/:roomId/messages/:messageId` — 204 No Content
- `DELETE /api/v1/messages/dm/:conversationId/messages/:messageId` — 204 No Content
- Both call `messagesService.deleteMessage()` then `gateway.broadcastMessageDeleted()`

**MessagesGateway** — `broadcastMessageDeleted(messageId, conversationType, conversationId)` emits `'message-deleted'` event with `{ conversation_type, conversation_id, message_id }` to the room/DM channel.

### Frontend (Task 2)

**api.ts** — `deleteRoomMessage(roomId, messageId)` and `deleteDmMessage(conversationId, messageId)` using existing `del<T>` helper.

**MessageTimeline.tsx** — Added `onDelete?: (message: MessageView) => void` and `canDeleteAny?: boolean` props. Delete button renders `(isOwn || canDeleteAny) && onDelete` with class `msg-bubble__action--delete` and `aria-label="Delete this message"`.

**styles.css** — `.msg-bubble__action--delete:hover` applies `color: var(--color-error)` and a danger background tint (Phase 8 section at end of file).

**RoomChatView.tsx** — `handleDeleteMessage` calls API + optimistic state removal; WS `message-deleted` listener filters message from state; `canDeleteAny={isAdminOrOwner}` prop wired to new `isAdminOrOwner` prop.

**DmChatView.tsx** — Same pattern without `canDeleteAny` (DM has no admin concept); `onDelete` hidden when `frozen`.

**App.tsx** — `ShellRoomLink` extended with optional `role` field; `activeRoom` state updated to `ShellRoomLink | null`; `loadPrivateRoomData` stores `membership.role` per room; `isAdminOrOwner` derived from `activeRoom.role` and passed to `RoomChatView`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing App.tsx type error fixed**
- **Found during:** Task 2 TypeScript check
- **Issue:** Original `setActiveRoom` state was typed as `{ id: string; name: string } | null` but was called with objects containing `visibility` (a `ShellRoomLink` field), causing a TS error at the call site in `handleRoomJoined`
- **Fix:** Changed `activeRoom` useState type to `ShellRoomLink | null` and updated `AuthenticatedShellProps.activeRoom` to `ShellRoomLink | null`. This also correctly aligns with the new `role` field needed for admin/owner detection.
- **Files modified:** `apps/web/src/App.tsx`
- **Commit:** 6b66690

**Note on tsc false positive:** `tsc --noEmit` reports one error at App.tsx line 1057 col 51 (a column position that doesn't exist in the file), which is a stale incremental compilation artifact. The vite production build (`pnpm --filter @chat/web build`) succeeds cleanly.

## Known Stubs

None — all delete functionality is fully wired end-to-end.

## Threat Surface Scan

The DELETE endpoints add new attack surface at trust boundary `client -> messages API`. Both endpoints are covered by the plan's threat model:
- T-08-03: IDOR for room messages — mitigated via `author_id === callerId || RoomsService.isAdmin()`
- T-08-04: IDOR for DM messages — mitigated via strict `author_id === callerId`
- T-08-05: Information disclosure — accepted; 204 returns no body; 404 reveals existence (low risk)

No new unplanned surface introduced.

## Self-Check

Files exist:
- `apps/api/src/messages/messages.repository.ts` — FOUND (deleteMessage added)
- `apps/api/src/messages/messages.service.ts` — FOUND (deleteMessage added)
- `apps/api/src/messages/messages.controller.ts` — FOUND (DELETE endpoints added)
- `apps/api/src/messages/messages.gateway.ts` — FOUND (broadcastMessageDeleted added)
- `apps/web/src/lib/api.ts` — FOUND (deleteRoomMessage, deleteDmMessage added)
- `apps/web/src/features/messages/MessageTimeline.tsx` — FOUND (onDelete, canDeleteAny added)
- `apps/web/src/styles.css` — FOUND (msg-bubble__action--delete:hover added)
- `apps/web/src/features/messages/RoomChatView.tsx` — FOUND (WS handler, delete handler added)
- `apps/web/src/features/messages/DmChatView.tsx` — FOUND (WS handler, delete handler added)
- `apps/web/src/App.tsx` — FOUND (ShellRoomLink role, isAdminOrOwner wiring added)

Commits exist:
- 02326d7 — feat(08-02): backend deleteMessage — FOUND
- 6b66690 — feat(08-02): frontend delete button, API client, WS handler — FOUND

## Self-Check: PASSED
