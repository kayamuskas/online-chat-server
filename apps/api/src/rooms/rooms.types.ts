/**
 * rooms.types.ts — Phase 4 room domain type contracts.
 *
 * Defines the explicit authority model: rooms, memberships, invites, admins,
 * and room bans as separate relational concepts, not collapsed boolean flags.
 *
 * Design decisions:
 * - Visibility is a string union (not boolean) for clarity and extensibility.
 * - Role is a string union: 'owner' | 'admin' | 'member'.
 * - Invite status distinguishes pending/accepted/declined/expired durably.
 * - Ban is its own relation (not a membership flag) so it survives leave/rejoin cycles.
 */

// ── Enums / unions ────────────────────────────────────────────────────────────

/** Room visibility: controls discoverability and join policy. */
export type RoomVisibility = 'public' | 'private';

/** Room membership role: determines authority level within a room. */
export type RoomRole = 'owner' | 'admin' | 'member';

/** Invite status lifecycle. */
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

// ── Core domain types ─────────────────────────────────────────────────────────

/**
 * A room record as returned from the database.
 *
 * Globally unique name is enforced via a UNIQUE constraint on the `name` column.
 * Both public and private rooms share the same uniqueness domain.
 */
export interface Room {
  id: string;
  name: string;
  description: string | null;
  visibility: RoomVisibility;
  /** The user who created and currently owns this room. */
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Room membership record.
 *
 * Every room participant (including the owner) has exactly one membership row.
 * The owner's membership row carries role='owner'.
 */
export interface RoomMembership {
  id: string;
  room_id: string;
  user_id: string;
  role: RoomRole;
  joined_at: Date;
}

/**
 * A private-room invitation targeting an already registered user.
 *
 * Invites can only be created for existing users; freeform username-only invites
 * are rejected at the service layer to prevent disclosure of private room existence.
 */
export interface RoomInvite {
  id: string;
  room_id: string;
  /** User who sent the invitation. */
  invited_by_user_id: string;
  /** Must be an already registered user ID. */
  invited_user_id: string;
  status: InviteStatus;
  created_at: Date;
  expires_at: Date | null;
}

/**
 * A room admin grant record.
 *
 * Separate from membership to make admin promotions/demotions explicit domain events.
 * A user may be both a member and an admin (most common case) or just an admin
 * (not yet a member in edge cases — though policy may prevent that).
 */
export interface RoomAdmin {
  id: string;
  room_id: string;
  user_id: string;
  granted_by_user_id: string;
  granted_at: Date;
}

/**
 * A room ban record.
 *
 * Bans survive leave/rejoin cycles because they are stored separately from membership.
 * Admin removal of a member creates a ban row; rejoining a room checks ban state.
 */
export interface RoomBan {
  id: string;
  room_id: string;
  banned_user_id: string;
  banned_by_user_id: string;
  reason: string | null;
  banned_at: Date;
}

// ── Catalog projection ─────────────────────────────────────────────────────────

/**
 * Public room catalog row — used for browse/search results.
 * Includes server-computed member count to avoid client-side aggregation.
 */
export interface RoomCatalogRow {
  id: string;
  name: string;
  description: string | null;
  visibility: RoomVisibility;
  owner_id: string;
  member_count: number;
  created_at: Date;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateRoomInput {
  name: string;
  description?: string | null;
  visibility?: RoomVisibility;
  owner_id: string;
}

export interface AddMemberInput {
  room_id: string;
  user_id: string;
  role: RoomRole;
}

export interface CreateInviteInput {
  room_id: string;
  invited_by_user_id: string;
  invited_user_id: string;
}

export interface AddBanInput {
  room_id: string;
  banned_user_id: string;
  banned_by_user_id: string;
  reason?: string | null;
}

// ── Service input types ───────────────────────────────────────────────────────

export interface CreateRoomServiceInput {
  name: string;
  description?: string | null;
  visibility?: RoomVisibility;
  creatorUserId: string;
}
