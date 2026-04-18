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

import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RoomsRepository } from './rooms.repository.js';
import { RoomsService } from './rooms.service.js';
import { RoomsController } from './rooms.controller.js';
import { UserRepository } from '../auth/user.repository.js';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [RoomsController],
  providers: [RoomsRepository, RoomsService, UserRepository],
  exports: [RoomsService, RoomsRepository],
})
export class RoomsModule {}
