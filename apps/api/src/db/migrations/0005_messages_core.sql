-- Migration: 0005_messages_core
-- Purpose: shared message table for room and DM conversations with watermark integrity
-- Creates: messages
-- Design:
--   - One messages table serves both room and DM targets (MSG-01).
--   - conversation_type + conversation_id identify the target conversation.
--   - conversation_watermark is a server-assigned monotonic integer per (type, id).
--   - Watermark assignment uses a SELECT MAX(...) + 1 strategy inside the INSERT
--     transaction; service layer must hold an advisory lock or use serializable
--     isolation for the watermark assignment sequence (Phase 6 plan 02).
--   - reply_to_id references the same table with SET NULL on delete so orphaned
--     replies degrade gracefully (Phase 8 will add full deletion policy).
--   - edited_at is NULL until the first edit; editing does NOT change created_at
--     or conversation_watermark (MSG-04 / D-25).
--   - No attachment columns in Phase 6; attachments belong to Phase 7.
--   - No soft-delete column in Phase 6; deletion belongs to Phase 8.

CREATE TABLE IF NOT EXISTS messages (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conversation discriminator (MSG-01)
  conversation_type       TEXT        NOT NULL
                                      CHECK (conversation_type IN ('room', 'dm')),
  conversation_id         UUID        NOT NULL,

  -- Author (FK to users; restrict to prevent message orphaning on user delete)
  author_id               UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

  -- Message body (MSG-02): plain UTF-8 text up to 3 KB (enforced at service layer)
  content                 TEXT        NOT NULL,

  -- Reply linkage (MSG-03): optional reference to another message in the same conversation
  -- SET NULL on delete so reply chips degrade gracefully when the original is deleted later
  reply_to_id             UUID        REFERENCES messages (id) ON DELETE SET NULL,

  -- Edit metadata (MSG-04)
  edited_at               TIMESTAMPTZ,

  -- Watermark (MSG-08): monotonically increasing per (conversation_type, conversation_id)
  -- server-assigned at INSERT time; never client-provided
  conversation_watermark  BIGINT      NOT NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uniqueness: one watermark value per conversation
  CONSTRAINT messages_watermark_unique
    UNIQUE (conversation_type, conversation_id, conversation_watermark),

  -- Self-reply guard: a message cannot reply to itself
  CONSTRAINT messages_no_self_reply
    CHECK (reply_to_id IS NULL OR reply_to_id <> id)
);

-- Primary access pattern: load chronological history for a conversation
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_type, conversation_id, conversation_watermark ASC);

-- Author lookup: user message history, edit authorization check
CREATE INDEX IF NOT EXISTS idx_messages_author_id
  ON messages (author_id);

-- Reply chain traversal: find all messages that reply to a given message
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id
  ON messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;
