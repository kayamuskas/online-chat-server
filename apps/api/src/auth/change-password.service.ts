/**
 * ChangePasswordService — authenticated password-change flow.
 *
 * Requires:
 *   1. A valid authenticated session (enforced by CurrentUserGuard at the controller layer)
 *   2. The user's current password to be provided and verified before replacement
 *
 * Threat mitigations (T-02-08):
 *   - Current password verification before hash replacement (no silent takeover)
 *   - Only the calling user's own password can be changed (userId comes from session)
 *   - Separate from reset-token behavior — no token-based path reused here
 */

import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { UserRepository } from './user.repository.js';
import { verifyPassword, hashPassword } from './passwords.js';

export interface ChangePasswordInput {
  /** The authenticated user's UUID (from session, not from request body). */
  userId: string;
  /** The current stored password, used to verify identity before replacement. */
  currentPassword: string;
  /** The new password to store. */
  newPassword: string;
}

@Injectable()
export class ChangePasswordService {
  constructor(private readonly users: UserRepository) {}

  /**
   * Change the password for an authenticated user.
   *
   * Verifies the current password first. If the current password is wrong,
   * throws UnauthorizedException — the stored hash is never updated.
   *
   * On success, replaces the stored hash with the new bcrypt hash.
   */
  async changePassword(input: ChangePasswordInput): Promise<void> {
    const user = await this.users.findById(input.userId);
    if (!user) {
      // Session references a deleted user — should not normally happen
      throw new NotFoundException('user account not found');
    }

    const isCurrentPasswordValid = await verifyPassword(
      input.currentPassword,
      user.password_hash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('current password is incorrect');
    }

    const newHash = await hashPassword(input.newPassword);
    await this.users.updatePasswordHash(user.id, newHash);
  }
}
