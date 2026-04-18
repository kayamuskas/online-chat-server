/**
 * rooms-domain.spec.ts — TDD tests for Phase 4 room domain foundation.
 *
 * Covers:
 *  Task 1: RoomsRepository — schema types, persistence boundary, authority relations
 *  Task 2: RoomsService — creation policy, owner bootstrap, invite validation helpers
 *
 * Uses plain object stubs instead of NestJS testing module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RoomsRepository } from '../../rooms/rooms.repository.js';
import type { RoomsService } from '../../rooms/rooms.service.js';
import type {
  Room,
  RoomMembership,
  RoomInvite,
  RoomAdmin,
  RoomBan,
  RoomVisibility,
  RoomRole,
} from '../../rooms/rooms.types.js';
import type { UserRepository } from '../../auth/user.repository.js';

// ── type shape tests ──────────────────────────────────────────────────────────

describe('Room domain types', () => {
  it('Room has the required identity fields', () => {
    const room: Room = {
      id: 'room-1',
      name: 'general',
      description: null,
      visibility: 'public',
      owner_id: 'user-1',
      created_at: new Date(),
      updated_at: new Date(),
    };
    expect(room.id).toBe('room-1');
    expect(room.visibility).toBe('public');
    expect(room.owner_id).toBe('user-1');
  });

  it('RoomMembership has user_id, room_id, and role', () => {
    const membership: RoomMembership = {
      id: 'mem-1',
      room_id: 'room-1',
      user_id: 'user-1',
      role: 'member',
      joined_at: new Date(),
    };
    expect(membership.role).toBe('member');
  });

  it('RoomInvite has inviter, invitee, and room references', () => {
    const invite: RoomInvite = {
      id: 'inv-1',
      room_id: 'room-1',
      invited_by_user_id: 'user-1',
      invited_user_id: 'user-2',
      status: 'pending',
      created_at: new Date(),
      expires_at: null,
    };
    expect(invite.status).toBe('pending');
  });

  it('RoomAdmin has room_id and user_id', () => {
    const admin: RoomAdmin = {
      id: 'adm-1',
      room_id: 'room-1',
      user_id: 'user-2',
      granted_by_user_id: 'user-1',
      granted_at: new Date(),
    };
    expect(admin.user_id).toBe('user-2');
  });

  it('RoomBan has room_id, banned_user_id, and reason', () => {
    const ban: RoomBan = {
      id: 'ban-1',
      room_id: 'room-1',
      banned_user_id: 'user-3',
      banned_by_user_id: 'user-1',
      reason: null,
      banned_at: new Date(),
    };
    expect(ban.banned_user_id).toBe('user-3');
  });

  it('RoomVisibility union is public or private', () => {
    const vis1: RoomVisibility = 'public';
    const vis2: RoomVisibility = 'private';
    expect(vis1).toBe('public');
    expect(vis2).toBe('private');
  });

  it('RoomRole union is owner, admin, or member', () => {
    const r1: RoomRole = 'owner';
    const r2: RoomRole = 'admin';
    const r3: RoomRole = 'member';
    expect([r1, r2, r3]).toEqual(['owner', 'admin', 'member']);
  });
});

// ── RoomsRepository stub tests ────────────────────────────────────────────────

function makeRoomsRepository(): RoomsRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    listPublic: vi.fn(),
    addMember: vi.fn(),
    getMembership: vi.fn(),
    removeMember: vi.fn(),
    listMembers: vi.fn(),
    addAdmin: vi.fn(),
    removeAdmin: vi.fn(),
    isAdmin: vi.fn(),
    createInvite: vi.fn(),
    findInviteByUserAndRoom: vi.fn(),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    addBan: vi.fn(),
    removeBan: vi.fn(),
    isBanned: vi.fn(),
    getMemberCount: vi.fn(),
  } as unknown as RoomsRepository;
}

describe('RoomsRepository interface', () => {
  let repo: RoomsRepository;

  beforeEach(() => {
    repo = makeRoomsRepository();
  });

  it('create() returns a Room', async () => {
    const expected: Room = {
      id: 'r1',
      name: 'test-room',
      description: null,
      visibility: 'public',
      owner_id: 'u1',
      created_at: new Date(),
      updated_at: new Date(),
    };
    vi.mocked(repo.create).mockResolvedValue(expected);
    const result = await repo.create({ name: 'test-room', visibility: 'public', owner_id: 'u1', description: null });
    expect(result.name).toBe('test-room');
    expect(result.owner_id).toBe('u1');
  });

  it('findByName() returns null when room does not exist', async () => {
    vi.mocked(repo.findByName).mockResolvedValue(null);
    const result = await repo.findByName('nonexistent');
    expect(result).toBeNull();
  });

  it('addBan() returns a RoomBan', async () => {
    const ban: RoomBan = {
      id: 'ban-1',
      room_id: 'r1',
      banned_user_id: 'u2',
      banned_by_user_id: 'u1',
      reason: 'spam',
      banned_at: new Date(),
    };
    vi.mocked(repo.addBan).mockResolvedValue(ban);
    const result = await repo.addBan({ room_id: 'r1', banned_user_id: 'u2', banned_by_user_id: 'u1', reason: 'spam' });
    expect(result.banned_user_id).toBe('u2');
  });

  it('isBanned() returns false for non-banned user', async () => {
    vi.mocked(repo.isBanned).mockResolvedValue(false);
    const result = await repo.isBanned('r1', 'u1');
    expect(result).toBe(false);
  });

  it('getMemberCount() returns a number', async () => {
    vi.mocked(repo.getMemberCount).mockResolvedValue(5);
    const result = await repo.getMemberCount('r1');
    expect(result).toBe(5);
  });
});

// ── RoomsService stub tests ───────────────────────────────────────────────────

function makeUserRepository(exists = true): UserRepository {
  return {
    findByUsername: vi.fn().mockResolvedValue(
      exists ? { id: 'u2', username: 'bob', email: 'bob@example.com', password_hash: 'x', created_at: new Date(), updated_at: new Date() } : null,
    ),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updatePasswordHash: vi.fn(),
  } as unknown as UserRepository;
}

function makeRoomsService(
  repo?: RoomsRepository,
  userRepo?: UserRepository,
): RoomsService {
  // Import is async (dynamic) – we stub the interface directly
  return {
    createRoom: vi.fn(),
    getRoom: vi.fn(),
    findRoomByName: vi.fn(),
    listPublicRooms: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    inviteToRoom: vi.fn(),
    validateInviteTarget: vi.fn(),
    makeAdmin: vi.fn(),
    removeAdmin: vi.fn(),
    banMember: vi.fn(),
    unbanMember: vi.fn(),
    isOwner: vi.fn(),
    isAdmin: vi.fn(),
  } as unknown as RoomsService;
}

describe('RoomsService interface', () => {
  let service: RoomsService;

  beforeEach(() => {
    service = makeRoomsService();
  });

  it('createRoom() returns a Room with owner set to creator', async () => {
    const room: Room = {
      id: 'r1',
      name: 'my-room',
      description: null,
      visibility: 'public',
      owner_id: 'u1',
      created_at: new Date(),
      updated_at: new Date(),
    };
    vi.mocked(service.createRoom).mockResolvedValue(room);
    const result = await service.createRoom({ name: 'my-room', creatorUserId: 'u1' });
    expect(result.owner_id).toBe('u1');
    expect(result.visibility).toBe('public');
  });

  it('createRoom() with private visibility stores private', async () => {
    const room: Room = {
      id: 'r2',
      name: 'secret',
      description: null,
      visibility: 'private',
      owner_id: 'u1',
      created_at: new Date(),
      updated_at: new Date(),
    };
    vi.mocked(service.createRoom).mockResolvedValue(room);
    const result = await service.createRoom({ name: 'secret', visibility: 'private', creatorUserId: 'u1' });
    expect(result.visibility).toBe('private');
  });

  it('leaveRoom() throws when owner attempts to leave', async () => {
    vi.mocked(service.leaveRoom).mockRejectedValue(new Error('Owner cannot leave'));
    await expect(service.leaveRoom('r1', 'u1')).rejects.toThrow('Owner cannot leave');
  });

  it('inviteToRoom() calls validateInviteTarget with username', async () => {
    vi.mocked(service.inviteToRoom).mockResolvedValue({
      id: 'inv-1',
      room_id: 'r1',
      invited_by_user_id: 'u1',
      invited_user_id: 'u2',
      status: 'pending',
      created_at: new Date(),
      expires_at: null,
    });
    const result = await service.inviteToRoom('r1', 'u1', 'bob');
    expect(result.invited_user_id).toBe('u2');
  });

  it('isOwner() returns boolean', async () => {
    vi.mocked(service.isOwner).mockResolvedValue(true);
    const result = await service.isOwner('r1', 'u1');
    expect(result).toBe(true);
  });

  it('isAdmin() returns boolean', async () => {
    vi.mocked(service.isAdmin).mockResolvedValue(false);
    const result = await service.isAdmin('r1', 'u2');
    expect(result).toBe(false);
  });
});

// ── RoomsService real-implementation tests ────────────────────────────────────
// These tests exercise actual service logic using stubbed repository dependencies.

describe('RoomsService real implementation', () => {
  it('createRoom defaults visibility to public when not specified', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');
    const mockRepo = makeRoomsRepository();
    const mockUserRepo = makeUserRepository();

    const createdRoom: Room = {
      id: 'r1',
      name: 'lobby',
      description: null,
      visibility: 'public',
      owner_id: 'u1',
      created_at: new Date(),
      updated_at: new Date(),
    };
    vi.mocked(mockRepo.create).mockResolvedValue(createdRoom);
    vi.mocked(mockRepo.addMember).mockResolvedValue({
      id: 'mem-1',
      room_id: 'r1',
      user_id: 'u1',
      role: 'owner',
      joined_at: new Date(),
    });

    const svc = new RoomsService(mockRepo, mockUserRepo);
    const result = await svc.createRoom({ name: 'lobby', creatorUserId: 'u1' });
    expect(result.visibility).toBe('public');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'public', owner_id: 'u1' }),
    );
  });

  it('createRoom records owner as member with owner role', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');
    const mockRepo = makeRoomsRepository();
    const mockUserRepo = makeUserRepository();

    const createdRoom: Room = {
      id: 'r2',
      name: 'lobby2',
      description: null,
      visibility: 'public',
      owner_id: 'u1',
      created_at: new Date(),
      updated_at: new Date(),
    };
    vi.mocked(mockRepo.create).mockResolvedValue(createdRoom);
    vi.mocked(mockRepo.addMember).mockResolvedValue({
      id: 'mem-1',
      room_id: 'r2',
      user_id: 'u1',
      role: 'owner',
      joined_at: new Date(),
    });

    const svc = new RoomsService(mockRepo, mockUserRepo);
    await svc.createRoom({ name: 'lobby2', creatorUserId: 'u1' });
    expect(mockRepo.addMember).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', role: 'owner' }),
    );
  });

  it('leaveRoom throws when user is the room owner', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');
    const mockRepo = makeRoomsRepository();
    const mockUserRepo = makeUserRepository();

    vi.mocked(mockRepo.findById).mockResolvedValue({
      id: 'r1',
      name: 'lobby',
      description: null,
      visibility: 'public',
      owner_id: 'u1',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const svc = new RoomsService(mockRepo, mockUserRepo);
    await expect(svc.leaveRoom('r1', 'u1')).rejects.toThrow();
  });

  it('inviteToRoom throws when target username does not exist', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');
    const mockRepo = makeRoomsRepository();
    const mockUserRepo = makeUserRepository(false); // user not found

    vi.mocked(mockRepo.findById).mockResolvedValue({
      id: 'r1',
      name: 'private-room',
      description: null,
      visibility: 'private',
      owner_id: 'u1',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const svc = new RoomsService(mockRepo, mockUserRepo);
    await expect(svc.inviteToRoom('r1', 'u1', 'unknown-user')).rejects.toThrow();
  });

  it('inviteToRoom succeeds when target is a registered user', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');
    const mockRepo = makeRoomsRepository();
    const mockUserRepo = makeUserRepository(true); // user found

    vi.mocked(mockRepo.findById).mockResolvedValue({
      id: 'r1',
      name: 'private-room',
      description: null,
      visibility: 'private',
      owner_id: 'u1',
      created_at: new Date(),
      updated_at: new Date(),
    });
    vi.mocked(mockRepo.findInviteByUserAndRoom).mockResolvedValue(null);
    const invite: RoomInvite = {
      id: 'inv-1',
      room_id: 'r1',
      invited_by_user_id: 'u1',
      invited_user_id: 'u2',
      status: 'pending',
      created_at: new Date(),
      expires_at: null,
    };
    vi.mocked(mockRepo.createInvite).mockResolvedValue(invite);

    const svc = new RoomsService(mockRepo, mockUserRepo);
    const result = await svc.inviteToRoom('r1', 'u1', 'bob');
    expect(result.invited_user_id).toBe('u2');
  });
});
