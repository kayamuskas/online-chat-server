-- Migration: 0002_session_presence
-- Purpose: extend session rows with client metadata for Phase 3 inventory
-- Adds ip_address and user_agent columns to the sessions table
-- These fields are captured at session creation time, not lazily at inventory-read time

-- Add IP address column for full-IP tracking (SESS-07)
-- Nullable for backwards compatibility with rows created before this migration
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Index to support analytics and security audits over IP-based session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_ip_address ON sessions (ip_address);

-- The presence-related last_seen_at column already exists from migration 0001
-- No schema changes needed for last_seen_at; it was already part of the base schema
