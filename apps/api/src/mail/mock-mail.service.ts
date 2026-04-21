/**
 * MockMailService — filesystem-backed mail artifact generation.
 *
 * Satisfies OPS-04: SMTP-free, local-only mail delivery for QA.
 *
 * Each call writes a structured JSON artifact to a mounted outbox directory
 * and returns the file path so the caller can log it for QA discovery.
 *
 * The outbox directory is controlled by the MAIL_OUTBOX_DIR environment
 * variable; it defaults to /tmp/mail-outbox so tests can use it without
 * a real mounted volume. Production compose provides a narrow writable
 * volume mount at /app/mail-outbox.
 */

import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MailService } from './mail.service.js';

export interface SendPasswordResetMailInput {
  to: string;
  username: string;
  resetLink: string;
}

export interface MailArtifactResult {
  artifactPath: string;
}

@Injectable()
export class MockMailService implements MailService {
  private readonly logger = new Logger(MockMailService.name);

  /**
   * The outbox directory.
   *
   * Reads MAIL_OUTBOX_DIR from environment at call time so tests can override
   * it without restarting the process.
   */
  private get outboxDir(): string {
    return process.env.MAIL_OUTBOX_DIR ?? '/tmp/mail-outbox';
  }

  /**
   * Write a password-reset mail artifact to the outbox directory.
   *
   * Returns the path of the written artifact so callers can log it.
   * Ensures the outbox directory exists before writing.
   */
  async sendPasswordResetMail(
    input: SendPasswordResetMailInput,
  ): Promise<MailArtifactResult> {
    const outboxDir = this.outboxDir;

    // Ensure the outbox directory exists (compose volume provides it in production)
    await mkdir(outboxDir, { recursive: true });

    const artifact = {
      type: 'password-reset',
      to: input.to,
      username: input.username,
      subject: 'Reset your password',
      resetLink: input.resetLink,
      generatedAt: new Date().toISOString(),
    };

    const filename = `password-reset-${randomUUID()}.json`;
    const artifactPath = join(outboxDir, filename);

    await writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf-8');

    // Log path for QA discovery (D-13)
    this.logger.log(`[mock-mail] artifact written → ${artifactPath}`);

    return { artifactPath };
  }
}
