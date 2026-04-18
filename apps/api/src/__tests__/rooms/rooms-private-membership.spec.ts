/**
 * rooms-private-membership.spec.ts — gap-closure tests for recipient-side
 * private invite actions and authenticated private-room listing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { RoomsRepository } from '../../rooms/rooms.repository.js';
import type { UserRepository } from '../../auth/user.repository.js';
import type {
  Room,
  RoomMembership,
  RoomInvite,
  PrivateRoomMembershipRow,
  PendingRoomInviteRow,
} from '../../rooms/rooms.types.js';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    name: 'secret',
    description: 'Private room',
    visibility: 'private',
    owner_id: 'owner-1',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeMembership(overrides: Partial<RoomMembership> = {}): RoomMembership {
  return {
    id: 'membership-1',
    room_id: 'room-1',
    user_id: 'user-2',
    role: 'member',
    joined_at: new Date('2026-01-02'),
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
    created_at: new Date('2026-01-02'),
    expires_at: null,
    ...overrides,
  };
}

function makePrivateMembershipRow(
  overrides: Partial<PrivateRoomMembershipRow> = {},
): PrivateRoomMembershipRow {
  return {
    id: 'room-1',
    name: 'secret',
    description: 'Private room',
    visibility: 'private',
    owner_id: 'owner-1',
    member_count: 2,
    created_at: new Date('2026-01-01'),
    membership_id: 'membership-1',
    membership_user_id: 'user-2',
    membership_role: 'member',
    membership_joined_at: new Date('2026-01-02'),
    ...overrides,
  };
}

function makePendingInviteRow(
  overrides: Partial<PendingRoomInviteRow> = {},
): PendingRoomInviteRow {
  return {
    id: 'invite-1',
    room_id: 'room-1',
    invited_by_user_id: 'owner-1',
    invited_user_id: 'user-2',
    status: 'pending',
    created_at: new Date('2026-01-02'),
    expires_at: null,
    room_name: 'secret',
    room_description: 'Private room',
    room_visibility: 'private',
    room_owner_id: 'owner-1',
    room_member_count: 2,
    inviter_username: 'owner',
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
    listPrivateRoomsByUser: vi.fn(),
    addAdmin: vi.fn(),
    removeAdmin: vi.fn(),
    isAdmin: vi.fn(),
    createInvite: vi.fn(),
    findInviteByUserAndRoom: vi.fn(),
    listPendingInvitesByUser: vi.fn(),
    findInviteForRecipient: vi.fn(),
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

describe('RoomsService — private-room membership listing', () => {
  let repo: RoomsRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    repo = makeRepo();
    userRepo = makeUserRepo();
  });

  it('getMyPrivateRooms returns private memberships with room details and role', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.listPrivateRoomsByUser).mockResolvedValue([
      makePrivateMembershipRow({ name: 'staff', membership_role: 'admin' }),
    ]);

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.getMyPrivateRooms('user-2');

    expect(repo.listPrivateRoomsByUser).toHaveBeenCalledWith('user-2');
    expect(result).toHaveLength(1);
    expect(result[0]?.room.name).toBe('staff');
    expect(result[0]?.membership.role).toBe('admin');
  });

  it('getPendingPrivateInvites returns only pending invites for the recipient', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.listPendingInvitesByUser).mockResolvedValue([
      makePendingInviteRow({ inviter_username: 'alice' }),
    ]);

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.getPendingPrivateInvites('user-2');

    expect(repo.listPendingInvitesByUser).toHaveBeenCalledWith('user-2');
    expect(result).toHaveLength(1);
    expect(result[0]?.invite.status).toBe('pending');
    expect(result[0]?.inviter_username).toBe('alice');
  });
});

describe('RoomsService — private invite acceptance and decline', () => {
  let repo: RoomsRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    repo = makeRepo();
    userRepo = makeUserRepo();
  });

  it('acceptInvite accepts only a pending invite owned by the recipient and adds membership once', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ id: 'room-1' }));
    vi.mocked(repo.findInviteForRecipient).mockResolvedValue(makeInvite());
    vi.mocked(repo.isBanned).mockResolvedValue(false);
    vi.mocked(repo.getMembership).mockResolvedValue(null);
    vi.mocked(repo.addMember).mockResolvedValue(makeMembership());
    vi.mocked(repo.acceptInvite).mockResolvedValue(true);

    const svc = new RoomsService(repo, userRepo);
    const membership = await svc.acceptInvite('room-1', 'invite-1', 'user-2');

    expect(repo.findInviteForRecipient).toHaveBeenCalledWith('room-1', 'invite-1', 'user-2');
    expect(repo.addMember).toHaveBeenCalledWith({
      room_id: 'room-1',
      user_id: 'user-2',
      role: 'member',
    });
    expect(repo.acceptInvite).toHaveBeenCalledWith('invite-1');
    expect(membership.user_id).toBe('user-2');
  });

  it('acceptInvite rejects an invite that belongs to another user or room', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ id: 'room-1' }));
    vi.mocked(repo.findInviteForRecipient).mockResolvedValue(null);

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.acceptInvite('room-1', 'invite-1', 'user-2')).rejects.toThrow(NotFoundException);
  });

  it('acceptInvite rejects non-pending invites', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ id: 'room-1' }));
    vi.mocked(repo.findInviteForRecipient).mockResolvedValue(makeInvite({ status: 'accepted' }));

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.acceptInvite('room-1', 'invite-1', 'user-2')).rejects.toThrow(BadRequestException);
  });

  it('acceptInvite blocks duplicate acceptance when membership already exists', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ id: 'room-1' }));
    vi.mocked(repo.findInviteForRecipient).mockResolvedValue(makeInvite());
    vi.mocked(repo.isBanned).mockResolvedValue(false);
    vi.mocked(repo.getMembership).mockResolvedValue(makeMembership());

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.acceptInvite('room-1', 'invite-1', 'user-2')).rejects.toThrow(ConflictException);
    expect(repo.addMember).not.toHaveBeenCalled();
    expect(repo.acceptInvite).not.toHaveBeenCalled();
  });

  it('declineInvite declines a valid pending invite without creating membership', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findInviteForRecipient).mockResolvedValue(makeInvite());
    vi.mocked(repo.declineInvite).mockResolvedValue(true);

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.declineInvite('room-1', 'invite-1', 'user-2')).resolves.toBeUndefined();

    expect(repo.declineInvite).toHaveBeenCalledWith('invite-1');
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it('declineInvite rejects non-owned or non-pending invites', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findInviteForRecipient).mockResolvedValue(makeInvite({ status: 'declined' }));

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.declineInvite('room-1', 'invite-1', 'user-2')).rejects.toThrow(BadRequestException);
  });
});
