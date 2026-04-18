/**
 * PresenceModule — NestJS module for realtime presence aggregation.
 *
 * Wires together:
 *  - PresenceService  (runtime presence aggregation, in-memory)
 *  - PresenceRepository (durable last seen persistence, PostgreSQL)
 *
 * Exports PresenceService so AppGateway can inject it directly.
 *
 * The DbModule (PostgresService) is imported here to satisfy the
 * PresenceRepository dependency without re-exporting the database provider.
 */

import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service.js';
import { PresenceRepository } from './presence.repository.js';
import { DbModule } from '../db/db.module.js';
import { DEFAULT_PRESENCE_CONFIG, PRESENCE_CONFIG_TOKEN } from './presence-config.js';

@Module({
  imports: [DbModule],
  providers: [
    PresenceRepository,
    PresenceService,
    {
      provide: PRESENCE_CONFIG_TOKEN,
      useValue: DEFAULT_PRESENCE_CONFIG,
    },
  ],
  exports: [PresenceService],
})
export class PresenceModule {}
