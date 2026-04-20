---
phase: 08-moderation-and-destructive-actions
plan: "03"
subsystem: rooms-deletion
tags: [room-deletion, websocket, cascade, frontend, danger-zone]
dependency_graph:
  requires: [08-01]
  provides: [ROOM-09-room-deletion, AUTH-08-prereqs-listOwnedRooms]
  affects: [AUTH-08-account-deletion]
tech_stack:
  added: []
  patterns: [ws-first-cascade, forwardRef-circular-deps, two-step-confirm-ui]
key_files:
  created: []
  modified:
    - apps/api/src/attachments/attachments.repository.ts
    - apps/api/src/attachments/attachments.service.ts
    - apps/api/src/attachments/attachments.module.ts
    - apps/api/src/messages/messages.gateway.ts
    - apps/api/src/messages/messages.module.ts
    - apps/api/src/rooms/rooms.repository.ts
    - apps/api/src/rooms/rooms.service.ts
    - apps/api/src/rooms/rooms.module.ts
    - apps/api/src/rooms/rooms-management.controller.ts
    - apps/web/src/lib/api.ts
    - apps/web/src/features/rooms/ManageRoomView.tsx
    - apps/web/src/features/messages/RoomChatView.tsx
    - apps/web/src/styles.css
decisions:
  - "forwardRef used in RoomsModule <-> MessagesModule and RoomsModule <-> AttachmentsModule to resolve circular dependency"
  - "MessagesGateway and AttachmentsService exported from their modules so RoomsService can inject them"
  - "WS broadcast fires before any data deletion per D-06 — enforced by sequential await ordering in deleteRoom()"
  - "listOwnedRooms/removeAdminFromAllRooms/removeMemberFromAllRooms added to RoomsRepository as AUTH-08 preparation"
metrics:
  duration: "12m"
  completed: "2026-04-20"
  tasks_completed: 2
  files_changed: 13
---

# Phase 08 Plan 03: Room Deletion Cascade Summary

Full room deletion with WS-first broadcast, FS/DB cascade, danger zone UI, and client-side navigation via room-deleted event.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Backend — room deletion cascade with WS-first broadcast | ba198f2 | attachments.repository.ts, attachments.service.ts, attachments.module.ts, messages.gateway.ts, messages.module.ts, rooms.repository.ts, rooms.service.ts, rooms.module.ts, rooms-management.controller.ts |
| 2 | Frontend — room delete UI + WS handler + API client | 11decf8 | api.ts, ManageRoomView.tsx, RoomChatView.tsx, styles.css |

## What Was Built

### Task 1: Backend Room Deletion Cascade

**AttachmentsRepository** — Added two methods:
- `findByRoomId(roomId)`: SELECT attachments joined via messages WHERE conversation_id = roomId
- `deleteByRoomId(roomId)`: DELETE attachments for messages in the room

**AttachmentsService** — Added `deleteForRoom(roomId)`:
- Loops through all room attachments calling `unlink(path).catch(() => {})` for silent FS errors
- Then calls `repo.deleteByRoomId(roomId)` to clear DB records
- Exported from `AttachmentsModule` exports array

**MessagesGateway** — Added `broadcastRoomDeleted(roomId)`:
- Emits `'room-deleted'` event with `{ room_id: roomId }` to `room:${roomId}` channel
- Exported from `MessagesModule` exports array

**RoomsRepository** — Added four methods:
- `deleteRoom(roomId)`: DELETE FROM rooms WHERE id = $1 (FK CASCADE handles sub-tables)
- `listOwnedRooms(userId)`: SELECT rooms WHERE owner_id = $1 (for AUTH-08)
- `removeAdminFromAllRooms(userId)`: DELETE FROM room_admins WHERE user_id = $1 (for AUTH-08)
- `removeMemberFromAllRooms(userId)`: DELETE FROM room_memberships WHERE user_id = $1 (for AUTH-08)

**RoomsService** — Added `deleteRoom(roomId, actorId)` with strict cascade order:
1. `this.gateway.broadcastRoomDeleted(roomId)` — WS first (D-06)
2. `this.attachmentsService.deleteForRoom(roomId)` — FS + DB attachment cleanup
3. `this.roomsRepo.deleteRoom(roomId)` — DB cascade via FK

Injected `MessagesGateway` and `AttachmentsService` via `@Inject(forwardRef(...))`.

**RoomsModule** — Updated imports: `forwardRef(() => MessagesModule)` and `forwardRef(() => AttachmentsModule)`.
**MessagesModule** — Updated to use `forwardRef(() => RoomsModule)` and `forwardRef(() => AttachmentsModule)`.
**AttachmentsModule** — Updated to use `forwardRef(() => RoomsModule)`.

**RoomsManagementController** — Added `DELETE /:id` endpoint:
- `requireOwner()` guard before service call (T-08-06 mitigated)
- `@HttpCode(HttpStatus.NO_CONTENT)` — returns 204
- Delegates to `roomsService.deleteRoom(roomId, ctx.user.id)`

### Task 2: Frontend Room Delete UI

**api.ts** — Added `deleteRoom(roomId: string): Promise<void>` using the existing `del()` helper.

**ManageRoomView.tsx** — Danger zone added to Settings tab (owner-only):
- Three new state vars: `confirmingDelete`, `deletingRoom`, `deleteRoomError`
- `handleDeleteRoom()`: calls `deleteRoom(room.id)` then `onBack?.()`
- Two-step inline confirm: first click shows confirm block, second triggers deletion
- Buttons: "Delete Room" → "Confirm Delete" / "Keep Room"
- Room name in bold in confirm text
- Error display if deletion fails

**RoomChatView.tsx** — Added `room-deleted` WS event listener:
- Handler: `if (data.room_id === roomId) { onBack?.(); }`
- Registered and cleaned up in the main socket useEffect
- `onBack` added to the useEffect dependency array

**styles.css** — Added Phase 8 danger zone styles:
- `.danger-zone` with `border: 1px solid rgba(176, 42, 42, 0.3)`
- `.danger-zone__title`, `.danger-zone__description`
- `.danger-zone__confirm` with `background-color: rgba(248, 113, 113, 0.06)`
- `.danger-zone__confirm-text`, `.danger-zone__confirm-actions`, `.danger-zone__password-field`

## Deviations from Plan

**1. [Rule 2 - Missing Critical] MessagesModule and AttachmentsModule also needed forwardRef**

- **Found during:** Task 1, when analyzing circular dependency chain
- **Issue:** Plan said to add `forwardRef` only in `RoomsModule`, but `MessagesModule` already imports `RoomsModule` (and `AttachmentsModule`) directly — NestJS circular dep resolution requires both sides to use `forwardRef`
- **Fix:** Added `forwardRef` in `MessagesModule` for both `RoomsModule` and `AttachmentsModule`, and in `AttachmentsModule` for `RoomsModule`
- **Files modified:** `messages.module.ts`, `attachments.module.ts`
- **Commit:** ba198f2

## Known Stubs

None — all wired functionality. Room deletion cascade is fully connected: endpoint → service → gateway + attachments + repository.

## Threat Flags

None — no new network surface beyond what the plan's threat register covers. T-08-06 (non-owner DELETE attempt) is mitigated by `requireOwner()` at the controller layer.

## Self-Check: PASSED

- `apps/api/src/attachments/attachments.repository.ts` — findByRoomId/deleteByRoomId FOUND
- `apps/api/src/attachments/attachments.service.ts` — deleteForRoom FOUND
- `apps/api/src/messages/messages.gateway.ts` — broadcastRoomDeleted FOUND
- `apps/api/src/rooms/rooms.repository.ts` — deleteRoom/listOwnedRooms FOUND
- `apps/api/src/rooms/rooms.service.ts` — deleteRoom with WS-first order FOUND
- `apps/api/src/rooms/rooms-management.controller.ts` — DELETE ':id' FOUND
- `apps/web/src/lib/api.ts` — deleteRoom FOUND
- `apps/web/src/features/rooms/ManageRoomView.tsx` — danger-zone FOUND
- `apps/web/src/features/messages/RoomChatView.tsx` — room-deleted handler FOUND
- `apps/web/src/styles.css` — .danger-zone styles FOUND
- commit ba198f2 — FOUND
- commit 11decf8 — FOUND
