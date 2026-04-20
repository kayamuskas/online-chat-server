/**
 * SessionRepository — persistence boundary for browser session records.
 *
 * Each sign-in creates exactly one row here, keyed by an opaque random token
 * that is mirrored to the browser via an HttpOnly cookie.
 *
 * Phase 3 adds session inventory and targeted-revocation capabilities
 * on top of these same rows. All operations are scoped to the authenticated
 * user's own sessions to prevent cross-user session access.
 *
 * Threat model:
 *   T-03-02 — persist browser/IP metadata at session creation
 *   T-03-03 — scope all inventory queries to the authenticated user
 *   T-03-04 — keep revoke-one and revoke-all-other-sessions as explicit row-level ops
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PostgresService } from '../db/postgres.service.js';
import type { SessionWithMetadata } from './auth.types.js';
import { randomBytes } from 'node:crypto';

export interface CreateSessionInput {
  userId: string;
  isPersistent: boolean;
  expiresAt: Date;
  /** Client IP captured at session creation time (Phase 3). */
  ipAddress?: string | null;
  /** Raw User-Agent string captured at session creation time (Phase 3). */
  userAgent?: string | null;
}

/** Columns returned by session SELECT queries (base + metadata). */
const SESSION_COLUMNS = `
  id, user_id, session_token, is_persistent, expires_at,
  last_seen_at, created_at, ip_address, user_agent
`.trim();

@Injectable()
export class SessionRepository {
  constructor(private readonly db: PostgresService) {}

  /**
   * Persist a new session row and return the full record.
   * Generates the opaque session token internally so callers never need
   * to produce tokens themselves.
   *
   * Phase 3: also persists ip_address and user_agent when provided.
   */
  async create(input: CreateSessionInput): Promise<SessionWithMetadata> {
    const token = randomBytes(32).toString('hex');
    const result = await this.db.query<SessionWithMetadata>(
      `INSERT INTO sessions
         (user_id, session_token, is_persistent, expires_at, last_seen_at, created_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6)
       RETURNING ${SESSION_COLUMNS}`,
      [
        input.userId,
        token,
        input.isPersistent,
        input.expiresAt,
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );
    return result.rows[0];
  }

  /** Look up a session by its opaque token. Returns null if not found. */
  async findByToken(token: string): Promise<SessionWithMetadata | null> {
    const result = await this.db.query<SessionWithMetadata>(
      `SELECT ${SESSION_COLUMNS}
         FROM sessions WHERE session_token = $1 LIMIT 1`,
      [token],
    );
    return result.rows[0] ?? null;
  }

  /**
   * List all active (non-expired) sessions for a given user,
   * ordered by last_seen_at descending for inventory display.
   *
   * Scoped strictly to the specified user_id — cannot return sessions
   * belonging to other users.
   *
   * Threat model: T-03-03 — user-scoped inventory query.
   */
  async findAllByUserId(userId: string): Promise<SessionWithMetadata[]> {
    const result = await this.db.query<SessionWithMetadata>(
      `SELECT ${SESSION_COLUMNS}
         FROM sessions
        WHERE user_id = $1
          AND expires_at > NOW()
        ORDER BY last_seen_at DESC`,
      [userId],
    );
    return result.rows;
  }

  /**
   * Delete a single session row by its opaque token.
   * This is the targeted current-session sign-out operation.
   * Other session rows for the same user are untouched.
   */
  async delete(token: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE session_token = $1', [token]);
  }

  /**
   * Delete a single session row by its ID, scoped to a specific user.
   *
   * The user_id predicate ensures a user can only revoke their own sessions.
   *
   * Threat model: T-03-03/T-03-04 — user-scoped row-level delete.
   */
  async deleteById(sessionId: string, userId: string): Promise<void> {
    const result = await this.db.query(
      'DELETE FROM sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('session not found');
    }
  }

  /** Delete ALL sessions for a user (used by AUTH-08 account deletion cascade — D-14). */
  async deleteAllByUserId(userId: string): Promise<void> {
    await this.db.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  }

  /**
   * Delete all session rows for a user except the one identified by currentToken.
   *
   * This is the `sign out all other sessions` operation. The current session
   * is preserved so the caller remains signed in on this browser.
   *
   * Threat model: T-03-04 — targeted bulk revoke scoped to user.
   */
  async deleteAllOtherByUserId(userId: string, currentToken: string): Promise<void> {
    await this.db.query(
      'DELETE FROM sessions WHERE user_id = $1 AND session_token <> $2',
      [userId, currentToken],
    );
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
