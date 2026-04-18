/**
 * rooms-catalog.spec.ts — TDD tests for Phase 4-02 catalog, create, join, and leave flows.
 *
 * Covers:
 *  Task 1: Create-room and public catalog/search surface
 *  Task 2: Join and leave flows with owner restriction
 *
 * Uses plain object stubs and imports of real service logic.
 * Does NOT require a live database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { RoomsRepository } from '../../rooms/rooms.repository.js';
import type { UserRepository } from '../../auth/user.repository.js';
import type { Room, RoomMembership, RoomCatalogRow } from '../../rooms/rooms.types.js';

// ── shared stubs ──────────────────────────────────────────────────────────────

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    name: 'general',
    description: 'The main room',
    visibility: 'public',
    owner_id: 'user-1',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeCatalogRow(overrides: Partial<RoomCatalogRow> = {}): RoomCatalogRow {
  return {
    id: 'room-1',
    name: 'general',
    description: 'The main room',
    visibility: 'public',
    owner_id: 'user-1',
    member_count: 3,
    created_at: new Date('2026-01-01'),
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

// ── Task 1: Public catalog and create-room ─────────────────────────────────────

describe('RoomsService — catalog and create (Task 1)', () => {
  let repo: RoomsRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    repo = makeRepo();
    userRepo = makeUserRepo();
  });

  it('listPublicRooms returns only public rooms', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    const publicRow = makeCatalogRow({ visibility: 'public' });
    vi.mocked(repo.listPublic).mockResolvedValue([publicRow]);

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.listPublicRooms();

    expect(result).toHaveLength(1);
    expect(result[0].visibility).toBe('public');
    // Repository query already filters; ensure service passes through
    expect(repo.listPublic).toHaveBeenCalledWith(undefined);
  });

  it('listPublicRooms with search passes query to repository', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');
    vi.mocked(repo.listPublic).mockResolvedValue([]);

    const svc = new RoomsService(repo, userRepo);
    await svc.listPublicRooms('general');

    expect(repo.listPublic).toHaveBeenCalledWith('general');
  });

  it('catalog rows include name, description, and member_count fields', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    const row = makeCatalogRow({ name: 'general', description: 'Main room', member_count: 7 });
    vi.mocked(repo.listPublic).mockResolvedValue([row]);

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.listPublicRooms();

    expect(result[0]).toHaveProperty('name', 'general');
    expect(result[0]).toHaveProperty('description', 'Main room');
    expect(result[0]).toHaveProperty('member_count', 7);
  });

  it('private rooms are NOT returned from listPublicRooms (repository filter)', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    // Repo correctly returns only public rows — confirm service does not re-add private ones
    vi.mocked(repo.listPublic).mockResolvedValue([]);

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.listPublicRooms();

    expect(result).toHaveLength(0);
  });

  it('createRoom requires name and sets visibility to public by default', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    const room = makeRoom({ name: 'lobby', visibility: 'public' });
    vi.mocked(repo.findByName).mockResolvedValue(null); // no conflict
    vi.mocked(repo.create).mockResolvedValue(room);
    vi.mocked(repo.addMember).mockResolvedValue({
      id: 'mem-1', room_id: 'room-1', user_id: 'user-1', role: 'owner', joined_at: new Date(),
    });

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.createRoom({ name: 'lobby', creatorUserId: 'user-1' });

    expect(result.visibility).toBe('public');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'lobby', visibility: 'public' }),
    );
  });

  it('createRoom with explicit private visibility stores private', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    const room = makeRoom({ name: 'secret', visibility: 'private' });
    vi.mocked(repo.findByName).mockResolvedValue(null);
    vi.mocked(repo.create).mockResolvedValue(room);
    vi.mocked(repo.addMember).mockResolvedValue({
      id: 'mem-1', room_id: 'room-1', user_id: 'user-1', role: 'owner', joined_at: new Date(),
    });

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.createRoom({ name: 'secret', visibility: 'private', creatorUserId: 'user-1' });

    expect(result.visibility).toBe('private');
  });

  it('createRoom throws ConflictException when name is already taken', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findByName).mockResolvedValue(makeRoom({ name: 'general' }));

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.createRoom({ name: 'general', creatorUserId: 'user-1' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('createRoom bootstraps creator as owner membership', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    const room = makeRoom();
    vi.mocked(repo.findByName).mockResolvedValue(null);
    vi.mocked(repo.create).mockResolvedValue(room);
    vi.mocked(repo.addMember).mockResolvedValue({
      id: 'mem-1', room_id: 'room-1', user_id: 'user-1', role: 'owner', joined_at: new Date(),
    });

    const svc = new RoomsService(repo, userRepo);
    await svc.createRoom({ name: 'general', creatorUserId: 'user-1' });

    expect(repo.addMember).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', role: 'owner' }),
    );
  });
});

// ── Task 2: Join and leave flows ───────────────────────────────────────────────

describe('RoomsService — join (Task 2)', () => {
  let repo: RoomsRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    repo = makeRepo();
    userRepo = makeUserRepo();
  });

  it('joinRoom succeeds for authenticated non-banned user on a public room', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ visibility: 'public' }));
    vi.mocked(repo.isBanned).mockResolvedValue(false);
    vi.mocked(repo.getMembership).mockResolvedValue(null); // not already a member
    const membership: RoomMembership = {
      id: 'mem-2', room_id: 'room-1', user_id: 'user-2', role: 'member', joined_at: new Date(),
    };
    vi.mocked(repo.addMember).mockResolvedValue(membership);

    const svc = new RoomsService(repo, userRepo);
    const result = await svc.joinRoom('room-1', 'user-2');

    expect(result.user_id).toBe('user-2');
    expect(result.role).toBe('member');
  });

  it('joinRoom throws BadRequestException when user is banned', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ visibility: 'public' }));
    vi.mocked(repo.isBanned).mockResolvedValue(true);

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.joinRoom('room-1', 'user-2')).rejects.toThrow(BadRequestException);
  });

  it('joinRoom throws BadRequestException when room is private', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ visibility: 'private' }));

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.joinRoom('room-1', 'user-2')).rejects.toThrow(BadRequestException);
  });

  it('joinRoom throws ConflictException when already a member', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ visibility: 'public' }));
    vi.mocked(repo.isBanned).mockResolvedValue(false);
    vi.mocked(repo.getMembership).mockResolvedValue({
      id: 'mem-1', room_id: 'room-1', user_id: 'user-2', role: 'member', joined_at: new Date(),
    });

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.joinRoom('room-1', 'user-2')).rejects.toThrow(ConflictException);
  });

  it('joinRoom throws NotFoundException for unknown room', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(null);

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.joinRoom('nonexistent', 'user-2')).rejects.toThrow(NotFoundException);
  });
});

describe('RoomsService — leave (Task 2)', () => {
  let repo: RoomsRepository;
  let userRepo: UserRepository;

  beforeEach(() => {
    repo = makeRepo();
    userRepo = makeUserRepo();
  });

  it('leaveRoom removes membership for an ordinary member', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ owner_id: 'user-1' }));
    vi.mocked(repo.removeMember).mockResolvedValue(true);

    const svc = new RoomsService(repo, userRepo);
    await svc.leaveRoom('room-1', 'user-2'); // user-2 is not the owner

    expect(repo.removeMember).toHaveBeenCalledWith('room-1', 'user-2');
  });

  it('leaveRoom throws BadRequestException when owner attempts to leave', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ owner_id: 'user-1' }));

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.leaveRoom('room-1', 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('owner leave error message mentions delete', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ owner_id: 'user-1' }));

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.leaveRoom('room-1', 'user-1')).rejects.toThrow(/delete/i);
  });

  it('leaveRoom throws NotFoundException when user is not a member', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ owner_id: 'user-1' }));
    vi.mocked(repo.removeMember).mockResolvedValue(false); // no row deleted

    const svc = new RoomsService(repo, userRepo);
    await expect(svc.leaveRoom('room-1', 'user-2')).rejects.toThrow(NotFoundException);
  });

  it('leaveRoom does not delete the room when ordinary member leaves', async () => {
    const { RoomsService } = await import('../../rooms/rooms.service.js');

    vi.mocked(repo.findById).mockResolvedValue(makeRoom({ owner_id: 'user-1' }));
    vi.mocked(repo.removeMember).mockResolvedValue(true);

    const svc = new RoomsService(repo, userRepo);
    await svc.leaveRoom('room-1', 'user-2');

    // Room was not deleted — no delete-room style call
    expect(repo.create).not.toHaveBeenCalled();
  });
});

// ── Controller contract tests (RoomsController shape validation) ───────────────

describe('RoomsController — endpoint contract (Task 1 + 2)', () => {
  it('controller module can be imported', async () => {
    const mod = await import('../../rooms/rooms.controller.js');
    expect(mod.RoomsController).toBeDefined();
  });

  it('RoomsController has createRoom method', async () => {
    const { RoomsController } = await import('../../rooms/rooms.controller.js');
    expect(typeof RoomsController.prototype.createRoom).toBe('function');
  });

  it('RoomsController has catalog method', async () => {
    const { RoomsController } = await import('../../rooms/rooms.controller.js');
    expect(typeof RoomsController.prototype.catalog).toBe('function');
  });

  it('RoomsController has join method', async () => {
    const { RoomsController } = await import('../../rooms/rooms.controller.js');
    expect(typeof RoomsController.prototype.join).toBe('function');
  });

  it('RoomsController has leave method', async () => {
    const { RoomsController } = await import('../../rooms/rooms.controller.js');
    expect(typeof RoomsController.prototype.leave).toBe('function');
  });
});
