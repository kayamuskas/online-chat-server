/**
 * AuthModule — NestJS module wiring auth controllers, services, and repositories.
 *
 * Imports DbModule to access PostgresService via DI.
 * Exports AuthService so other modules (e.g., Phase 3 session management) can
 * inject it without re-declaring its dependencies.
 */

import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserRepository } from './user.repository.js';
import { SessionRepository } from './session.repository.js';
import { CurrentUserGuard } from './current-user.guard.js';

@Module({
  imports: [DbModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserRepository,
    SessionRepository,
    CurrentUserGuard,
  ],
  exports: [AuthService, CurrentUserGuard],
})
export class AuthModule {}
