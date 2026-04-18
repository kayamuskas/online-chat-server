/**
 * RoomsModule — NestJS module wiring the Phase 4 room domain.
 *
 * Imports DbModule for PostgresService access.
 * Imports AuthModule for UserRepository (invite target validation).
 * Exports RoomsService so later HTTP/WS modules can inject room authority checks.
 */

import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RoomsRepository } from './rooms.repository.js';
import { RoomsService } from './rooms.service.js';
import { UserRepository } from '../auth/user.repository.js';

@Module({
  imports: [DbModule, AuthModule],
  providers: [RoomsRepository, RoomsService, UserRepository],
  exports: [RoomsService, RoomsRepository],
})
export class RoomsModule {}
