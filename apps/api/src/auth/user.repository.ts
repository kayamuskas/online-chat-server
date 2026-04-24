/**
 * UserRepository — persistence boundary for user records.
 *
 * All SQL interactions with the `users` table are isolated here.
 * Controllers and services must not issue SQL directly.
 *
 * Username is write-once: no update path for username is exposed.
 */

import { Injectable } from '@nestjs/common';
import { PostgresService } from '../db/postgres.service.js';
import type { User } from './auth.types.js';
import { randomUUID } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';

export interface CreateUserInput {
  email: string;
  username: string;
  password_hash: string;
}

type SqlExecutor = {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
};

@Injectable()
export class UserRepository {
  constructor(private readonly db: PostgresService) {}

  /** Find a user by email for sign-in lookup. Returns null if not found. */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE email = $1 LIMIT 1',
      [email],
    );
    return result.rows[0] ?? null;
  }

  /** Find a user by username for registration uniqueness check. Returns null if not found. */
  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE username = $1 LIMIT 1',
      [username],
    );
    return result.rows[0] ?? null;
  }

  /** Find a user by UUID primary key. Returns null if not found. */
  async findById(id: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE id = $1 LIMIT 1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  /** Delete a user by ID. FK ON DELETE SET NULL on messages.author_id and attachments.uploader_id
   *  preserves DM message history (D-13). FK ON DELETE CASCADE handles sessions, password_reset_tokens. */
  async deleteById(userId: string): Promise<void> {
    await this.db.query(`DELETE FROM users WHERE id = $1`, [userId]);
  }

  /**
   * Persist a new user row. Returns the created user.
   * Uniqueness constraints are enforced at the database level — callers
   * should check findByEmail/findByUsername before calling this to provide
   * a friendlier conflict message.
   */
  async create(input: CreateUserInput): Promise<User> {
    const id = randomUUID();
    const result = await this.db.query<User>(
      `INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, username, password_hash, created_at, updated_at`,
      [id, input.email, input.username, input.password_hash],
    );
    return result.rows[0];
  }

  /**
   * Check whether a username has been reserved after account deletion (D-9.1-13).
   * Returns true if the username exists in the deleted_usernames table.
   */
  async isUsernameReserved(username: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM deleted_usernames WHERE username = $1 LIMIT 1`,
      [username],
    );
    return result.rows.length > 0;
  }

  /**
   * Reserve a username on account deletion so it cannot be re-registered (D-9.1-13).
   * Uses ON CONFLICT DO NOTHING to be idempotent.
   */
  async reserveUsername(username: string): Promise<void> {
    await this.db.query(
      `INSERT INTO deleted_usernames (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`,
      [username],
    );
  }

  /**
   * Update the stored password hash for a user (password-change flow).
   * Does NOT expose a username-update path.
   */
  async updatePasswordHash(
    userId: string,
    newHash: string,
    executor: SqlExecutor = this.db,
  ): Promise<boolean> {
    const result = await executor.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId],
    );
    return result.rowCount === 1;
  }
}
