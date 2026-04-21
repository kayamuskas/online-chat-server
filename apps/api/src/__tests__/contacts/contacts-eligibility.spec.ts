/**
 * contacts-eligibility.spec.ts — DM eligibility matrix tests for FRND-06.
 *
 * Tests ContactsService.checkDmEligibility() exhaustively:
 *   - No friendship + no ban → not eligible (reason: not_friends)
 *   - Friendship + no ban → eligible
 *   - Any ban in either direction → not eligible (reason: ban_exists), even if friendship was already removed
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContactsRepository } from '../../contacts/contacts.repository.js';
import type { ContactsService as ContactsServiceType } from '../../contacts/contacts.service.js';
import type { UserRepository } from '../../auth/user.repository.js';
import type { Friendship, UserBan } from '../../contacts/contacts.types.js';

// ── stub factories ────────────────────────────────────────────────────────────

function makeContactsRepository(): ContactsRepository {
  return {
    createFriendRequest:   vi.fn(),
    findRequestById:       vi.fn(),
    findFriendRequest:     vi.fn(),
    updateRequestStatus:   vi.fn(),
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

// ── DM eligibility matrix (FRND-06) ──────────────────────────────────────────
describe('ContactsService.checkDmEligibility()', () => {
  let mockRepo: ContactsRepository;
  let mockUserRepo: UserRepository;
  let svc: ContactsServiceType;

  const mockFriendship: Friendship = {
    id: 'fr-1', user_a_id: 'user-a', user_b_id: 'user-b', created_at: new Date(),
  };

  const mockBan: UserBan = {
    id: 'ban-1', banner_user_id: 'user-a', banned_user_id: 'user-b', created_at: new Date(),
  };

  beforeEach(async () => {
    mockRepo = makeContactsRepository();
    mockUserRepo = makeUserRepository();
    const { ContactsService } = await import('../../contacts/contacts.service.js');
    svc = new ContactsService(mockRepo, mockUserRepo);
  });

  // FRND-06: no friendship + no ban → not eligible
  it('returns not eligible with reason not_friends when no friendship or ban exists', async () => {
    vi.mocked(mockRepo.findFriendship).mockResolvedValue(null);
    vi.mocked(mockRepo.findBanBetween).mockResolvedValue(null);

    const result = await svc.checkDmEligibility('user-a', 'user-b');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_friends');
  });

  // FRND-06: friendship + no ban → eligible
  it('returns eligible when friendship exists and no ban is present', async () => {
    vi.mocked(mockRepo.findFriendship).mockResolvedValue(mockFriendship);
    vi.mocked(mockRepo.findBanBetween).mockResolvedValue(null);

    const result = await svc.checkDmEligibility('user-a', 'user-b');
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  // FRND-06: caller bans target → not eligible, even if friendship row is already gone
  it('returns not eligible with reason ban_exists when caller has banned target', async () => {
    vi.mocked(mockRepo.findFriendship).mockResolvedValue(null);
    vi.mocked(mockRepo.findBanBetween).mockResolvedValue(mockBan);

    const result = await svc.checkDmEligibility('user-a', 'user-b');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('ban_exists');
  });

  // FRND-06: target bans caller → not eligible, even if friendship row is already gone
  it('returns not eligible with reason ban_exists when target has banned caller', async () => {
    const reverseBan: UserBan = {
      id: 'ban-2', banner_user_id: 'user-b', banned_user_id: 'user-a', created_at: new Date(),
    };
    vi.mocked(mockRepo.findFriendship).mockResolvedValue(null);
    vi.mocked(mockRepo.findBanBetween).mockResolvedValue(reverseBan);

    const result = await svc.checkDmEligibility('user-a', 'user-b');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('ban_exists');
  });
});
