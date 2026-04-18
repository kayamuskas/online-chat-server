import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health/health.controller.js';
import { MetaController } from './meta/meta.controller.js';
import { AppGateway } from './ws/app.gateway.js';
import { QueueModule } from './queue/queue.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PresenceModule } from './presence/presence.module.js';

/**
 * AppModule — root Nest module for the hybrid REST + WebSocket API.
 *
 * Phase 3 additions:
 *  - PresenceModule: realtime presence engine (runtime state + durable last seen)
 *  - AppGateway now injects PresenceService and AuthService for authenticated
 *    presence transport (Threat T-03-05: unauthenticated sockets are rejected).
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
    AuthModule,
    PresenceModule,
  ],
  controllers: [HealthController, MetaController],
  providers: [AppGateway],
})
export class AppModule {}
