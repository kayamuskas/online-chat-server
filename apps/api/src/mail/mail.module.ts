/**
 * MailModule — provides the appropriate mail service based on environment.
 *
 * - If SMTP_HOST is set: uses SmtpMailService (real emails)
 * - Otherwise: uses MockMailService (file-based artifacts for dev/test)
 *
 * Consumers inject via @Inject(MAIL_SERVICE) with the MailService interface.
 */

import { Module } from '@nestjs/common';
import { MockMailService } from './mock-mail.service.js';
import { SmtpMailService } from './smtp-mail.service.js';
import { MAIL_SERVICE } from './mail.service.js';

const mailProvider = {
  provide: MAIL_SERVICE,
  useClass: process.env['SMTP_HOST'] ? SmtpMailService : MockMailService,
};

@Module({
  providers: [mailProvider],
  exports: [MAIL_SERVICE],
})
export class MailModule {}
