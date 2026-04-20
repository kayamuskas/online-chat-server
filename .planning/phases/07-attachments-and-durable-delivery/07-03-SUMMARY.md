---
phase: "07"
plan: "03"
subsystem: attachments
tags: [upload, download, acl, multer, file-storage, orphan-cleanup]
dependency_graph:
  requires: [07-01]
  provides: [AttachmentsService, AttachmentsController, AttachmentsModule]
  affects: [app.module.ts, messages-module-integration]
tech_stack:
  added: [multer-disk-storage, nestjs-file-interceptor, streamable-file]
  patterns: [uuid-filenames, post-storage-validation, proxied-downloads, request-time-acl]
key_files:
  created:
    - apps/api/src/attachments/attachments.service.ts
    - apps/api/src/attachments/attachments.controller.ts
    - apps/api/src/attachments/attachments.module.ts
  modified:
    - apps/api/src/app.module.ts
decisions:
  - "Image 3MB cap enforced post-storage (delete file then throw 413) per Pitfall 2"
  - "ACL returns 403 (not 404) for unresolvable conversations per Pitfall 6"
  - "Orphan cleanup runs synchronously on bootstrap, not via BullMQ"
  - "UUID filenames on disk; original filenames stored in DB only (D-48)"
  - "Downloads proxied via StreamableFile, no filesystem URLs exposed (D-49)"
metrics:
  duration_seconds: 288
  completed: "2026-04-20T06:29:27Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 07 Plan 03: Attachments Service, Controller, and Module Summary

AttachmentsService with upload (image 3MB / file 20MB caps), download ACL (room membership + DM participation checked at request time), orphan cleanup on bootstrap; controller with Multer diskStorage UUID filenames and StreamableFile proxied downloads; module wired into AppModule.

## Task Results

### Task 1: AttachmentsService (5f3c9db)

Created `apps/api/src/attachments/attachments.service.ts` with:
- `createAttachment()`: accepts Multer file, validates image size cap (3MB for image/* MIME types), persists via repository
- `resolveDownload()`: finds attachment, resolves conversation via message FK, checks room membership/ban or DM participation/ban ACL
- `onApplicationBootstrap()`: cleans up orphaned attachments (no message_id) older than 1 hour, deletes files from disk and DB records
- ACL consistently returns 403 ForbiddenException for all denial cases (not 404)

### Task 2: AttachmentsController + Module + AppModule wiring (237ecd0)

Created `apps/api/src/attachments/attachments.controller.ts`:
- `POST /api/v1/attachments/upload` with `FileInterceptor('file', multerOptions)` -- Multer diskStorage with UUID filenames, 20MB hard cap
- `GET /api/v1/attachments/:id/download` -- StreamableFile proxied response with Content-Disposition RFC 5987 encoding
- Class-level `@UseGuards(CurrentUserGuard)` for all routes
- Missing file validation (BadRequestException if no file provided)

Created `apps/api/src/attachments/attachments.module.ts`:
- Imports: DbModule, AuthModule, RoomsModule, ContactsModule
- Exports: AttachmentsRepository (for MessagesModule cross-module use)

Modified `apps/api/src/app.module.ts`:
- Added AttachmentsModule import

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing validation] Added null file check in upload endpoint**
- **Found during:** Task 2
- **Issue:** Controller did not validate that a file was actually provided in the multipart request
- **Fix:** Added `if (!file) throw new BadRequestException('No file provided')` guard
- **Files modified:** apps/api/src/attachments/attachments.controller.ts
- **Commit:** 237ecd0

## Threat Mitigations Applied

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-07-06 | @UseGuards(CurrentUserGuard) at class level on AttachmentsController |
| T-07-07 | Downloads proxied via StreamableFile; no filesystem URLs in responses |
| T-07-08 | resolveDownload checks room membership + ban and DM participation + ban at request time |
| T-07-09 | Multer limits.fileSize = 20MB; image cap 3MB in service post-storage |
| T-07-10 | UUID filenames via randomUUID(); original filename in DB only |

## Self-Check: PASSED
