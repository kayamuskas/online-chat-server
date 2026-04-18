/**
 * SessionRepository — persistence boundary for browser session records.
 *
 * Each sign-in creates exactly one row here, keyed by an opaque random token
 * that is mirrored to the browser via an HttpOnly cookie.
 *
 * Phase 3 will add session inventory and targeted-revocation capabilities
 * on top of these same rows — do not collapse or conflate session rows.
 */

import { Injectable } from '@nestjs/common';
import { PostgresService } from '../db/postgres.service.js';
import type { Session } from './auth.types.js';
import { randomBytes } from 'node:crypto';

export interface CreateSessionInput {
  userId: string;
  isPersistent: boolean;
  expiresAt: Date;
}

@Injectable()
export class SessionRepository {
  constructor(private readonly db: PostgresService) {}

  /**
   * Persist a new session row and return the full record.
   * Generates the opaque session token internally so callers never need
   * to produce tokens themselves.
   */
  async create(input: CreateSessionInput): Promise<Session> {
    const token = randomBytes(32).toString('hex');
    const result = await this.db.query<Session>(
      `INSERT INTO sessions (user_id, session_token, is_persistent, expires_at, last_seen_at, created_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, user_id, session_token, is_persistent, expires_at, last_seen_at, created_at`,
      [input.userId, token, input.isPersistent, input.expiresAt],
    );
    return result.rows[0];
  }

  /** Look up a session by its opaque token. Returns null if not found. */
  async findByToken(token: string): Promise<Session | null> {
    const result = await this.db.query<Session>(
      `SELECT id, user_id, session_token, is_persistent, expires_at, last_seen_at, created_at
         FROM sessions WHERE session_token = $1 LIMIT 1`,
      [token],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Delete a single session row by its opaque token.
   * This is the targeted current-session sign-out operation.
   * Other session rows for the same user are untouched (Phase 3 scope).
   */
  async delete(token: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE session_token = $1', [token]);
  }

  /**
   * Update last_seen_at and (for persistent sessions) extend expires_at
   * on each authenticated request to implement the idle-timeout policy.
   */
  async touchLastSeen(token: string, newExpiresAt?: Date): Promise<void> {
    if (newExpiresAt) {
      await this.db.query(
        'UPDATE sessions SET last_seen_at = NOW(), expires_at = $1 WHERE session_token = $2',
        [newExpiresAt, token],
      );
    } else {
      await this.db.query(
        'UPDATE sessions SET last_seen_at = NOW() WHERE session_token = $1',
        [token],
      );
    }
  }
}
