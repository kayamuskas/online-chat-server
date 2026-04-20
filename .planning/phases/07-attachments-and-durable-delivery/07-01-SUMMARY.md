---
phase: 07-attachments-and-durable-delivery
plan: 01
subsystem: attachments-persistence
tags: [database, types, repository, docker, multer]
dependency_graph:
  requires: [messages-table, users-table, postgres-service]
  provides: [attachments-table, attachment-types, attachments-repository, multer-dep, uploads-volume]
  affects: [compose.yaml, api-package.json]
tech_stack:
  added: [multer]
  patterns: [repository-pattern, constructor-injection]
key_files:
  created:
    - apps/api/src/db/migrations/0006_attachments_core.sql
    - apps/api/src/attachments/attachments.types.ts
    - apps/api/src/attachments/attachments.repository.ts
  modified:
    - apps/api/package.json
    - infra/compose/compose.yaml
decisions:
  - "UUID-based storage_path with UNIQUE constraint prevents filename collisions on disk"
  - "message_id nullable to support upload-before-send flow with later binding"
  - "bindAttachments guards on uploader_id + message_id IS NULL to prevent hijacking"
metrics:
  duration_seconds: 124
  completed: 2026-04-20T06:21:26Z
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 07 Plan 01: Attachment Persistence Foundation Summary

PostgreSQL attachments table with nullable message_id for upload-before-send, typed domain contracts, and repository with ownership-guarded bind operation.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create attachments migration, domain types, and install Multer | 53ab2d9 | 0006_attachments_core.sql, attachments.types.ts, package.json |
| 2 | Create AttachmentsRepository and Docker volume mount | fd4e572 | attachments.repository.ts, compose.yaml |

## Key Implementation Details

### Migration (0006_attachments_core.sql)
- Attachments table with FK to messages (CASCADE) and users (RESTRICT)
- Partial index on message_id WHERE NOT NULL for bound attachment lookups
- Partial index on created_at WHERE message_id IS NULL for orphan cleanup

### Domain Types (attachments.types.ts)
- `Attachment`: full DB row with storage_path (internal use only)
- `AttachmentView`: client-safe projection without storage_path (D-49)
- `InsertAttachmentInput`: input contract for upload flow

### Repository (attachments.repository.ts)
- `insert()`: returns AttachmentView (no storage_path leak)
- `findById()`: full Attachment for internal service use
- `bindAttachments()`: ownership guard (uploader_id) + unbound guard (message_id IS NULL)
- `getByMessageIds()`: batch lookup for history enrichment
- `findOrphanedBefore()`: cleanup query using orphan index
- `getViewsByMessageIds()`: returns Map<messageId, AttachmentView[]> for MessageView enrichment
- `deleteById()`: single-row delete for cleanup jobs

### Docker Compose
- Added UPLOADS_DIR env var pointing to /app/uploads
- Added uploads volume mount alongside existing mail-outbox volume

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Verification

All three threat mitigations from the plan's threat model are implemented:
- T-07-01: bindAttachments uses `AND uploader_id = $3 AND message_id IS NULL`
- T-07-02: storage_path is UUID-based, UNIQUE constraint in DDL
- T-07-03: idx_attachments_orphan_cleanup index created for efficient cleanup

## Known Stubs

None - all methods are fully implemented with real SQL queries.

## Self-Check: PASSED
