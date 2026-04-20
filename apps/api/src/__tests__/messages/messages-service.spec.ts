/**
 * messages-service.spec.ts — Unit tests for MessagesService policy layer.
 *
 * Covers service-layer invariants using stub repositories (no NestJS DI, no DB):
 *   - D-30: Room access — member required, banned user rejected
 *   - D-31: DM access — participant required, banned users rejected
 *   - D-32: Frozen DM — send/edit rejected; history read allowed
 *   - MSG-02: Content size validation wired through service
 *   - MSG-03: Cross-conversation reply reference rejection
 *   - MSG-04: Author-only edit enforcement
 *
 * All external dependencies are replaced with typed stub objects that
 * simulate happy-path and error-path states without touching the DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MessagesService } from '../../messages/messages.service.js';
import type { MessagesRepository } from '../../messages/messages.repository.js';
import type { RoomsRepository } from '../../rooms/rooms.repository.js';
import type { ContactsRepository } from '../../contacts/contacts.repository.js';
import type {
  Message,
  MessageView,
  SendMessageInput,
  EditMessageInput,
  MessageHistoryQuery,
} from '../../messages/messages.types.js';
import type { DmConversation } from '../../contacts/contacts.types.js';
import type { RoomMembership, RoomBan } from '../../rooms/rooms.types.js';

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

function makeMessageView(overrides: Partial<MessageView> = {}): MessageView {
  return {
    id: 'msg-1',
    conversation_type: 'room',
    conversation_id: 'room-1',
    author_id: 'user-a',
    author_username: 'alice',
    content: 'Hello world',
    reply_to_id: null,
    reply_preview: null,
    edited_at: null,
    conversation_watermark: 1,
    created_at: new Date('2026-01-01T00:00:00Z'),
    attachments: [],
    ...overrides,
  };
}

function makeDmConversation(overrides: Partial<DmConversation> = {}): DmConversation {
  return {
    id: 'dm-conv-1',
    user_a_id: 'user-a',
    user_b_id: 'user-b',
    frozen: false,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeMembership(overrides: Partial<RoomMembership> = {}): RoomMembership {
  return {
    id: 'memb-1',
    room_id: 'room-1',
    user_id: 'user-a',
    role: 'member',
    joined_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ── Stub factories ────────────────────────────────────────────────────────────

function makeMessagesRepoStub(overrides: Partial<MessagesRepository> = {}): MessagesRepository {
  return {
    createMessage: vi.fn().mockResolvedValue(makeMessage()),
    editMessage: vi.fn().mockResolvedValue(makeMessage({ content: 'Edited', edited_at: new Date() })),
    findMessageById: vi.fn().mockResolvedValue(makeMessage()),
    findMessageViewById: vi.fn().mockResolvedValue(makeMessageView()),
    listHistory: vi.fn().mockResolvedValue({ messages: [], range: { firstWatermark: 0, lastWatermark: 0, hasMoreBefore: false, totalCount: 0 } }),
    resolveReplyMessage: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as MessagesRepository;
}

function makeRoomsRepoStub(overrides: Partial<RoomsRepository> = {}): RoomsRepository {
  return {
    isBanned: vi.fn().mockResolvedValue(false),
    getMembership: vi.fn().mockResolvedValue(makeMembership()),
    ...overrides,
  } as unknown as RoomsRepository;
}

function makeContactsRepoStub(overrides: Partial<ContactsRepository> = {}): ContactsRepository {
  return {
    findDmConversationById: vi.fn().mockResolvedValue(makeDmConversation()),
    findBanBetween: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as ContactsRepository;
}

function makeService(
  msgRepo?: Partial<MessagesRepository>,
  roomsRepo?: Partial<RoomsRepository>,
  contactsRepo?: Partial<ContactsRepository>,
): MessagesService {
  return new MessagesService(
    makeMessagesRepoStub(msgRepo),
    makeRoomsRepoStub(roomsRepo),
    makeContactsRepoStub(contactsRepo),
  );
}

// ── D-30: Room access control ─────────────────────────────────────────────────

describe('D-30: Room access control', () => {
  it('sendMessage succeeds when caller is a room member with no ban', async () => {
    const svc = makeService();
    const input: SendMessageInput = {
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-a',
      content: 'Hello',
    };
    await expect(svc.sendMessage(input)).resolves.toBeDefined();
  });

  it('sendMessage throws ForbiddenException when caller is banned from the room', async () => {
    const svc = makeService(undefined, { isBanned: vi.fn().mockResolvedValue(true) });
    const input: SendMessageInput = {
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-a',
      content: 'Hello',
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sendMessage throws ForbiddenException when caller is not a member', async () => {
    const svc = makeService(undefined, {
      isBanned: vi.fn().mockResolvedValue(false),
      getMembership: vi.fn().mockResolvedValue(null),
    });
    const input: SendMessageInput = {
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-x',
      content: 'Hello',
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listHistory throws ForbiddenException when caller is banned from room', async () => {
    const svc = makeService(undefined, { isBanned: vi.fn().mockResolvedValue(true) });
    await expect(svc.listHistory('user-a', { conversation_type: 'room', conversation_id: 'room-1' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listHistory throws ForbiddenException when caller is not a room member', async () => {
    const svc = makeService(undefined, {
      isBanned: vi.fn().mockResolvedValue(false),
      getMembership: vi.fn().mockResolvedValue(null),
    });
    await expect(svc.listHistory('user-x', { conversation_type: 'room', conversation_id: 'room-1' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── D-31 + D-32: DM access control ───────────────────────────────────────────

describe('D-31 + D-32: DM access control', () => {
  it('sendMessage succeeds for eligible DM participants', async () => {
    const svc = makeService();
    const input: SendMessageInput = {
      conversation_type: 'dm',
      conversation_id: 'dm-conv-1',
      author_id: 'user-a',
      content: 'Hi',
    };
    await expect(svc.sendMessage(input)).resolves.toBeDefined();
  });

  it('sendMessage throws NotFoundException when DM conversation does not exist', async () => {
    const svc = makeService(undefined, undefined, {
      findDmConversationById: vi.fn().mockResolvedValue(null),
      findBanBetween: vi.fn().mockResolvedValue(null),
    });
    const input: SendMessageInput = {
      conversation_type: 'dm',
      conversation_id: 'nonexistent',
      author_id: 'user-a',
      content: 'Hi',
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sendMessage throws ForbiddenException when caller is not a DM participant', async () => {
    const svc = makeService(undefined, undefined, {
      findDmConversationById: vi.fn().mockResolvedValue(makeDmConversation({ user_a_id: 'user-x', user_b_id: 'user-y' })),
      findBanBetween: vi.fn().mockResolvedValue(null),
    });
    const input: SendMessageInput = {
      conversation_type: 'dm',
      conversation_id: 'dm-conv-1',
      author_id: 'user-a',
      content: 'Hi',
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sendMessage throws ForbiddenException when a ban exists in DM', async () => {
    const svc = makeService(undefined, undefined, {
      findDmConversationById: vi.fn().mockResolvedValue(makeDmConversation()),
      findBanBetween: vi.fn().mockResolvedValue({ id: 'ban-1', banner_user_id: 'user-b', banned_user_id: 'user-a', created_at: new Date() }),
    });
    const input: SendMessageInput = {
      conversation_type: 'dm',
      conversation_id: 'dm-conv-1',
      author_id: 'user-a',
      content: 'Hi',
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sendMessage throws ForbiddenException when DM conversation is frozen (D-32)', async () => {
    const svc = makeService(undefined, undefined, {
      findDmConversationById: vi.fn().mockResolvedValue(makeDmConversation({ frozen: true })),
      findBanBetween: vi.fn().mockResolvedValue(null),
    });
    const input: SendMessageInput = {
      conversation_type: 'dm',
      conversation_id: 'dm-conv-1',
      author_id: 'user-a',
      content: 'Hi',
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listHistory succeeds for frozen DM (D-32: read-only not gone)', async () => {
    const svc = makeService(undefined, undefined, {
      findDmConversationById: vi.fn().mockResolvedValue(makeDmConversation({ frozen: true })),
      findBanBetween: vi.fn().mockResolvedValue(null),
    });
    await expect(svc.listHistory('user-a', { conversation_type: 'dm', conversation_id: 'dm-conv-1' }))
      .resolves.toBeDefined();
  });

  it('editMessage throws ForbiddenException when DM conversation is frozen (D-32)', async () => {
    const svc = makeService(
      {
        findMessageById: vi.fn().mockResolvedValue(makeMessage({ conversation_type: 'dm', conversation_id: 'dm-conv-1' })),
      },
      undefined,
      {
        findDmConversationById: vi.fn().mockResolvedValue(makeDmConversation({ frozen: true })),
        findBanBetween: vi.fn().mockResolvedValue(null),
      },
    );
    const input: EditMessageInput = { message_id: 'msg-1', caller_id: 'user-a', new_content: 'Edited' };
    await expect(svc.editMessage(input)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── MSG-02: Content validation in service ────────────────────────────────────

describe('MSG-02: Service enforces content size limit', () => {
  it('sendMessage throws BadRequestException for empty content', async () => {
    const svc = makeService();
    const input: SendMessageInput = {
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-a',
      content: '   ',
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendMessage throws BadRequestException for content exceeding 3072 bytes', async () => {
    const svc = makeService();
    const input: SendMessageInput = {
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-a',
      content: 'x'.repeat(3073),
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('editMessage throws BadRequestException for empty new content', async () => {
    const svc = makeService();
    const input: EditMessageInput = { message_id: 'msg-1', caller_id: 'user-a', new_content: '  ' };
    await expect(svc.editMessage(input)).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ── MSG-03: Cross-conversation reply rejection ────────────────────────────────

describe('MSG-03: Service rejects cross-conversation reply references', () => {
  it('sendMessage throws BadRequestException when reply target is in another conversation', async () => {
    const replyInOtherConv = makeMessage({ id: 'msg-other', conversation_id: 'room-OTHER' });
    const svc = makeService({
      resolveReplyMessage: vi.fn().mockResolvedValue(replyInOtherConv),
    });
    const input: SendMessageInput = {
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-a',
      content: 'reply',
      reply_to_id: 'msg-other',
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendMessage throws BadRequestException when reply target message does not exist', async () => {
    const svc = makeService({
      resolveReplyMessage: vi.fn().mockResolvedValue(null),
    });
    const input: SendMessageInput = {
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-a',
      content: 'reply',
      reply_to_id: 'nonexistent-msg',
    };
    await expect(svc.sendMessage(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendMessage accepts valid same-conversation reply reference', async () => {
    const replyMsg = makeMessage({ id: 'msg-original', conversation_type: 'room', conversation_id: 'room-1' });
    const svc = makeService({
      resolveReplyMessage: vi.fn().mockResolvedValue(replyMsg),
    });
    const input: SendMessageInput = {
      conversation_type: 'room',
      conversation_id: 'room-1',
      author_id: 'user-a',
      content: 'reply',
      reply_to_id: 'msg-original',
    };
    await expect(svc.sendMessage(input)).resolves.toBeDefined();
  });
});

// ── MSG-04: Author-only edit ──────────────────────────────────────────────────

describe('MSG-04: Service enforces author-only edit', () => {
  it('editMessage throws ForbiddenException when caller is not the message author', async () => {
    const svc = makeService({
      findMessageById: vi.fn().mockResolvedValue(makeMessage({ author_id: 'user-a' })),
    });
    const input: EditMessageInput = { message_id: 'msg-1', caller_id: 'user-b', new_content: 'Edited' };
    await expect(svc.editMessage(input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('editMessage throws NotFoundException when message does not exist', async () => {
    const svc = makeService({
      findMessageById: vi.fn().mockResolvedValue(null),
    });
    const input: EditMessageInput = { message_id: 'msg-missing', caller_id: 'user-a', new_content: 'Edited' };
    await expect(svc.editMessage(input)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('editMessage succeeds when caller matches author_id', async () => {
    const svc = makeService();
    const input: EditMessageInput = { message_id: 'msg-1', caller_id: 'user-a', new_content: 'Updated content' };
    await expect(svc.editMessage(input)).resolves.toBeDefined();
  });

  it('editMessage result preserves original watermark (D-25)', async () => {
    const original = makeMessage({ author_id: 'user-a', conversation_watermark: 42 });
    const edited = { ...original, content: 'Updated', edited_at: new Date() };
    const svc = makeService({
      findMessageById: vi.fn().mockResolvedValue(original),
      editMessage: vi.fn().mockResolvedValue(edited),
    });
    const input: EditMessageInput = { message_id: 'msg-1', caller_id: 'user-a', new_content: 'Updated' };
    const result = await svc.editMessage(input);
    expect(result.conversation_watermark).toBe(42);
  });
});

// ── Room and DM variants ──────────────────────────────────────────────────────

describe('Room and DM coverage (acceptance criteria)', () => {
  it('sendMessage works for DM conversation variant', async () => {
    const svc = makeService();
    const input: SendMessageInput = {
      conversation_type: 'dm',
      conversation_id: 'dm-conv-1',
      author_id: 'user-a',
      content: 'DM message',
    };
    await expect(svc.sendMessage(input)).resolves.toBeDefined();
  });

  it('listHistory works for DM conversation variant', async () => {
    const svc = makeService();
    const result = await svc.listHistory('user-a', {
      conversation_type: 'dm',
      conversation_id: 'dm-conv-1',
    });
    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('range');
  });

  it('listHistory works for room conversation variant', async () => {
    const svc = makeService();
    const result = await svc.listHistory('user-a', {
      conversation_type: 'room',
      conversation_id: 'room-1',
    });
    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('range');
  });

  it('editMessage room variant: access guard runs before author check', async () => {
    // Caller is banned — should get ForbiddenException before author check
    const svc = makeService(
      { findMessageById: vi.fn().mockResolvedValue(makeMessage({ author_id: 'user-a' })) },
      { isBanned: vi.fn().mockResolvedValue(true) },
    );
    const input: EditMessageInput = { message_id: 'msg-1', caller_id: 'user-a', new_content: 'X' };
    await expect(svc.editMessage(input)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
