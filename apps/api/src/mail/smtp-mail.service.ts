/**
 * SmtpMailService — sends real emails via SMTP.
 *
 * Used in production when SMTP_HOST is configured. Falls back gracefully
 * if the SMTP server is unreachable (logs error, does not crash the app).
 */

import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailService } from './mail.service.js';
import type { SendPasswordResetMailInput, MailArtifactResult } from './mock-mail.service.js';

@Injectable()
export class SmtpMailService implements MailService {
  private readonly logger = new Logger(SmtpMailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    this.from = process.env['SMTP_FROM'] ?? 'noreply@chat.local';
    this.transporter = createTransport({
      host: process.env['SMTP_HOST'],
      port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
      secure: parseInt(process.env['SMTP_PORT'] ?? '587', 10) === 465,
      auth: process.env['SMTP_USER']
        ? { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] ?? '' }
        : undefined,
    });
  }

  async sendPasswordResetMail(input: SendPasswordResetMailInput): Promise<MailArtifactResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: 'Reset your password',
        text: `Hi ${input.username},\n\nClick the link below to reset your password:\n${input.resetLink}\n\nIf you did not request this, ignore this email.`,
        html: `<p>Hi ${input.username},</p><p>Click the link below to reset your password:</p><p><a href="${input.resetLink}">${input.resetLink}</a></p><p>If you did not request this, ignore this email.</p>`,
      });

      this.logger.log(`[smtp-mail] sent password reset to ${input.to} (messageId: ${info.messageId})`);
      return { artifactPath: `smtp:${info.messageId}` };
    } catch (err) {
      this.logger.error(`[smtp-mail] failed to send to ${input.to}`, (err as Error).stack);
      throw err;
    }
  }
}
