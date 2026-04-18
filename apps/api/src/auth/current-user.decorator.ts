/**
 * CurrentUser decorator — extracts the authenticated user/session from the
 * request object after the CurrentUserGuard has run.
 *
 * Usage in a controller handler:
 *
 *   @UseGuards(CurrentUserGuard)
 *   @Get('me')
 *   me(@CurrentUser() ctx: AuthContext) {
 *     return ctx.user;
 *   }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from './current-user.guard.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<Request & { authContext?: AuthContext }>();
    if (!request.authContext) {
      throw new Error(
        '@CurrentUser() requires CurrentUserGuard to populate request.authContext',
      );
    }
    return request.authContext;
  },
);
