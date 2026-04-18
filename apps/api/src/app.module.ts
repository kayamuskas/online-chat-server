import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health/health.controller.js';
import { MetaController } from './meta/meta.controller.js';
import { AppGateway } from './ws/app.gateway.js';
import { QueueModule } from './queue/queue.module.js';

/**
 * AppModule — root Nest module for the hybrid REST + WebSocket API.
 *
 * Phase 1 scope: health check, metadata, WebSocket handshake, and the system
 * echo queue. No domain controllers, auth guards, or persistence are added
 * here yet.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env['REDIS_HOST'] ?? 'localhost',
          port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
        },
      }),
    }),
    QueueModule,
  ],
  controllers: [HealthController, MetaController],
  providers: [AppGateway],
})
export class AppModule {}
