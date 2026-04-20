/**
 * PostgresService — thin wrapper around the `pg` Pool.
 *
 * Reads connection config from the shared RuntimeEnv contract
 * (POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD).
 * Later plans that need database access should inject this service via NestJS DI.
 */

import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { parseRuntimeEnv } from '@chat/shared';

const AUTH_SCHEMA_BOOTSTRAP_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_token TEXT        NOT NULL,
  is_persistent BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at    TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Phase 3 session metadata columns (added by migration 0002_session_presence)
  ip_address    TEXT,
  user_agent    TEXT,

  CONSTRAINT sessions_session_token_unique UNIQUE (session_token)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_token
  ON sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

-- Phase 3: add metadata columns if table already existed without them
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_ip_address ON sessions (ip_address);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT password_reset_tokens_token_unique UNIQUE (token)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token
  ON password_reset_tokens (token);

-- ── Phase 4: Room domain tables (migration 0003_rooms_core) ──────────────────

CREATE TABLE IF NOT EXISTS rooms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  visibility  TEXT        NOT NULL DEFAULT 'public'
                          CHECK (visibility IN ('public', 'private')),
  owner_id    UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rooms_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_rooms_owner_id   ON rooms (owner_id);
CREATE INDEX IF NOT EXISTS idx_rooms_visibility ON rooms (visibility);

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

CREATE TABLE IF NOT EXISTS room_invites (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               UUID        NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  invited_by_user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  invited_user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,

  CONSTRAINT room_invites_pending_unique UNIQUE (room_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_invites_room_id         ON room_invites (room_id);
CREATE INDEX IF NOT EXISTS idx_room_invites_invited_user_id ON room_invites (invited_user_id);

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

-- ── Phase 5: Contacts domain tables (migration 0004_contacts_core) ──────────

CREATE TABLE IF NOT EXISTS friend_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message         TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT friend_requests_pair_unique UNIQUE (requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_target    ON friend_requests (target_id);

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

-- ── Phase 6: Messages core (migration 0005_messages_core) ────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type       TEXT        NOT NULL
                                      CHECK (conversation_type IN ('room', 'dm')),
  conversation_id         UUID        NOT NULL,
  author_id               UUID        REFERENCES users (id) ON DELETE SET NULL,
  content                 TEXT        NOT NULL,
  reply_to_id             UUID        REFERENCES messages (id) ON DELETE SET NULL,
  edited_at               TIMESTAMPTZ,
  conversation_watermark  BIGINT      NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT messages_watermark_unique
    UNIQUE (conversation_type, conversation_id, conversation_watermark),

  CONSTRAINT messages_no_self_reply
    CHECK (reply_to_id IS NULL OR reply_to_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_type, conversation_id, conversation_watermark ASC);

CREATE INDEX IF NOT EXISTS idx_messages_author_id
  ON messages (author_id);

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id
  ON messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- ── Phase 7: Attachments (migration 0006_attachments_core) ───────────────────

CREATE TABLE IF NOT EXISTS attachments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        UUID        REFERENCES messages(id) ON DELETE CASCADE,
  uploader_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
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

-- ── Phase 8: Destructive actions FK changes (migration 0008) ───────────────

-- For existing databases: change RESTRICT to SET NULL for user deletion support
ALTER TABLE messages ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_author_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE attachments ALTER COLUMN uploader_id DROP NOT NULL;
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_uploader_id_fkey;
ALTER TABLE attachments ADD CONSTRAINT attachments_uploader_id_fkey
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL;
`;

@Injectable()
export class PostgresService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PostgresService.name);
  private readonly pool: Pool;

  constructor() {
    const env = parseRuntimeEnv();
    this.pool = new Pool({
      host:     env.POSTGRES_HOST,
      port:     env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user:     env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Idle Postgres client error', err);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query(AUTH_SCHEMA_BOOTSTRAP_SQL);
    this.logger.log('Auth schema bootstrap verified');
  }

  /**
   * Execute a parameterised query and return the full QueryResult.
   * Callers should prefer this over direct pool access.
   */
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    return this.pool.query<R>(text, values);
  }

  /**
   * Acquire a client for multi-statement transactions.
   * Callers must release the client in a finally block.
   */
  async getClient() {
    return this.pool.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    this.logger.log('Postgres pool closed');
  }
}
