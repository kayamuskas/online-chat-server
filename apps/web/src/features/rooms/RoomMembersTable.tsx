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

import { useState } from "react";
import { PresenceDot, type PresenceStatus } from "../presence/PresenceDot";
import { MemberPopover } from "../contacts/MemberPopover";
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
  /** Called when user clicks "Add friend" on a member row. Per D-05. */
  onSendFriendRequest?: (userId: string, username: string) => void;
  /** Set of user IDs already friends with current user (to hide the button). */
  friendUserIds?: Set<string>;
  /** Room name for popover context line. */
  roomName?: string;
  /** Called when user clicks Ban in popover. */
  onBanUser?: (userId: string) => void;
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
  onSendFriendRequest,
  friendUserIds,
  roomName,
  onBanUser,
}: RoomMembersTableProps) {
  const [popoverTarget, setPopoverTarget] = useState<{ userId: string; rect: DOMRect } | null>(null);

  if (members.length === 0) {
    return <p className="rooms-empty">No members found.</p>;
  }

  return (
    <>
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
                <span
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: isCurrentUser ? "default" : "pointer" }}
                  onClick={isCurrentUser ? undefined : (e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setPopoverTarget({ userId: m.userId, rect });
                  }}
                >
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
    {popoverTarget && (() => {
      const member = members.find(m => m.userId === popoverTarget.userId);
      if (!member) return null;
      return (
        <MemberPopover
          username={member.username}
          userId={member.userId}
          presenceStatus={member.presenceStatus ?? "offline"}
          roomName={roomName ?? ""}
          isFriend={friendUserIds?.has(member.userId) ?? false}
          isCurrentUser={member.userId === currentUserId}
          anchorRect={popoverTarget.rect}
          onClose={() => setPopoverTarget(null)}
          onSendFriendRequest={onSendFriendRequest}
          onBanUser={onBanUser}
        />
      );
    })()}
    </>
  );
}
