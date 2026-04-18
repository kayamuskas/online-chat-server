-- Migration: 0003_rooms_core
-- Purpose: establish the Phase 4 room-domain foundation
-- Creates rooms, room_memberships, room_invites, room_admins, and room_bans relations
-- Design: keeps visibility, membership, invite, and ban state in separate relations
--         to prevent rule-collapse pitfalls (see Phase 4 RESEARCH.md §Common Pitfalls)

-- ── Rooms table ────────────────────────────────────────────────────────────────
-- Room names are globally unique across both public and private rooms.
-- Owner is stored directly on the room row for fast ownership checks.
CREATE TABLE IF NOT EXISTS rooms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  visibility  TEXT        NOT NULL DEFAULT 'public'
                          CHECK (visibility IN ('public', 'private')),
  owner_id    UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Global uniqueness across all room names regardless of visibility
  CONSTRAINT rooms_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_rooms_owner_id    ON rooms (owner_id);
CREATE INDEX IF NOT EXISTS idx_rooms_visibility  ON rooms (visibility);
-- Full-text index for catalog search on name and description
CREATE INDEX IF NOT EXISTS idx_rooms_name_text   ON rooms USING gin (to_tsvector('english', name));

-- ── Room memberships table ─────────────────────────────────────────────────────
-- Every participant (including the owner) has exactly one membership row.
-- Owner's row carries role='owner'. Role enum enforced via CHECK constraint.
CREATE TABLE IF NOT EXISTS room_memberships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID        NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'member'
                          CHECK (role IN ('owner', 'admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT room_memberships_unique UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_memberships_room_id ON room_memberships (room_id);
CREATE INDEX IF NOT EXISTS idx_room_memberships_user_id ON room_memberships (user_id);

-- ── Room invites table ─────────────────────────────────────────────────────────
-- Invites are constrained to already-registered users via FK on invited_user_id.
-- Status lifecycle: pending -> accepted | declined | expired
CREATE TABLE IF NOT EXISTS room_invites (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               UUID        NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  invited_by_user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  invited_user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,

  -- Prevent duplicate pending invites for the same user/room combination
  CONSTRAINT room_invites_pending_unique UNIQUE (room_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_invites_room_id         ON room_invites (room_id);
CREATE INDEX IF NOT EXISTS idx_room_invites_invited_user_id ON room_invites (invited_user_id);

-- ── Room admins table ──────────────────────────────────────────────────────────
-- Explicit admin grants separate from membership for clean promotion/demotion events.
-- Owner is always implicitly an admin; explicit rows cover promoted members only.
CREATE TABLE IF NOT EXISTS room_admins (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID        NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  granted_by_user_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT room_admins_unique UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_admins_room_id ON room_admins (room_id);
CREATE INDEX IF NOT EXISTS idx_room_admins_user_id ON room_admins (user_id);

-- ── Room bans table ────────────────────────────────────────────────────────────
-- Bans survive leave/rejoin cycles; stored separately from membership rows.
-- Rejoin policy must check this table before allowing a membership insert.
CREATE TABLE IF NOT EXISTS room_bans (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID        NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  banned_user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  banned_by_user_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason              TEXT,
  banned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT room_bans_unique UNIQUE (room_id, banned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_bans_room_id        ON room_bans (room_id);
CREATE INDEX IF NOT EXISTS idx_room_bans_banned_user_id ON room_bans (banned_user_id);
