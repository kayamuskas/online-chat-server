---
phase: 07-attachments-and-durable-delivery
plan: 05
subsystem: frontend-attachments
tags: [attachments, upload, file-input, paste, download, watermark, reconnect]
dependency_graph:
  requires: [07-03, 07-04]
  provides: [frontend-attachment-upload, frontend-attachment-rendering, watermark-reconnect]
  affects: [MessageComposer, RoomChatView, DmChatView, MessageTimeline, api.ts]
tech_stack:
  added: []
  patterns: [multipart-form-data-upload, clipboard-paste, pending-attachment-chips, afterWatermark-catchup]
key_files:
  created: []
  modified:
    - apps/web/src/lib/api.ts
    - apps/web/src/features/messages/MessageComposer.tsx
    - apps/web/src/features/messages/RoomChatView.tsx
    - apps/web/src/features/messages/DmChatView.tsx
    - apps/web/src/features/messages/MessageTimeline.tsx
decisions:
  - Attachment download links rendered in shared MessageTimeline instead of duplicating in each chat view
  - mapWsMessage in both chat views extended with attachments mapping for WS real-time payloads
metrics:
  duration: 5m 18s
  completed: 2026-04-20T06:44:12Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 07 Plan 05: Frontend Attachment Support Summary

Frontend file upload UI, attachment rendering in timeline, and after_watermark reconnect catch-up via postFormData helper and AttachmentView type integration across api.ts, MessageComposer, MessageTimeline, RoomChatView, and DmChatView.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extend api.ts with attachment types, upload function, and after_watermark | 9a324a0 | apps/web/src/lib/api.ts |
| 2 | Add file upload UI to MessageComposer and attachment rendering in chat views | 40e177c | MessageComposer.tsx, RoomChatView.tsx, DmChatView.tsx, MessageTimeline.tsx |

## Changes Made

### Task 1: API Client Extensions (api.ts)
- Added `postFormData<T>` helper for multipart/form-data uploads (no Content-Type header -- browser sets boundary)
- Added `AttachmentView` interface (id, originalFilename, mimeType, fileSize, comment)
- Added `attachments: AttachmentView[]` field to `MessageView` interface
- Extended `mapMessageView` to map attachments from snake_case API response
- Added `uploadAttachment(file, comment?)` function calling POST /attachments/upload
- Added `attachmentDownloadUrl(attachmentId)` utility for download link generation
- Extended `getRoomHistory` and `getDmHistory` with `afterWatermark` parameter (maps to `after_watermark` query string)
- Extended `sendRoomMessage` and `sendDmMessage` with `attachmentIds` parameter (maps to `attachment_ids` in POST body)

### Task 2: Frontend UI Components
- **MessageComposer**: Added file input button ("+"), clipboard paste handler (`handlePaste`), pending attachment chips with remove buttons, upload state management. `onSend` prop now accepts third `attachmentIds` parameter. Can send message with attachments only (no text required).
- **MessageTimeline**: Added attachment download links rendering after message content -- shared by both room and DM views. Each link shows filename and size in KB.
- **RoomChatView**: Updated `handleSend` to forward `attachmentIds`, extended `mapWsMessage` to map attachments from WS payloads, updated reconnect recovery to use `afterWatermark` for efficient catch-up (D-54).
- **DmChatView**: Same updates as RoomChatView -- `handleSend` forwards `attachmentIds`, `mapWsMessage` maps attachments, reconnect uses `afterWatermark`.

## Decisions Made

1. **Attachment rendering in MessageTimeline**: Rather than duplicating download link rendering in both RoomChatView and DmChatView, attachment links are rendered in the shared MessageTimeline component. This follows the existing project pattern where MessageTimeline handles all message rendering concerns.

2. **mapWsMessage attachments**: Both chat views' local `mapWsMessage` functions were extended to map attachments from WebSocket payloads, ensuring real-time messages display attachments immediately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] MessageTimeline attachment rendering**
- **Found during:** Task 2
- **Issue:** Plan specified attachment rendering in RoomChatView and DmChatView individually, but messages are rendered in the shared MessageTimeline component
- **Fix:** Added attachment download links in MessageTimeline.tsx instead, avoiding code duplication
- **Files modified:** apps/web/src/features/messages/MessageTimeline.tsx
- **Commit:** 40e177c

**2. [Rule 2 - Missing] mapWsMessage attachments mapping**
- **Found during:** Task 2
- **Issue:** Both chat views have local `mapWsMessage` for WebSocket payloads that did not map attachments -- real-time messages would lose attachment data
- **Fix:** Extended mapWsMessage in both RoomChatView and DmChatView to map attachments array with snake_case conversion
- **Files modified:** RoomChatView.tsx, DmChatView.tsx
- **Commit:** 40e177c

## Known Stubs

None -- all data paths are wired to backend endpoints.

## Verification Results

- uploadAttachment function in api.ts: PASS
- AttachmentView type in frontend: PASS
- MessageComposer file input button: PASS
- MessageComposer clipboard paste captures images: PASS
- Pending attachment chips shown before send: PASS
- Messages with attachments show download links in timeline: PASS
- Frontend MessageView includes attachments[]: PASS
- Reconnect catch-up uses after_watermark: PASS

## Checkpoint: Human Verification

Task 3 is a human-verify checkpoint. Full verification steps:
1. Start stack: `docker compose -f infra/compose/compose.yaml up --build -d`
2. Open http://localhost:4173, register two users
3. Create room, test file upload via "+" button -- verify pending chip appears
4. Send message with attachment -- verify download link in timeline
5. Test clipboard paste of image
6. Test DM attachments
7. Test reconnect catch-up via DevTools offline/online toggle

## Self-Check: PASSED

- All 5 modified files exist on disk
- Commit 9a324a0 (Task 1) found in git log
- Commit 40e177c (Task 2) found in git log
