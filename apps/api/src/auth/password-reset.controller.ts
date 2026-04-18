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
import {
  parseResetConfirmBody,
  parseResetRequestBody,
} from './auth.validation.js';

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
  async requestReset(@Body() body: unknown): Promise<void> {
    const input = parseResetRequestBody(body);
    await this.passwordResetService.requestReset(input.email);
  }

  /**
   * POST /api/v1/auth/password-reset/confirm
   *
   * Consumes the reset token and updates the stored password hash.
   * 400 if the token is unknown, already used, or expired.
   */
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirmReset(@Body() body: unknown): Promise<void> {
    const input = parseResetConfirmBody(body);
    await this.passwordResetService.confirmReset(input);
  }
}
