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
