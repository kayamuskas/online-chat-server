/**
 * CurrentUserGuard — resolves the authenticated user/session from the session cookie.
 *
 * Attach this guard to any handler that requires an authenticated user.
 * On success, the resolved AuthContext is attached to `request.authContext`
 * and is available via the @CurrentUser() decorator.
 *
 * Returns 401 if the cookie is absent, the session is not found, or the
 * session has expired. Other sessions are NOT affected.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { extractSessionToken } from './session-cookie.js';
import { AuthService } from './auth.service.js';
import type { PublicUser, Session } from './auth.types.js';

/** Shape attached to `request.authContext` after guard succeeds. */
export interface AuthContext {
  user: PublicUser;
  session: Session;
}

@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<Request & { authContext?: AuthContext }>();

    const token = extractSessionToken(request);
    if (!token) {
      throw new UnauthorizedException('not authenticated');
    }

    const result = await this.authService.getCurrentUser(token);
    if (!result) {
      throw new UnauthorizedException('session expired or invalid');
    }

    request.authContext = result;
    return true;
  }
}
