/**
 * RoomsModule — NestJS module wiring the Phase 4 room domain.
 *
 * Imports DbModule for PostgresService access.
 * Imports AuthModule for CurrentUserGuard and UserRepository (invite target validation).
 * Exports RoomsService so later HTTP/WS modules can consume room authority checks.
 *
 * Phase 4-02 additions:
 *  - RoomsController: REST endpoints for create, catalog, join, and leave flows.
 */

import { Module, forwardRef } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { RoomsRepository } from './rooms.repository.js';
import { RoomsService } from './rooms.service.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsManagementController } from './rooms-management.controller.js';
import { UserRepository } from '../auth/user.repository.js';

/**
 * RoomsModule — NestJS module wiring the Phase 4 room domain.
 *
 * Phase 4-03 additions:
 *  - RoomsManagementController: authenticated management surface for invites,
 *    admin promotion/demotion, member removal (as ban), and ban-list operations.
 */

@Module({
  imports: [DbModule, AuthModule, forwardRef(() => MessagesModule), forwardRef(() => AttachmentsModule)],
  controllers: [RoomsController, RoomsManagementController],
  providers: [RoomsRepository, RoomsService, UserRepository],
  exports: [RoomsService, RoomsRepository],
})
export class RoomsModule {}
