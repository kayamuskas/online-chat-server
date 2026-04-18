/**
 * MailModule — provides MockMailService for DI injection in feature modules.
 *
 * Import MailModule in any feature module that needs to send mail artifacts.
 * In Phase 2, only PasswordResetModule needs it.
 */

import { Module } from '@nestjs/common';
import { MockMailService } from './mock-mail.service.js';

@Module({
  providers: [MockMailService],
  exports: [MockMailService],
})
export class MailModule {}
