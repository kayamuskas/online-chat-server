import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health/health.controller.js';
import { MetaController } from './meta/meta.controller.js';
import { AppGateway } from './ws/app.gateway.js';
import { QueueModule } from './queue/queue.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PresenceModule } from './presence/presence.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { ContactsModule } from './contacts/contacts.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';

/**
 * AppModule — root Nest module for the hybrid REST + WebSocket API.
 *
 * Phase 3 additions:
 *  - PresenceModule: realtime presence engine (runtime state + durable last seen)
 *  - AppGateway now injects PresenceService and AuthService for authenticated
 *    presence transport (Threat T-03-05: unauthenticated sockets are rejected).
 *
 * Phase 4-02 additions:
 *  - RoomsModule: room creation, public catalog, join/leave HTTP endpoints.
 *
 * Phase 5 additions:
 *  - ContactsModule: friendship lifecycle, user-to-user bans, DM eligibility enforcement
 *
 * Phase 6 additions:
 *  - MessagesModule: shared messaging engine — HTTP endpoints, realtime fanout,
 *    watermark integrity, room/DM access control (MSG-01..04, MSG-08).
 *    AppGateway is provided inside MessagesModule; removed from root providers
 *    to avoid duplicate instantiation.
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
    RoomsModule,
    ContactsModule,   // Phase 5: friendship lifecycle, user bans, DM eligibility
    MessagesModule,   // Phase 6: shared messaging engine, HTTP + WebSocket fanout
    AttachmentsModule, // Phase 7: file upload/download, attachment ACL
  ],
  controllers: [HealthController, MetaController],
  providers: [AppGateway],
})
export class AppModule {}
