/**
 * AuthController — HTTP surface for Phase 2 auth flows.
 *
 * Endpoints (all under /api/v1/auth):
 *   POST /register       — create a new account
 *   POST /sign-in        — authenticate and issue session cookie
 *   POST /sign-out       — invalidate current browser session
 *   GET  /me             — return the authenticated user/session info
 *
 * Username is immutable: no update path is exposed here.
 * Session durations are enforced by the session-policy helper, not inline.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ChangePasswordService } from './change-password.service.js';
import { CurrentUserGuard } from './current-user.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  extractSessionToken,
  setSessionCookie,
  clearSessionCookie,
} from './session-cookie.js';
import type { AuthContext } from './current-user.guard.js';

// ── Request body shapes ────────────────────────────────────────────────────────

class RegisterDto {
  email!: string;
  username!: string;
  password!: string;
}

class SignInDto {
  email!: string;
  password!: string;
  keepSignedIn!: boolean;
}

class ChangePasswordDto {
  currentPassword!: string;
  newPassword!: string;
}

// ── Controller ─────────────────────────────────────────────────────────────────

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly changePasswordService: ChangePasswordService,
  ) {}

  /**
   * POST /api/v1/auth/register
   *
   * Creates a new user account. Returns the PublicUser projection.
   * 409 if email or username is already taken.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterDto) {
    const user = await this.authService.register({
      email: body.email,
      username: body.username,
      password: body.password,
    });
    return { user };
  }

  /**
   * POST /api/v1/auth/sign-in
   *
   * Authenticates the user and issues a session cookie.
   * 401 on invalid credentials.
   */
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() body: SignInDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signIn({
      email: body.email,
      password: body.password,
      keepSignedIn: body.keepSignedIn ?? false,
    });

    setSessionCookie(res, result.sessionToken, {
      maxAge: result.cookieMaxAge,
      persistent: result.isPersistent,
    });

    return { user: result.user };
  }

  /**
   * POST /api/v1/auth/sign-out
   *
   * Invalidates only the current browser session.
   * Other sessions for the same user are untouched (Phase 3 manages those).
   * 204 on success (even if no active session — idempotent).
   */
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = extractSessionToken(req);
    if (token) {
      await this.authService.signOut(token);
    }
    clearSessionCookie(res);
  }

  /**
   * GET /api/v1/auth/me
   *
   * Returns the current authenticated user.
   * 401 if the session cookie is absent or the session has expired.
   */
  @Get('me')
  @UseGuards(CurrentUserGuard)
  me(@CurrentUser() ctx: AuthContext) {
    return { user: ctx.user };
  }

  /**
   * POST /api/v1/auth/change-password
   *
   * Changes the password for the currently authenticated user.
   * Requires the current password for verification before update.
   * 401 if not authenticated or current password is wrong.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CurrentUserGuard)
  async changePassword(
    @CurrentUser() ctx: AuthContext,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.changePasswordService.changePassword({
      userId: ctx.user.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }
}
