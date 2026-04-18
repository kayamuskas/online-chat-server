import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health/health.controller.js';
import { MetaController } from './meta/meta.controller.js';
import { AppGateway } from './ws/app.gateway.js';
import { QueueModule } from './queue/queue.module.js';
import { AuthModule } from './auth/auth.module.js';

/**
 * AppModule — root Nest module for the hybrid REST + WebSocket API.
 *
 * Phase 2 additions: AuthModule wires auth controllers, services, and
 * repositories. Cookie parsing is enabled in main.ts via cookie-parser.
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
  ],
  controllers: [HealthController, MetaController],
  providers: [AppGateway],
})
export class AppModule {}
