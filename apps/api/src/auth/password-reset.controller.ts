/**
 * PasswordResetController — HTTP surface for password reset flows.
 *
 * Endpoints (all under /api/v1/auth/password-reset):
 *   POST /request  — initiate a reset (sends mail artifact, no enumeration)
 *   POST /confirm  — consume token and update password hash
 *
 * Both endpoints return 200 / empty body to prevent information leakage.
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PasswordResetService } from './password-reset.service.js';

// ── Request body shapes ────────────────────────────────────────────────────────

class ResetRequestDto {
  email!: string;
}

class ResetConfirmDto {
  token!: string;
  newPassword!: string;
}

// ── Controller ─────────────────────────────────────────────────────────────────

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  /**
   * POST /api/v1/auth/password-reset/request
   *
   * Initiates a password reset. Returns 200 regardless of whether the email
   * is registered (prevents email enumeration).
   */
  @Post('request')
  @HttpCode(HttpStatus.OK)
  async requestReset(@Body() body: ResetRequestDto): Promise<void> {
    await this.passwordResetService.requestReset(body.email);
  }

  /**
   * POST /api/v1/auth/password-reset/confirm
   *
   * Consumes the reset token and updates the stored password hash.
   * 400 if the token is unknown, already used, or expired.
   */
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirmReset(@Body() body: ResetConfirmDto): Promise<void> {
    await this.passwordResetService.confirmReset({
      token: body.token,
      newPassword: body.newPassword,
    });
  }
}
