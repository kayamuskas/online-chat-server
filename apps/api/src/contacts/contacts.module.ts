import { Module, forwardRef } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ContactsRepository } from './contacts.repository.js';
import { ContactsService } from './contacts.service.js';
import { ContactsController } from './contacts.controller.js';
import { UserRepository } from '../auth/user.repository.js';

/**
 * ContactsModule — friendship lifecycle, user-to-user ban mechanics, and DM eligibility.
 *
 * Exports ContactsService so Phase 6 MessagingModule can inject DM eligibility checks
 * without re-implementing the friendship/ban policy.
 */
@Module({
  imports: [DbModule, forwardRef(() => AuthModule)],
  controllers: [ContactsController],
  providers: [ContactsRepository, ContactsService, UserRepository],
  exports: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
