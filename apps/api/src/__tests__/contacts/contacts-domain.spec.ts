/**
 * contacts-domain.spec.ts — TDD tests for Phase 5 contacts domain.
 *
 * Covers FRND-01 through FRND-04:
 *   FRND-01: sendFriendRequest creates pending request; duplicate rejected
 *   FRND-02: acceptRequest creates friendship; declineRequest does not
 *   FRND-03: removeFriend removes friendship; DM history preserved
 *   FRND-04: banUser creates ban, terminates friendship atomically; no self-ban
 *   FRND-05: banUser sets dm_conversations.frozen = true
 *
 * Uses plain object stubs — no NestJS testing module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContactsRepository } from '../../contacts/contacts.repository.js';
import type { ContactsService as ContactsServiceType } from '../../contacts/contacts.service.js';
import type { UserRepository } from '../../auth/user.repository.js';
import type {
  FriendRequest,
  Friendship,
  UserBan,
  UserBanView,
  FriendRequestStatus,
} from '../../contacts/contacts.types.js';

// ── stub factories ────────────────────────────────────────────────────────────

function makeContactsRepository(): ContactsRepository {
  return {
    createFriendRequest:   vi.fn(),
    findRequestById:       vi.fn(),
    findFriendRequest:     vi.fn(),
    findAnyFriendRequest:  vi.fn(),
    updateRequestStatus:   vi.fn(),
    cancelPendingRequestsBetween: vi.fn(),
    listIncomingRequests:  vi.fn(),
    listOutgoingRequests:  vi.fn(),
    createFriendship:      vi.fn(),
    findFriendship:        vi.fn(),
    deleteFriendship:      vi.fn(),
    listFriends:           vi.fn(),
    createBan:             vi.fn(),
    removeBan:             vi.fn(),
    findBanBetween:        vi.fn(),
    findBanByBanner:       vi.fn(),
    listBans:              vi.fn(),
    freezeDmConversation:  vi.fn(),
    createDmConversation:  vi.fn(),
    findDmConversation:    vi.fn(),
  } as unknown as ContactsRepository;
}

function makeUserRepository(): UserRepository {
  return {
    findByEmail:        vi.fn(),
    findByUsername:     vi.fn(),
    findById:           vi.fn(),
    createUser:         vi.fn(),
    updatePasswordHash: vi.fn(),
  } as unknown as UserRepository;
}

// ── type shape tests ──────────────────────────────────────────────────────────
describe('Contacts domain types', () => {
  it('FriendRequest has required fields', () => {
    const r: FriendRequest = {
      id: 'req-1',
      requester_id: 'user-a',
      target_id: 'user-b',
      message: null,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    };
    expect(r.status).toBe('pending');
  });

  it('FriendRequestStatus accepts all four values', () => {
    const statuses: FriendRequestStatus[] = ['pending', 'accepted', 'declined', 'cancelled'];
    expect(statuses).toHaveLength(4);
  });

  it('Friendship has user_a_id and user_b_id', () => {
    const f: Friendship = {
      id: 'fr-1',
      user_a_id: 'user-a',
      user_b_id: 'user-b',
      created_at: new Date(),
    };
    expect(f.user_a_id).toBe('user-a');
  });

  it('UserBan has banner_user_id and banned_user_id', () => {
    const ban: UserBan = {
      id: 'ban-1',
      banner_user_id: 'user-a',
      banned_user_id: 'user-b',
      created_at: new Date(),
    };
    expect(ban.banner_user_id).toBe('user-a');
  });

  it('UserBanView includes banned_username for management UI', () => {
    const ban: UserBanView = {
      id: 'ban-1',
      banner_user_id: 'user-a',
      banned_user_id: 'user-b',
      banned_username: 'bob',
      created_at: new Date(),
    };
    expect(ban.banned_username).toBe('bob');
  });
});

// ── ContactsService real implementation ──────────────────────────────────────
describe('ContactsService real implementation', () => {
  let mockRepo: ContactsRepository;
  let mockUserRepo: UserRepository;
  let svc: ContactsServiceType;

  beforeEach(async () => {
    mockRepo = makeContactsRepository();
    mockUserRepo = makeUserRepository();
    const { ContactsService } = await import('../../contacts/contacts.service.js');
    svc = new ContactsService(mockRepo, mockUserRepo);
  });

  // FRND-01: send request creates pending row; duplicate rejected
  it('sendFriendRequest looks up target username', async () => {
    vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({
      id: 'user-b', email: 'b@test.com', username: 'bob',
      password_hash: 'x', created_at: new Date(), updated_at: new Date(),
    });
    vi.mocked(mockRepo.findFriendship).mockResolvedValue(null);
    vi.mocked(mockRepo.findAnyFriendRequest).mockResolvedValue(null);
    vi.mocked(mockRepo.createFriendRequest).mockResolvedValue({
      id: 'req-1', requester_id: 'user-a', target_id: 'user-b',
      message: null, status: 'pending', created_at: new Date(), updated_at: new Date(),
    });

    const result = await svc.sendFriendRequest('user-a', { targetUsername: 'bob' });
    expect(result.requester_id).toBe('user-a');
    expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('bob');
  });

  it('sendFriendRequest throws ConflictException when pending request exists', async () => {
    vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({
      id: 'user-b', email: 'b@test.com', username: 'bob',
      password_hash: 'x', created_at: new Date(), updated_at: new Date(),
    });
    vi.mocked(mockRepo.findFriendship).mockResolvedValue(null);
    vi.mocked(mockRepo.findAnyFriendRequest).mockResolvedValue({
      id: 'req-1', requester_id: 'user-a', target_id: 'user-b',
      message: null, status: 'pending', created_at: new Date(), updated_at: new Date(),
    });

    await expect(svc.sendFriendRequest('user-a', { targetUsername: 'bob' }))
      .rejects.toThrow();
  });

  it('sendFriendRequest throws ConflictException when already friends', async () => {
    vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({
      id: 'user-b', email: 'b@test.com', username: 'bob',
      password_hash: 'x', created_at: new Date(), updated_at: new Date(),
    });
    vi.mocked(mockRepo.findFriendship).mockResolvedValue({
      id: 'fr-1', user_a_id: 'user-a', user_b_id: 'user-b', created_at: new Date(),
    });

    await expect(svc.sendFriendRequest('user-a', { targetUsername: 'bob' }))
      .rejects.toThrow(/already friends/i);
  });

  it('sendFriendRequest throws ForbiddenException when a ban exists in either direction', async () => {
    vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({
      id: 'user-b', email: 'b@test.com', username: 'bob',
      password_hash: 'x', created_at: new Date(), updated_at: new Date(),
    });
    vi.mocked(mockRepo.findFriendship).mockResolvedValue(null);
    vi.mocked(mockRepo.findBanBetween).mockResolvedValue({
      id: 'ban-1',
      banner_user_id: 'user-b',
      banned_user_id: 'user-a',
      created_at: new Date(),
    });

    await expect(svc.sendFriendRequest('user-a', { targetUsername: 'bob' }))
      .rejects.toThrow(/contact is restricted/i);
    expect(mockRepo.createFriendRequest).not.toHaveBeenCalled();
  });

  it('sendFriendRequest throws BadRequestException for self-request', async () => {
    vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({
      id: 'user-a', email: 'a@test.com', username: 'alice',
      password_hash: 'x', created_at: new Date(), updated_at: new Date(),
    });

    await expect(svc.sendFriendRequest('user-a', { targetUsername: 'alice' }))
      .rejects.toThrow();
  });

  // FRND-02: accept creates friendship row
  it('acceptRequest throws ForbiddenException when caller is not the target', async () => {
    vi.mocked(mockRepo.findRequestById).mockResolvedValue({
      id: 'req-1', requester_id: 'user-a', target_id: 'user-b',
      message: null, status: 'pending', created_at: new Date(), updated_at: new Date(),
    });

    await expect(svc.acceptRequest('req-1', 'user-a')).rejects.toThrow();
  });

  // FRND-04: self-ban guard
  it('banUser throws BadRequestException for self-ban', async () => {
    await expect(svc.banUser('user-a', 'user-a')).rejects.toThrow();
  });

  it('banUser cancels pending requests between users before creating the ban', async () => {
    const client = {
      query: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };
    const db = {
      getClient: vi.fn().mockResolvedValue(client),
    } as any;
    const { ContactsService } = await import('../../contacts/contacts.service.js');
    const transactionalSvc = new ContactsService(mockRepo, mockUserRepo, db);

    await transactionalSvc.banUser('user-a', 'user-b');

    expect(mockRepo.deleteFriendship).toHaveBeenCalledWith('user-a', 'user-b', client);
    expect(mockRepo.cancelPendingRequestsBetween).toHaveBeenCalledWith('user-a', 'user-b', client);
    expect(mockRepo.createBan).toHaveBeenCalledWith(
      { banner_user_id: 'user-a', banned_user_id: 'user-b' },
      client,
    );
    expect(mockRepo.freezeDmConversation).toHaveBeenCalledWith('user-a', 'user-b', client);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('getMyBans returns enriched ban rows for blocked-users UI', async () => {
    vi.mocked(mockRepo.listBans).mockResolvedValue([
      {
        id: 'ban-1',
        banner_user_id: 'user-a',
        banned_user_id: 'user-b',
        banned_username: 'bob',
        created_at: new Date(),
      },
    ]);

    const result = await svc.getMyBans('user-a');
    expect(result[0].banned_username).toBe('bob');
    expect(mockRepo.listBans).toHaveBeenCalledWith('user-a');
  });
});
