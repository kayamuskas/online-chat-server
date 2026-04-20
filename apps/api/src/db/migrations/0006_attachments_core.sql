-- Migration: 0006_attachments_core
-- Purpose: attachments table for file upload/download (Phase 7, D-40..D-43)
-- Creates: attachments
-- Design:
--   - message_id is nullable: attachment row is created before message send (D-45).
--     bindAttachments() updates message_id at send time.
--   - storage_path has UNIQUE constraint: UUID filename on disk prevents collisions (D-48).
--   - uploader_id references users with ON DELETE RESTRICT (files outlive uploader).
--   - message_id has ON DELETE CASCADE (if message deleted in Phase 8, attachments follow).

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
