/**
 * DbModule — NestJS module that provides and exports PostgresService.
 *
 * Import DbModule in any feature module that needs database access.
 * The connection pool is managed by PostgresService and closed gracefully
 * on application shutdown.
 */

import { Module } from '@nestjs/common';
import { PostgresService } from './postgres.service.js';

@Module({
  providers: [PostgresService],
  exports:   [PostgresService],
})
export class DbModule {}
