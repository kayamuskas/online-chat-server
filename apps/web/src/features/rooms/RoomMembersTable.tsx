/**
 * RoomMembersTable — Phase 4 member list with presence and role management.
 *
 * Renders the room member list with:
 *   - Per-member presence status using shared PresenceDot primitives (D-10).
 *   - Role badge (owner / admin / member).
 *   - Make admin / Remove admin actions (owner only).
 *   - Remove member action (admin or owner; not applicable to the room owner).
 *
 * Uses the shared presence rendering contract rather than inventing one-off
 * presence indicators. PresenceDot is the compact form appropriate for member
 * tables per Phase 3 contract.
 */

import { PresenceDot, type PresenceStatus } from "../presence/PresenceDot";
import type { RoomMembership } from "../../lib/api";

export interface MemberRow {
  userId: string;
  username: string;
  membership: RoomMembership;
  /** Presence status — undefined when not available yet. */
  presenceStatus?: PresenceStatus;
}

interface RoomMembersTableProps {
  members: MemberRow[];
  /** The currently authenticated user's ID. */
  currentUserId: string;
  /** The room owner's user ID — owner cannot be removed or demoted. */
  ownerUserId: string;
  /** Whether the current user is an admin or owner. */
  currentUserIsAdmin: boolean;
  /** Whether the current user is the owner. */
  currentUserIsOwner: boolean;
  onMakeAdmin?: (userId: string) => void;
  onRemoveAdmin?: (userId: string) => void;
  onRemoveMember?: (userId: string) => void;
  actionBusy?: string | null;
}

export function RoomMembersTable({
  members,
  currentUserId,
  ownerUserId,
  currentUserIsAdmin,
  currentUserIsOwner,
  onMakeAdmin,
  onRemoveAdmin,
  onRemoveMember,
  actionBusy,
}: RoomMembersTableProps) {
  if (members.length === 0) {
    return <p className="rooms-empty">No members found.</p>;
  }

  return (
    <table className="members-table" aria-label="Room members">
      <thead>
        <tr>
          <th>Member</th>
          <th>Role</th>
          {currentUserIsAdmin && <th className="members-table__actions">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {members.map((m) => {
          const isOwner = m.userId === ownerUserId;
          const isCurrentUser = m.userId === currentUserId;
          const role = m.membership.role;
          const isAdmin = role === "admin" || role === "owner";
          const busy = actionBusy === m.userId;

          return (
            <tr key={m.userId}>
              <td>
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <PresenceDot status={m.presenceStatus ?? "offline"} />
                  <span>{m.username}</span>
                  {isCurrentUser && (
                    <span className="sessions-badge">you</span>
                  )}
                </span>
              </td>
              <td>
                <span
                  className={`members-table__role${
                    role === "owner"
                      ? " members-table__role--owner"
                      : role === "admin"
                      ? " members-table__role--admin"
                      : ""
                  }`}
                >
                  {role}
                </span>
              </td>
              {currentUserIsAdmin && (
                <td className="members-table__actions">
                  {/* Owner cannot have actions applied — protected */}
                  {!isOwner && !isCurrentUser && (
                    <>
                      {currentUserIsOwner && !isAdmin && onMakeAdmin && (
                        <button
                          type="button"
                          className="btn btn--soft btn--xs"
                          onClick={() => onMakeAdmin(m.userId)}
                          disabled={busy}
                        >
                          {busy ? "…" : "Make admin"}
                        </button>
                      )}
                      {currentUserIsOwner && isAdmin && onRemoveAdmin && (
                        <button
                          type="button"
                          className="btn btn--soft btn--xs"
                          onClick={() => onRemoveAdmin(m.userId)}
                          disabled={busy}
                        >
                          {busy ? "…" : "Remove admin"}
                        </button>
                      )}
                      {onRemoveMember && (
                        <button
                          type="button"
                          className="btn btn--danger btn--xs"
                          onClick={() => onRemoveMember(m.userId)}
                          disabled={busy}
                        >
                          {busy ? "…" : "Ban"}
                        </button>
                      )}
                    </>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
