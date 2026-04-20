/**
 * MessagesModule — Phase 6 NestJS module for the shared messaging engine.
 *
 * Wires together:
 * - MessagesRepository: persistence layer (createMessage, editMessage, listHistory, ...)
 * - MessagesService: domain policy (access control D-30/D-31/D-32, MSG-02/03/04/08)
 * - MessagesController: HTTP surface (room/DM history, send, edit endpoints)
 * - MessagesGateway: realtime fanout (broadcastMessageCreated, broadcastMessageEdited)
 *
 * Dependencies:
 * - DbModule: PostgresService for all SQL queries.
 * - AuthModule: CurrentUserGuard, CurrentUser decorator, AuthService (used by MessagesGateway
 *              to authenticate WebSocket connections via session cookie).
 * - RoomsModule: RoomsRepository (D-30 room access checks).
 * - ContactsModule: ContactsRepository (D-31/D-32 DM access checks).
 */

import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { ContactsModule } from '../contacts/contacts.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { MessagesRepository } from './messages.repository.js';
import { MessagesService } from './messages.service.js';
import { MessagesController } from './messages.controller.js';
import { MessagesGateway } from './messages.gateway.js';

@Module({
  imports: [
    DbModule,
    AuthModule,
    RoomsModule,
    ContactsModule,
    AttachmentsModule,  // Phase 7: attachment binding in sendMessage
  ],
  controllers: [MessagesController],
  providers: [
    MessagesRepository,
    MessagesService,
    MessagesGateway,
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
