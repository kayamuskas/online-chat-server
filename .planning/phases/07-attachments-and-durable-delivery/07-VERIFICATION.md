---
phase: 07-attachments-and-durable-delivery
verified: 2026-04-20T07:15:00Z
status: human_needed
score: 6/6
overrides_applied: 0
human_verification:
  - test: "Upload a file via the '+' button in the message composer and verify the pending chip appears"
    expected: "File uploads, chip shows original filename with an 'x' remove button"
    why_human: "UI rendering and interaction flow cannot be verified programmatically"
  - test: "Send a message with an attachment and verify the download link appears in the timeline for both sender and another user"
    expected: "Attachment link with original filename and size in KB appears below the message content"
    why_human: "Requires running app with two authenticated sessions"
  - test: "Paste an image from clipboard into the composer textarea"
    expected: "Image uploads automatically and appears as a pending attachment chip"
    why_human: "Clipboard paste events require browser interaction"
  - test: "Upload an image > 3 MB and verify 413 rejection; upload a file > 20 MB and verify 413 rejection"
    expected: "Error message displayed to user for both cases"
    why_human: "Requires browser interaction with the upload flow"
  - test: "Remove a user from a room, then try to download an attachment from that room as the removed user"
    expected: "Download returns 403 Forbidden"
    why_human: "Requires runtime ACL enforcement with multiple sessions"
  - test: "Go offline briefly (DevTools Network), go back online, verify missed messages are caught up via after_watermark (check network requests)"
    expected: "Network tab shows GET /history?after_watermark=N instead of full reload"
    why_human: "Requires browser offline/online simulation and network inspection"
---

# Phase 7: Attachments and Durable Delivery Verification Report

**Phase Goal:** Add attachment upload/download, ACL enforcement, offline delivery, bounded queue strategy, and persistent storage.
**Verified:** 2026-04-20T07:15:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Users can upload files and images by button and paste, with comments and preserved filenames | VERIFIED | Controller POST /upload with Multer diskStorage + UUID filenames; service preserves original_filename in DB; MessageComposer has file input button, handlePaste for clipboard, comment field in upload endpoint |
| 2 | Attachment downloads are authorized against current membership or DM participation | VERIFIED | resolveDownload checks room membership + isBanned via RoomsRepository; DM participation + findBanBetween via ContactsRepository; orphaned attachments restricted to uploader only; 403 returned for all denials |
| 3 | Files stay stored when required and become inaccessible immediately after access loss | VERIFIED | Files stored on disk via UUID paths; ACL checked at request time (not cached) per D-50; files persist even after uploader loses access (ON DELETE RESTRICT on uploader_id FK); orphan cleanup only targets unbound attachments older than 1 hour |
| 4 | Offline recipients receive persisted messages after reconnect | VERIFIED | after_watermark query param in MessageHistoryQuery, repository sorts ASC directly, controller parses and passes through, frontend RoomChatView and DmChatView use afterWatermark in reconnect recovery |
| 5 | Filesystem storage persists correctly across container restarts | VERIFIED | compose.yaml has `../../.volumes/uploads:/app/uploads` volume mount + UPLOADS_DIR env var pointing to /app/uploads |
| 6 | Transient queues remain bounded even for users absent for very long periods | VERIFIED | No transient delivery queue exists; messages table is the sole delivery mechanism; after_watermark catch-up reads directly from messages table; MSG-09 satisfied by architecture |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/db/migrations/0006_attachments_core.sql` | Attachments table DDL | VERIFIED | 30 lines; CREATE TABLE with FK, UNIQUE, two partial indexes |
| `apps/api/src/attachments/attachments.types.ts` | Attachment, AttachmentView, InsertAttachmentInput | VERIFIED | 37 lines; all 3 interfaces exported with correct fields |
| `apps/api/src/attachments/attachments.repository.ts` | AttachmentsRepository CRUD | VERIFIED | 120 lines; insert, findById, bindAttachments, getByMessageIds, findOrphanedBefore, deleteById, getViewsByMessageIds, findMessageById all implemented with real SQL |
| `apps/api/src/attachments/attachments.service.ts` | AttachmentsService with upload, download ACL, orphan cleanup | VERIFIED | 156 lines; createAttachment with image 3MB cap, resolveDownload with room/DM ACL, onApplicationBootstrap orphan cleanup |
| `apps/api/src/attachments/attachments.controller.ts` | Upload and download endpoints | VERIFIED | 118 lines; POST /upload with FileInterceptor + Multer diskStorage + UUID filenames + 20MB limit; GET /:id/download with StreamableFile + Content-Disposition |
| `apps/api/src/attachments/attachments.module.ts` | NestJS module | VERIFIED | 24 lines; imports DbModule, AuthModule, RoomsModule, ContactsModule; exports AttachmentsRepository |
| `apps/api/src/app.module.ts` | AttachmentsModule registered | VERIFIED | Import and registration confirmed at line 12 and 50 |
| `apps/api/src/messages/messages.types.ts` | MessageView.attachments, SendMessageInput.attachment_ids, after_watermark | VERIFIED | AttachmentView imported; attachments: AttachmentView[] on MessageView; attachment_ids?: string[] on SendMessageInput; after_watermark?: number on MessageHistoryQuery |
| `apps/api/src/messages/messages.repository.ts` | LEFT JOIN attachments, after_watermark ASC sort | VERIFIED | LEFT JOIN json_agg sub-query in both listHistory and findMessageViewById; COALESCE to '[]'::json; afterWatermarkClause; sortAsc conditional; conditional reverse |
| `apps/api/src/messages/messages.controller.ts` | after_watermark parsing, attachment_ids in parseSendMessageBody | VERIFIED | parseHistoryQuery includes after_watermark with >= 0 guard and mutual exclusion; parseSendMessageBody parses attachment_ids array; both room and DM send handlers forward attachment_ids |
| `apps/api/src/messages/messages.service.ts` | bindAttachments after createMessage | VERIFIED | AttachmentsRepository injected; bindAttachments called with created.id, attachment_ids, author_id after createMessage |
| `apps/api/src/messages/messages.gateway.ts` | attachments in message-created fanout | VERIFIED | broadcastMessageCreated includes `attachments: message.attachments ?? []` at line 216 |
| `apps/api/src/messages/messages.module.ts` | AttachmentsModule imported | VERIFIED | Import at line 23; added to imports array at line 35 |
| `apps/web/src/lib/api.ts` | uploadAttachment, AttachmentView, afterWatermark, attachment_ids | VERIFIED | postFormData helper, AttachmentView interface, uploadAttachment function, attachmentDownloadUrl utility, afterWatermark in getRoomHistory/getDmHistory, attachment_ids in sendRoomMessage/sendDmMessage |
| `apps/web/src/features/messages/MessageComposer.tsx` | File input, paste handler, pending chips | VERIFIED | uploadAttachment import, pendingAttachments state, fileInputRef, handlePaste, handleFileSelect, file input button, attachment chips with remove |
| `apps/web/src/features/messages/MessageTimeline.tsx` | Attachment rendering | VERIFIED | attachmentDownloadUrl import; download links with original filename and size rendered for messages with attachments |
| `apps/web/src/features/messages/RoomChatView.tsx` | Attachment rendering, afterWatermark reconnect | VERIFIED | attachmentDownloadUrl imported; attachments mapped in mapWsMessage; afterWatermark used in reconnect; attachmentIds forwarded in handleSend |
| `apps/web/src/features/messages/DmChatView.tsx` | Attachment rendering, afterWatermark reconnect | VERIFIED | attachments mapped in mapWsMessage; afterWatermark in reconnect; attachmentIds forwarded in handleSend |
| `infra/compose/compose.yaml` | uploads volume mount | VERIFIED | UPLOADS_DIR: /app/uploads env var at line 68; ../../.volumes/uploads:/app/uploads volume at line 89 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| attachments.repository.ts | postgres.service.ts | constructor injection | WIRED | `constructor(private readonly db: PostgresService)` |
| attachments.controller.ts | attachments.service.ts | constructor injection | WIRED | `constructor(private readonly attachmentsService: AttachmentsService)` |
| attachments.service.ts | rooms.repository.ts | constructor injection for ACL | WIRED | `private readonly roomsRepo: RoomsRepository` with isBanned/getMembership calls |
| attachments.service.ts | contacts.repository.ts | constructor injection for DM ACL | WIRED | `private readonly contactsRepo: ContactsRepository` with findDmConversationById/findBanBetween calls |
| messages.service.ts | attachments.repository.ts | constructor injection | WIRED | `private readonly attachmentsRepo: AttachmentsRepository` with bindAttachments call |
| messages.repository.ts | attachments table | LEFT JOIN | WIRED | `LEFT JOIN (SELECT a2.message_id, json_agg(...) FROM attachments a2 ...) att ON att.message_id = m.id` |
| messages.controller.ts | messages.service.ts | after_watermark passthrough | WIRED | parseHistoryQuery returns after_watermark; passed to listHistory in both room and DM handlers |
| MessageComposer.tsx | api.ts | uploadAttachment import | WIRED | `import { uploadAttachment, type AttachmentView } from "../../lib/api"` |
| api.ts | /api/v1/attachments/upload | fetch POST multipart | WIRED | `postFormData<any>("/attachments/upload", fd)` |
| compose.yaml | .volumes/uploads | Docker volume mount | WIRED | `../../.volumes/uploads:/app/uploads` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| messages.repository.ts | attachments | LEFT JOIN json_agg on attachments table | Yes -- real SQL query against attachments table | FLOWING |
| messages.gateway.ts | message.attachments | MessageView from findMessageViewById | Yes -- LEFT JOIN populates attachments array | FLOWING |
| MessageTimeline.tsx | msg.attachments | MessageView from API/WS | Yes -- mapped via mapMessageView/mapWsMessage | FLOWING |
| RoomChatView.tsx | afterWatermark | messages[].conversationWatermark | Yes -- last message watermark drives catch-up query | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (no runnable entry points -- requires Docker stack with Postgres)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MSG-06 | 07-02 | Messages stored persistently, delivered after reconnect | SATISFIED | after_watermark catch-up in repository, controller, frontend reconnect |
| MSG-09 | 07-02 | Transient delivery queues remain bounded | SATISFIED | No queue exists; messages table is sole delivery mechanism |
| FILE-01 | 07-01, 07-03, 07-04, 07-05 | Upload images and files via button or paste | SATISFIED | Full upload pipeline: Multer controller, service, repository, frontend composer with file input and paste |
| FILE-02 | 07-01, 07-03, 07-04, 07-05 | Preserve original filename and optional comment | SATISFIED | original_filename and comment stored in DB; AttachmentView exposes both |
| FILE-03 | 07-03 | Only current members or DM participants can download | SATISFIED | resolveDownload checks room membership + ban, DM participation + ban |
| FILE-04 | 07-03 | Losing access blocks downloads | SATISFIED | ACL checked at request time (not cached); isBanned + getMembership checked per request |
| FILE-05 | 07-01 | Files remain stored unless room deleted | SATISFIED | uploader_id ON DELETE RESTRICT; message_id ON DELETE CASCADE (files persist if uploader loses access, cascade only on message deletion) |
| FILE-06 | 07-03 | Image 3 MB limit, file 20 MB limit | SATISFIED | IMAGE_MAX_BYTES = 3 * 1024 * 1024 in service; FILE_MAX_BYTES = 20 * 1024 * 1024 in controller Multer limits |
| OPS-03 | 07-01 | Files stored on local filesystem, persist across restarts | SATISFIED | Docker volume mount ../../.volumes/uploads:/app/uploads in compose.yaml |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODO, FIXME, placeholder, or stub patterns found in any Phase 7 files |

### Human Verification Required

### 1. File Upload via Button

**Test:** Click the "+" button in the message composer to select a file (< 20 MB). Verify it appears as a pending chip with filename.
**Expected:** Chip shows original filename with an "x" remove button.
**Why human:** UI rendering and interaction flow cannot be verified programmatically.

### 2. Send Message with Attachment

**Test:** Send a message with a pending attachment. As another user in the same room, verify the download link appears.
**Expected:** Attachment link with original filename and size in KB appears below message content. Clicking downloads the file with the original filename.
**Why human:** Requires running app with two authenticated sessions.

### 3. Clipboard Paste Upload

**Test:** Copy an image to clipboard, paste into the composer textarea.
**Expected:** Image uploads automatically and appears as a pending attachment chip.
**Why human:** Clipboard paste events require browser interaction.

### 4. Size Limit Enforcement

**Test:** Upload an image > 3 MB and a file > 20 MB.
**Expected:** 413 error message displayed to user for both cases.
**Why human:** Requires browser interaction with the upload flow and error display.

### 5. ACL Enforcement After Access Loss

**Test:** Remove a user from a room, then try to download a previously accessible attachment as that user.
**Expected:** Download returns 403 Forbidden.
**Why human:** Requires runtime ACL enforcement with multiple sessions and membership changes.

### 6. Reconnect Catch-Up via Watermark

**Test:** Open browser DevTools Network tab, go offline briefly, go back online. Check network requests.
**Expected:** GET /history?after_watermark=N request instead of full history reload.
**Why human:** Requires browser offline/online simulation and network inspection.

### 7. DM Attachments

**Test:** Open a DM conversation, upload and send an attachment. Verify the download link appears for both participants.
**Expected:** Same attachment flow as rooms works in DM conversations.
**Why human:** Requires two authenticated users with an active DM conversation.

### Gaps Summary

No automated gaps found. All 6 roadmap success criteria verified against the codebase. All 19 artifacts exist, are substantive, and are properly wired. All key links are connected with real data flowing through them. All 9 requirement IDs (MSG-06, MSG-09, FILE-01 through FILE-06, OPS-03) are covered by implemented code.

7 human verification items remain for visual, interactive, and runtime ACL testing.

---

_Verified: 2026-04-20T07:15:00Z_
_Verifier: Claude (gsd-verifier)_
