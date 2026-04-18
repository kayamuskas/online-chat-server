-- Migration: 0001_auth_core
-- Purpose: initial auth schema for users, sessions, and password-reset tokens
-- Compatible with Phase 3 session inventory (per-browser session records)

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  username      TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_email_unique    UNIQUE (email),
  CONSTRAINT users_username_unique UNIQUE (username)
);

-- Fast lookup by email (sign-in path)
CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
-- Fast lookup by username
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ── Sessions ──────────────────────────────────────────────────────────────────
-- One row per browser/session; enables targeted sign-out and Phase 3 inventory.

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Opaque random token sent to the browser as an HttpOnly cookie
  session_token TEXT        NOT NULL,
  -- Whether "Keep me signed in" was checked (drives expiry policy)
  is_persistent BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Absolute expiry: browser-close cap (24h) or 30-day idle threshold
  expires_at    TIMESTAMPTZ NOT NULL,
  -- Updated on each authenticated request for idle-timeout enforcement
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sessions_session_token_unique UNIQUE (session_token)
);

-- Fast lookup by session token on every authenticated request
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions (session_token);
-- Useful for Phase 3 active-session listing per user
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

-- ── Password Reset Tokens ─────────────────────────────────────────────────────
-- Server-side one-time tokens for emailed password-reset links.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Opaque random token embedded in the reset link
  token      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  -- NULL until the token is consumed; non-NULL means the token is spent
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT password_reset_tokens_token_unique UNIQUE (token)
);

-- Fast lookup by reset token value
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token
  ON password_reset_tokens (token);
