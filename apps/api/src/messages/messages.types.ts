import type { AttachmentView } from '../attachments/attachments.types.js';

/**
 * messages.types.ts — Phase 6 shared message domain type contracts.
 *
 * Defines the core message model shared by room chats and DM conversations.
 * Both conversation types use the same message table (msg-01) differentiated
 * by conversation_type and conversation_id.
 *
 * Design decisions (from 06-CONTEXT.md):
 * - D-21: Room and DM chats use one core domain model; differ only by target.
 * - D-22: Messages are plain UTF-8 text up to 3 KB.
 * - D-23: Reply is an optional reference to another message in the same conversation.
 * - D-24: Author-only edits in Phase 6; deletion deferred to Phase 8.
 * - D-25: Edited messages carry edited_at; chronological position is preserved.
 * - D-26: Each conversation has an incremental, monotonic, server-assigned watermark.
 * - D-27: History endpoints return range metadata (firstWatermark, lastWatermark, hasMoreBefore).
 * - D-28: Watermark is assigned atomically at persistence time; never client-invented.
 */

// ── Enums / unions ────────────────────────────────────────────────────────────

/**
 * MSG-01: Conversation target type — distinguishes room chat from DM chat.
 * Both use the same message table; target type routes access control and fanout.
 */
export type ConversationType = 'room' | 'dm';

// ── Core domain types ─────────────────────────────────────────────────────────

/**
 * A message record as returned from the database.
 *
 * MSG-01: Supports both room and DM conversation targets.
 * MSG-02: Plain UTF-8 text; content enforced ≤ 3 KB after trim.
 * MSG-03: Optional reply reference to a message in the same conversation.
 * MSG-04: Author-only edit path; edited_at marks the edit event.
 * MSG-08: conversation_watermark is monotonic per conversation_id.
 */
export interface Message {
  id: string;

  /** Discriminator: 'room' for room chats, 'dm' for direct messages. */
  conversation_type: ConversationType;

  /**
   * The conversation this message belongs to.
   * For 'room' messages: the rooms.id FK value.
   * For 'dm' messages:   the dm_conversations.id FK value.
   */
  conversation_id: string;

  /** The user who authored this message. */
  author_id: string;

  /**
   * Message body. Plain UTF-8 text, multiline allowed.
   * Persisted value must not exceed 3 KB after trimming (enforced at service layer).
   */
  content: string;

  /**
   * MSG-03: Optional ID of the message this message replies to.
   * Must reference a message in the same conversation; validated at write time.
   * NULL when the message is not a reply.
   */
  reply_to_id: string | null;

  /**
   * MSG-04: Timestamp of the most recent edit.
   * NULL when the message has never been edited.
   * Chronological position (created_at / watermark) is NOT changed on edit.
   */
  edited_at: Date | null;

  /**
   * MSG-08: Monotonically increasing integer scoped to (conversation_type, conversation_id).
   * Assigned by the server at INSERT time; clients must never invent this value.
   * Used for gap detection and history range queries.
   */
  conversation_watermark: number;

  created_at: Date;
}

// ── Reply preview ─────────────────────────────────────────────────────────────

/**
 * MSG-03: Minimal preview of a replied-to message for client rendering.
 * Returned as part of MessageView so the client can render a reply chip
 * without a second fetch.
 */
export interface ReplyPreview {
  id: string;
  author_id: string;
  author_username: string;
  /** Truncated preview; may be omitted if original message is no longer available. */
  content_preview: string;
}

// ── Projection / view types ───────────────────────────────────────────────────

/**
 * Message enriched with author information and optional reply preview.
 * This is the type returned by history endpoints and realtime fanout.
 */
export interface MessageView {
  id: string;
  conversation_type: ConversationType;
  conversation_id: string;
  author_id: string;
  author_username: string;
  content: string;
  reply_to_id: string | null;
  /** MSG-03: Preview of the replied-to message; null when reply_to_id is null. */
  reply_preview: ReplyPreview | null;
  /** MSG-04: Non-null when the message has been edited at least once. */
  edited_at: Date | null;
  /** MSG-08: Monotonic per-conversation sequence number. */
  conversation_watermark: number;
  created_at: Date;
  /** D-43: Attachment metadata. Empty array when message has no attachments. */
  attachments: AttachmentView[];
}

/**
 * MSG-08: Watermark range metadata returned alongside message history.
 *
 * Enables Phase 9 gap detection and infinite scroll without contract rewrites.
 * D-27: History endpoints return chronological order plus this range object.
 */
export interface MessageHistoryRange {
  /** Watermark of the earliest message in this page. */
  firstWatermark: number;
  /** Watermark of the latest message in this page. */
  lastWatermark: number;
  /**
   * True when there are messages with lower watermarks than firstWatermark
   * in this conversation (i.e., the caller can request an older page).
   */
  hasMoreBefore: boolean;
  /** Total count in the conversation; may be null if not computed. */
  totalCount: number | null;
}

// ── Input types ───────────────────────────────────────────────────────────────

/**
 * Input for the send-message operation.
 *
 * conversation_type + conversation_id uniquely identify the target.
 * author_id is always sourced from the authenticated session (never from request body).
 */
export interface SendMessageInput {
  conversation_type: ConversationType;
  conversation_id: string;
  author_id: string;
  content: string;
  /** MSG-03: Optional reply reference. Validated to be in the same conversation. */
  reply_to_id?: string | null;
  /** D-45: Optional attachment IDs to bind at send time. */
  attachment_ids?: string[];
}

/**
 * Input for the edit-message operation.
 *
 * MSG-04: Only the message author may edit; caller_id must match author_id.
 * Editing does NOT change created_at or conversation_watermark.
 */
export interface EditMessageInput {
  message_id: string;
  caller_id: string;
  new_content: string;
}

/**
 * Input for fetching paginated conversation history.
 *
 * D-27: Clients pass before_watermark to paginate backwards.
 * limit defaults to a server-defined page size when omitted.
 */
export interface MessageHistoryQuery {
  conversation_type: ConversationType;
  conversation_id: string;
  /** Fetch messages with watermark < before_watermark (older than cursor). */
  before_watermark?: number;
  /** Fetch messages with watermark > after_watermark (newer than cursor). D-52..D-54: catch-up after reconnect. */
  after_watermark?: number;
  limit?: number;
}

export type { AttachmentView } from '../attachments/attachments.types.js';
