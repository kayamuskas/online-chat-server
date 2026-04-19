# Phase 7: Attachments and Durable Delivery - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/attachments/attachments.module.ts` | module/config | — | `apps/api/src/messages/messages.module.ts` | exact |
| `apps/api/src/attachments/attachments.controller.ts` | controller | file-I/O + request-response | `apps/api/src/messages/messages.controller.ts` | role-match |
| `apps/api/src/attachments/attachments.service.ts` | service | file-I/O + CRUD | `apps/api/src/messages/messages.service.ts` | role-match |
| `apps/api/src/attachments/attachments.repository.ts` | repository | CRUD | `apps/api/src/messages/messages.repository.ts` | exact |
| `apps/api/src/attachments/attachments.types.ts` | types | — | `apps/api/src/messages/messages.types.ts` | exact |
| `apps/api/src/db/migrations/0006_attachments_core.sql` | migration | — | `apps/api/src/db/migrations/0005_messages_core.sql` | exact |
| `apps/api/src/messages/messages.types.ts` (modify) | types | — | self | self |
| `apps/api/src/messages/messages.repository.ts` (modify) | repository | CRUD | self (listHistory extension) | self |
| `apps/api/src/messages/messages.controller.ts` (modify) | controller | request-response | self (parseHistoryQuery extension) | self |
| `apps/api/src/messages/messages.gateway.ts` (modify) | gateway | event-driven | self (broadcastMessageCreated extension) | self |
| `apps/api/src/app.module.ts` (modify) | module/config | — | self | self |
| `infra/compose/compose.yaml` (modify) | config | — | self (mail-outbox pattern) | exact |
| `apps/web/src/lib/api.ts` (modify) | utility | request-response | self (messaging section) | self |
| `apps/web/src/features/messages/MessageComposer.tsx` (modify) | component | file-I/O + event-driven | `apps/web/src/features/messages/MessageComposer.tsx` | self |

---

## Pattern Assignments

### `apps/api/src/attachments/attachments.module.ts` (module/config)

**Analog:** `apps/api/src/messages/messages.module.ts`

**Full module pattern** (lines 1-43):
```typescript
/**
 * AttachmentsModule — NestJS module for file upload/download and ACL.
 *
 * Imports: DbModule, AuthModule, RoomsModule, ContactsModule
 * No circular dependency — coupling to MessagesModule is only via DB FK.
 */
import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { ContactsModule } from '../contacts/contacts.module.js';
import { AttachmentsRepository } from './attachments.repository.js';
import { AttachmentsService } from './attachments.service.js';
import { AttachmentsController } from './attachments.controller.js';

@Module({
  imports: [DbModule, AuthModule, RoomsModule, ContactsModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsRepository, AttachmentsService],
  exports: [AttachmentsRepository],   // MessagesRepository needs bindAttachments
})
export class AttachmentsModule {}
```

**Registration pattern** — in `apps/api/src/app.module.ts` (lines 33-53):
```typescript
// Add AttachmentsModule to imports array, after MessagesModule:
import { AttachmentsModule } from './attachments/attachments.module.js';

// In @Module({ imports: [...] }):
AttachmentsModule,   // Phase 7: file upload/download, attachment ACL
```

---

### `apps/api/src/attachments/attachments.controller.ts` (controller, file-I/O + request-response)

**Analog:** `apps/api/src/messages/messages.controller.ts`

**Imports pattern** (lines 31-49 of analog):
```typescript
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { AttachmentsService } from './attachments.service.js';
import { CurrentUserGuard } from '../auth/current-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/current-user.guard.js';
```

**Class-level guard pattern** (lines 96-103 of analog):
```typescript
@Controller('api/v1/attachments')
@UseGuards(CurrentUserGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}
```

**Upload endpoint pattern** (new — based on RESEARCH.md Pattern 3):
```typescript
@Post('upload')
@HttpCode(HttpStatus.CREATED)
@UseInterceptors(FileInterceptor('file', multerOptions))
async upload(
  @UploadedFile() file: Express.Multer.File,
  @Body('comment') comment: string | undefined,
  @CurrentUser() ctx: AuthContext,
) {
  const attachment = await this.attachmentsService.createAttachment(
    file,
    ctx.user.id,
    comment,
  );
  return attachment;
}
```

**Download endpoint pattern** (new — based on RESEARCH.md Pattern 4):
```typescript
@Get(':id/download')
async download(
  @Param('id') id: string,
  @CurrentUser() ctx: AuthContext,
  @Res({ passthrough: true }) res: Response,
) {
  const { attachment, storagePath } =
    await this.attachmentsService.resolveDownload(id, ctx.user.id);
  res.set({
    'Content-Type': attachment.mime_type,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_filename)}`,
  });
  return new StreamableFile(createReadStream(storagePath));
}
```

**Error handling pattern** — mirrored from `messages.service.ts` (lines 25-31):
```typescript
// Controllers let NestJS exception filters handle ForbiddenException,
// NotFoundException, PayloadTooLargeException — no try/catch in controller.
// Service throws these typed exceptions; controller just awaits.
```

---

### `apps/api/src/attachments/attachments.service.ts` (service, file-I/O + CRUD)

**Analog:** `apps/api/src/messages/messages.service.ts`

**Imports and injectable pattern** (lines 25-52 of analog):
```typescript
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { unlink, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AttachmentsRepository } from './attachments.repository.js';
import { RoomsRepository } from '../rooms/rooms.repository.js';
import { ContactsRepository } from '../contacts/contacts.repository.js';
import type { AttachmentView, Attachment } from './attachments.types.js';

@Injectable()
export class AttachmentsService implements OnApplicationBootstrap {
  constructor(
    private readonly repo: AttachmentsRepository,
    private readonly roomsRepo: RoomsRepository,
    private readonly contactsRepo: ContactsRepository,
  ) {}
```

**Access guard pattern** — copy from `messages.service.ts` (lines 60-102):
```typescript
// D-49/D-50: assertDownloadAccess — same structure as assertRoomAccess / assertDmAccess
private async assertDownloadAccess(attachmentId: string, callerId: string): Promise<{ attachment: Attachment; storagePath: string }> {
  const attachment = await this.repo.findById(attachmentId);
  if (!attachment) {
    throw new NotFoundException('Attachment not found');
  }
  if (!attachment.message_id) {
    // orphaned attachment — only uploader can access
    if (attachment.uploader_id !== callerId) {
      throw new ForbiddenException('Access denied');
    }
    return { attachment, storagePath: attachment.storage_path };
  }
  // Resolve conversation from message
  const message = await this.repo.findMessageById(attachment.message_id);
  if (!message) {
    throw new ForbiddenException('Access denied');  // Pitfall 6: 403 not 404
  }
  if (message.conversation_type === 'room') {
    const isBanned = await this.roomsRepo.isBanned(message.conversation_id, callerId);
    if (isBanned) throw new ForbiddenException('Access denied');
    const membership = await this.roomsRepo.getMembership(message.conversation_id, callerId);
    if (!membership) throw new ForbiddenException('Access denied');
  } else {
    const dm = await this.contactsRepo.findDmConversationById(message.conversation_id);
    if (!dm || (dm.user_a_id !== callerId && dm.user_b_id !== callerId)) {
      throw new ForbiddenException('Access denied');
    }
    const otherId = dm.user_a_id === callerId ? dm.user_b_id : dm.user_a_id;
    const ban = await this.contactsRepo.findBanBetween(callerId, otherId);
    if (ban) throw new ForbiddenException('Access denied');
  }
  return { attachment, storagePath: attachment.storage_path };
}
```

**Orphan cleanup pattern** — `OnApplicationBootstrap` (open question from RESEARCH.md):
```typescript
async onApplicationBootstrap(): Promise<void> {
  // Clean up orphaned attachments older than 1 hour (Pitfall 4)
  const orphans = await this.repo.findOrphanedBefore(new Date(Date.now() - 3600_000));
  for (const orphan of orphans) {
    await unlink(orphan.storage_path).catch(() => { /* already gone */ });
    await this.repo.deleteById(orphan.id);
  }
}
```

**Image size cap pattern** — post-storage check (RESEARCH.md Pitfall 2):
```typescript
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const IMAGE_MAX_BYTES = 3 * 1024 * 1024;

async createAttachment(
  file: Express.Multer.File,
  uploaderId: string,
  comment?: string,
): Promise<AttachmentView> {
  // Post-storage image size check (D-47, Pitfall 2)
  if (IMAGE_MIMES.has(file.mimetype) && file.size > IMAGE_MAX_BYTES) {
    await unlink(file.path).catch(() => {});
    throw new PayloadTooLargeException('Image files must be 3 MB or smaller');
  }
  return this.repo.insert({
    uploader_id: uploaderId,
    original_filename: file.originalname,
    mime_type: file.mimetype,
    file_size: file.size,
    storage_path: file.path,
    comment: comment ?? null,
  });
}
```

---

### `apps/api/src/attachments/attachments.repository.ts` (repository, CRUD)

**Analog:** `apps/api/src/messages/messages.repository.ts`

**Class structure pattern** (lines 19-93 of analog):
```typescript
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../db/postgres.service.js';
import type { Attachment, AttachmentView, InsertAttachmentInput } from './attachments.types.js';

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly db: PostgresService) {}
```

**INSERT pattern** — copy from `messages.repository.ts` createMessage (lines 106-134):
```typescript
async insert(input: InsertAttachmentInput): Promise<AttachmentView> {
  const id = randomUUID();
  const result = await this.db.query<AttachmentView>(
    `INSERT INTO attachments
       (id, uploader_id, original_filename, mime_type, file_size, storage_path, comment, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, uploader_id, original_filename, mime_type, file_size, storage_path, comment, created_at`,
    [id, input.uploader_id, input.original_filename, input.mime_type,
     input.file_size, input.storage_path, input.comment ?? null],
  );
  return result.rows[0];
}
```

**findById pattern** — copy from `rooms.repository.ts` findById (lines 52-59):
```typescript
async findById(id: string): Promise<Attachment | null> {
  const result = await this.db.query<Attachment>(
    `SELECT id, message_id, uploader_id, original_filename, mime_type,
            file_size, storage_path, comment, created_at
     FROM attachments WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}
```

**bindAttachments pattern** — from RESEARCH.md Pattern 6:
```typescript
async bindAttachments(
  messageId: string,
  attachmentIds: string[],
  uploaderId: string,
): Promise<void> {
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

**getByMessageIds pattern** — batch lookup for LEFT JOIN alternative:
```typescript
async getByMessageIds(messageIds: string[]): Promise<Attachment[]> {
  if (messageIds.length === 0) return [];
  const result = await this.db.query<Attachment>(
    `SELECT id, message_id, original_filename, mime_type, file_size, comment, created_at
     FROM attachments
     WHERE message_id = ANY($1::uuid[])
       AND message_id IS NOT NULL
     ORDER BY created_at ASC`,
    [messageIds],
  );
  return result.rows;
}
```

**findOrphanedBefore pattern** — for cleanup in service:
```typescript
async findOrphanedBefore(before: Date): Promise<Attachment[]> {
  const result = await this.db.query<Attachment>(
    `SELECT id, storage_path FROM attachments
     WHERE message_id IS NULL AND created_at < $1`,
    [before],
  );
  return result.rows;
}

async deleteById(id: string): Promise<void> {
  await this.db.query(`DELETE FROM attachments WHERE id = $1`, [id]);
}
```

---

### `apps/api/src/attachments/attachments.types.ts` (types)

**Analog:** `apps/api/src/messages/messages.types.ts`

**File header and type structure pattern** (lines 1-25 of analog):
```typescript
/**
 * attachments.types.ts — Phase 7 attachment domain type contracts.
 *
 * D-40..D-43: Attachment is a separate entity with FK to messages (1:N).
 * D-41: Stores original_filename, mime_type, file_size, storage_path, comment, uploader_id.
 */

export interface Attachment {
  id: string;
  message_id: string | null;          // null when orphaned (pre-bind)
  uploader_id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;               // UUID-based path on disk (D-48)
  comment: string | null;
  created_at: Date;
}

/** Projection returned to clients — no storage_path exposed (D-49). */
export interface AttachmentView {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  comment: string | null;
}

export interface InsertAttachmentInput {
  uploader_id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  comment: string | null;
}
```

---

### `apps/api/src/db/migrations/0006_attachments_core.sql` (migration)

**Analog:** `apps/api/src/db/migrations/0005_messages_core.sql`

**Header comment pattern** (lines 1-16 of analog):
```sql
-- Migration: 0006_attachments_core
-- Purpose: attachments table for file upload/download (Phase 7, D-40..D-43)
-- Creates: attachments
-- Design:
--   - message_id is nullable: attachment row is created before message send (D-45).
--     bindAttachments() updates message_id at send time.
--   - storage_path has UNIQUE constraint: UUID filename on disk prevents collisions (D-48).
--   - uploader_id references users with ON DELETE RESTRICT (files outlive uploader).
--   - message_id has ON DELETE CASCADE (if message deleted in Phase 8, attachments follow).
```

**Table DDL pattern** — mirrors 0005 style:
```sql
CREATE TABLE IF NOT EXISTS attachments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        UUID        REFERENCES messages(id) ON DELETE CASCADE,
  uploader_id       UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  original_filename TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL,
  file_size         BIGINT      NOT NULL,
  storage_path      TEXT        NOT NULL UNIQUE,
  comment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id
  ON attachments (message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attachments_orphan_cleanup
  ON attachments (created_at)
  WHERE message_id IS NULL;
```

---

### `apps/api/src/messages/messages.types.ts` (modify — add AttachmentView + extend MessageView + SendMessageInput)

**Analog:** self — extend existing types

**Extension pattern** — follows same JSDoc style as existing interfaces (lines 100-184 of analog):
```typescript
// ── Attachment view (Phase 7) ─────────────────────────────────────────────────

/**
 * D-43: Attachment metadata embedded in MessageView.attachments[].
 * storage_path is intentionally omitted — clients use the download endpoint.
 */
export interface AttachmentView {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  comment: string | null;
}

// Add to MessageView interface:
// attachments: AttachmentView[];    // empty array when message has no attachments (D-43)

// Add to SendMessageInput interface:
// attachment_ids?: string[];        // optional IDs to bind at send time (D-45)

// Add to MessageHistoryQuery interface:
// after_watermark?: number;         // catch-up after reconnect (D-52..D-54)
```

---

### `apps/api/src/messages/messages.repository.ts` (modify — extend listHistory)

**Analog:** self — extend `listHistory` and `findMessageViewById`

**after_watermark branch pattern** — mirrors `before_watermark` branch (lines 205-210):
```typescript
// In listHistory(), after the existing before_watermark block:
let afterWatermarkClause = '';
if (query.after_watermark !== undefined) {
  params.push(query.after_watermark);
  afterWatermarkClause = `AND m.conversation_watermark > $${params.length}`;
}
// IMPORTANT (Pitfall 3): when after_watermark is set, sort ASC directly (no reverse)
// Use a flag: const sortAsc = query.after_watermark !== undefined;
// ORDER BY: sortAsc ? 'ASC' : 'DESC'
// Skip the .reverse() call when sortAsc is true
```

**Attachment LEFT JOIN pattern** — extends the main SELECT in listHistory (lines 216-244):
```sql
LEFT JOIN (
  SELECT a.message_id,
         json_agg(json_build_object(
           'id',                a.id,
           'original_filename', a.original_filename,
           'mime_type',         a.mime_type,
           'file_size',         a.file_size,
           'comment',           a.comment
         ) ORDER BY a.created_at) AS attachments
  FROM attachments a
  WHERE a.message_id IS NOT NULL
  GROUP BY a.message_id
) att ON att.message_id = m.id
-- In SELECT list add:
-- COALESCE(att.attachments, '[]'::json) AS attachments
```

**bindAttachments delegation pattern** — new method, delegates to AttachmentsRepository:
```typescript
// MessagesRepository optionally accepts AttachmentsRepository via constructor injection,
// OR AttachmentsRepository.bindAttachments is called directly from MessagesService.
// Preferred: MessagesService calls this.attachmentsRepo.bindAttachments() after createMessage.
```

**rowToMessageView extension** — add `attachments` field (lines 60-82):
```typescript
// In rowToMessageView, add:
attachments: Array.isArray((row as any).attachments)
  ? (row as any).attachments
  : [],
```

---

### `apps/api/src/messages/messages.controller.ts` (modify — extend parseHistoryQuery)

**Analog:** self — extend `parseHistoryQuery` and `sendRoomMessage` / `sendDmMessage`

**parseHistoryQuery extension** (lines 75-92):
```typescript
// Add after_watermark parsing (mirror of before_watermark):
if (query['after_watermark'] !== undefined) {
  const aw = parseInt(query['after_watermark'], 10);
  if (!isNaN(aw) && aw >= 0) {
    result.after_watermark = aw;
  }
}
```

**sendMessage body extension** — extend `parseSendMessageBody` (lines 53-65):
```typescript
// Add attachment_ids parsing:
const attachment_ids: string[] = [];
if (Array.isArray(b.attachment_ids)) {
  for (const id of b.attachment_ids) {
    if (typeof id === 'string' && id.trim().length > 0) {
      attachment_ids.push(id.trim());
    }
  }
}
return { content: b.content, reply_to_id: ..., attachment_ids };
```

---

### `apps/api/src/messages/messages.gateway.ts` (modify — broadcast attachment metadata)

**Analog:** self — extend `broadcastMessageCreated` payload

**Attachment payload extension** (lines 197-218):
```typescript
// In broadcastMessageCreated, extend the message object in emit:
this.server.to(channel).emit('message-created', {
  conversation_type: message.conversation_type,
  conversation_id: message.conversation_id,
  message: {
    // ... existing fields ...
    attachments: message.attachments ?? [],   // Phase 7 addition (D-43)
  },
});
```

---

### `infra/compose/compose.yaml` (modify — uploads volume)

**Analog:** self — mirror the existing `mail-outbox` volume pattern (lines 83-87)

**Volume mount pattern** (lines 83-87 of compose.yaml — mail-outbox):
```yaml
# Existing pattern to mirror:
volumes:
  - ../../.volumes/mail-outbox:/app/mail-outbox

# New addition (same location in api service volumes block):
- ../../.volumes/uploads:/app/uploads
```

**Environment variable pattern** (lines 56-70 of compose.yaml):
```yaml
# Add alongside MAIL_OUTBOX_DIR:
UPLOADS_DIR: /app/uploads
```

---

### `apps/web/src/lib/api.ts` (modify — add attachment upload, download, extend MessageView)

**Analog:** self — extend messaging section (lines 572-780)

**Multipart upload helper pattern** — new function alongside `post`:
```typescript
// New helper alongside existing post/get/del helpers (lines 75-150):
async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,  // No Content-Type header — browser sets multipart boundary
  });
  // ... same error handling as post() ...
}
```

**AttachmentView type** — extends MessageView section (lines 614-638):
```typescript
export interface AttachmentView {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  comment: string | null;
}

// Extend MessageView:
// attachments: AttachmentView[];
```

**uploadAttachment function** — new exported function:
```typescript
export async function uploadAttachment(
  file: File,
  comment?: string,
): Promise<AttachmentView> {
  const fd = new FormData();
  fd.append('file', file);
  if (comment) fd.append('comment', comment);
  return postFormData<AttachmentView>('/attachments/upload', fd);
}
```

**mapMessageView extension** — mirrors existing snake_case → camelCase mapping (lines 587-608):
```typescript
// In mapMessageView, add:
attachments: Array.isArray(raw.attachments)
  ? raw.attachments.map((a: any) => ({
      id: a.id,
      originalFilename: a.original_filename,
      mimeType: a.mime_type,
      fileSize: a.file_size,
      comment: a.comment ?? null,
    }))
  : [],
```

**getRoomHistory after_watermark extension** (lines 652-668):
```typescript
// Extend opts parameter:
opts?: { beforeWatermark?: number; afterWatermark?: number; limit?: number }

// Add to query string builder:
if (opts?.afterWatermark !== undefined) qs.append('after_watermark', String(opts.afterWatermark));
```

---

### `apps/web/src/features/messages/MessageComposer.tsx` (modify — file upload + paste)

**Analog:** self — extend existing composer (lines 13-123)

**File input + paste handler pattern** — extend existing `handleKeyDown` / `handleSend` pattern (lines 56-69):
```typescript
// New ref alongside textareaRef:
const fileInputRef = useRef<HTMLInputElement>(null);

// Paste handler on textarea:
function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
  const files = Array.from(e.clipboardData.files);
  if (files.length > 0) {
    e.preventDefault();
    void handleFileSelect(files);
  }
}

// File upload handler — calls uploadAttachment from api.ts:
async function handleFileSelect(files: File[]) {
  setUploading(true);
  try {
    const uploaded = await Promise.all(files.map((f) => uploadAttachment(f)));
    setPendingAttachments((prev) => [...prev, ...uploaded]);
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Upload failed');
  } finally {
    setUploading(false);
  }
}
```

**Props extension** — mirrors existing `replyTo` optional prop pattern (lines 24-37):
```typescript
interface MessageComposerProps {
  // ... existing props ...
  /** Called with content, replyToId, and attachment IDs when user submits. */
  onSend: (
    content: string,
    replyToId: string | null,
    attachmentIds: string[],
  ) => Promise<void> | void;
}
```

---

## Shared Patterns

### Authentication Guard
**Source:** `apps/api/src/auth/current-user.guard.ts` (full file, 53 lines)
**Apply to:** `AttachmentsController` (class-level `@UseGuards(CurrentUserGuard)`)
```typescript
// Class-level application — copy from MessagesController lines 97-98:
@Controller('api/v1/attachments')
@UseGuards(CurrentUserGuard)
export class AttachmentsController {
  // callerId always from @CurrentUser() ctx.user.id — never from body or params
```

### Injectable Repository Pattern
**Source:** `apps/api/src/messages/messages.repository.ts` (lines 91-94)
**Apply to:** `AttachmentsRepository`
```typescript
@Injectable()
export class AttachmentsRepository {
  constructor(private readonly db: PostgresService) {}
```

### Error Type Hierarchy
**Source:** `apps/api/src/messages/messages.service.ts` (lines 26-30)
**Apply to:** `AttachmentsService`
```typescript
// Use NestJS built-in exceptions — no custom error class:
// ForbiddenException  — access denied (room/DM ACL, Pitfall 6: always 403 not 404)
// NotFoundException   — attachment row not found (when caller is uploader or admin)
// PayloadTooLargeException — image > 3 MB or file > 20 MB (D-47)
// BadRequestException — invalid input (empty attachment_ids array, etc.)
```

### DB Query Pattern
**Source:** `apps/api/src/messages/messages.repository.ts` (lines 108-109)
**Apply to:** All `AttachmentsRepository` methods
```typescript
// Always use parameterized queries via this.db.query<RowType>(sql, params):
const result = await this.db.query<AttachmentRow>(sql, [param1, param2]);
return result.rows[0] ?? null;
```

### Module Export for Cross-Module Use
**Source:** `apps/api/src/rooms/rooms.module.ts` (lines 29-35)
**Apply to:** `AttachmentsModule`
```typescript
// Export AttachmentsRepository so MessagesModule can import and use bindAttachments:
exports: [AttachmentsRepository],
```

---

## No Analog Found

All files have close analogs in the existing codebase. No files require falling back to RESEARCH.md patterns exclusively — though the Multer configuration (`createMulterStorage`, `buildMulterOptions`) and `StreamableFile` usage are new infrastructure without a prior codebase analog. Use RESEARCH.md Patterns 1–4 for those specific implementations.

| Concern | Reason | Use Instead |
|---------|---------|-------------|
| Multer DiskStorage config | No prior file upload in codebase | RESEARCH.md Pattern 1 + Pattern 2 |
| `FileInterceptor` decorator | No prior interceptor usage | RESEARCH.md Pattern 3 |
| `StreamableFile` + `createReadStream` | No prior file streaming | RESEARCH.md Pattern 4 |
| Docker named volume for uploads | Only one prior example (mail-outbox) | compose.yaml mail-outbox section (lines 83-87) |

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/`, `infra/compose/`
**Files scanned:** 18 source files read
**Pattern extraction date:** 2026-04-19
