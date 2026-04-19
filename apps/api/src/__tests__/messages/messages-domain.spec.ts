/**
 * messages-domain.spec.ts — TDD RED/GREEN tests for Phase 6 messaging domain.
 *
 * Covers MSG-01 through MSG-04:
 *   MSG-01: Room and DM conversations share one core message domain model
 *   MSG-02: Content is plain UTF-8 text up to 3 KB; multiline allowed
 *   MSG-03: Reply references are optional and must target the same conversation
 *   MSG-04: Author-only edits; edited_at set; chronological position preserved
 *
 * Uses plain object stubs — no NestJS testing module or DB connection.
 */

import { describe, it, expect } from 'vitest';
import type {
  Message,
  MessageView,
  SendMessageInput,
  EditMessageInput,
  ConversationType,
  ReplyPreview,
} from '../../messages/messages.types.js';
import {
  validateMessageContent,
  validateReplyTarget,
  applyMessageEdit,
  buildMessageView,
} from '../../messages/messages.helpers.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_type: 'room',
    conversation_id: 'room-1',
    author_id: 'user-a',
    content: 'Hello world',
    reply_to_id: null,
    edited_at: null,
    conversation_watermark: 1,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ── MSG-01: Shared domain model ────────────────────────────────────────────────

describe('MSG-01: Message type covers room and DM targets', () => {
  it('accepts conversation_type = "room"', () => {
    const msg: Message = makeMessage({ conversation_type: 'room' });
    expect(msg.conversation_type).toBe('room');
  });

  it('accepts conversation_type = "dm"', () => {
    const msg: Message = makeMessage({ conversation_type: 'dm', conversation_id: 'dm-conv-1' });
    expect(msg.conversation_type).toBe('dm');
  });

  it('SendMessageInput carries conversation_type and conversation_id', () => {
    const input: SendMessageInput = {
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-a',
      content: 'Hi there',
    };
    expect(input.conversation_type).toBe('room');
    expect(input.conversation_id).toBe('room-1');
  });

  it('MessageView includes author_username for rendering', () => {
    const view: MessageView = {
      id: 'msg-1',
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-a',
      author_username: 'alice',
      content: 'Hello',
      reply_to_id: null,
      reply_preview: null,
      edited_at: null,
      conversation_watermark: 1,
      created_at: new Date(),
    };
    expect(view.author_username).toBe('alice');
  });
});

// ── MSG-02: Content validation ─────────────────────────────────────────────────

describe('MSG-02: Content is plain UTF-8 text up to 3 KB', () => {
  it('accepts non-empty content within 3 KB limit', () => {
    const result = validateMessageContent('Hello, World!');
    expect(result.valid).toBe(true);
  });

  it('accepts multiline content', () => {
    const multiline = 'Line 1\nLine 2\nLine 3';
    const result = validateMessageContent(multiline);
    expect(result.valid).toBe(true);
  });

  it('rejects empty string after trimming', () => {
    const result = validateMessageContent('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('rejects content exceeding 3072 bytes (3 KB) after trim', () => {
    const tooBig = 'x'.repeat(3073);
    const result = validateMessageContent(tooBig);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/3\s*kb|3072|too long/i);
  });

  it('accepts content at exactly 3072 bytes', () => {
    const exactly3kb = 'x'.repeat(3072);
    const result = validateMessageContent(exactly3kb);
    expect(result.valid).toBe(true);
  });
});

// ── MSG-03: Reply validation ───────────────────────────────────────────────────

describe('MSG-03: Reply references must be in the same conversation', () => {
  it('allows null reply_to_id (non-reply message)', () => {
    const result = validateReplyTarget({
      reply_to_id: null,
      conversation_type: 'room',
      conversation_id: 'room-1',
      reply_message: null,
    });
    expect(result.valid).toBe(true);
  });

  it('accepts reply when target is in the same conversation', () => {
    const replyTarget: Message = makeMessage({
      id: 'msg-original',
      conversation_type: 'room',
      conversation_id: 'room-1',
    });
    const result = validateReplyTarget({
      reply_to_id: 'msg-original',
      conversation_type: 'room',
      conversation_id: 'room-1',
      reply_message: replyTarget,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects reply when target is in a different conversation_id', () => {
    const replyTarget: Message = makeMessage({
      id: 'msg-other',
      conversation_type: 'room',
      conversation_id: 'room-OTHER',
    });
    const result = validateReplyTarget({
      reply_to_id: 'msg-other',
      conversation_type: 'room',
      conversation_id: 'room-1',
      reply_message: replyTarget,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/same conversation/i);
  });

  it('rejects reply when target is in a different conversation_type', () => {
    const replyTarget: Message = makeMessage({
      id: 'msg-dm',
      conversation_type: 'dm',
      conversation_id: 'room-1',
    });
    const result = validateReplyTarget({
      reply_to_id: 'msg-dm',
      conversation_type: 'room',
      conversation_id: 'room-1',
      reply_message: replyTarget,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/same conversation/i);
  });

  it('rejects reply when reply_to_id is given but reply_message is not found', () => {
    const result = validateReplyTarget({
      reply_to_id: 'missing-id',
      conversation_type: 'room',
      conversation_id: 'room-1',
      reply_message: null,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});

// ── MSG-04: Edit semantics ─────────────────────────────────────────────────────

describe('MSG-04: Author-only edit; chronological position preserved', () => {
  it('applyMessageEdit sets edited_at to the provided timestamp', () => {
    const original = makeMessage({ id: 'msg-1', author_id: 'user-a', edited_at: null });
    const editedAt = new Date('2026-01-02T00:00:00Z');
    const result = applyMessageEdit(original, {
      message_id: 'msg-1',
      caller_id: 'user-a',
      new_content: 'Updated text',
    }, editedAt);

    expect(result.edited_at).toEqual(editedAt);
  });

  it('applyMessageEdit updates content', () => {
    const original = makeMessage({ author_id: 'user-a' });
    const result = applyMessageEdit(original, {
      message_id: original.id,
      caller_id: 'user-a',
      new_content: 'New content',
    }, new Date());

    expect(result.content).toBe('New content');
  });

  it('applyMessageEdit does NOT change created_at', () => {
    const original = makeMessage({ author_id: 'user-a' });
    const originalCreatedAt = original.created_at;
    const result = applyMessageEdit(original, {
      message_id: original.id,
      caller_id: 'user-a',
      new_content: 'Edited',
    }, new Date());

    expect(result.created_at).toEqual(originalCreatedAt);
  });

  it('applyMessageEdit does NOT change conversation_watermark', () => {
    const original = makeMessage({ author_id: 'user-a', conversation_watermark: 42 });
    const result = applyMessageEdit(original, {
      message_id: original.id,
      caller_id: 'user-a',
      new_content: 'Edited',
    }, new Date());

    expect(result.conversation_watermark).toBe(42);
  });

  it('applyMessageEdit throws when caller_id does not match author_id', () => {
    const original = makeMessage({ author_id: 'user-a' });
    expect(() =>
      applyMessageEdit(original, {
        message_id: original.id,
        caller_id: 'user-b',
        new_content: 'Edited by wrong user',
      }, new Date())
    ).toThrow(/not the author|forbidden/i);
  });
});

// ── buildMessageView ───────────────────────────────────────────────────────────

describe('buildMessageView assembles MessageView from raw message + author info', () => {
  it('returns a MessageView with author_username', () => {
    const msg = makeMessage();
    const view = buildMessageView(msg, 'alice', null);
    expect(view.author_username).toBe('alice');
    expect(view.reply_preview).toBeNull();
  });

  it('includes reply_preview when provided', () => {
    const msg = makeMessage({ reply_to_id: 'msg-original' });
    const preview: ReplyPreview = {
      id: 'msg-original',
      author_id: 'user-b',
      author_username: 'bob',
      content_preview: 'Original text',
    };
    const view = buildMessageView(msg, 'alice', preview);
    expect(view.reply_preview).toEqual(preview);
    expect(view.reply_to_id).toBe('msg-original');
  });

  it('MessageView preserves conversation_type and conversation_id', () => {
    const msg = makeMessage({ conversation_type: 'dm', conversation_id: 'dm-1' });
    const view = buildMessageView(msg, 'alice', null);
    expect(view.conversation_type).toBe('dm');
    expect(view.conversation_id).toBe('dm-1');
  });
});
