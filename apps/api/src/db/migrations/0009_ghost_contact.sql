-- Migration: 0009_ghost_contact
-- Purpose: Ghost contact support — freeze DMs on account deletion, block username re-use

-- 1. deleted_usernames table (D-9.1-13)
CREATE TABLE IF NOT EXISTS deleted_usernames (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT        NOT NULL UNIQUE,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add frozen_reason and frozen_at columns to dm_conversations (D-9.1-11)
ALTER TABLE dm_conversations
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT DEFAULT NULL
    CHECK (frozen_reason IN ('banned', 'account_deleted')),
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Change FK from CASCADE to SET NULL so dm_conversations survive user deletion
-- Drop existing FK constraints first, then recreate as SET NULL with nullable columns
ALTER TABLE dm_conversations ALTER COLUMN user_a_id DROP NOT NULL;
ALTER TABLE dm_conversations ALTER COLUMN user_b_id DROP NOT NULL;

ALTER TABLE dm_conversations DROP CONSTRAINT IF EXISTS dm_conversations_user_a_id_fkey;
ALTER TABLE dm_conversations DROP CONSTRAINT IF EXISTS dm_conversations_user_b_id_fkey;

ALTER TABLE dm_conversations
  ADD CONSTRAINT dm_conversations_user_a_id_fkey
    FOREIGN KEY (user_a_id) REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE dm_conversations
  ADD CONSTRAINT dm_conversations_user_b_id_fkey
    FOREIGN KEY (user_b_id) REFERENCES users (id) ON DELETE SET NULL;

-- 4. Backfill frozen_reason for existing frozen conversations (pre-9.1 bans)
UPDATE dm_conversations SET frozen_reason = 'banned' WHERE frozen = TRUE AND frozen_reason IS NULL;
