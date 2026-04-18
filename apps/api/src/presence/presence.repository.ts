/**
 * PresenceRepository — durable `last seen` persistence boundary.
 *
 * This repository has a single responsibility: write the user's last-seen
 * timestamp to PostgreSQL when they transition to offline. It does NOT
 * own live presence state (which lives in PresenceService runtime memory).
 *
 * Threat model: T-03-07 — persist only on offline transition (write-behind
 * boundary) to avoid turning PostgreSQL into a live presence polling source.
 */

import { Injectable } from '@nestjs/common';
import { PostgresService } from '../db/postgres.service.js';

@Injectable()
export class PresenceRepository {
  constructor(private readonly db: PostgresService) {}

  /**
   * Persist `last seen` for the given user by updating the most recently
   * touched non-expired session row for that user.
   *
   * This is a best-effort write-behind call that happens only when all of a
   * user's tabs disconnect. It does NOT block live presence reads.
   *
   * The `last_seen_at` column already exists on the sessions table from Phase 2.
   * We update the most recent session row so the session inventory UI can show
   * a meaningful "last active" time for recently-offline users.
   */
  async persistLastSeen(userId: string, lastSeenAt: Date): Promise<void> {
    // Update the most recently active session row for this user.
    // We write to the session row that was most recently last_seen_at so that
    // the session inventory always has a fresh last-active timestamp.
    await this.db.query(
      `UPDATE sessions
          SET last_seen_at = $2
        WHERE id = (
          SELECT id FROM sessions
           WHERE user_id = $1
             AND expires_at > NOW()
           ORDER BY last_seen_at DESC
           LIMIT 1
        )`,
      [userId, lastSeenAt],
    );
  }
}
