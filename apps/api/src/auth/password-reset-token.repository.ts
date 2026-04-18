/**
 * PasswordResetTokenRepository — persistence boundary for reset token records.
 *
 * All SQL interactions with the `password_reset_tokens` table are isolated here.
 * Tokens are one-time: used_at transitions from NULL to a timestamp on consumption.
 */

import { Injectable } from '@nestjs/common';
import { PostgresService } from '../db/postgres.service.js';
import type { PasswordResetToken } from './auth.types.js';
import { randomBytes } from 'node:crypto';

// Token TTL: 1 hour (generous enough for UX, short enough for security)
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface CreateResetTokenInput {
  userId: string;
}

@Injectable()
export class PasswordResetTokenRepository {
  constructor(private readonly db: PostgresService) {}

  /**
   * Create a new reset token for the given user.
   * Token is a random 32-byte hex string — opaque and unpredictable.
   */
  async create(input: CreateResetTokenInput): Promise<PasswordResetToken> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    const result = await this.db.query<PasswordResetToken>(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, token, expires_at, used_at, created_at`,
      [input.userId, token, expiresAt],
    );
    return result.rows[0];
  }

  /**
   * Look up a reset token record by its token string.
   * Returns null if not found.
   */
  async findByToken(token: string): Promise<PasswordResetToken | null> {
    const result = await this.db.query<PasswordResetToken>(
      `SELECT id, user_id, token, expires_at, used_at, created_at
       FROM password_reset_tokens
       WHERE token = $1
       LIMIT 1`,
      [token],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Mark a token as used (consumed). This is a one-way transition.
   * Subsequent confirmReset calls with the same token will be rejected.
   */
  async markUsed(tokenId: string): Promise<void> {
    await this.db.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [tokenId],
    );
  }
}
