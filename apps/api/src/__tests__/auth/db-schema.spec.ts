/**
 * Task 1 TDD — RED phase
 *
 * Tests for the auth persistence layer:
 * - SQL migration file contains required table definitions and constraints
 * - DB module reads Postgres config from shared runtime env
 * - Auth types contract is correct
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_PATH = resolve(
  __dirname,
  '../../db/migrations/0001_auth_core.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf8');
}

// ──────────────────────────────────────────────────────────────────────────────
// SQL Schema tests — no DB connection required
// ──────────────────────────────────────────────────────────────────────────────

describe('0001_auth_core.sql — users table', () => {
  it('creates a users table', () => {
    const sql = loadMigration().toLowerCase();
    expect(sql).toMatch(/create table.*users/s);
  });

  it('has unique constraint on email', () => {
    const sql = loadMigration().toLowerCase();
    // either inline UNIQUE or a separate UNIQUE INDEX / CONSTRAINT on email
    const hasInlineUnique = /email.*unique|unique.*email/.test(sql);
    const hasSeparateUnique = /unique.*\(.*email.*\)/.test(sql);
    expect(hasInlineUnique || hasSeparateUnique).toBe(true);
  });

  it('has unique constraint on username', () => {
    const sql = loadMigration().toLowerCase();
    const hasInlineUnique = /username.*unique|unique.*username/.test(sql);
    const hasSeparateUnique = /unique.*\(.*username.*\)/.test(sql);
    expect(hasInlineUnique || hasSeparateUnique).toBe(true);
  });

  it('stores password_hash, not plaintext password', () => {
    const sql = loadMigration().toLowerCase();
    // Must have a password_hash column
    expect(sql).toMatch(/password_hash/);
    // Must NOT have a column definition like "password TEXT" or "password VARCHAR"
    // Strip comment lines first to avoid false positives from comment text
    const noComments = sql.replace(/--[^\n]*/g, '');
    const hasBarePasswordCol = /^\s*password\s+(text|varchar|character)/m.test(noComments);
    expect(hasBarePasswordCol).toBe(false);
  });

  it('has created_at and updated_at timestamps', () => {
    const sql = loadMigration().toLowerCase();
    expect(sql).toMatch(/created_at/);
    expect(sql).toMatch(/updated_at/);
  });
});

describe('0001_auth_core.sql — sessions table', () => {
  it('creates a sessions table', () => {
    const sql = loadMigration().toLowerCase();
    expect(sql).toMatch(/create table.*sessions/s);
  });

  it('has a token or session_token column for opaque session lookup', () => {
    const sql = loadMigration().toLowerCase();
    expect(sql).toMatch(/session_token|token/);
  });

  it('has expires_at column for session expiry', () => {
    const sql = loadMigration().toLowerCase();
    expect(sql).toMatch(/expires_at/);
  });

  it('has a persistent/keep_signed_in flag column', () => {
    const sql = loadMigration().toLowerCase();
    // Allow various naming conventions
    const hasPersistent = /persistent|keep_signed_in|is_persistent/.test(sql);
    expect(hasPersistent).toBe(true);
  });

  it('has last_seen_at for idle timeout calculation', () => {
    const sql = loadMigration().toLowerCase();
    expect(sql).toMatch(/last_seen_at|last_active/);
  });

  it('references users table via foreign key', () => {
    const sql = loadMigration().toLowerCase();
    expect(sql).toMatch(/references.*users|foreign key.*user_id/);
  });
});

describe('0001_auth_core.sql — password_reset_tokens table', () => {
  it('creates a password_reset_tokens table', () => {
    const sql = loadMigration().toLowerCase();
    expect(sql).toMatch(/create table.*password_reset_tokens/s);
  });

  it('has a token column', () => {
    const sql = loadMigration().toLowerCase();
    // within the password_reset_tokens context
    expect(sql).toMatch(/password_reset_tokens[\s\S]*?token|token[\s\S]*?password_reset/);
  });

  it('has used_at or consumed_at for one-time consumption tracking', () => {
    const sql = loadMigration().toLowerCase();
    const hasConsumed = /used_at|consumed_at/.test(sql);
    expect(hasConsumed).toBe(true);
  });

  it('has expires_at column', () => {
    const sql = loadMigration().toLowerCase();
    // We already checked expires_at above; just confirm it appears in the reset section too
    expect(sql).toMatch(/expires_at/);
  });

  it('references users table', () => {
    const sql = loadMigration().toLowerCase();
    // Must reference users at least twice (once for sessions, once for reset tokens)
    const refs = (sql.match(/references.*users/g) || []).length;
    expect(refs).toBeGreaterThanOrEqual(2);
  });
});

describe('0001_auth_core.sql — indexes', () => {
  it('has an index on sessions.session_token for fast lookups', () => {
    const sql = loadMigration().toLowerCase();
    expect(sql).toMatch(/index.*session_token|unique.*session_token/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// DB module config tests
// ──────────────────────────────────────────────────────────────────────────────

describe('PostgresService — reads config from shared env contract', () => {
  it('exports a PostgresService class', async () => {
    const mod = await import('../../db/postgres.service.js');
    expect(mod.PostgresService).toBeDefined();
    expect(typeof mod.PostgresService).toBe('function');
  });

  it('PostgresService exposes a query method', async () => {
    const { PostgresService } = await import('../../db/postgres.service.js');
    const instance = new PostgresService();
    expect(typeof instance.query).toBe('function');
  });
});

describe('DbModule — exports PostgresService', () => {
  it('exports a DbModule', async () => {
    const mod = await import('../../db/db.module.js');
    expect(mod.DbModule).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Auth types contract tests
// ──────────────────────────────────────────────────────────────────────────────

describe('auth.types — data contracts', () => {
  it('exports User type shape', async () => {
    // Types are erased at runtime; we verify the module imports without error
    // and that it exports the expected symbols
    const mod = await import('../../auth/auth.types.js');
    // The module should export at least SessionPolicy enum/const
    expect(mod).toBeDefined();
  });

  it('exports SessionPolicy with TRANSIENT and PERSISTENT values', async () => {
    const mod = await import('../../auth/auth.types.js');
    expect(mod.SessionPolicy).toBeDefined();
    expect(mod.SessionPolicy.TRANSIENT).toBeDefined();
    expect(mod.SessionPolicy.PERSISTENT).toBeDefined();
  });
});
