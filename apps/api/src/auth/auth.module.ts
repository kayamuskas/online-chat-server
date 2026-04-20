/**
 * AuthModule — NestJS module wiring auth controllers, services, and repositories.
 *
 * Imports DbModule to access PostgresService via DI.
 * Exports AuthService so other modules (e.g., Phase 3 session management) can
 * inject it without re-declaring its dependencies.
 */

import { Module, forwardRef } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { MailModule } from '../mail/mail.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { ContactsModule } from '../contacts/contacts.module.js';
import { AuthController } from './auth.controller.js';
import { PasswordResetController } from './password-reset.controller.js';
import { SessionManagementController } from './session-management.controller.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordService } from './change-password.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { UserRepository } from './user.repository.js';
import { SessionRepository } from './session.repository.js';
import { PasswordResetTokenRepository } from './password-reset-token.repository.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { CurrentUserGuard } from './current-user.guard.js';

@Module({
  imports: [DbModule, MailModule, forwardRef(() => RoomsModule), forwardRef(() => ContactsModule)],
  controllers: [AuthController, PasswordResetController, SessionManagementController],
  providers: [
    AuthService,
    ChangePasswordService,
    PasswordResetService,
    UserRepository,
    SessionRepository,
    PasswordResetTokenRepository,
    AuthRateLimitGuard,
    CurrentUserGuard,
  ],
  exports: [AuthService, CurrentUserGuard],
})
export class AuthModule {}
