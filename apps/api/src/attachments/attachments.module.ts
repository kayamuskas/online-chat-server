/**
 * AttachmentsModule -- Phase 7 NestJS module for file upload/download and ACL.
 *
 * Imports: DbModule, AuthModule, RoomsModule, ContactsModule
 * No circular dependency with MessagesModule -- coupling is only via DB FK.
 * Exports AttachmentsRepository so MessagesModule can use bindAttachments.
 */

import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { ContactsModule } from '../contacts/contacts.module.js';
import { AttachmentsRepository } from './attachments.repository.js';
import { AttachmentsService } from './attachments.service.js';
import { AttachmentsController } from './attachments.controller.js';

@Module({
  imports: [DbModule, AuthModule, RoomsModule, ContactsModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsRepository, AttachmentsService],
  exports: [AttachmentsRepository],
})
export class AttachmentsModule {}
