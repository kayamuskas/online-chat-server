/**
 * SessionManagementController — authenticated HTTP surface for session inventory and revoke.
 *
 * Endpoints (all under /api/v1/sessions):
 *   GET  /              — list active sessions for the current user
 *   DELETE /:id         — revoke a specific session by ID
 *   DELETE /others      — sign out all other sessions (keep current)
 *
 * All endpoints require an authenticated session (CurrentUserGuard).
 * All operations are scoped to the caller's own sessions — cross-user
 * access is prevented at the repository level via user_id predicates.
 *
 * Threat model:
 *   T-03-03 — inventory scoped to authenticated user
 *   T-03-04 — explicit row-level revoke and bulk-revoke-others operations
 */

import {
  Controller,
  Get,
  Delete,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentUserGuard } from './current-user.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import { clearSessionCookie } from './session-cookie.js';
import type { AuthContext } from './current-user.guard.js';

interface ResponseLike {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
}

@Controller('api/v1/sessions')
@UseGuards(CurrentUserGuard)
export class SessionManagementController {
  constructor(private readonly authService: AuthService) {}

  /**
   * GET /api/v1/sessions
   *
   * Returns the list of active sessions for the authenticated user.
   * The response includes an isCurrentSession flag to power the "This browser" badge.
   * Sessions are ordered: current session first, then by most recently seen.
   */
  @Get()
  async listSessions(@CurrentUser() ctx: AuthContext) {
    const sessions = await this.authService.listSessions(
      ctx.user.id,
      ctx.session.session_token,
    );
    return { sessions };
  }

  /**
   * DELETE /api/v1/sessions/others
   *
   * Signs out all sessions except the current one.
   * The caller remains signed in on this browser.
   * 204 on success.
   *
   * NOTE: This route must be declared before /:id to avoid Express matching
   * "others" as a dynamic segment.
   */
  @Delete('others')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeOtherSessions(@CurrentUser() ctx: AuthContext): Promise<void> {
    await this.authService.revokeAllOtherSessions(
      ctx.user.id,
      ctx.session.session_token,
    );
  }

  /**
   * DELETE /api/v1/sessions/:id
   *
   * Revokes the session identified by :id.
   * Only the authenticated user's own sessions may be revoked.
   *
   * If the revoked session is the current one, the session cookie is cleared
   * so the browser returns to the sign-in screen immediately.
   *
   * 204 on success. 404 if the session does not belong to the current user.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() ctx: AuthContext,
    @Param('id') sessionId: string,
    @Res({ passthrough: true }) res: ResponseLike,
  ): Promise<void> {
    await this.authService.revokeSession(ctx.user.id, sessionId);

    // If the user revoked their own current session, clear the cookie so the
    // browser immediately returns to the sign-in screen.
    const currentSession = ctx.session;
    if (currentSession.id === sessionId) {
      clearSessionCookie(res);
    }
  }
}
