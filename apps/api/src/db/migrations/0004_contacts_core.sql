-- Migration: 0004_contacts_core
-- Purpose: friendship lifecycle, user-to-user ban mechanics, and DM conversation stub
-- Creates: friend_requests, friendships, user_bans, dm_conversations
-- Design: separate tables per state concept; ban is directional (A banning B is
--         independent of B banning A); dm_conversations stub exists so FRND-05
--         freeze can be applied in Phase 5 before Phase 6 ships the message engine

-- ── friend_requests ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message         TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate pending requests from same requester to same target
  CONSTRAINT friend_requests_pair_unique UNIQUE (requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_target    ON friend_requests (target_id);

-- ── friendships ──────────────────────────────────────────────────────────────
-- Symmetric relation; stored with normalized ordering (user_a_id < user_b_id)
-- so (A,B) and (B,A) cannot coexist. Repository must canonicalize before INSERT/SELECT.
CREATE TABLE IF NOT EXISTS friendships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_b_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT friendships_unique  UNIQUE (user_a_id, user_b_id),
  CONSTRAINT friendships_no_self CHECK  (user_a_id <> user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON friendships (user_a_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships (user_b_id);

-- ── user_bans ────────────────────────────────────────────────────────────────
-- Directional: banner_user_id bans banned_user_id.
-- A banning B and B banning A are two separate rows.
-- DM eligibility check queries both directions.
CREATE TABLE IF NOT EXISTS user_bans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_user_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  banned_user_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_bans_unique  UNIQUE (banner_user_id, banned_user_id),
  CONSTRAINT user_bans_no_self CHECK  (banner_user_id <> banned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bans_banner ON user_bans (banner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_banned ON user_bans (banned_user_id);

-- ── dm_conversations ─────────────────────────────────────────────────────────
-- Stub table. Phase 6 adds message rows; this table exists now so that the
-- ban service can set frozen = TRUE (FRND-05) without Phase 6 being shipped.
-- Normalized ordering: user_a_id < user_b_id (same as friendships).
CREATE TABLE IF NOT EXISTS dm_conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_b_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  frozen      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dm_conversations_unique  UNIQUE (user_a_id, user_b_id),
  CONSTRAINT dm_conversations_no_self CHECK  (user_a_id <> user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_conversations_user_a ON dm_conversations (user_a_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_user_b ON dm_conversations (user_b_id);
