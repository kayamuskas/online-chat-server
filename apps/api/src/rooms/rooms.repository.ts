/**
 * RoomsRepository — persistence boundary for room identity and authority relations.
 *
 * All SQL for rooms, memberships, invites, admins, and bans is isolated here.
 * Controllers and services must not issue SQL directly.
 *
 * Design decisions:
 * - Room names are globally unique (enforced at DB level via UNIQUE constraint).
 * - Ban state is separate from membership; bans survive leave/rejoin cycles.
 * - Invite targets are constrained to registered users via FK (enforced in service layer too).
 * - Admin records are explicit domain rows, not just a membership role flag.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../db/postgres.service.js';
import type {
  Room,
  RoomMembership,
  RoomInvite,
  RoomAdmin,
  RoomBan,
  RoomCatalogRow,
  PrivateRoomMembershipRow,
  PendingRoomInviteRow,
  CreateRoomInput,
  AddMemberInput,
  CreateInviteInput,
  AddBanInput,
} from './rooms.types.js';

@Injectable()
export class RoomsRepository {
  constructor(private readonly db: PostgresService) {}

  // ── Room CRUD ──────────────────────────────────────────────────────────────

  /** Create a new room. Returns the created room. */
  async create(input: CreateRoomInput): Promise<Room> {
    const id = randomUUID();
    const visibility = input.visibility ?? 'public';
    const result = await this.db.query<Room>(
      `INSERT INTO rooms (id, name, description, visibility, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, description, visibility, owner_id, created_at, updated_at`,
      [id, input.name, input.description ?? null, visibility, input.owner_id],
    );
    return result.rows[0];
  }

  /** Find a room by UUID. Returns null if not found. */
  async findById(id: string): Promise<Room | null> {
    const result = await this.db.query<Room>(
      `SELECT id, name, description, visibility, owner_id, created_at, updated_at
       FROM rooms WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  /** Find a room by unique name. Returns null if not found. */
  async findByName(name: string): Promise<Room | null> {
    const result = await this.db.query<Room>(
      `SELECT id, name, description, visibility, owner_id, created_at, updated_at
       FROM rooms WHERE name = $1 LIMIT 1`,
      [name],
    );
    return result.rows[0] ?? null;
  }

  /**
   * List public rooms for catalog, optionally filtered by search query.
   * Returns rows with server-computed member_count.
   *
   * Search matches both room name and description via full-text or ILIKE.
   */
  async listPublic(search?: string): Promise<RoomCatalogRow[]> {
    const params: unknown[] = [];
    let whereClause = `WHERE r.visibility = 'public'`;

    if (search && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      whereClause += ` AND (r.name ILIKE $${params.length} OR r.description ILIKE $${params.length})`;
    }

    const result = await this.db.query<RoomCatalogRow>(
      `SELECT r.id,
              r.name,
              r.description,
              r.visibility,
              r.owner_id,
              r.created_at,
              COUNT(m.id)::INT AS member_count
       FROM rooms r
       LEFT JOIN room_memberships m ON m.room_id = r.id
       ${whereClause}
       GROUP BY r.id
       ORDER BY r.name ASC`,
      params,
    );
    return result.rows;
  }

  // ── Membership ─────────────────────────────────────────────────────────────

  /** Add a member to a room. Returns the membership row. */
  async addMember(input: AddMemberInput): Promise<RoomMembership> {
    const id = randomUUID();
    const result = await this.db.query<RoomMembership>(
      `INSERT INTO room_memberships (id, room_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, room_id, user_id, role, joined_at`,
      [id, input.room_id, input.user_id, input.role],
    );
    return result.rows[0];
  }

  /** Get the membership row for a specific user in a room. Returns null if not a member. */
  async getMembership(room_id: string, user_id: string): Promise<RoomMembership | null> {
    const result = await this.db.query<RoomMembership>(
      `SELECT id, room_id, user_id, role, joined_at
       FROM room_memberships WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
      [room_id, user_id],
    );
    return result.rows[0] ?? null;
  }

  /** Remove a member from a room. Returns true if a row was deleted. */
  async removeMember(room_id: string, user_id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM room_memberships WHERE room_id = $1 AND user_id = $2`,
      [room_id, user_id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** List all members of a room with their roles. */
  async listMembers(room_id: string): Promise<RoomMembership[]> {
    const result = await this.db.query<RoomMembership>(
      `SELECT id, room_id, user_id, role, joined_at
       FROM room_memberships WHERE room_id = $1 ORDER BY joined_at ASC`,
      [room_id],
    );
    return result.rows;
  }

  /** Get the current member count for a room. */
  async getMemberCount(room_id: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::INT AS count FROM room_memberships WHERE room_id = $1`,
      [room_id],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * List private rooms where the given user has active membership.
   * Includes room details, member count, and the caller's membership row.
   */
  async listPrivateRoomsByUser(user_id: string): Promise<PrivateRoomMembershipRow[]> {
    const result = await this.db.query<PrivateRoomMembershipRow>(
      `SELECT r.id,
              r.name,
              r.description,
              r.visibility,
              r.owner_id,
              r.created_at,
              COUNT(all_members.id)::INT AS member_count,
              m.id AS membership_id,
              m.user_id AS membership_user_id,
              m.role AS membership_role,
              m.joined_at AS membership_joined_at
       FROM room_memberships m
       INNER JOIN rooms r ON r.id = m.room_id
       LEFT JOIN room_memberships all_members ON all_members.room_id = r.id
       WHERE m.user_id = $1 AND r.visibility = 'private'
       GROUP BY r.id, m.id
       ORDER BY r.name ASC`,
      [user_id],
    );
    return result.rows;
  }

  // ── Admin grants ───────────────────────────────────────────────────────────

  /** Grant admin privileges to a user within a room. Returns the admin row. */
  async addAdmin(room_id: string, user_id: string, granted_by_user_id: string): Promise<RoomAdmin> {
    const id = randomUUID();
    const result = await this.db.query<RoomAdmin>(
      `INSERT INTO room_admins (id, room_id, user_id, granted_by_user_id, granted_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (room_id, user_id) DO UPDATE SET granted_by_user_id = EXCLUDED.granted_by_user_id, granted_at = NOW()
       RETURNING id, room_id, user_id, granted_by_user_id, granted_at`,
      [id, room_id, user_id, granted_by_user_id],
    );
    return result.rows[0];
  }

  /** Revoke admin privileges from a user within a room. Returns true if a row was deleted. */
  async removeAdmin(room_id: string, user_id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM room_admins WHERE room_id = $1 AND user_id = $2`,
      [room_id, user_id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Check whether a user holds explicit admin privileges in a room. */
  async isAdmin(room_id: string, user_id: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM room_admins WHERE room_id = $1 AND user_id = $2
       ) AS exists`,
      [room_id, user_id],
    );
    return result.rows[0]?.exists ?? false;
  }

  // ── Invites ────────────────────────────────────────────────────────────────

  /** Create a pending invite for a registered user. */
  async createInvite(input: CreateInviteInput): Promise<RoomInvite> {
    const id = randomUUID();
    const result = await this.db.query<RoomInvite>(
      `INSERT INTO room_invites (id, room_id, invited_by_user_id, invited_user_id, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING id, room_id, invited_by_user_id, invited_user_id, status, created_at, expires_at`,
      [id, input.room_id, input.invited_by_user_id, input.invited_user_id],
    );
    return result.rows[0];
  }

  /** Find an existing invite for a user in a specific room. Returns null if none. */
  async findInviteByUserAndRoom(room_id: string, user_id: string): Promise<RoomInvite | null> {
    const result = await this.db.query<RoomInvite>(
      `SELECT id, room_id, invited_by_user_id, invited_user_id, status, created_at, expires_at
       FROM room_invites WHERE room_id = $1 AND invited_user_id = $2 LIMIT 1`,
      [room_id, user_id],
    );
    return result.rows[0] ?? null;
  }

  /**
   * List pending invites addressed to the given user, enriched with room context.
   */
  async listPendingInvitesByUser(user_id: string): Promise<PendingRoomInviteRow[]> {
    const result = await this.db.query<PendingRoomInviteRow>(
      `SELECT ri.id,
              ri.room_id,
              ri.invited_by_user_id,
              ri.invited_user_id,
              ri.status,
              ri.created_at,
              ri.expires_at,
              r.name AS room_name,
              r.description AS room_description,
              r.visibility AS room_visibility,
              r.owner_id AS room_owner_id,
              r.created_at AS room_created_at,
              COUNT(m.id)::INT AS room_member_count,
              inviter.username AS inviter_username
       FROM room_invites ri
       INNER JOIN rooms r ON r.id = ri.room_id
       LEFT JOIN room_memberships m ON m.room_id = r.id
       LEFT JOIN users inviter ON inviter.id = ri.invited_by_user_id
       WHERE ri.invited_user_id = $1
         AND ri.status = 'pending'
       GROUP BY ri.id, r.id, inviter.username
       ORDER BY ri.created_at DESC`,
      [user_id],
    );
    return result.rows;
  }

  /**
   * Find a specific invite owned by the recipient for accept/decline flows.
   */
  async findInviteForRecipient(room_id: string, invite_id: string, user_id: string): Promise<RoomInvite | null> {
    const result = await this.db.query<RoomInvite>(
      `SELECT id, room_id, invited_by_user_id, invited_user_id, status, created_at, expires_at
       FROM room_invites
       WHERE id = $1 AND room_id = $2 AND invited_user_id = $3
       LIMIT 1`,
      [invite_id, room_id, user_id],
    );
    return result.rows[0] ?? null;
  }

  /** Accept an invite, updating status to 'accepted'. Returns true on success. */
  async acceptInvite(invite_id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE room_invites SET status = 'accepted' WHERE id = $1 AND status = 'pending'`,
      [invite_id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Decline an invite, updating status to 'declined'. Returns true on success. */
  async declineInvite(invite_id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE room_invites SET status = 'declined' WHERE id = $1 AND status = 'pending'`,
      [invite_id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ── Bans ───────────────────────────────────────────────────────────────────

  /** Add a ban record. Bans survive leave/rejoin cycles. */
  async addBan(input: AddBanInput): Promise<RoomBan> {
    const id = randomUUID();
    const result = await this.db.query<RoomBan>(
      `INSERT INTO room_bans (id, room_id, banned_user_id, banned_by_user_id, reason, banned_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (room_id, banned_user_id) DO UPDATE SET
         banned_by_user_id = EXCLUDED.banned_by_user_id,
         reason = EXCLUDED.reason,
         banned_at = NOW()
       RETURNING id, room_id, banned_user_id, banned_by_user_id, reason, banned_at`,
      [id, input.room_id, input.banned_user_id, input.banned_by_user_id, input.reason ?? null],
    );
    return result.rows[0];
  }

  /** Remove a ban record. Returns true if a row was deleted. */
  async removeBan(room_id: string, banned_user_id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM room_bans WHERE room_id = $1 AND banned_user_id = $2`,
      [room_id, banned_user_id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Check whether a user is banned from a room. */
  async isBanned(room_id: string, user_id: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM room_bans WHERE room_id = $1 AND banned_user_id = $2
       ) AS exists`,
      [room_id, user_id],
    );
    return result.rows[0]?.exists ?? false;
  }

  /**
   * List all ban records for a room, ordered by most-recently banned.
   * Includes banned_by_user_id and reason for display in admin UI.
   */
  async listBanned(room_id: string): Promise<RoomBan[]> {
    const result = await this.db.query<RoomBan>(
      `SELECT id, room_id, banned_user_id, banned_by_user_id, reason, banned_at
       FROM room_bans WHERE room_id = $1 ORDER BY banned_at DESC`,
      [room_id],
    );
    return result.rows;
  }
}
