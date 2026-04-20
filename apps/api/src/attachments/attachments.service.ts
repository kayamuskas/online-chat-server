/**
 * AttachmentsService -- Phase 7 attachment business logic.
 *
 * Responsibilities:
 *   - createAttachment: store file on disk, validate image size cap, persist DB record
 *   - resolveDownload: find attachment, resolve conversation, check ACL (D-49, D-50)
 *   - onApplicationBootstrap: clean up orphaned attachments older than 1 hour (Pitfall 4)
 *
 * ACL enforcement (D-49, D-50):
 *   - Room attachments: caller must be a current room member with no active ban
 *   - DM attachments: caller must be a participant with no mutual user-ban
 *   - Orphaned attachments (no message_id): only uploader can access
 *   - Returns 403 (not 404) when conversation cannot be resolved (Pitfall 6)
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { unlink, mkdir } from 'node:fs/promises';
import { AttachmentsRepository } from './attachments.repository.js';
import { RoomsRepository } from '../rooms/rooms.repository.js';
import { ContactsRepository } from '../contacts/contacts.repository.js';
import type { Attachment, AttachmentView } from './attachments.types.js';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const IMAGE_MAX_BYTES = 3 * 1024 * 1024;   // 3 MB (D-47 / FILE-06)
const ORPHAN_MAX_AGE_MS = 3600_000;         // 1 hour

@Injectable()
export class AttachmentsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly uploadsDir: string;

  constructor(
    private readonly repo: AttachmentsRepository,
    private readonly roomsRepo: RoomsRepository,
    private readonly contactsRepo: ContactsRepository,
  ) {
    this.uploadsDir = process.env['UPLOADS_DIR'] ?? './uploads';
  }

  // -- Lifecycle: orphan cleanup --

  async onApplicationBootstrap(): Promise<void> {
    // Ensure uploads directory exists
    await mkdir(this.uploadsDir, { recursive: true }).catch(() => {});

    const cutoff = new Date(Date.now() - ORPHAN_MAX_AGE_MS);
    const orphans = await this.repo.findOrphanedBefore(cutoff);
    if (orphans.length === 0) return;

    this.logger.log(`Cleaning up ${orphans.length} orphaned attachment(s)`);
    for (const orphan of orphans) {
      await unlink(orphan.storage_path).catch(() => { /* file may already be gone */ });
      await this.repo.deleteById(orphan.id);
    }
  }

  // -- Upload --

  /**
   * D-44, D-47, D-48: Create an attachment record from an uploaded file.
   *
   * Multer has already stored the file on disk with a UUID filename.
   * This method does the post-storage image size check (Pitfall 2):
   * if the file is an image MIME and exceeds 3 MB, delete it and throw 413.
   */
  async createAttachment(
    file: Express.Multer.File,
    uploaderId: string,
    comment?: string,
  ): Promise<AttachmentView> {
    // Post-storage image size check (D-47, Pitfall 2)
    if (IMAGE_MIMES.has(file.mimetype) && file.size > IMAGE_MAX_BYTES) {
      await unlink(file.path).catch(() => {});
      throw new PayloadTooLargeException('Image files must be 3 MB or smaller');
    }

    return this.repo.insert({
      uploader_id: uploaderId,
      original_filename: file.originalname,
      mime_type: file.mimetype,
      file_size: file.size,
      storage_path: file.path,
      comment: comment ?? null,
    });
  }

  // -- Download with ACL --

  /**
   * D-49, D-50: Resolve an attachment for download with real-time ACL check.
   *
   * Returns the attachment record and the storage path on disk.
   * Throws ForbiddenException if the caller lacks access.
   * Throws NotFoundException if the attachment does not exist.
   *
   * ACL logic:
   *   - Orphaned (no message_id): only uploader can access
   *   - Room attachment: caller must be a member and not banned
   *   - DM attachment: caller must be a participant with no mutual ban
   *   - If conversation cannot be resolved: 403 (not 404) per Pitfall 6
   */
  async resolveDownload(
    attachmentId: string,
    callerId: string,
  ): Promise<{ attachment: Attachment; storagePath: string }> {
    const attachment = await this.repo.findById(attachmentId);
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Orphaned attachment -- only uploader can access
    if (!attachment.message_id) {
      if (attachment.uploader_id !== callerId) {
        throw new ForbiddenException('Access denied');
      }
      return { attachment, storagePath: attachment.storage_path };
    }

    // Resolve conversation from the parent message
    const message = await this.repo.findMessageById(attachment.message_id);
    if (!message) {
      // Pitfall 6: return 403 not 404 to avoid leaking existence info
      throw new ForbiddenException('Access denied');
    }

    if (message.conversation_type === 'room') {
      const isBanned = await this.roomsRepo.isBanned(message.conversation_id, callerId);
      if (isBanned) throw new ForbiddenException('Access denied');
      const membership = await this.roomsRepo.getMembership(message.conversation_id, callerId);
      if (!membership) throw new ForbiddenException('Access denied');
    } else {
      // DM: caller must be a participant with no mutual ban
      const dm = await this.contactsRepo.findDmConversationById(message.conversation_id);
      if (!dm || (dm.user_a_id !== callerId && dm.user_b_id !== callerId)) {
        throw new ForbiddenException('Access denied');
      }
      const otherId = dm.user_a_id === callerId ? dm.user_b_id : dm.user_a_id;
      const ban = await this.contactsRepo.findBanBetween(callerId, otherId);
      if (ban) throw new ForbiddenException('Access denied');
    }

    return { attachment, storagePath: attachment.storage_path };
  }

  /** Expose uploadsDir for Multer config in controller. */
  getUploadsDir(): string {
    return this.uploadsDir;
  }
}
