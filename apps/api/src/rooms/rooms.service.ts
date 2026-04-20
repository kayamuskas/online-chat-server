/**
 * RoomsService — Phase 4 room domain policy layer.
 *
 * Owns all domain invariants before HTTP endpoints exist:
 * - Room creation requires only `name`; visibility defaults to 'public'; description optional.
 * - Room creator is durably recorded as owner (membership row with role='owner').
 * - Owner cannot leave their own room; they must delete the room instead.
 * - Invite targets must be already registered users (validated via UserRepository).
 * - Admin/ban/member authority helpers for later plan consumption.
 * - Removing a member through management flow is modeled as ban semantics (Phase 4-03).
 * - Owner cannot lose admin authority; removeAdmin rejects targeting the owner.
 *
 * Controllers must stay thin; all actor-vs-target policy checks live here.
 */

import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { RoomsRepository } from './rooms.repository.js';
import { UserRepository } from '../auth/user.repository.js';
import { MessagesGateway } from '../messages/messages.gateway.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import type {
  Room,
  RoomMembership,
  RoomInvite,
  RoomAdmin,
  RoomBan,
  RoomCatalogRow,
  PrivateRoomMembershipRow,
  PendingRoomInviteRow,
  PrivateRoomMembershipView,
  PendingRoomInviteView,
  CreateRoomServiceInput,
} from './rooms.types.js';

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomsRepo: RoomsRepository,
    private readonly userRepo: UserRepository,
    @Inject(forwardRef(() => MessagesGateway))
    private readonly gateway: MessagesGateway,
    @Inject(forwardRef(() => AttachmentsService))
    private readonly attachmentsService: AttachmentsService,
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

  /**
   * List the authenticated user's private-room memberships with room details.
   */
  async getMyPrivateRooms(userId: string): Promise<PrivateRoomMembershipView[]> {
    const rows = await this.roomsRepo.listPrivateRoomsByUser(userId);
    return rows.map((row) => this.mapPrivateMembershipRow(row));
  }

  /** List ALL rooms (public + private) where the user has active membership. */
  async getMyRooms(userId: string): Promise<PrivateRoomMembershipView[]> {
    const rows = await this.roomsRepo.listAllRoomsByUser(userId);
    return rows.map((row) => this.mapPrivateMembershipRow(row));
  }

  /**
   * List pending private-room invites addressed to the authenticated user.
   */
  async getPendingPrivateInvites(userId: string): Promise<PendingRoomInviteView[]> {
    const rows = await this.roomsRepo.listPendingInvitesByUser(userId);
    return rows.map((row) => this.mapPendingInviteRow(row));
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

  /**
   * Accept a pending private-room invite owned by the authenticated user.
   */
  async acceptInvite(roomId: string, inviteId: string, userId: string): Promise<RoomMembership> {
    const room = await this.getRoom(roomId);
    if (room.visibility !== 'private') {
      throw new BadRequestException('Invite acceptance is only supported for private rooms');
    }

    const invite = await this.roomsRepo.findInviteForRecipient(roomId, inviteId, userId);
    if (!invite) {
      throw new NotFoundException('Invite not found for this user and room');
    }

    if (invite.status !== 'pending') {
      throw new BadRequestException('Invite is no longer pending');
    }

    const banned = await this.roomsRepo.isBanned(roomId, userId);
    if (banned) {
      throw new BadRequestException('You are banned from this room');
    }

    const existingMembership = await this.roomsRepo.getMembership(roomId, userId);
    if (existingMembership) {
      throw new ConflictException('You are already a member of this room');
    }

    const membership = await this.roomsRepo.addMember({
      room_id: roomId,
      user_id: userId,
      role: 'member',
    });

    const accepted = await this.roomsRepo.acceptInvite(inviteId);
    if (!accepted) {
      throw new ConflictException('Invite could not be accepted');
    }

    return membership;
  }

  /**
   * Decline a pending private-room invite owned by the authenticated user.
   */
  async declineInvite(roomId: string, inviteId: string, userId: string): Promise<void> {
    const invite = await this.roomsRepo.findInviteForRecipient(roomId, inviteId, userId);
    if (!invite) {
      throw new NotFoundException('Invite not found for this user and room');
    }

    if (invite.status !== 'pending') {
      throw new BadRequestException('Invite is no longer pending');
    }

    const declined = await this.roomsRepo.declineInvite(inviteId);
    if (!declined) {
      throw new ConflictException('Invite could not be declined');
    }
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

  /**
   * Revoke admin role from a user in a room.
   *
   * Owner protection: the room owner cannot lose admin authority through this flow.
   * Attempting to remove the owner's admin status throws ForbiddenException.
   */
  async removeAdmin(roomId: string, targetUserId: string): Promise<void> {
    const room = await this.getRoom(roomId);

    if (room.owner_id === targetUserId) {
      throw new ForbiddenException(
        'Cannot remove admin authority from the room owner. The owner is always an admin.',
      );
    }

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

    // D-17: admin cannot ban another admin — only owner can ban an admin
    const targetIsAdmin = await this.roomsRepo.isAdmin(roomId, targetUserId);
    if (targetIsAdmin) {
      const callerIsOwner = await this.isOwner(roomId, bannedByUserId);
      if (!callerIsOwner) {
        throw new ForbiddenException('Only the room owner can ban an admin');
      }
    }

    // Remove from membership if present (ignore false — user may not have been a member)
    await this.roomsRepo.removeMember(roomId, targetUserId);

    return this.roomsRepo.addBan({
      room_id: roomId,
      banned_user_id: targetUserId,
      banned_by_user_id: bannedByUserId,
      reason: reason ?? null,
    });
  }

  /** Remove a ban from a user in a room. Allows the user to rejoin. */
  async unbanMember(roomId: string, targetUserId: string): Promise<void> {
    await this.roomsRepo.removeBan(roomId, targetUserId);
  }

  /**
   * Remove a member from a room using ban semantics.
   *
   * This is the authoritative "admin removes member" operation for Phase 4.
   * Modeling removal as a ban means the user cannot immediately rejoin until
   * explicitly unbanned — preventing the remove-and-rejoin loop.
   *
   * Rules:
   * - Target must currently be a member (throws NotFoundException otherwise).
   * - Owner cannot be removed this way (throws ForbiddenException).
   * - Creates a ban record with the actor's ID as banned_by_user_id.
   */
  async removeMemberAsBan(
    roomId: string,
    targetUserId: string,
    removedByUserId: string,
    reason?: string,
  ): Promise<RoomBan> {
    const room = await this.getRoom(roomId);

    // Owner protection: owner cannot be removed through management flows
    if (room.owner_id === targetUserId) {
      throw new ForbiddenException(
        'Cannot remove the room owner through member management. The owner must delete the room instead.',
      );
    }

    // Target must be a current member
    const membership = await this.roomsRepo.getMembership(roomId, targetUserId);
    if (!membership) {
      throw new NotFoundException(`User '${targetUserId}' is not a member of this room`);
    }

    // Remove membership
    await this.roomsRepo.removeMember(roomId, targetUserId);

    // Create ban record so user cannot rejoin until explicitly unbanned
    return this.roomsRepo.addBan({
      room_id: roomId,
      banned_user_id: targetUserId,
      banned_by_user_id: removedByUserId,
      reason: reason ?? 'Removed by admin',
    });
  }

  /**
   * List all banned users in a room.
   *
   * Returns ban records with who-banned metadata (banned_by_user_id, reason, banned_at)
   * for display in the admin UI.
   */
  async listBanned(roomId: string): Promise<RoomBan[]> {
    return this.roomsRepo.listBanned(roomId);
  }

  // ── Room deletion ──────────────────────────────────────────────────────────

  /**
   * Delete a room with full cascade (D-07).
   *
   * Order: WS broadcast FIRST (D-06), then FS cleanup, then DB cascade.
   */
  async deleteRoom(roomId: string, actorId: string): Promise<void> {
    await this.getRoom(roomId);  // throws NotFoundException if not found

    // D-06: WS broadcast BEFORE any data deletion
    await this.gateway.broadcastRoomDeleted(roomId);

    // D-07 step 1-2: Delete attachment files from FS + attachment DB records
    await this.attachmentsService.deleteForRoom(roomId);

    // D-07 step 3-5: Delete room record — FK CASCADE handles:
    //   messages (author_id is SET NULL for user-owned msgs, message rows deleted)
    //   room_memberships, room_admins, room_bans, room_invites
    await this.roomsRepo.deleteRoom(roomId);
  }

  /** List rooms owned by userId (for AUTH-08 cascade). */
  async listOwnedRooms(userId: string): Promise<Room[]> {
    return this.roomsRepo.listOwnedRooms(userId);
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

  private mapPrivateMembershipRow(row: PrivateRoomMembershipRow): PrivateRoomMembershipView {
    return {
      room: {
        id: row.id,
        name: row.name,
        description: row.description,
        visibility: row.visibility,
        owner_id: row.owner_id,
        member_count: row.member_count,
        created_at: row.created_at,
      },
      membership: {
        id: row.membership_id,
        room_id: row.id,
        user_id: row.membership_user_id,
        role: row.membership_role,
        joined_at: row.membership_joined_at,
      },
    };
  }

  private mapPendingInviteRow(row: PendingRoomInviteRow): PendingRoomInviteView {
    return {
      invite: {
        id: row.id,
        room_id: row.room_id,
        invited_by_user_id: row.invited_by_user_id,
        invited_user_id: row.invited_user_id,
        status: row.status,
        created_at: row.created_at,
        expires_at: row.expires_at,
      },
      room: {
        id: row.room_id,
        name: row.room_name,
        description: row.room_description,
        visibility: row.room_visibility,
        owner_id: row.room_owner_id,
        member_count: row.room_member_count,
        created_at: row.room_created_at,
      },
      inviter_username: row.inviter_username,
    };
  }
}
