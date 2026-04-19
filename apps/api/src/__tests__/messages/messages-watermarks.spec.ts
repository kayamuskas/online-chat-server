/**
 * messages-watermarks.spec.ts — TDD RED/GREEN tests for MSG-08 watermark invariants.
 *
 * Covers MSG-08:
 *   MSG-08: Each conversation has incremental watermarks for client gap detection.
 *
 * Verifies:
 *   - Watermark monotonicity within a conversation
 *   - Per-conversation isolation (watermarks in room-A don't affect room-B or DM)
 *   - MessageHistoryRange metadata accuracy
 *   - Range query boundary conditions
 *
 * Uses plain object stubs — no NestJS testing module or DB connection.
 */

import { describe, it, expect } from 'vitest';
import type { Message, MessageHistoryRange } from '../../messages/messages.types.js';
import {
  computeHistoryRange,
  sortByWatermark,
  isWatermarkMonotonic,
  nextWatermark,
} from '../../messages/messages.helpers.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMessages(
  conversationType: 'room' | 'dm',
  conversationId: string,
  watermarks: number[],
): Message[] {
  return watermarks.map((wm, i) => ({
    id: `msg-${i + 1}`,
    conversation_type: conversationType,
    conversation_id: conversationId,
    author_id: 'user-a',
    content: `Message ${i + 1}`,
    reply_to_id: null,
    edited_at: null,
    conversation_watermark: wm,
    created_at: new Date(`2026-01-01T00:0${i}:00Z`),
  }));
}

// ── MSG-08: Watermark monotonicity ────────────────────────────────────────────

describe('MSG-08: Watermark is monotonically increasing per conversation', () => {
  it('isWatermarkMonotonic returns true for strictly ascending watermarks', () => {
    const messages = makeMessages('room', 'room-1', [1, 2, 3, 4, 5]);
    expect(isWatermarkMonotonic(messages)).toBe(true);
  });

  it('isWatermarkMonotonic returns false when a watermark is repeated', () => {
    const messages = makeMessages('room', 'room-1', [1, 2, 2, 3]);
    expect(isWatermarkMonotonic(messages)).toBe(false);
  });

  it('isWatermarkMonotonic returns false when a watermark decreases', () => {
    const messages = makeMessages('room', 'room-1', [1, 3, 2, 4]);
    expect(isWatermarkMonotonic(messages)).toBe(false);
  });

  it('isWatermarkMonotonic returns true for a single message', () => {
    const messages = makeMessages('room', 'room-1', [7]);
    expect(isWatermarkMonotonic(messages)).toBe(true);
  });

  it('isWatermarkMonotonic returns true for empty list', () => {
    expect(isWatermarkMonotonic([])).toBe(true);
  });
});

// ── MSG-08: Per-conversation isolation ────────────────────────────────────────

describe('MSG-08: Watermarks are scoped per conversation', () => {
  it('nextWatermark returns 1 for a conversation with no messages', () => {
    expect(nextWatermark([])).toBe(1);
  });

  it('nextWatermark returns maxWatermark + 1', () => {
    const messages = makeMessages('room', 'room-1', [1, 2, 5]);
    expect(nextWatermark(messages)).toBe(6);
  });

  it('watermarks in different conversations are independent', () => {
    const roomMessages = makeMessages('room', 'room-1', [1, 2, 3]);
    const dmMessages = makeMessages('dm', 'dm-1', [1, 2]);

    // Both sequences start at 1 independently — no cross-conversation coupling
    expect(nextWatermark(roomMessages)).toBe(4);
    expect(nextWatermark(dmMessages)).toBe(3);
  });

  it('watermarks in different room conversations are independent', () => {
    const roomA = makeMessages('room', 'room-A', [1, 2, 10]);
    const roomB = makeMessages('room', 'room-B', [1, 2, 3]);

    expect(nextWatermark(roomA)).toBe(11);
    expect(nextWatermark(roomB)).toBe(4);
  });
});

// ── MSG-08: History range metadata ────────────────────────────────────────────

describe('MSG-08: computeHistoryRange returns correct range metadata', () => {
  it('returns firstWatermark and lastWatermark from the given page', () => {
    const messages = makeMessages('room', 'room-1', [3, 4, 5]);
    const range = computeHistoryRange(messages, { totalCount: 10 });

    expect(range.firstWatermark).toBe(3);
    expect(range.lastWatermark).toBe(5);
  });

  it('hasMoreBefore is true when firstWatermark > 1 (older messages exist)', () => {
    const messages = makeMessages('room', 'room-1', [3, 4, 5]);
    const range = computeHistoryRange(messages, { totalCount: 10 });
    expect(range.hasMoreBefore).toBe(true);
  });

  it('hasMoreBefore is false when firstWatermark is 1 (start of conversation)', () => {
    const messages = makeMessages('room', 'room-1', [1, 2, 3]);
    const range = computeHistoryRange(messages, { totalCount: 3 });
    expect(range.hasMoreBefore).toBe(false);
  });

  it('totalCount reflects the passed-in conversation total', () => {
    const messages = makeMessages('room', 'room-1', [8, 9, 10]);
    const range = computeHistoryRange(messages, { totalCount: 42 });
    expect(range.totalCount).toBe(42);
  });

  it('handles empty page gracefully', () => {
    const range = computeHistoryRange([], { totalCount: 0 });
    expect(range.firstWatermark).toBe(0);
    expect(range.lastWatermark).toBe(0);
    expect(range.hasMoreBefore).toBe(false);
    expect(range.totalCount).toBe(0);
  });
});

// ── sortByWatermark ────────────────────────────────────────────────────────────

describe('sortByWatermark returns messages in chronological (ascending) order', () => {
  it('sorts ascending by conversation_watermark', () => {
    const messages = makeMessages('room', 'room-1', [5, 3, 1, 4, 2]);
    const sorted = sortByWatermark(messages);
    const watermarks = sorted.map((m) => m.conversation_watermark);
    expect(watermarks).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the input array', () => {
    const messages = makeMessages('room', 'room-1', [3, 1, 2]);
    const original = [...messages];
    sortByWatermark(messages);
    expect(messages.map((m) => m.conversation_watermark)).toEqual(
      original.map((m) => m.conversation_watermark),
    );
  });

  it('handles a single-element list', () => {
    const messages = makeMessages('room', 'room-1', [7]);
    const sorted = sortByWatermark(messages);
    expect(sorted[0].conversation_watermark).toBe(7);
  });
});
