/**
 * MessagesRepository — persistence boundary for the shared messaging engine.
 *
 * All SQL for creating, reading, and editing messages is isolated here.
 * Controllers and services must not issue SQL directly.
 *
 * Design decisions (from 06-CONTEXT.md):
 * - D-21: Room and DM messages share one table, differentiated by
 *         conversation_type + conversation_id.
 * - D-26: Watermarks are per-conversation; assigned atomically via
 *         SELECT MAX(...) + 1 inside a serializable-isolation INSERT.
 * - D-27: listHistory returns messages in chronological order with
 *         MessageHistoryRange metadata for client gap detection (MSG-08).
 * - D-28: Watermark is never accepted from clients; always server-assigned.
 * - D-25: editMessage updates content + edited_at; watermark/created_at unchanged.
 * - MSG-03: resolveReplyMessage fetches a single message row for reply validation.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../db/postgres.service.js';
import {
  computeHistoryRange,
  sortByWatermark,
} from './messages.helpers.js';
import type {
  Message,
  MessageView,
  MessageHistoryRange,
  MessageHistoryQuery,
  SendMessageInput,
} from './messages.types.js';

/** Default maximum page size for history queries. */
const DEFAULT_PAGE_SIZE = 50;

// ── Internal DB row shape ──────────────────────────────────────────────────────

/**
 * Raw row returned by history queries with JOINed author_username and
 * optional reply preview columns.
 */
interface MessageViewRow {
  id: string;
  conversation_type: 'room' | 'dm';
  conversation_id: string;
  author_id: string;
  author_username: string;
  content: string;
  reply_to_id: string | null;
  edited_at: Date | null;
  conversation_watermark: string; // PostgreSQL returns BIGINT as string
  created_at: Date;
  // Reply preview columns (NULL when there is no reply reference)
  reply_author_id: string | null;
  reply_author_username: string | null;
  reply_content_preview: string | null;
  // Phase 7: attachment LEFT JOIN result
  attachments: unknown; // json_agg result or '[]'
}

function rowToMessageView(row: MessageViewRow): MessageView {
  return {
    id: row.id,
    conversation_type: row.conversation_type,
    conversation_id: row.conversation_id,
    author_id: row.author_id,
    author_username: row.author_username,
    content: row.content,
    reply_to_id: row.reply_to_id,
    reply_preview:
      row.reply_to_id && row.reply_author_id
        ? {
            id: row.reply_to_id,
            author_id: row.reply_author_id,
            author_username: row.reply_author_username ?? '',
            content_preview: row.reply_content_preview ?? '',
          }
        : null,
    edited_at: row.edited_at,
    conversation_watermark: Number(row.conversation_watermark),
    created_at: row.created_at,
    attachments: Array.isArray(row.attachments)
      ? row.attachments
      : typeof row.attachments === 'string'
        ? JSON.parse(row.attachments)
        : [],
  };
}

// ── Repository ─────────────────────────────────────────────────────────────────

export interface MessageHistoryResult {
  messages: MessageView[];
  range: MessageHistoryRange;
}

@Injectable()
export class MessagesRepository {
  constructor(private readonly db: PostgresService) {}

  // ── Write: create message ─────────────────────────────────────────────────

  /**
   * Insert a new message with an atomically assigned per-conversation watermark.
   *
   * The watermark is computed as `COALESCE(MAX(conversation_watermark), 0) + 1`
   * scoped to (conversation_type, conversation_id) inside the INSERT CTE, which
   * prevents gaps under concurrent inserts within the same transaction isolation
   * level. The DB-level UNIQUE constraint on (type, id, watermark) provides the
   * final race guard (D-28).
   */
  async createMessage(input: SendMessageInput): Promise<Message> {
    const id = randomUUID();
    const result = await this.db.query<Message>(
      `WITH next_wm AS (
         SELECT COALESCE(MAX(conversation_watermark), 0) + 1 AS wm
         FROM messages
         WHERE conversation_type = $2 AND conversation_id = $3
       )
       INSERT INTO messages
         (id, conversation_type, conversation_id, author_id, content, reply_to_id, conversation_watermark, created_at)
       SELECT $1, $2, $3, $4, $5, $6, wm, NOW()
       FROM next_wm
       RETURNING id, conversation_type, conversation_id, author_id, content,
                 reply_to_id, edited_at, conversation_watermark, created_at`,
      [
        id,
        input.conversation_type,
        input.conversation_id,
        input.author_id,
        input.content.trim(),
        input.reply_to_id ?? null,
      ],
    );
    const row = result.rows[0];
    return {
      ...row,
      conversation_watermark: Number(row.conversation_watermark),
    };
  }

  // ── Write: edit message ───────────────────────────────────────────────────

  /**
   * Persist an edit to an existing message.
   *
   * Updates content and edited_at only; conversation_watermark and created_at
   * are never touched (D-25, D-28, MSG-04).
   *
   * Returns the updated Message row, or null if the message does not exist.
   */
  async editMessage(
    messageId: string,
    newContent: string,
    editedAt: Date,
  ): Promise<Message | null> {
    const result = await this.db.query<Message>(
      `UPDATE messages
       SET content = $2, edited_at = $3
       WHERE id = $1
       RETURNING id, conversation_type, conversation_id, author_id, content,
                 reply_to_id, edited_at, conversation_watermark, created_at`,
      [messageId, newContent.trim(), editedAt],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      conversation_watermark: Number(row.conversation_watermark),
    };
  }

  // ── Read: single message ──────────────────────────────────────────────────

  /**
   * Fetch a single raw Message row by primary key.
   * Used by the service for author-only edit authorization and reply validation.
   */
  async findMessageById(id: string): Promise<Message | null> {
    const result = await this.db.query<Message>(
      `SELECT id, conversation_type, conversation_id, author_id, content,
              reply_to_id, edited_at, conversation_watermark, created_at
       FROM messages WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      conversation_watermark: Number(row.conversation_watermark),
    };
  }

  // ── Read: paginated history ───────────────────────────────────────────────

  /**
   * Return a chronological page of MessageViews for a conversation, with
   * range metadata suitable for Phase 9 gap detection (MSG-08, D-27).
   *
   * Pagination: if before_watermark is provided, fetch messages with
   * conversation_watermark < before_watermark (older-page cursor).
   * Results are ordered ascending by watermark (chronological).
   *
   * @param query  History query parameters including target and optional cursor.
   * @returns      { messages, range } — messages in ASC order plus range metadata.
   */
  async listHistory(query: MessageHistoryQuery): Promise<MessageHistoryResult> {
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, 200);
    const params: unknown[] = [query.conversation_type, query.conversation_id];

    let watermarkClause = '';
    if (query.before_watermark !== undefined) {
      params.push(query.before_watermark);
      watermarkClause = `AND m.conversation_watermark < $${params.length}`;
    }

    let afterWatermarkClause = '';
    if (query.after_watermark !== undefined) {
      params.push(query.after_watermark);
      afterWatermarkClause = `AND m.conversation_watermark > $${params.length}`;
    }

    const sortAsc = query.after_watermark !== undefined;

    params.push(limit);
    const limitParam = `$${params.length}`;

    // Fetch enriched MessageView rows with author and reply preview JOINs.
    // We sort DESC to apply the limit efficiently, then reverse in memory.
    const result = await this.db.query<MessageViewRow>(
      `SELECT
         m.id,
         m.conversation_type,
         m.conversation_id,
         m.author_id,
         a.username          AS author_username,
         m.content,
         m.reply_to_id,
         m.edited_at,
         m.conversation_watermark,
         m.created_at,
         rm.author_id        AS reply_author_id,
         ru.username         AS reply_author_username,
         LEFT(rm.content, 200) AS reply_content_preview,
         COALESCE(att.attachments, '[]'::json) AS attachments
       FROM messages m
       INNER JOIN users a ON a.id = m.author_id
       LEFT  JOIN messages rm ON rm.id = m.reply_to_id
       LEFT  JOIN users ru ON ru.id = rm.author_id
       LEFT JOIN (
         SELECT a2.message_id,
                json_agg(json_build_object(
                  'id', a2.id,
                  'original_filename', a2.original_filename,
                  'mime_type', a2.mime_type,
                  'file_size', a2.file_size,
                  'comment', a2.comment
                ) ORDER BY a2.created_at) AS attachments
         FROM attachments a2
         WHERE a2.message_id IS NOT NULL
         GROUP BY a2.message_id
       ) att ON att.message_id = m.id
       WHERE m.conversation_type = $1
         AND m.conversation_id   = $2
         ${watermarkClause}
         ${afterWatermarkClause}
       ORDER BY m.conversation_watermark ${sortAsc ? 'ASC' : 'DESC'}
       LIMIT ${limitParam}`,
      params,
    );

    // When sorting ASC (after_watermark), rows are already chronological.
    // When sorting DESC (before_watermark / default), reverse to chronological.
    const views = sortAsc
      ? result.rows.map(rowToMessageView)
      : result.rows.reverse().map(rowToMessageView);

    // Total count in conversation (for MessageHistoryRange.totalCount).
    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::BIGINT AS total
       FROM messages
       WHERE conversation_type = $1 AND conversation_id = $2`,
      [query.conversation_type, query.conversation_id],
    );
    const totalCount = Number(countResult.rows[0]?.total ?? 0);

    let hasMoreBefore = false;
    const firstWatermark = views[0]?.conversation_watermark;
    if (firstWatermark !== undefined) {
      const olderCountResult = await this.db.query<{ total: string }>(
        `SELECT COUNT(*)::BIGINT AS total
         FROM messages
         WHERE conversation_type = $1
           AND conversation_id = $2
           AND conversation_watermark < $3`,
        [query.conversation_type, query.conversation_id, firstWatermark],
      );
      hasMoreBefore = Number(olderCountResult.rows[0]?.total ?? 0) > 0;
    }

    // Derive range metadata from the in-memory page using the shared helper.
    const rawMessages = views.map((v) => ({
      id: v.id,
      conversation_type: v.conversation_type,
      conversation_id: v.conversation_id,
      author_id: v.author_id,
      content: v.content,
      reply_to_id: v.reply_to_id,
      edited_at: v.edited_at,
      conversation_watermark: v.conversation_watermark,
      created_at: v.created_at,
    }));

    const range = computeHistoryRange(sortByWatermark(rawMessages), { totalCount, hasMoreBefore });

    return { messages: views, range };
  }

  // ── Write: delete message ─────────────────────────────────────────────────

  /**
   * Hard-delete a single message by ID (D-01).
   * Attachment records cascade via ON DELETE CASCADE on attachments.message_id.
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.db.query(`DELETE FROM messages WHERE id = $1`, [messageId]);
  }

  // ── Read: single enriched MessageView ────────────────────────────────────

  /**
   * Fetch a single fully-hydrated MessageView row by primary key.
   *
   * Uses the same JOIN query as listHistory but scoped to a single row.
   * Called by sendMessage (via service) so the returned message carries
   * author_username and reply_preview — matching what listHistory returns.
   *
   * Returns null if the message does not exist (should only happen in race
   * conditions between insert and this read).
   */
  async findMessageViewById(id: string): Promise<MessageView | null> {
    const result = await this.db.query<MessageViewRow>(
      `SELECT
         m.id,
         m.conversation_type,
         m.conversation_id,
         m.author_id,
         a.username          AS author_username,
         m.content,
         m.reply_to_id,
         m.edited_at,
         m.conversation_watermark,
         m.created_at,
         rm.author_id        AS reply_author_id,
         ru.username         AS reply_author_username,
         LEFT(rm.content, 200) AS reply_content_preview,
         COALESCE(att.attachments, '[]'::json) AS attachments
       FROM messages m
       INNER JOIN users a ON a.id = m.author_id
       LEFT  JOIN messages rm ON rm.id = m.reply_to_id
       LEFT  JOIN users ru ON ru.id = rm.author_id
       LEFT JOIN (
         SELECT a2.message_id,
                json_agg(json_build_object(
                  'id', a2.id,
                  'original_filename', a2.original_filename,
                  'mime_type', a2.mime_type,
                  'file_size', a2.file_size,
                  'comment', a2.comment
                ) ORDER BY a2.created_at) AS attachments
         FROM attachments a2
         WHERE a2.message_id IS NOT NULL
         GROUP BY a2.message_id
       ) att ON att.message_id = m.id
       WHERE m.id = $1
       LIMIT 1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return rowToMessageView(result.rows[0]);
  }

  // ── Read: resolve reply target ────────────────────────────────────────────

  /**
   * Resolve the reply target for MSG-03 validation.
   *
   * Returns the raw Message row so the service can call validateReplyTarget.
   * Returns null when reply_to_id is null or the referenced message is gone.
   */
  async resolveReplyMessage(replyToId: string | null | undefined): Promise<Message | null> {
    if (!replyToId) return null;
    return this.findMessageById(replyToId);
  }
}
