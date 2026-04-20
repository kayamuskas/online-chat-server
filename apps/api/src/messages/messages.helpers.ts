/**
 * messages.helpers.ts — Phase 6 pure domain helpers for the messaging engine.
 *
 * All functions are stateless and free of I/O; they operate on in-memory
 * message objects only. The service and repository layers call these helpers
 * to enforce domain invariants before touching the database.
 *
 * Requirements covered:
 *   MSG-02: validateMessageContent — UTF-8 text ≤ 3 KB after trim
 *   MSG-03: validateReplyTarget    — reply must be in the same conversation
 *   MSG-04: applyMessageEdit       — author-only, preserves position/watermark
 *   MSG-08: isWatermarkMonotonic, nextWatermark, computeHistoryRange, sortByWatermark
 */

import type {
  Message,
  MessageView,
  MessageHistoryRange,
  EditMessageInput,
  ReplyPreview,
} from './messages.types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum message content size in bytes after trimming (MSG-02). */
export const MAX_MESSAGE_BYTES = 3072; // 3 KB

// ── Validation helpers ────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * MSG-02: Validate plain-text message content.
 *
 * Rules:
 *   - After trimming, must not be empty.
 *   - UTF-8 byte length (via Buffer or TextEncoder) must not exceed 3072 bytes.
 */
export function validateMessageContent(content: string): ValidationResult {
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Message content must not be empty after trimming.' };
  }

  // Measure byte size using Buffer (Node.js) or TextEncoder (browser-safe fallback)
  const byteLength =
    typeof Buffer !== 'undefined'
      ? Buffer.byteLength(trimmed, 'utf8')
      : new TextEncoder().encode(trimmed).length;

  if (byteLength > MAX_MESSAGE_BYTES) {
    return {
      valid: false,
      error: `Message content exceeds the 3 KB (${MAX_MESSAGE_BYTES} bytes) limit.`,
    };
  }

  return { valid: true };
}

// ── Reply validation ──────────────────────────────────────────────────────────

export interface ReplyTargetInput {
  reply_to_id: string | null;
  conversation_type: 'room' | 'dm';
  conversation_id: string;
  reply_message: Message | null;
}

/**
 * MSG-03: Validate that a reply reference stays within the same conversation.
 *
 * Rules:
 *   - If reply_to_id is null: always valid (non-reply message).
 *   - If reply_to_id is provided but reply_message is null: referenced message not found.
 *   - If reply_message is in a different conversation_type or conversation_id: rejected.
 */
export function validateReplyTarget(input: ReplyTargetInput): ValidationResult {
  const { reply_to_id, conversation_type, conversation_id, reply_message } = input;

  if (reply_to_id === null) {
    return { valid: true };
  }

  if (reply_message === null) {
    return { valid: false, error: `Reply target message '${reply_to_id}' not found.` };
  }

  if (
    reply_message.conversation_type !== conversation_type ||
    reply_message.conversation_id !== conversation_id
  ) {
    return {
      valid: false,
      error:
        'Reply target must be in the same conversation as the new message.',
    };
  }

  return { valid: true };
}

// ── Edit helper ───────────────────────────────────────────────────────────────

/**
 * MSG-04: Apply an author-only edit to a message.
 *
 * Returns a new Message object with updated content and edited_at.
 * Throws if caller_id does not match author_id.
 * Does NOT change created_at or conversation_watermark.
 */
export function applyMessageEdit(
  message: Message,
  input: EditMessageInput,
  editedAt: Date,
): Message {
  if (input.caller_id !== message.author_id) {
    throw new Error(
      `Forbidden: caller '${input.caller_id}' is not the author of message '${message.id}'.`,
    );
  }

  return {
    ...message,
    content: input.new_content,
    edited_at: editedAt,
    // created_at and conversation_watermark are deliberately NOT changed (D-25, D-28)
  };
}

// ── View builder ──────────────────────────────────────────────────────────────

/**
 * Assemble a MessageView from raw message, resolved author username, and optional reply preview.
 *
 * The service layer resolves author_username and reply_preview before calling this.
 */
export function buildMessageView(
  message: Message,
  authorUsername: string,
  replyPreview: ReplyPreview | null,
): MessageView {
  return {
    id: message.id,
    conversation_type: message.conversation_type,
    conversation_id: message.conversation_id,
    author_id: message.author_id,
    author_username: authorUsername,
    content: message.content,
    reply_to_id: message.reply_to_id,
    reply_preview: replyPreview,
    edited_at: message.edited_at,
    conversation_watermark: message.conversation_watermark,
    created_at: message.created_at,
    attachments: [],
  };
}

// ── Watermark helpers (MSG-08) ────────────────────────────────────────────────

/**
 * MSG-08: Check that a list of messages has strictly monotonically increasing watermarks.
 *
 * Returns true for empty lists and single-element lists.
 * Returns false if any watermark equals or is less than the previous one.
 */
export function isWatermarkMonotonic(messages: Message[]): boolean {
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].conversation_watermark <= messages[i - 1].conversation_watermark) {
      return false;
    }
  }
  return true;
}

/**
 * MSG-08: Compute the next watermark value for a conversation.
 *
 * Returns max(existing watermarks) + 1, or 1 if the list is empty.
 *
 * NOTE: In production, the service/repository assigns watermarks atomically
 * via a DB-level SELECT MAX + INSERT within a serializable transaction.
 * This helper is used in tests to simulate and verify watermark sequencing.
 */
export function nextWatermark(messages: Message[]): number {
  if (messages.length === 0) {
    return 1;
  }
  const max = Math.max(...messages.map((m) => m.conversation_watermark));
  return max + 1;
}

/**
 * MSG-08: Compute MessageHistoryRange metadata from a page of messages.
 *
 * D-27: Returns firstWatermark, lastWatermark, hasMoreBefore, totalCount.
 *
 * @param messages - The page of messages (already sorted or unsorted — min/max are derived).
 * @param opts.totalCount - Total message count in the conversation, or null if unknown.
 */
export function computeHistoryRange(
  messages: Message[],
  opts: { totalCount: number | null; hasMoreBefore?: boolean },
): MessageHistoryRange {
  if (messages.length === 0) {
    return {
      firstWatermark: 0,
      lastWatermark: 0,
      hasMoreBefore: false,
      totalCount: opts.totalCount ?? 0,
    };
  }

  const watermarks = messages.map((m) => m.conversation_watermark);
  const firstWatermark = Math.min(...watermarks);
  const lastWatermark = Math.max(...watermarks);

  // hasMoreBefore must reflect actual older persisted rows, not watermark gaps.
  // Deleted messages can leave sparse watermarks (e.g. only watermark 7 remains),
  // so firstWatermark > 1 does not imply there are older messages to load.
  const hasMoreBefore = opts.hasMoreBefore ?? firstWatermark > 1;

  return {
    firstWatermark,
    lastWatermark,
    hasMoreBefore,
    totalCount: opts.totalCount,
  };
}

/**
 * Sort a list of messages in ascending watermark (chronological) order.
 *
 * Returns a new array; does NOT mutate the input.
 */
export function sortByWatermark(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => a.conversation_watermark - b.conversation_watermark,
  );
}
