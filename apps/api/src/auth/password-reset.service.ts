/**
 * PasswordResetService — orchestrates the password reset link flow.
 *
 * Two operations:
 *   requestReset  — generates a token, writes a mail artifact, returns silently
 *   confirmReset  — validates the token, updates the password hash, marks token used
 *
 * Threat mitigations (T-02-07):
 *   - Email enumeration protection: requestReset always returns void regardless of
 *     whether the email is registered.
 *   - Token is one-time: markUsed is called atomically with updatePasswordHash.
 *   - Expiry is enforced server-side in addition to token record presence.
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { UserRepository } from './user.repository.js';
import { PasswordResetTokenRepository } from './password-reset-token.repository.js';
import { MockMailService } from '../mail/mock-mail.service.js';
import { hashPassword } from './passwords.js';
import { PostgresService } from '../db/postgres.service.js';

export interface ConfirmResetInput {
  token: string;
  newPassword: string;
}

/** Base URL for reset links. Reads from APP_BASE_URL env, falls back to localhost. */
function getBaseUrl(): string {
  return process.env.APP_BASE_URL ?? 'http://localhost:4173';
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly mail: MockMailService,
    private readonly db: PostgresService,
  ) {}

  /**
   * Initiate a password reset for the given email address.
   *
   * If the email is not registered, returns silently (no enumeration).
   * If found, creates a reset token and writes a mail artifact.
   * The artifact path is logged for QA discovery.
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);

    // Enumeration protection: do not reveal whether the email is registered
    if (!user) {
      return;
    }

    const resetToken = await this.resetTokens.create({ userId: user.id });

    const resetLink = `${getBaseUrl()}/reset-password?token=${resetToken.token}`;

    const { artifactPath } = await this.mail.sendPasswordResetMail({
      to: user.email,
      username: user.username,
      resetLink,
    });

    this.logger.log(
      `[password-reset] reset-link artifact for user ${user.id} → ${artifactPath}`,
    );
  }

  /**
   * Confirm a password reset using the token from the reset link.
   *
   * Validates:
   *   1. Token exists in the database.
   *   2. Token has not been used already.
   *   3. Token has not expired.
   *   4. The owning user still exists.
   *
   * On success, updates the password hash and marks the token as used.
   */
  async confirmReset(input: ConfirmResetInput): Promise<void> {
    const tokenRecord = await this.resetTokens.findByToken(input.token);

    if (!tokenRecord) {
      throw new BadRequestException('invalid or unknown reset token');
    }

    if (tokenRecord.used_at !== null) {
      throw new BadRequestException('reset token has already been used');
    }

    if (tokenRecord.expires_at < new Date()) {
      throw new BadRequestException('reset token has expired');
    }

    const user = await this.users.findById(tokenRecord.user_id);
    if (!user) {
      throw new BadRequestException('user account not found');
    }

    const newHash = await hashPassword(input.newPassword);
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const claimed = await this.resetTokens.claimToken(tokenRecord.id, client);
      if (!claimed) {
        throw new BadRequestException('reset token has already been used');
      }

      const updated = await this.users.updatePasswordHash(user.id, newHash, client);
      if (!updated) {
        throw new BadRequestException('user account not found');
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
