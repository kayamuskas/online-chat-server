/**
 * ContactsService — Phase 5 contacts policy layer.
 *
 * Owns all domain invariants for the friendship lifecycle, user-to-user ban
 * mechanics, and DM eligibility enforcement.
 *
 * Design decisions:
 * - callerId always arrives from @CurrentUser() guard; never from request body.
 * - banUser() wraps deleteFriendship + createBan + freezeDmConversation in a
 *   single BEGIN/COMMIT transaction to prevent race conditions (T-05-07).
 * - checkDmEligibility() checks friendship first, then either-direction ban.
 * - Self-ban and self-friend-request are rejected before any DB calls.
 * - acceptRequest and cancelRequest enforce actor-target authorization.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ContactsRepository } from './contacts.repository.js';
import { UserRepository } from '../auth/user.repository.js';
import { PostgresService } from '../db/postgres.service.js';
import type {
  FriendRequest,
  Friendship,
  UserBanView,
  DmConversation,
  FriendWithPresence,
  IncomingFriendRequestView,
  DmEligibilityResult,
} from './contacts.types.js';

@Injectable()
export class ContactsService {
  constructor(
    private readonly repo: ContactsRepository,
    private readonly userRepo: UserRepository,
    private readonly db?: PostgresService,
  ) {}

  // ── Friend requests ────────────────────────────────────────────────────────

  /**
   * Send a friend request to a user identified by username.
   *
   * - Target must be a registered user (NotFoundException if not found).
   * - Cannot send to yourself (BadRequestException).
   * - Duplicate pending requests are rejected (ConflictException).
   */
  async sendFriendRequest(
    callerId: string,
    input: { targetUsername: string; message?: string },
  ): Promise<FriendRequest> {
    const target = await this.userRepo.findByUsername(input.targetUsername);
    if (!target) {
      throw new NotFoundException(`User '${input.targetUsername}' is not registered`);
    }
    if (callerId === target.id) {
      throw new BadRequestException('Cannot send a friend request to yourself');
    }
    // Check friendship first — users already friends cannot send another request
    const friendship = await this.repo.findFriendship(callerId, target.id);
    if (friendship) {
      throw new ConflictException('You are already friends with this user');
    }
    const ban = await this.repo.findBanBetween(callerId, target.id);
    if (ban) {
      throw new ForbiddenException('Cannot send a friend request when contact is restricted');
    }
    // Check any existing request (any status) to avoid DB constraint violation
    const existing = await this.repo.findAnyFriendRequest(callerId, target.id);
    if (existing) {
      if (existing.status === 'pending') {
        throw new ConflictException('You already have a pending request to this user');
      }
      // declined or cancelled — re-send by updating the existing row to pending
      await this.repo.updateRequestStatus(existing.id, 'pending');
      return this.repo.findRequestById(existing.id) as Promise<FriendRequest>;
    }
    return this.repo.createFriendRequest({
      requester_id: callerId,
      target_id: target.id,
      message: input.message ?? null,
    });
  }

  /** Return all incoming pending friend requests for the caller. */
  async getIncomingRequests(userId: string): Promise<IncomingFriendRequestView[]> {
    return this.repo.listIncomingRequests(userId);
  }

  /** Return all outgoing pending friend requests sent by the caller. */
  async getOutgoingRequests(userId: string): Promise<FriendRequest[]> {
    return this.repo.listOutgoingRequests(userId);
  }

  /**
   * Accept a pending friend request.
   *
   * - Only the request recipient may accept it (ForbiddenException otherwise).
   * - Request must be in 'pending' status (BadRequestException otherwise).
   * - Creates a friendship row and marks the request 'accepted'.
   */
  async acceptRequest(requestId: string, callerId: string): Promise<Friendship> {
    const req = await this.repo.findRequestById(requestId);
    if (!req) {
      throw new NotFoundException('Friend request not found');
    }
    if (req.target_id !== callerId) {
      throw new ForbiddenException('Only the request recipient can accept it');
    }
    if (req.status !== 'pending') {
      throw new BadRequestException('Request is no longer pending');
    }
    const existingFriendship = await this.repo.findFriendship(callerId, req.requester_id);
    const friendship = existingFriendship ?? await this.repo.createFriendship(callerId, req.requester_id);
    await this.repo.updateRequestStatus(requestId, 'accepted');
    return friendship;
  }

  /**
   * Decline a pending friend request.
   *
   * - Only the request recipient may decline it (ForbiddenException otherwise).
   * - Request must be in 'pending' status (BadRequestException otherwise).
   */
  async declineRequest(requestId: string, callerId: string): Promise<void> {
    const req = await this.repo.findRequestById(requestId);
    if (!req) {
      throw new NotFoundException('Friend request not found');
    }
    if (req.target_id !== callerId) {
      throw new ForbiddenException('Only the request recipient can decline it');
    }
    if (req.status !== 'pending') {
      throw new BadRequestException('Request is no longer pending');
    }
    await this.repo.updateRequestStatus(requestId, 'declined');
  }

  /**
   * Cancel a pending friend request.
   *
   * - Only the original sender may cancel it (ForbiddenException otherwise).
   * - Request must be in 'pending' status (BadRequestException otherwise).
   */
  async cancelRequest(requestId: string, callerId: string): Promise<void> {
    const req = await this.repo.findRequestById(requestId);
    if (!req) {
      throw new NotFoundException('Friend request not found');
    }
    if (req.requester_id !== callerId) {
      throw new ForbiddenException('Only the sender can cancel a request');
    }
    if (req.status !== 'pending') {
      throw new BadRequestException('Request is no longer pending');
    }
    await this.repo.updateRequestStatus(requestId, 'cancelled');
  }

  // ── Friendships ────────────────────────────────────────────────────────────

  /**
   * Return all friends of a user with presence status placeholder.
   * presenceStatus is enriched by PresenceService in Phase 6; defaults to undefined here.
   */
  async getFriends(userId: string): Promise<FriendWithPresence[]> {
    return this.repo.listFriends(userId);
  }

  /**
   * Remove a friendship.
   *
   * - Does NOT freeze DM history (D-19: removal is not a ban).
   * - DM eligibility is lost because friendship is required per checkDmEligibility.
   * - Throws NotFoundException if no friendship row exists.
   */
  async removeFriend(callerId: string, targetUserId: string): Promise<void> {
    const removed = await this.repo.deleteFriendship(callerId, targetUserId);
    if (!removed) {
      throw new NotFoundException('Friendship not found');
    }
  }

  // ── User bans ──────────────────────────────────────────────────────────────

  /**
   * Ban a user.
   *
   * Atomically (BEGIN/COMMIT):
   * 1. Deletes existing friendship (if any).
   * 2. Creates ban record.
   * 3. Freezes the DM conversation (upsert).
   *
   * Self-ban is rejected before any DB calls (BadRequestException).
   * Implements T-05-07: race condition prevention via transaction.
   */
  async banUser(callerId: string, targetId: string): Promise<void> {
    if (callerId === targetId) {
      throw new BadRequestException('Cannot ban yourself');
    }
    const client = await this.db!.getClient();
    try {
      await client.query('BEGIN');
      await this.repo.deleteFriendship(callerId, targetId, client as any);
      await this.repo.cancelPendingRequestsBetween(callerId, targetId, client as any);
      await this.repo.createBan({ banner_user_id: callerId, banned_user_id: targetId }, client as any);
      await this.repo.freezeDmConversation(callerId, targetId, client as any);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Return all bans created by the caller. */
  async getMyBans(userId: string): Promise<UserBanView[]> {
    return this.repo.listBans(userId);
  }

  /**
   * Remove a ban previously created by the caller.
   *
   * - Only the banner can unban (T-05-08).
   * - Throws NotFoundException if no matching ban found.
   */
  async unbanUser(callerId: string, targetId: string): Promise<void> {
    const ban = await this.repo.findBanByBanner(callerId, targetId);
    if (!ban) {
      throw new NotFoundException('Ban not found');
    }
    await this.repo.removeBan(callerId, targetId);
  }

  // ── DM eligibility ─────────────────────────────────────────────────────────

  /**
   * Check whether two users are eligible to exchange DMs.
   *
   * Rules (D-14, FRND-06):
   * - Returns { eligible: false, reason: 'not_friends' } if no friendship exists.
   * - Returns { eligible: false, reason: 'ban_exists' } if any ban exists in either direction.
   * - Returns { eligible: true } otherwise.
   *
   * Enforced server-side; frontend button state is advisory only.
   */
  async checkDmEligibility(callerId: string, targetId: string): Promise<DmEligibilityResult> {
    const friendship = await this.repo.findFriendship(callerId, targetId);
    if (!friendship) {
      return { eligible: false, reason: 'not_friends' };
    }
    const ban = await this.repo.findBanBetween(callerId, targetId);
    if (ban) {
      return { eligible: false, reason: 'ban_exists' };
    }
    return { eligible: true };
  }

  /**
   * Initiate a DM conversation between the caller and a target user.
   *
   * - Calls checkDmEligibility first; throws ForbiddenException if not eligible (T-05-09).
   * - Creates or retrieves the DM conversation row (idempotent via ON CONFLICT in repository).
   */
  async initiateDm(
    callerId: string,
    targetId: string,
  ): Promise<{ conversation: DmConversation; eligible: boolean }> {
    const eligibility = await this.checkDmEligibility(callerId, targetId);
    if (!eligibility.eligible) {
      throw new ForbiddenException(`DM not allowed: ${eligibility.reason}`);
    }
    const conversation = await this.repo.createDmConversation(callerId, targetId);
    return { conversation, eligible: true };
  }
}
