/**
 * contacts.types.ts — Phase 5 contacts domain type contracts.
 *
 * Defines the friendship lifecycle, user-to-user ban mechanics, and DM
 * conversation stub as separate relational concepts, consistent with the
 * rooms domain approach (no collapsed boolean flags).
 *
 * Design decisions:
 * - FriendRequestStatus is a string union matching the DB CHECK constraint.
 * - Friendship and DmConversation use normalized ordering (user_a_id < user_b_id).
 * - Ban is directional: A banning B is independent of B banning A.
 * - DmConversation.frozen allows Phase 5 ban service to freeze a DM before Phase 6 ships.
 */

// ── Enums / unions ────────────────────────────────────────────────────────────

/** Friend request status lifecycle. */
export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

// ── Core domain types ─────────────────────────────────────────────────────────

/**
 * A friend request record as returned from the database.
 *
 * Uniqueness is enforced via CONSTRAINT friend_requests_pair_unique
 * on (requester_id, target_id).
 */
export interface FriendRequest {
  id: string;
  requester_id: string;
  target_id: string;
  message: string | null;
  status: FriendRequestStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * A friendship record.
 *
 * Symmetric relation stored with normalized ordering (user_a_id < user_b_id)
 * so (A,B) and (B,A) cannot coexist. Repository must canonicalize before
 * INSERT and SELECT operations.
 */
export interface Friendship {
  id: string;
  user_a_id: string;  // normalized: always user_a_id < user_b_id (lexicographic UUID)
  user_b_id: string;
  created_at: Date;
}

/**
 * A user-to-user ban record.
 *
 * Directional: banner_user_id banning banned_user_id.
 * A banning B and B banning A are independent rows.
 * DM eligibility checks both directions via findBanBetween().
 */
export interface UserBan {
  id: string;
  banner_user_id: string;
  banned_user_id: string;
  created_at: Date;
}

/**
 * DM conversation stub.
 *
 * Exists in Phase 5 so the ban service can set frozen=TRUE before Phase 6
 * ships the message engine. Normalized ordering: user_a_id < user_b_id.
 */
export interface DmConversation {
  id: string;
  user_a_id: string;  // normalized: always user_a_id < user_b_id (lexicographic UUID)
  user_b_id: string;
  frozen: boolean;
  created_at: Date;
}

// ── Projection / view types ───────────────────────────────────────────────────

/**
 * Friend with presence hint — used for the contacts sidebar list.
 * Presence is fetched from the runtime presence layer, not from the DB.
 */
export interface FriendWithPresence {
  userId: string;
  username: string;
  presenceStatus?: 'online' | 'afk' | 'offline';
}

/**
 * Pending incoming friend request enriched with the requester's username.
 * Used for the notification dropdown and request list views.
 */
export interface IncomingFriendRequestView {
  id: string;
  requester_id: string;
  requester_username: string;
  message: string | null;
  created_at: Date;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface SendFriendRequestInput {
  requester_id: string;
  target_id: string;
  message?: string | null;
}

export interface CreateBanInput {
  banner_user_id: string;
  banned_user_id: string;
}

export interface DmEligibilityResult {
  eligible: boolean;
  reason?: 'not_friends' | 'ban_exists';
}
