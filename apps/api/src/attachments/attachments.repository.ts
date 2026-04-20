import { Injectable } from '@nestjs/common';
import { PostgresService } from '../db/postgres.service.js';
import type { Attachment, AttachmentView, InsertAttachmentInput } from './attachments.types.js';

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly db: PostgresService) {}

  async insert(input: InsertAttachmentInput): Promise<AttachmentView> {
    const result = await this.db.query<AttachmentView>(
      `INSERT INTO attachments
         (uploader_id, original_filename, mime_type, file_size, storage_path, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, original_filename, mime_type, file_size, comment`,
      [input.uploader_id, input.original_filename, input.mime_type,
       input.file_size, input.storage_path, input.comment],
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Attachment | null> {
    const result = await this.db.query<Attachment>(
      `SELECT id, message_id, uploader_id, original_filename, mime_type,
              file_size, storage_path, comment, created_at
       FROM attachments WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  /**
   * D-45 + Pitfall 5: Bind attachment IDs to a message atomically.
   * Only binds attachments owned by uploaderId that are currently unbound.
   */
  async bindAttachments(
    messageId: string,
    attachmentIds: string[],
    uploaderId: string,
  ): Promise<void> {
    if (attachmentIds.length === 0) return;
    await this.db.query(
      `UPDATE attachments
       SET message_id = $1
       WHERE id = ANY($2::uuid[])
         AND uploader_id = $3
         AND message_id IS NULL`,
      [messageId, attachmentIds, uploaderId],
    );
  }

  /** Batch lookup for LEFT JOIN alternative -- used by listHistory. */
  async getByMessageIds(messageIds: string[]): Promise<Attachment[]> {
    if (messageIds.length === 0) return [];
    const result = await this.db.query<Attachment>(
      `SELECT id, message_id, original_filename, mime_type, file_size, comment, created_at
       FROM attachments
       WHERE message_id = ANY($1::uuid[])
         AND message_id IS NOT NULL
       ORDER BY created_at ASC`,
      [messageIds],
    );
    return result.rows;
  }

  /** Find the message row for an attachment (for ACL resolution). */
  async findMessageById(messageId: string): Promise<{
    conversation_type: string;
    conversation_id: string;
  } | null> {
    const result = await this.db.query<{
      conversation_type: string;
      conversation_id: string;
    }>(
      `SELECT conversation_type, conversation_id
       FROM messages WHERE id = $1 LIMIT 1`,
      [messageId],
    );
    return result.rows[0] ?? null;
  }

  /** Pitfall 4: Find orphaned attachments older than a given date. */
  async findOrphanedBefore(before: Date): Promise<Attachment[]> {
    const result = await this.db.query<Attachment>(
      `SELECT id, storage_path FROM attachments
       WHERE message_id IS NULL AND created_at < $1`,
      [before],
    );
    return result.rows;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.query(`DELETE FROM attachments WHERE id = $1`, [id]);
  }

  /** Find all attachments belonging to messages in a room (for room deletion cascade D-07). */
  async findByRoomId(roomId: string): Promise<{ id: string; storage_path: string }[]> {
    const result = await this.db.query<{ id: string; storage_path: string }>(
      `SELECT a.id, a.storage_path
       FROM attachments a
       JOIN messages m ON m.id = a.message_id
       WHERE m.conversation_type = 'room' AND m.conversation_id = $1`,
      [roomId],
    );
    return result.rows;
  }

  /** Delete all attachment DB records for messages in a room. */
  async deleteByRoomId(roomId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM attachments
       WHERE message_id IN (
         SELECT id FROM messages
         WHERE conversation_type = 'room' AND conversation_id = $1
       )`,
      [roomId],
    );
  }

  /** Get AttachmentViews for a set of message IDs (for MessageView enrichment). */
  async getViewsByMessageIds(messageIds: string[]): Promise<Map<string, AttachmentView[]>> {
    if (messageIds.length === 0) return new Map();
    const result = await this.db.query<AttachmentView & { message_id: string }>(
      `SELECT id, message_id, original_filename, mime_type, file_size, comment
       FROM attachments
       WHERE message_id = ANY($1::uuid[])
         AND message_id IS NOT NULL
       ORDER BY created_at ASC`,
      [messageIds],
    );
    const map = new Map<string, AttachmentView[]>();
    for (const row of result.rows) {
      const existing = map.get(row.message_id) ?? [];
      existing.push({
        id: row.id,
        original_filename: row.original_filename,
        mime_type: row.mime_type,
        file_size: row.file_size,
        comment: row.comment,
      });
      map.set(row.message_id, existing);
    }
    return map;
  }
}
