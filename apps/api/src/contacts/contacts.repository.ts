/**
 * ContactsRepository — persistence boundary for the contacts domain.
 *
 * All SQL for friend_requests, friendships, user_bans, and dm_conversations
 * is isolated here. Services and controllers must not issue SQL directly.
 *
 * Design decisions:
 * - Friendship and DmConversation use normalized ordering (user_a_id < user_b_id).
 * - Ban is directional; findBanBetween checks both directions.
 * - Methods that participate in transactions accept an optional SqlExecutor so
 *   callers can pass a PoolClient for manual BEGIN/COMMIT/ROLLBACK flows.
 * - freezeDmConversation uses ON CONFLICT upsert to be idempotent.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../db/postgres.service.js';
import type { QueryResult, QueryResultRow } from 'pg';
import type {
  FriendRequest,
  Friendship,
  UserBan,
  UserBanView,
  DmConversation,
  SendFriendRequestInput,
  CreateBanInput,
  IncomingFriendRequestView,
  FriendWithPresence,
} from './contacts.types.js';

type SqlExecutor = {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
};

@Injectable()
export class ContactsRepository {
  constructor(private readonly db: PostgresService) {}

  // ── Friend requests ────────────────────────────────────────────────────────

  /** Create a new pending friend request. Returns the created row. */
  async createFriendRequest(input: SendFriendRequestInput): Promise<FriendRequest> {
    const id = randomUUID();
    const result = await this.db.query<FriendRequest>(
      `INSERT INTO friend_requests (id, requester_id, target_id, message, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
       RETURNING *`,
      [id, input.requester_id, input.target_id, input.message ?? null],
    );
    return result.rows[0];
  }

  /** Find a friend request by UUID. Returns null if not found. */
  async findRequestById(requestId: string): Promise<FriendRequest | null> {
    const result = await this.db.query<FriendRequest>(
      `SELECT * FROM friend_requests WHERE id = $1 LIMIT 1`,
      [requestId],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Find an existing pending request from requester to target.
   * Returns null if none exists.
   */
  async findFriendRequest(requesterId: string, targetId: string): Promise<FriendRequest | null> {
    const result = await this.db.query<FriendRequest>(
      `SELECT * FROM friend_requests
       WHERE requester_id = $1 AND target_id = $2 AND status = 'pending'
       LIMIT 1`,
      [requesterId, targetId],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Find any request (any status) between requester and target.
   * Used to detect DB-constraint conflicts before INSERT.
   */
  async findAnyFriendRequest(requesterId: string, targetId: string): Promise<FriendRequest | null> {
    const result = await this.db.query<FriendRequest>(
      `SELECT * FROM friend_requests
       WHERE requester_id = $1 AND target_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [requesterId, targetId],
    );
    return result.rows[0] ?? null;
  }

  /** Update the status of a friend request (accepted / declined / cancelled). */
  async updateRequestStatus(
    requestId: string,
    status: string,
    executor: SqlExecutor = this.db,
  ): Promise<void> {
    await executor.query(
      `UPDATE friend_requests SET status = $2, updated_at = NOW() WHERE id = $1`,
      [requestId, status],
    );
  }

  /**
   * Cancel all pending requests between two users in either direction.
   * Used when a ban lands so stale pending requests stop surfacing immediately.
   */
  async cancelPendingRequestsBetween(
    userAId: string,
    userBId: string,
    executor: SqlExecutor = this.db,
  ): Promise<void> {
    await executor.query(
      `UPDATE friend_requests
       SET status = 'cancelled', updated_at = NOW()
       WHERE status = 'pending'
         AND (
           (requester_id = $1 AND target_id = $2)
           OR (requester_id = $2 AND target_id = $1)
         )`,
      [userAId, userBId],
    );
  }

  /** List all incoming pending requests for a user, enriched with requester username. */
  async listIncomingRequests(userId: string): Promise<IncomingFriendRequestView[]> {
    const result = await this.db.query<IncomingFriendRequestView>(
      `SELECT fr.id,
              fr.requester_id,
              u.username AS requester_username,
              fr.message,
              fr.created_at
       FROM friend_requests fr
       JOIN users u ON u.id = fr.requester_id
       WHERE fr.target_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  /** List all outgoing pending requests sent by a user. */
  async listOutgoingRequests(userId: string): Promise<FriendRequest[]> {
    const result = await this.db.query<FriendRequest>(
      `SELECT * FROM friend_requests
       WHERE requester_id = $1 AND status = 'pending'`,
      [userId],
    );
    return result.rows;
  }

  // ── Friendships ────────────────────────────────────────────────────────────

  /**
   * Create a friendship between two users.
   * Normalizes pair ordering so user_a_id < user_b_id (lexicographic UUID).
   */
  async createFriendship(
    userAId: string,
    userBId: string,
    executor: SqlExecutor = this.db,
  ): Promise<Friendship> {
    const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
    const id = randomUUID();
    const result = await executor.query<Friendship>(
      `INSERT INTO friendships (id, user_a_id, user_b_id, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET created_at = friendships.created_at
       RETURNING *`,
      [id, a, b],
    );
    return result.rows[0];
  }

  /**
   * Find an existing friendship between two users.
   * Normalizes pair ordering before querying.
   */
  async findFriendship(userAId: string, userBId: string): Promise<Friendship | null> {
    const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
    const result = await this.db.query<Friendship>(
      `SELECT * FROM friendships WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1`,
      [a, b],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Delete a friendship between two users (for either ordering).
   * Returns true if a row was deleted.
   */
  async deleteFriendship(
    userAId: string,
    userBId: string,
    executor: SqlExecutor = this.db,
  ): Promise<boolean> {
    const result = await executor.query(
      `DELETE FROM friendships
       WHERE (user_a_id = $1 AND user_b_id = $2)
          OR (user_a_id = $2 AND user_b_id = $1)`,
      [userAId, userBId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * List all friends for a user with their presence status placeholder.
   * presenceStatus is left as undefined; service layer enriches from PresenceService in Phase 6.
   */
  async listFriends(userId: string): Promise<FriendWithPresence[]> {
    const result = await this.db.query<FriendWithPresence>(
      `SELECT u.id AS "userId", u.username
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_a_id = $1 THEN f.user_b_id ELSE f.user_a_id END
       WHERE f.user_a_id = $1 OR f.user_b_id = $1
       ORDER BY u.username ASC`,
      [userId],
    );
    return result.rows;
  }

  // ── User bans ──────────────────────────────────────────────────────────────

  /** Create a directional ban record. */
  async createBan(input: CreateBanInput, executor: SqlExecutor = this.db): Promise<UserBan> {
    const id = randomUUID();
    const result = await executor.query<UserBan>(
      `INSERT INTO user_bans (id, banner_user_id, banned_user_id, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [id, input.banner_user_id, input.banned_user_id],
    );
    return result.rows[0];
  }

  /**
   * Remove a ban from banner to banned user.
   * Returns true if a row was deleted.
   */
  async removeBan(bannerUserId: string, bannedUserId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM user_bans WHERE banner_user_id = $1 AND banned_user_id = $2`,
      [bannerUserId, bannedUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find a ban in either direction between two users.
   * Used by checkDmEligibility to block DMs regardless of ban direction.
   */
  async findBanBetween(userAId: string, userBId: string): Promise<UserBan | null> {
    const result = await this.db.query<UserBan>(
      `SELECT * FROM user_bans
       WHERE (banner_user_id = $1 AND banned_user_id = $2)
          OR (banner_user_id = $2 AND banned_user_id = $1)
       LIMIT 1`,
      [userAId, userBId],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Find a ban created by a specific banner against a specific banned user.
   * Used by unbanUser to verify the caller is the actual banner.
   */
  async findBanByBanner(bannerUserId: string, bannedUserId: string): Promise<UserBan | null> {
    const result = await this.db.query<UserBan>(
      `SELECT * FROM user_bans
       WHERE banner_user_id = $1 AND banned_user_id = $2
       LIMIT 1`,
      [bannerUserId, bannedUserId],
    );
    return result.rows[0] ?? null;
  }

  /** List all bans created by a given user, most-recent first. */
  async listBans(bannerUserId: string): Promise<UserBanView[]> {
    const result = await this.db.query<UserBanView>(
      `SELECT ub.id,
              ub.banner_user_id,
              ub.banned_user_id,
              ub.created_at,
              u.username AS banned_username
       FROM user_bans ub
       JOIN users u ON u.id = ub.banned_user_id
       WHERE ub.banner_user_id = $1
       ORDER BY ub.created_at DESC`,
      [bannerUserId],
    );
    return result.rows;
  }

  // ── DM conversations ───────────────────────────────────────────────────────

  /**
   * Freeze a DM conversation between two users (idempotent upsert).
   * Called transactionally by banUser() to lock the conversation.
   * Normalizes pair ordering: user_a_id < user_b_id.
   */
  async freezeDmConversation(
    userAId: string,
    userBId: string,
    executor: SqlExecutor = this.db,
  ): Promise<void> {
    const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
    const id = randomUUID();
    await executor.query(
      `INSERT INTO dm_conversations (id, user_a_id, user_b_id, frozen, created_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET frozen = TRUE`,
      [id, a, b],
    );
  }

  /**
   * Create or get a DM conversation, preserving existing frozen state.
   * Normalizes pair ordering: user_a_id < user_b_id.
   */
  async createDmConversation(userAId: string, userBId: string): Promise<DmConversation> {
    const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
    const id = randomUUID();
    const result = await this.db.query<DmConversation>(
      `INSERT INTO dm_conversations (id, user_a_id, user_b_id, frozen, created_at)
       VALUES ($1, $2, $3, FALSE, NOW())
       ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET frozen = dm_conversations.frozen
       RETURNING *`,
      [id, a, b],
    );
    return result.rows[0];
  }

  /**
   * Find an existing DM conversation between two users.
   * Normalizes pair ordering before querying.
   */
  async findDmConversation(userAId: string, userBId: string): Promise<DmConversation | null> {
    const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
    const result = await this.db.query<DmConversation>(
      `SELECT * FROM dm_conversations WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1`,
      [a, b],
    );
    return result.rows[0] ?? null;
  }
}
