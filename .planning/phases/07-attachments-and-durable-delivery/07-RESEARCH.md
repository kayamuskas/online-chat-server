# Phase 7: Attachments and Durable Delivery - Research

**Researched:** 2026-04-19
**Domain:** File upload (Multer/NestJS), attachment ACL, durable message delivery (watermark catch-up), Docker volume persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-40:** Attachments are a separate DB entity with FK to messages (1:N).
- **D-41:** Attachment record stores: original filename, MIME type, file size, storage path (UUID-based), optional comment, uploader_user_id.
- **D-42:** messages table gains no new columns — association entirely via attachments FK.
- **D-43:** Attachment metadata included in MessageView.attachments[] — no separate fetch.
- **D-44:** Upload endpoint: `POST /attachments/upload`, multipart via Multer, UUID filename, returns attachment record with ID.
- **D-45:** Client uploads files first (gets IDs), then sendMessage with optional `attachment_ids[]`.
- **D-46:** Clipboard paste handled client-side: paste event → File object → same upload endpoint.
- **D-47:** Size limits at Multer layer: 20 MB for arbitrary files, 3 MB for images (by MIME). Violations return 413.
- **D-48:** Files stored under configurable base dir (e.g., `./uploads/`) with UUID filenames. Original filenames in DB only.
- **D-49:** Download proxied: `GET /attachments/:id/download` — checks membership/DM participation before streaming. No direct FS URLs.
- **D-50:** Download ACL checked at download time, not cached. Losing room/DM access immediately blocks download.
- **D-51:** Files remain on disk even if uploader loses access. Deleted only on room deletion (Phase 8, ROOM-09).
- **D-52:** Durable delivery uses watermark-based catch-up, not a separate push queue. Client reconnects → sends last watermark → server returns missed messages via existing history REST endpoint.
- **D-53:** No separate delivery queue or inbox table. "Delivery" = history query filtered by watermark.
- **D-54:** Reconnect catch-up flow: reconnect WS → call `GET /messages/:type/:id?after_watermark=N` → merge into timeline.
- **D-55:** OPS-03 satisfied by Docker volume-mounted uploads directory.

### Claude's Discretion

- Exact Multer configuration and middleware placement in the NestJS module hierarchy.
- Whether attachment upload requires a pre-existing conversation or can be "orphaned" temporarily.
- Whether to add `after_watermark` to existing history endpoints or create a separate catch-up endpoint.
- Exact thumbnail/preview generation for images (not required by spec).

### Deferred Ideas (OUT OF SCOPE)

- Image thumbnails / preview generation — Phase 9 frontend polish.
- Message deletion cascading to attachment file deletion — Phase 8 (MSG-05, ROOM-09).
- Virus/malware scanning — not in v1.
- CDN or S3-compatible storage — v1 is local filesystem only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MSG-06 | Messages stored persistently, delivered after reconnect when recipient was offline | D-52..D-54: watermark catch-up via `after_watermark` on existing history endpoint |
| MSG-09 | Transient delivery queues remain bounded for long-absent users | D-53: no secondary queue — messages table IS the queue; bounded by history |
| FILE-01 | Send images and files via upload button or clipboard paste | D-44, D-46: `POST /attachments/upload` + client-side paste-to-File conversion |
| FILE-02 | Preserve original filename and optional attachment comment | D-41: original_filename + comment stored in attachments table |
| FILE-03 | Only current room members or authorized DM participants can download | D-49: proxied download endpoint with membership/DM check at request time |
| FILE-04 | If user loses room access → loses access to room's messages, files, images | D-50: ACL check at download time, not cached |
| FILE-05 | Files remain stored unless room is deleted, even if uploader loses access | D-51: deletion only on room delete (Phase 8) |
| FILE-06 | File size limit 20 MB; image size limit 3 MB | D-47: Multer `limits.fileSize` per MIME type |
| OPS-03 | Files stored on local filesystem, persist across restarts | D-55: Docker named volume for uploads dir |
</phase_requirements>

---

## Summary

Phase 7 has two distinct technical tracks that share no implementation dependencies between them.

**Track A — File attachments:** A new `attachments` module (controller + service + repository) built on NestJS `@nestjs/platform-express` + Multer. The upload endpoint stores files under a UUID-named path on a host-mounted Docker volume. The download endpoint proxies file streams after performing a real-time ACL check by delegating to the existing `RoomsRepository.getMembership` / `ContactsRepository.findDmConversationById` methods. One migration (0006_attachments_core.sql) adds the `attachments` table. `MessageView` and the history query gain an `attachments[]` sub-array populated by a LEFT JOIN.

**Track B — Durable delivery (watermark catch-up):** This is the simpler track. The existing `listHistory` query is extended with a complementary `after_watermark` parameter. The Phase 6.1 client reconnect recovery already performs a full history re-fetch; it must be updated to pass `after_watermark` instead of reloading the full page, and the `MessageHistoryQuery` type must accept the new parameter.

**Critical infrastructure concern:** The API container runs with `read_only: true` in compose.yaml. Uploads require a writable directory. The solution is to add a named Docker volume mounted at `/app/uploads` inside the container (mirroring the existing mail-outbox pattern).

**Primary recommendation:** Build `AttachmentsModule` as a standalone NestJS module that imports `DbModule`, `AuthModule`, `RoomsModule`, and `ContactsModule`. Keep it fully decoupled from `MessagesModule` at the module level; the coupling happens at the DB layer (attachments.message_id FK) and at the `MessagesRepository` level (JOIN attachments in listHistory).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File upload (multipart) | API / Backend | — | Server must validate size, store file, create DB record |
| File download + streaming | API / Backend | — | ACL check must happen server-side before bytes reach client |
| Attachment ACL (room/DM) | API / Backend | — | Membership state lives in DB; client cannot be trusted |
| Original filename preservation | Database | — | UUID on disk; human name in DB only (D-48) |
| Clipboard paste → File | Browser / Client | — | Paste event is browser-side; File object piped to upload endpoint |
| File upload UI (button + paste) | Browser / Client | — | React component wires input[type=file] + paste handler |
| Attachment rendering in timeline | Browser / Client | — | MessageView.attachments[] → download link rendered per item |
| After-watermark catch-up | API / Backend | Browser / Client | Server adds `after_watermark` filter; client sends last known watermark on reconnect |
| Docker volume persistence | CDN / Static (Infra) | — | compose.yaml named volume for `/app/uploads` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| multer | 2.1.1 [VERIFIED: npm registry] | Multipart/form-data file parsing | De-facto Express/NestJS standard; built on busboy |
| @types/multer | 2.1.0 [VERIFIED: npm registry] | TypeScript types for Express.Multer.File | Required for typed route handlers |
| @nestjs/platform-express | ^11.0.0 [VERIFIED: existing package.json] | NestJS Express adapter (already installed) | FileInterceptor requires Express adapter |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs/promises | built-in | Streaming file to HTTP response via createReadStream | For the proxied download endpoint |
| node:crypto randomUUID | built-in | UUID-based storage filenames (D-48) | UUID prevents path traversal and collisions |
| node:path | built-in | Safe path joining for upload directory | Never use user-supplied paths directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Multer DiskStorage | MemoryStorage | MemoryStorage buffers entire file in RAM — inappropriate for 20 MB files |
| Proxied download via createReadStream + res.pipe | sendFile / res.download | NestJS StreamableFile wraps createReadStream cleanly in controllers |

**Installation (new deps only):**
```bash
pnpm --filter @chat/api add multer
pnpm --filter @chat/api add -D @types/multer
```

**Version verification:**
- multer: `npm view multer version` → 2.1.1 (verified 2026-04-19) [VERIFIED: npm registry]
- @types/multer: `npm view @types/multer version` → 2.1.0 (verified 2026-04-19) [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (paste / file-input click)
    │
    │  POST /api/v1/attachments/upload
    │  multipart/form-data  (field: "file", optional: "comment")
    ▼
AttachmentsController
    │
    ├─ FileInterceptor('file', multerOptions)  ← limits enforced here (D-47)
    ├─ MIME check → 3 MB cap for images, 20 MB for others
    │
    ├─ AttachmentsService.createAttachment(file, uploaderId)
    │       │
    │       ├─ Writes file to  ./uploads/{conv_type}/{conv_id}/{uuid}.{ext}
    │       └─ INSERT INTO attachments → returns AttachmentView {id, ...}
    │
    └─ 201 {id, original_filename, mime_type, file_size, comment}

Browser
    │
    │  POST /api/v1/messages/rooms/:id/messages
    │  body: { content, attachment_ids: [uuid] }
    ▼
MessagesController.sendRoomMessage
    │
    ├─ MessagesService.sendMessage(input)  (access check, content validation)
    │       └─ MessagesRepository.createMessage + bindAttachments(messageId, ids)
    │
    ├─ AttachmentsRepository.bindAttachments(messageId, attachment_ids)
    │       └─ UPDATE attachments SET message_id=$1 WHERE id = ANY($2) AND uploader_id=$3
    │
    └─ MessagesGateway.broadcastMessageCreated(messageView)
              messageView.attachments = [{id, original_filename, mime_type, file_size, comment}]

Browser
    │
    │  GET /api/v1/attachments/:id/download
    ▼
AttachmentsController.download
    │
    ├─ AttachmentsRepository.findById(id) → attachment row
    ├─ Resolve conversation_type + conversation_id from attachment.message_id
    ├─ ACL: room → RoomsRepository.getMembership + isBanned
    │         dm  → ContactsRepository.findDmConversationById + findBanBetween
    │
    ├─ ForbiddenException if not authorised
    │
    └─ StreamableFile(createReadStream(storagePath))
           + Content-Disposition: attachment; filename*=UTF-8''<encoded_name>

Reconnect (WS restored after offline)
    │
    │  GET /api/v1/messages/rooms/:id/history?after_watermark=N
    ▼
MessagesController.getRoomHistory
    │
    └─ MessagesService.listHistory → MessagesRepository.listHistory(after_watermark: N)
           Returns messages with watermark > N, ASC order
           attachments[] included per MessageView (LEFT JOIN)
```

### Recommended Project Structure
```
apps/api/src/
├── attachments/
│   ├── attachments.module.ts       # imports DbModule, AuthModule, RoomsModule, ContactsModule
│   ├── attachments.controller.ts   # POST /attachments/upload, GET /attachments/:id/download
│   ├── attachments.service.ts      # business logic: createAttachment, assertDownloadAccess
│   ├── attachments.repository.ts   # SQL: insert, findById, bindAttachments, getByMessageIds
│   └── attachments.types.ts        # Attachment, AttachmentView, BindAttachmentsInput
├── messages/
│   ├── messages.types.ts           # MessageView gains attachments: AttachmentView[]
│   ├── messages.repository.ts      # listHistory LEFT JOIN attachments; bindAttachments call
│   └── ... (existing files)
apps/api/src/db/migrations/
└── 0006_attachments_core.sql

infra/compose/compose.yaml          # add uploads volume + env UPLOADS_DIR
.volumes/
└── uploads/                        # host-side volume mount
```

### Pattern 1: Multer DiskStorage with UUID filenames in NestJS

**What:** Configure Multer's DiskStorage so files land at `{UPLOADS_BASE}/{uuid}{ext}`. Original filename is never used on disk.
**When to use:** All upload requests — prevents path traversal (D-48).

```typescript
// Source: https://github.com/expressjs/multer/blob/main/README.md [VERIFIED: Context7]
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

export function createMulterStorage(baseDir: string) {
  return diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, baseDir);
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname);
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}
```

### Pattern 2: MIME-aware size limits — two Multer instances

**What:** Decision D-47 requires different size caps for images vs other files. Multer's `limits.fileSize` is per-instance. Use a single `fileFilter` that enforces limits based on MIME type.

```typescript
// Source: [ASSUMED] — Multer docs show fileFilter callback; MIME-based logic is standard
import multer from 'multer';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const IMAGE_MAX = 3 * 1024 * 1024;   // 3 MB (D-47)
const FILE_MAX  = 20 * 1024 * 1024;  // 20 MB (D-47)

export function buildMulterOptions(storage: multer.StorageEngine): multer.Options {
  return {
    storage,
    limits: { fileSize: FILE_MAX },   // hard cap — image cap enforced in fileFilter
    fileFilter(_req, file, cb) {
      // If image MIME but file will be over 3 MB, reject before storing
      // NOTE: at fileFilter time file.size is NOT available; size check must happen
      // after storage in service layer, then unlink if oversized image.
      // Alternative: use two upload middleware instances; see Pitfall 2 below.
      cb(null, true);
    },
  };
}
```

> **Important:** Multer's `fileFilter` runs before the file is written to disk, but `file.size` is not available at filter time. For the 3 MB image cap, the service layer must check `file.size` after storage and delete the file if oversized. See Pitfall 2.

### Pattern 3: NestJS FileInterceptor with custom options

```typescript
// Source: https://github.com/nestjs/docs.nestjs.com/blob/master/content/techniques/file-upload.md
// [VERIFIED: Context7]
@Post('upload')
@UseInterceptors(FileInterceptor('file', multerOptions))
@UseGuards(CurrentUserGuard)
async upload(
  @UploadedFile() file: Express.Multer.File,
  @Body('comment') comment: string | undefined,
  @CurrentUser() ctx: AuthContext,
) {
  const attachment = await this.attachmentsService.createAttachment(file, ctx.user.id, comment);
  return attachment;
}
```

### Pattern 4: StreamableFile for proxied download

```typescript
// Source: https://docs.nestjs.com/techniques/streaming-files [ASSUMED — standard NestJS pattern]
import { StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { Response } from 'express';

@Get(':id/download')
async download(
  @Param('id') id: string,
  @CurrentUser() ctx: AuthContext,
  @Res({ passthrough: true }) res: Response,
) {
  const { attachment, storagePath } = await this.attachmentsService.resolveDownload(id, ctx.user.id);
  res.set({
    'Content-Type': attachment.mime_type,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_filename)}`,
  });
  return new StreamableFile(createReadStream(storagePath));
}
```

### Pattern 5: after_watermark for durable catch-up (D-52..D-54)

**What:** Extend existing `listHistory` with `after_watermark` to return messages with `conversation_watermark > N`.

```typescript
// Extension to MessageHistoryQuery (messages.types.ts)
export interface MessageHistoryQuery {
  conversation_type: ConversationType;
  conversation_id: string;
  before_watermark?: number;   // existing backward pagination
  after_watermark?: number;    // new: catch-up after reconnect (D-54)
  limit?: number;
}
```

SQL extension to repository (add to WHERE clause):
```sql
-- after_watermark clause (appended to existing WHERE in listHistory)
AND m.conversation_watermark > $N
ORDER BY m.conversation_watermark ASC   -- ascending for catch-up (not DESC like backward pagination)
```

### Pattern 6: bindAttachments — atomic association at send time (D-45)

```typescript
// Source: [ASSUMED] — standard UPDATE ... WHERE id = ANY(array) pattern in pg
async bindAttachments(messageId: string, attachmentIds: string[], uploaderId: string): Promise<void> {
  if (attachmentIds.length === 0) return;
  await this.db.query(
    `UPDATE attachments
     SET message_id = $1
     WHERE id = ANY($2::uuid[])
       AND uploader_id = $3
       AND message_id IS NULL`,
    [messageId, attachmentIds, uploaderId],
  );
}
```

The `AND message_id IS NULL` guard prevents re-binding already-bound attachments to a different message.

### Anti-Patterns to Avoid

- **Storing original filenames on disk:** Path traversal risk. UUID filenames on disk only (D-48).
- **Exposing direct filesystem URLs:** All downloads must go through the proxy endpoint (D-49).
- **Checking ACL via client-supplied metadata:** Always resolve attachment → message → conversation at download time using DB queries.
- **Using MemoryStorage for large files:** 20 MB in RAM per upload × concurrent users = OOM. Always use DiskStorage.
- **Skipping `AND message_id IS NULL` in bindAttachments:** Without this guard a malicious client could re-bind someone else's attachment.
- **Storing attachment data in MessageView without JOIN:** N+1 queries. Always LEFT JOIN `attachments` in the history query.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart parsing | Custom busboy wrapper | `multer` via `FileInterceptor` | Handles encoding, temp file cleanup, limits, errors |
| File streaming to response | Manual `res.write` loop | `StreamableFile(createReadStream(path))` | NestJS handles backpressure, headers, cleanup |
| UUID-based filenames | Custom hash/timestamp logic | `randomUUID()` from `node:crypto` | Cryptographically random, no collisions |
| MIME type detection | Custom file-header sniffing | Trust Multer's `file.mimetype` for enforcement; validate against allowed list | Multer reads MIME from Content-Type declared by client; service layer validates list |

**Key insight:** Multer handles all the hard multipart streaming edge cases (partial uploads, encoding boundaries, temp file cleanup on error). Never parse multipart manually in NestJS — use `FileInterceptor`.

---

## Common Pitfalls

### Pitfall 1: API container is read-only — uploads directory not writable
**What goes wrong:** The `api` service in compose.yaml has `read_only: true`. Multer writes to `./uploads/` inside the container → EROFS / permission denied at runtime.
**Why it happens:** Security hardening from Phase 1 (T-01-12). The mail-outbox used the same pattern.
**How to avoid:** Add a named Docker volume mounted at `/app/uploads` in compose.yaml AND add `/app/uploads` to the container's writable mounts. Mirror the existing `mail-outbox` volume pattern.
**Warning signs:** `EROFS: read-only file system` in API logs on first upload attempt.

```yaml
# compose.yaml addition (mirror of existing mail-outbox pattern):
volumes:
  - ../../.volumes/uploads:/app/uploads   # <-- add this

# Environment variable for configurable base path:
environment:
  UPLOADS_DIR: /app/uploads
```

### Pitfall 2: Image size cap not enforceable in Multer fileFilter (file.size unavailable)
**What goes wrong:** `file.size` is not available inside Multer's `fileFilter` callback — the file hasn't been read yet. Setting `limits.fileSize = 3MB` globally would reject valid non-image files above 3 MB.
**Why it happens:** Multer's `fileFilter` runs at the HTTP boundary before reading bytes.
**How to avoid:** Use two Multer middleware instances: one for images (3 MB cap) and one for all files (20 MB cap). Detect which to apply based on `Content-Type` header of the request, OR use a single 20 MB instance and add a post-storage size check in the service layer that deletes the file and throws 413 for oversized images.
**Recommended approach:** Post-storage service-layer check — simpler module wiring, one upload endpoint. See AttachmentsService.createAttachment logic below.

### Pitfall 3: after_watermark changes sort order of listHistory
**What goes wrong:** The existing `listHistory` sorts `DESC` to efficiently apply LIMIT, then reverses. An `after_watermark` query (catch-up) should return oldest-first (ASC) to allow the client to merge in order. Using the same DESC→reverse path produces wrong pagination semantics.
**Why it happens:** Backward pagination (before_watermark) and forward catch-up (after_watermark) require opposite sort directions for correct behavior.
**How to avoid:** When `after_watermark` is provided, sort ASC directly (no reverse needed). Add an explicit branch in `listHistory` or `parseHistoryQuery`.

### Pitfall 4: Orphaned attachment files (upload succeeds, sendMessage fails)
**What goes wrong:** Client uploads a file (file written to disk, DB row created), then sendMessage fails (e.g., network drop, validation error). The attachment row has `message_id = NULL` indefinitely.
**Why it happens:** Upload and send are two separate HTTP calls (D-45).
**How to avoid:** Per CONTEXT.md D-45, "orphaned" attachments are an accepted temporary state. For v1, a nightly/startup cleanup job scanning `attachments WHERE message_id IS NULL AND created_at < NOW() - INTERVAL '1 hour'` is sufficient. This is Claude's Discretion — planner should add a cleanup task.

### Pitfall 5: Missing `AND uploader_id=$3` in bindAttachments allows attachment hijacking
**What goes wrong:** User A uploads a file, gets attachment ID. User B POSTs sendMessage with User A's attachment ID. Without `uploader_id` check, User B can bind User A's file to their message.
**Why it happens:** Attachment IDs are predictable (UUIDs) and the upload response returns the ID.
**How to avoid:** `bindAttachments` query must include `AND uploader_id = $callerId AND message_id IS NULL`.

### Pitfall 6: Downloading attachments from deleted conversations (Phase 7 scope)
**What goes wrong:** ACL check resolves conversation from attachment.message_id → message.conversation_id. If the conversation no longer exists in DB, the check may throw NotFoundException instead of ForbiddenException.
**Why it happens:** Phase 8 will add room deletion; Phase 7 must anticipate it gracefully.
**How to avoid:** Download handler returns 403 (not 404) when the conversation cannot be resolved — avoids leaking existence information.

---

## Code Examples

### Migration 0006_attachments_core.sql

```sql
-- Source: pattern follows 0005_messages_core.sql in this repo [VERIFIED: codebase]
CREATE TABLE IF NOT EXISTS attachments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID        REFERENCES messages(id) ON DELETE CASCADE,
  uploader_id      UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  original_filename TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL,
  file_size         BIGINT      NOT NULL,
  storage_path      TEXT        NOT NULL UNIQUE,
  comment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup: attachments for a set of message IDs (batch JOIN in listHistory)
CREATE INDEX IF NOT EXISTS idx_attachments_message_id
  ON attachments (message_id)
  WHERE message_id IS NOT NULL;

-- Cleanup: orphaned attachments (message_id IS NULL, old)
CREATE INDEX IF NOT EXISTS idx_attachments_orphan_cleanup
  ON attachments (created_at)
  WHERE message_id IS NULL;
```

### MessageView extension

```typescript
// Source: messages.types.ts in this repo, extended for Phase 7 [VERIFIED: codebase]
export interface AttachmentView {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  comment: string | null;
}

export interface MessageView {
  // ... existing fields ...
  attachments: AttachmentView[];  // empty array when message has no attachments
}
```

### SendMessageInput extension

```typescript
// Source: messages.types.ts in this repo [VERIFIED: codebase]
export interface SendMessageInput {
  conversation_type: ConversationType;
  conversation_id: string;
  author_id: string;
  content: string;
  reply_to_id?: string | null;
  attachment_ids?: string[];  // new for Phase 7 (D-45)
}
```

### listHistory SQL extension (after_watermark)

```sql
-- Extends existing query in messages.repository.ts [VERIFIED: codebase]
-- after_watermark clause (appended only when after_watermark param provided):
AND m.conversation_watermark > $N

-- Attachment sub-query (LEFT JOIN added to existing listHistory SELECT):
LEFT JOIN (
  SELECT a.message_id,
         json_agg(json_build_object(
           'id', a.id,
           'original_filename', a.original_filename,
           'mime_type', a.mime_type,
           'file_size', a.file_size,
           'comment', a.comment
         ) ORDER BY a.created_at) AS attachments
  FROM attachments a
  WHERE a.message_id IS NOT NULL
  GROUP BY a.message_id
) att ON att.message_id = m.id
-- In SELECT: COALESCE(att.attachments, '[]'::json) AS attachments
```

---

## Runtime State Inventory

> This section is not applicable. Phase 7 is a greenfield feature addition — no renaming, refactoring, or migration of existing runtime state.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multer v1.x (callbacks) | Multer v2.x (same API, updated deps) | 2024 | API identical; just version bump |
| Manual multipart parsing | `FileInterceptor` from `@nestjs/platform-express` | NestJS 6+ | One decorator, full Express Multer integration |
| Polling for missed messages | Watermark-based `after_watermark` catch-up | Phase 6.1 established infrastructure | No extra queue, uses existing messages table |

**Deprecated/outdated:**
- `multer@1.x`: Security advisories; `multer@2.x` is the current stable. Use 2.1.1.
- In-memory delivery queues (Redis lists, BullMQ inbox): Not needed when messages are persisted in a queryable table with watermarks (D-53).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | OPS-03 volume mounts | ✓ | 28.5.2 | — |
| Node.js | API runtime | ✓ | 25.9.0 | — |
| multer | FILE-01..06 | ✗ (not yet in package.json) | 2.1.1 available | No fallback — must install |
| @types/multer | TypeScript types | ✗ (not yet in package.json) | 2.1.0 available | No fallback — must install |
| PostgreSQL | DB migrations | ✓ (via Docker) | 18 (in compose) | — |

**Missing dependencies with no fallback:**
- `multer` + `@types/multer` must be added to `apps/api` package.json before the upload endpoint can be implemented.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `apps/api/vitest.config.ts` (inferred from devDependencies) |
| Quick run command | `pnpm --filter @chat/api test` |
| Full suite command | `pnpm --filter @chat/api test --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-01 | Upload endpoint accepts multipart, stores file | unit | `pnpm --filter @chat/api test attachments` | --- Wave 0 |
| FILE-02 | original_filename and comment stored in DB | unit | same | --- Wave 0 |
| FILE-03 | Download blocked for non-member | unit | same | --- Wave 0 |
| FILE-04 | Download blocked after access loss | unit | same | --- Wave 0 |
| FILE-05 | File persists after uploader loses access | unit | same | --- Wave 0 |
| FILE-06 | 413 on oversized file; 3 MB image cap | unit | same | --- Wave 0 |
| MSG-06 | after_watermark returns only missed messages | unit | `pnpm --filter @chat/api test messages` | --- Wave 0 |
| MSG-09 | No secondary queue; bounded by messages table | integration (manual verify) | manual | — |
| OPS-03 | Volume persists across container restart | smoke script | manual QA | — |

### Sampling Rate
- **Per task commit:** `pnpm --filter @chat/api test`
- **Per wave merge:** `pnpm --filter @chat/api test --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/attachments/__tests__/attachments.service.spec.ts` — covers FILE-01..06
- [ ] `apps/api/src/attachments/__tests__/attachments.repository.spec.ts` — covers DB layer
- [ ] `apps/api/src/messages/__tests__/after-watermark.spec.ts` — covers MSG-06 catch-up logic

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | existing CurrentUserGuard on all endpoints |
| V3 Session Management | yes (inherited) | existing session-cookie mechanism |
| V4 Access Control | yes | runtime ACL check in AttachmentsService.assertDownloadAccess |
| V5 Input Validation | yes | Multer limits + MIME allowlist + service-layer size check |
| V6 Cryptography | no | No new crypto; UUID from node:crypto for filenames |

### Known Threat Patterns for file upload stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via filename | Tampering | UUID filenames on disk; original_filename stored in DB only (D-48) |
| Oversized upload DoS | DoS | Multer `limits.fileSize: 20 MB` + image cap in service layer |
| Attachment ID enumeration (download without auth) | Info Disclosure | Download endpoint requires session + ACL check (D-49) |
| Attachment hijacking (bind other user's file) | Tampering | `bindAttachments` validates `uploader_id = callerId` (Pitfall 5) |
| Direct filesystem URL access | Info Disclosure | No FS URLs exposed; all downloads proxied (D-49) |
| Uncontrolled disk growth | DoS | Orphan cleanup job (Pitfall 4); bounded by file size limits |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Post-storage image size check (delete file if oversized image) is the recommended approach for MIME-based dual cap | Pitfall 2, Pattern 2 | If wrong, need two Multer instances — more module complexity |
| A2 | `StreamableFile(createReadStream(path))` is the correct NestJS pattern for proxied file streaming | Pattern 4 | If wrong, need to pipe manually via `@Res()` — still works but less idiomatic |
| A3 | `after_watermark` should use `ASC` sort order in SQL (not DESC→reverse) | Pitfall 3, Pattern 5 | If wrong, client receives catch-up messages in reverse order |

---

## Open Questions (RESOLVED)

1. **Orphaned attachment cleanup timing** — RESOLVED (Plan 07-03)
   - What we know: uploads can become orphaned if sendMessage fails after upload (D-45 explicitly accepts this)
   - What's unclear: should cleanup be a startup task, a BullMQ job, or manual Phase 8 scope?
   - Recommendation: Add a simple startup cleanup in `AttachmentsService.onApplicationBootstrap` that deletes attachments with `message_id IS NULL AND created_at < NOW() - INTERVAL '1 hour'` and their disk files. No BullMQ needed.
   - **Resolution:** Plan 07-03 implements startup cleanup in `AttachmentsService.onApplicationBootstrap`. No BullMQ.

2. **after_watermark + before_watermark mutual exclusion** — RESOLVED (Plan 07-02)
   - What we know: they are logically opposed (forward vs backward pagination)
   - What's unclear: should the API reject requests with both, or silently prefer one?
   - Recommendation: Use `after_watermark` if both are present; log a warning.
   - **Resolution:** Plan 07-02 implements `after_watermark` support in the history endpoint. If both params are present, `after_watermark` takes precedence.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/expressjs/multer` — DiskStorage configuration, fileFilter, limits, error codes [VERIFIED]
- Context7 `/nestjs/docs.nestjs.com` — FileInterceptor, UploadedFile, MulterModule.register, StreamableFile [VERIFIED]
- `apps/api/package.json` — confirmed @nestjs/platform-express present, multer not yet installed [VERIFIED: codebase]
- `infra/compose/compose.yaml` — confirmed `read_only: true` on API container, existing mail-outbox volume pattern [VERIFIED: codebase]
- `apps/api/src/db/migrations/0005_messages_core.sql` — confirmed migration numbering → next is 0006 [VERIFIED: codebase]
- `apps/api/src/messages/messages.repository.ts` — confirmed listHistory sort pattern (DESC→reverse) [VERIFIED: codebase]
- `npm view multer version` → 2.1.1; `npm view @types/multer version` → 2.1.0 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- Multer README on GitHub (via Context7) — fileFilter, DiskStorage, limits API confirmed
- NestJS file upload docs (via Context7) — FileInterceptor usage pattern confirmed

### Tertiary (LOW confidence)
- None — all critical claims verified via tool calls or codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — multer/NestJS file upload is well-documented; versions verified against npm registry
- Architecture: HIGH — follows existing codebase patterns (repository/service/controller, migration numbering, module structure, compose volume pattern)
- Pitfalls: HIGH — pitfall 1 (read-only container) verified directly from compose.yaml; pitfalls 2–6 confirmed from Multer docs + codebase analysis

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable stack — multer + NestJS APIs change slowly)
