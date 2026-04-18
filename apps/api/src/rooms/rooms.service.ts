/**
 * RoomsService — Phase 4 room domain policy layer.
 *
 * Owns all domain invariants before HTTP endpoints exist:
 * - Room creation requires only `name`; visibility defaults to 'public'; description optional.
 * - Room creator is durably recorded as owner (membership row with role='owner').
 * - Owner cannot leave their own room; they must delete the room instead.
 * - Invite targets must be already registered users (validated via UserRepository).
 * - Admin/ban/member authority helpers for later plan consumption.
 *
 * Controllers must stay thin; all actor-vs-target policy checks live here.
 */

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { RoomsRepository } from './rooms.repository.js';
import { UserRepository } from '../auth/user.repository.js';
import type {
  Room,
  RoomMembership,
  RoomInvite,
  RoomAdmin,
  RoomBan,
  RoomCatalogRow,
  CreateRoomServiceInput,
} from './rooms.types.js';

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomsRepo: RoomsRepository,
    private readonly userRepo: UserRepository,
  ) {}

  // ── Room creation ──────────────────────────────────────────────────────────

  /**
   * Create a room.
   *
   * - `name` is required and must be globally unique.
   * - `visibility` defaults to 'public' when not specified.
   * - `description` is optional.
   * - Creator is bootstrapped as owner (membership row with role='owner').
   */
  async createRoom(input: CreateRoomServiceInput): Promise<Room> {
    const visibility = input.visibility ?? 'public';

    // Enforce global name uniqueness at the service layer (DB UNIQUE constraint is the final guard)
    const existing = await this.roomsRepo.findByName(input.name);
    if (existing) {
      throw new ConflictException(`Room name '${input.name}' is already taken`);
    }

    const room = await this.roomsRepo.create({
      name: input.name,
      description: input.description ?? null,
      visibility,
      owner_id: input.creatorUserId,
    });

    // Bootstrap owner as first member with owner role
    await this.roomsRepo.addMember({
      room_id: room.id,
      user_id: input.creatorUserId,
      role: 'owner',
    });

    return room;
  }

  // ── Room lookup ────────────────────────────────────────────────────────────

  /** Get a room by ID. Throws NotFoundException if not found. */
  async getRoom(roomId: string): Promise<Room> {
    const room = await this.roomsRepo.findById(roomId);
    if (!room) {
      throw new NotFoundException(`Room '${roomId}' not found`);
    }
    return room;
  }

  /** Find a room by name. Returns null if not found. */
  async findRoomByName(name: string): Promise<Room | null> {
    return this.roomsRepo.findByName(name);
  }

  /** List public rooms, optionally searching by name or description. */
  async listPublicRooms(search?: string): Promise<RoomCatalogRow[]> {
    return this.roomsRepo.listPublic(search);
  }

  // ── Membership ─────────────────────────────────────────────────────────────

  /**
   * Join a public room.
   *
   * Checks:
   * - Room must exist and be public.
   * - User must not be banned.
   * - User must not already be a member.
   */
  async joinRoom(roomId: string, userId: string): Promise<RoomMembership> {
    const room = await this.getRoom(roomId);

    if (room.visibility !== 'public') {
      throw new BadRequestException('Cannot join a private room directly; an invite is required');
    }

    const banned = await this.roomsRepo.isBanned(roomId, userId);
    if (banned) {
      throw new BadRequestException('You are banned from this room');
    }

    const existing = await this.roomsRepo.getMembership(roomId, userId);
    if (existing) {
      throw new ConflictException('Already a member of this room');
    }

    return this.roomsRepo.addMember({ room_id: roomId, user_id: userId, role: 'member' });
  }

  /**
   * Leave a room.
   *
   * Rule: Owner cannot leave their own room (they must delete it instead).
   */
  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const room = await this.getRoom(roomId);

    if (room.owner_id === userId) {
      throw new BadRequestException(
        'Room owners cannot leave their own room. You must delete the room instead.',
      );
    }

    const removed = await this.roomsRepo.removeMember(roomId, userId);
    if (!removed) {
      throw new NotFoundException('You are not a member of this room');
    }
  }

  // ── Invites ────────────────────────────────────────────────────────────────

  /**
   * Invite a registered user to a room.
   *
   * - Invite targets must be already registered users (validated by username lookup).
   * - Freeform invites to unknown usernames are rejected.
   * - Duplicate pending invites for the same room/user are rejected.
   */
  async inviteToRoom(roomId: string, inviterUserId: string, targetUsername: string): Promise<RoomInvite> {
    // Validate the room exists
    await this.getRoom(roomId);

    // Validate invite target is a registered user (ROOM-07: invites constrained to registered users)
    const targetUser = await this.userRepo.findByUsername(targetUsername);
    if (!targetUser) {
      throw new NotFoundException(`User '${targetUsername}' is not registered`);
    }

    // Check for existing invite
    const existing = await this.roomsRepo.findInviteByUserAndRoom(roomId, targetUser.id);
    if (existing && existing.status === 'pending') {
      throw new ConflictException(`User '${targetUsername}' already has a pending invite to this room`);
    }

    return this.roomsRepo.createInvite({
      room_id: roomId,
      invited_by_user_id: inviterUserId,
      invited_user_id: targetUser.id,
    });
  }

  /** Validate that a username maps to a registered user. Returns the user ID or null. */
  async validateInviteTarget(username: string): Promise<string | null> {
    const user = await this.userRepo.findByUsername(username);
    return user?.id ?? null;
  }

  // ── Admin authority primitives ─────────────────────────────────────────────

  /** Grant admin role to a user in a room. */
  async makeAdmin(roomId: string, targetUserId: string, grantedByUserId: string): Promise<RoomAdmin> {
    await this.getRoom(roomId);
    return this.roomsRepo.addAdmin(roomId, targetUserId, grantedByUserId);
  }

  /** Revoke admin role from a user in a room. */
  async removeAdmin(roomId: string, targetUserId: string): Promise<void> {
    await this.roomsRepo.removeAdmin(roomId, targetUserId);
  }

  // ── Ban authority primitives ───────────────────────────────────────────────

  /**
   * Ban a user from a room.
   *
   * Also removes the user from membership if they are currently a member.
   * Bans survive leave/rejoin cycles.
   */
  async banMember(
    roomId: string,
    targetUserId: string,
    bannedByUserId: string,
    reason?: string,
  ): Promise<RoomBan> {
    await this.getRoom(roomId);

    // Remove from membership if present
    await this.roomsRepo.removeMember(roomId, targetUserId);

    return this.roomsRepo.addBan({
      room_id: roomId,
      banned_user_id: targetUserId,
      banned_by_user_id: bannedByUserId,
      reason: reason ?? null,
    });
  }

  /** Remove a ban from a user in a room. */
  async unbanMember(roomId: string, targetUserId: string): Promise<void> {
    await this.roomsRepo.removeBan(roomId, targetUserId);
  }

  // ── Authority check helpers ────────────────────────────────────────────────

  /** Check whether a user is the owner of a room. */
  async isOwner(roomId: string, userId: string): Promise<boolean> {
    const room = await this.roomsRepo.findById(roomId);
    return room?.owner_id === userId;
  }

  /**
   * Check whether a user has admin authority in a room.
   *
   * Owner is always considered an admin even without an explicit room_admins row.
   */
  async isAdmin(roomId: string, userId: string): Promise<boolean> {
    const owner = await this.isOwner(roomId, userId);
    if (owner) return true;
    return this.roomsRepo.isAdmin(roomId, userId);
  }
}
