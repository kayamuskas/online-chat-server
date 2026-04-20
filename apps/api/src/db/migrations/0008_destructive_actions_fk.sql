-- Phase 8: Allow user deletion without destroying DM message history (D-13)
-- Change messages.author_id from ON DELETE RESTRICT to ON DELETE SET NULL
-- Change attachments.uploader_id from ON DELETE RESTRICT to ON DELETE SET NULL

ALTER TABLE messages
  ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_author_id_fkey;

ALTER TABLE messages
  ADD CONSTRAINT messages_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE attachments
  ALTER COLUMN uploader_id DROP NOT NULL;

ALTER TABLE attachments
  DROP CONSTRAINT IF EXISTS attachments_uploader_id_fkey;

ALTER TABLE attachments
  ADD CONSTRAINT attachments_uploader_id_fkey
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL;
