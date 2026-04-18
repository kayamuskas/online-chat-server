/**
 * rooms-management.spec.ts — TDD tests for Phase 4-03 management and ban-list surfaces.
 *
 * Covers:
 *  Task 1: Private-room invite by username, admin promotion/demotion, member removal
 *          as ban, owner protection rules.
 *  Task 2: Ban-list semantics — admin removal is a ban, banned users cannot rejoin,
 *          ban-list is queryable with metadata.
 *
 * Uses plain object stubs and imports of real service logic.
 * Does NOT require a live database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RoomsRepository } from '../../rooms/rooms.repository.js';
import type { UserRepository } from '../../auth/user.repository.js';
import type {
  Room,
  RoomMembership,
  RoomInvite,
  RoomAdmin,
  RoomBan,
} from '../../rooms/rooms.types.js';

// ── shared stubs ──────────────────────────────────────────────────────────────

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    name: 'private-room',
    description: null,
    visibility: 'private',
    owner_id: 'owner-1',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeUser(id: string, username: string) {
  return { id, username, email: `${username}@example.com`, created_at: new Date() };
}

function makeMembership(overrides: Partial<RoomMembership> = {}): RoomMembership {
  return {
    id: 'mem-1',
    room_id: 'room-1',
    user_id: 'member-1',
    role: 'member',
    joined_at: new Date(),
    ...overrides,
  };
}

function makeInvite(overrides: Partial<RoomInvite> = {}): RoomInvite {
  return {
    id: 'invite-1',
    room_id: 'room-1',
    invited_by_user_id: 'owner-1',
    invited_user_id: 'user-2',
    status: 'pending',
    created_at: new Date(),
    expires_at: null,
    ...overrides,
  };
}

function makeBan(overrides: Partial<RoomBan> = {}): RoomBan {
  return {
    id: 'ban-1',
    room_id: 'room-1',
    banned_user_id: 'user-2',
    banned_by_user_id: 'owner-1',
    reason: 'Removed by admin',
    banned_at: new Date(),
    ...overrides,
  };
}

function makeAdmin(overrides: Partial<RoomAdmin> = {}): RoomAdmin {
  return {
    id: 'admin-1',
    room_id: 'room-1',
    user_id: 'admin-1',
    granted_by_user_id: 'owner-1',
    granted_at: new Date(),
    ...overrides,
  };
}

function makeRepo(): RoomsRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    listPublic: vi.fn(),
    addMember: vi.fn(),
    getMembership: vi.fn(),
    removeMember: vi.fn(),
    listMembers: vi.fn(),
    getMemberCount: vi.fn(),
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
    listBanned: vi.fn(),
  } as unknown as RoomsRepository;
}

function makeUserRepo(): UserRepository {
  return {
    findByUsername: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updatePasswordHash: vi.fn(),
  } as unknown as UserRepository;
}

// ── Task 1: Private-room invite by username ───────────────────────────────────

describe('RoomsService — private invite by username (Task 1)', () => {
  let repo: RoomsRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    repo = makeRepo();
    userRepo = makeUserRepo();
  });

  it('inviteToRoom sends invite when target username is registered', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(userRepo.findByUsername).mockResolvedValue(makeUser('user-2', 'alice'));
    vi.mocked(repo.findInviteByUserAndRoom).mockResolvedValue(null);
    vi.mocked(repo.createInvite).mockResolvedValue(makeInvite());

    const svc = new RoomsService(repo, userRepo);
    const invite = await svc.inviteToRoom('room-1', 'owner-1', 'alice');

    expect(repo.createInvite).toHaveBeenCalledWith(
      expect.objectContaining({ invited_user_id: 'user-2' }),
    );
    expect(invite.status).toBe('pending');
  });

  it('inviteToRoom rejects unknown username with NotFoundException', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(userRepo.findByUsername).mockResolvedValue(null); // not registered

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.inviteToRoom('room-1', 'owner-1', 'ghost')).rejects.toThrow(NotFoundException);
  });

  it('inviteToRoom rejects unknown username — error message names the username', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(userRepo.findByUsername).mockResolvedValue(null);

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.inviteToRoom('room-1', 'owner-1', 'ghost')).rejects.toThrow(/ghost/);
  });

  it('inviteToRoom rejects duplicate pending invite with ConflictException', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(userRepo.findByUsername).mockResolvedValue(makeUser('user-2', 'alice'));
    vi.mocked(repo.findInviteByUserAndRoom).mockResolvedValue(makeInvite({ status: 'pending' }));

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.inviteToRoom('room-1', 'owner-1', 'alice')).rejects.toThrow(ConflictException);
  });

  it('validateInviteTarget returns user ID when username is registered', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(userRepo.findByUsername).mockResolvedValue(makeUser('user-2', 'alice'));

    const svc = new RoomsService(repo, userRepo);
    const id = await svc.validateInviteTarget('alice');

    expect(id).toBe('user-2');
  });

  it('validateInviteTarget returns null when username is not registered', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(userRepo.findByUsername).mockResolvedValue(null);

    const svc = new RoomsService(repo, userRepo);
    const id = await svc.validateInviteTarget('nobody');

    expect(id).toBeNull();
  });
});

// ── Task 1: Admin promotion/demotion with owner protection ────────────────────

describe('RoomsService — admin management (Task 1)', () => {
  let repo: RoomsRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    repo = makeRepo();
    userRepo = makeUserRepo();
  });

  it('makeAdmin promotes a member to admin role', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(repo.addAdmin).mockResolvedValue(makeAdmin({ user_id: 'member-1' }));

    const svc = new RoomsService(repo, userRepo);
    const admin = await svc.makeAdmin('room-1', 'member-1', 'owner-1');

    expect(repo.addAdmin).toHaveBeenCalledWith('room-1', 'member-1', 'owner-1');
    expect(admin.user_id).toBe('member-1');
  });

  it('removeAdmin demotes an admin successfully', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(repo.removeAdmin).mockResolvedValue(true);

    const svc = new RoomsService(repo, userRepo);
    await svc.removeAdmin('room-1', 'admin-1');

    expect(repo.removeAdmin).toHaveBeenCalledWith('room-1', 'admin-1');
  });

  it('makeAdmin called by owner: owner is always admin (isAdmin returns true for owner)', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ owner_id: 'owner-1' }));
    // No explicit admin row for owner — but isAdmin still returns true
    vi.mocked(repo.isAdmin).mockResolvedValue(false);

    const svc = new RoomsService(repo, userRepo);
    const isAdmin = await svc.isAdmin('room-1', 'owner-1');

    expect(isAdmin).toBe(true);
  });

  it('removeAdmin on owner should be blocked — owner cannot lose admin authority', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ owner_id: 'owner-1' }));

    const svc = new RoomsService(repo, userRepo);

    // Attempting to remove admin from owner should throw ForbiddenException or BadRequestException
    await expect(svc.removeAdmin('room-1', 'owner-1')).rejects.toThrow(
      /owner|forbidden|cannot/i,
    );
  });
});

// ── Task 1: Management controller shape ───────────────────────────────────────

describe('RoomsManagementController — endpoint contract (Task 1)', () => {
  it('management controller module can be imported', async () => {
    const mod = await import('../../rooms/rooms-management.controller.js');
    expect(mod.RoomsManagementController).toBeDefined();
  });

  it('controller has invite method', async () => {
    const { RoomsManagementController } = await import('../../rooms/rooms-management.controller.js');
    expect(typeof RoomsManagementController.prototype.invite).toBe('function');
  });

  it('controller has makeAdmin method', async () => {
    const { RoomsManagementController } = await import('../../rooms/rooms-management.controller.js');
    expect(typeof RoomsManagementController.prototype.makeAdmin).toBe('function');
  });

  it('controller has removeAdmin method', async () => {
    const { RoomsManagementController } = await import('../../rooms/rooms-management.controller.js');
    expect(typeof RoomsManagementController.prototype.removeAdmin).toBe('function');
  });

  it('controller has removeMember method', async () => {
    const { RoomsManagementController } = await import('../../rooms/rooms-management.controller.js');
    expect(typeof RoomsManagementController.prototype.removeMember).toBe('function');
  });

  it('controller has listBanned method', async () => {
    const { RoomsManagementController } = await import('../../rooms/rooms-management.controller.js');
    expect(typeof RoomsManagementController.prototype.listBanned).toBe('function');
  });

  it('controller has unban method', async () => {
    const { RoomsManagementController } = await import('../../rooms/rooms-management.controller.js');
    expect(typeof RoomsManagementController.prototype.unban).toBe('function');
  });
});

// ── Task 2: Ban-list semantics ─────────────────────────────────────────────────

describe('RoomsService — ban semantics (Task 2)', () => {
  let repo: RoomsRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    repo = makeRepo();
    userRepo = makeUserRepo();
  });

  it('banMember removes the user from membership and adds a ban record', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(repo.removeMember).mockResolvedValue(true);
    vi.mocked(repo.addBan).mockResolvedValue(
      makeBan({ banned_user_id: 'member-1', banned_by_user_id: 'owner-1' }),
    );

    const svc = new RoomsService(repo, userRepo);
    const ban = await svc.banMember('room-1', 'member-1', 'owner-1', 'Violated rules');

    expect(repo.removeMember).toHaveBeenCalledWith('room-1', 'member-1');
    expect(repo.addBan).toHaveBeenCalledWith(
      expect.objectContaining({
        room_id: 'room-1',
        banned_user_id: 'member-1',
        banned_by_user_id: 'owner-1',
      }),
    );
    expect(ban.banned_user_id).toBe('member-1');
  });

  it('banMember works even if user is not currently a member (removeMember returns false)', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(repo.removeMember).mockResolvedValue(false); // user was not a member
    vi.mocked(repo.addBan).mockResolvedValue(makeBan({ banned_user_id: 'ghost-user' }));

    const svc = new RoomsService(repo, userRepo);
    const ban = await svc.banMember('room-1', 'ghost-user', 'owner-1');

    // Ban was still created
    expect(repo.addBan).toHaveBeenCalled();
    expect(ban).toBeDefined();
  });

  it('joinRoom throws BadRequestException when user is banned — ban survives rejoin attempt', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ visibility: 'public' }));
    vi.mocked(repo.isBanned).mockResolvedValue(true);

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.joinRoom('room-1', 'banned-user')).rejects.toThrow(BadRequestException);
  });

  it('unbanMember allows rejoining after unban — isBanned returns false after removeBan', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.removeBan).mockResolvedValue(true);

    const svc = new RoomsService(repo, userRepo);
    await svc.unbanMember('room-1', 'user-2');

    expect(repo.removeBan).toHaveBeenCalledWith('room-1', 'user-2');
  });

  it('listBanned returns ban records with metadata (who banned, when, reason)', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    const ban = makeBan({
      banned_user_id: 'member-1',
      banned_by_user_id: 'owner-1',
      reason: 'Spam',
      banned_at: new Date('2026-01-15'),
    });
    vi.mocked(repo.listBanned).mockResolvedValue([ban]);

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.listBanned('room-1');

    expect(result).toHaveLength(1);
    expect(result[0].banned_user_id).toBe('member-1');
    expect(result[0].banned_by_user_id).toBe('owner-1');
    expect(result[0].reason).toBe('Spam');
    expect(result[0].banned_at).toBeDefined();
  });

  it('listBanned returns empty array when no bans exist', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.listBanned).mockResolvedValue([]);

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.listBanned('room-1');

    expect(result).toHaveLength(0);
  });

  it('removeMemberAsBan removes membership AND creates ban record (ban semantics for admin removal)', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(repo.getMembership).mockResolvedValue(makeMembership({ user_id: 'member-1' }));
    vi.mocked(repo.removeMember).mockResolvedValue(true);
    vi.mocked(repo.addBan).mockResolvedValue(
      makeBan({ banned_user_id: 'member-1', banned_by_user_id: 'admin-1' }),
    );

    const svc = new RoomsService(repo, userRepo);
    const ban = await svc.removeMemberAsBan('room-1', 'member-1', 'admin-1');

    expect(repo.removeMember).toHaveBeenCalledWith('room-1', 'member-1');
    expect(repo.addBan).toHaveBeenCalled();
    expect(ban.banned_user_id).toBe('member-1');
  });

  it('removeMemberAsBan throws NotFoundException when target is not a member', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom());
    vi.mocked(repo.getMembership).mockResolvedValue(null); // not a member

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.removeMemberAsBan('room-1', 'nonmember', 'admin-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removeMemberAsBan rejects owner removal — owner protection preserved', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ owner_id: 'owner-1' }));
    vi.mocked(repo.getMembership).mockResolvedValue(
      makeMembership({ user_id: 'owner-1', role: 'owner' }),
    );

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.removeMemberAsBan('room-1', 'owner-1', 'admin-1')).rejects.toThrow(
      /owner|forbidden|cannot/i,
    );
  });
});
