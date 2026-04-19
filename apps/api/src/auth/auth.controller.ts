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
import { AuthService } from './auth.service.js';
import { ChangePasswordService } from './change-password.service.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { CurrentUserGuard } from './current-user.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  parseChangePasswordBody,
  parseRegisterBody,
  parseSignInBody,
} from './auth.validation.js';
import {
  extractSessionToken,
  setSessionCookie,
  clearSessionCookie,
} from './session-cookie.js';
import { buildSessionMetadata } from './session-metadata.js';
import type { AuthContext } from './current-user.guard.js';

interface RequestLike {
  cookies?: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: { remoteAddress?: string };
}

interface ResponseLike {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
}

// ── Controller ─────────────────────────────────────────────────────────────────

@Controller('api/v1/auth')
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
  async register(
    @Body() body: unknown,
    @Req() req: RequestLike,
    @Res({ passthrough: true }) res: ResponseLike,
  ) {
    const input = parseRegisterBody(body);
    const metadata = buildSessionMetadata(req);
    const result = await this.authService.register(input, metadata);

    setSessionCookie(res, result.sessionToken, {
      maxAge: result.sessionTtlSeconds,
      persistent: result.isPersistent,
    });

    return { user: result.user };
  }

  /**
   * POST /api/v1/auth/sign-in
   *
   * Authenticates the user and issues a session cookie.
   * 401 on invalid credentials.
   */
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async signIn(
    @Body() body: unknown,
    @Req() req: RequestLike,
    @Res({ passthrough: true }) res: ResponseLike,
  ) {
    const input = parseSignInBody(body);
    const metadata = buildSessionMetadata(req);
    const result = await this.authService.signIn(input, metadata);

    setSessionCookie(res, result.sessionToken, {
      maxAge: result.sessionTtlSeconds,
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
  async signOut(@Req() req: RequestLike, @Res({ passthrough: true }) res: ResponseLike) {
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
    @Body() body: unknown,
  ): Promise<void> {
    const input = parseChangePasswordBody(body);
    await this.changePasswordService.changePassword({
      userId: ctx.user.id,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
  }
}
