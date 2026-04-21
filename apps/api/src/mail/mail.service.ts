/**
 * MailService — abstract contract for sending emails.
 *
 * Implementations:
 *   - MockMailService: writes JSON artifacts to filesystem (dev/test)
 *   - SmtpMailService: sends real emails via SMTP (production)
 *
 * MailModule selects the implementation based on NODE_ENV and whether
 * SMTP_HOST is configured.
 */

import type { SendPasswordResetMailInput, MailArtifactResult } from './mock-mail.service.js';

export const MAIL_SERVICE = Symbol('MAIL_SERVICE');

export interface MailService {
  sendPasswordResetMail(input: SendPasswordResetMailInput): Promise<MailArtifactResult>;
}
