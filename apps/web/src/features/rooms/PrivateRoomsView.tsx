/**
 * PrivateRoomsView — Phase 4 private room surface.
 *
 * Shows rooms the current user belongs to that are private (invite-only).
 * Provides an entry point for the invite flow when the user is an admin/owner.
 *
 * Private rooms are NOT shown in the public catalog — this view exists
 * specifically to surface rooms that require invitation to join.
 *
 * Distinct from PublicRoomsView: no public catalog search is exposed here.
 * The user's private memberships are shown, and for each room where the user
 * is admin/owner, an "Manage" action leads to ManageRoomView.
 */

import {
  type RoomCatalogRow,
  type PendingRoomInviteEntry,
  type PrivateRoomEntry,
} from "../../lib/api";

interface PrivateRoomsViewProps {
  /** Private rooms this user is a member of. */
  rooms: PrivateRoomEntry[];
  /** Pending invites addressed to the current user. */
  pendingInvites?: PendingRoomInviteEntry[];
  /** Called when user selects a room to manage. */
  onManage?: (room: RoomCatalogRow) => void;
  /** Called when user wants to leave a room. */
  onLeave?: (room: RoomCatalogRow) => void;
  /** Called when user accepts an invite. */
  onAcceptInvite?: (roomId: string, inviteId: string) => void;
  /** Called when user declines an invite. */
  onDeclineInvite?: (roomId: string, inviteId: string) => void;
  /** Called when user wants to create a new private room. */
  onCreateRoom?: () => void;
  /** Called when user wants to open the chat for a room they belong to. */
  onOpenChat?: (room: RoomCatalogRow) => void;
  loading?: boolean;
  error?: string | null;
  inviteActionId?: string | null;
}

export function PrivateRoomsView({
  rooms,
  pendingInvites = [],
  onManage,
  onLeave,
  onAcceptInvite,
  onDeclineInvite,
  onCreateRoom,
  onOpenChat,
  loading = false,
  error,
  inviteActionId = null,
}: PrivateRoomsViewProps) {
  const showInviteEmpty = !loading && pendingInvites.length === 0;
  const showRoomsEmpty = !loading && rooms.length === 0;

  return (
    <div className="rooms-view">
      <div className="rooms-view__header">
        <div>
          <h2>Private rooms</h2>
          <p className="sub">Invite-only rooms you belong to.</p>
        </div>
        {onCreateRoom && (
          <button type="button" className="btn btn--soft" onClick={onCreateRoom}>
            Create room
          </button>
        )}
      </div>

      {error && <p className="error-msg">{error}</p>}

      {loading && <p className="rooms-loading">Loading private rooms…</p>}

      {!loading && pendingInvites.length > 0 && (
        <>
          <h3 className="manage-room__section-title">Pending invites</h3>
          <ul className="rooms-list" aria-label="Pending private room invites">
            {pendingInvites.map(({ invite, room, inviter_username }) => (
              <li key={invite.id} className="rooms-list__item">
                <div className="rooms-list__info">
                  <span className="rooms-list__name">
                    {room.name}
                    <span className="rooms-badge rooms-badge--private">pending invite</span>
                  </span>
                  {room.description && (
                    <span className="rooms-list__desc">{room.description}</span>
                  )}
                  <span className="rooms-list__meta">
                    {room.member_count} {room.member_count === 1 ? "member" : "members"}
                    {inviter_username ? ` · invited by ${inviter_username}` : ""}
                  </span>
                </div>
                <div className="rooms-list__actions">
                  {onDeclineInvite && (
                    <button
                      type="button"
                      className="btn btn--soft btn--xs"
                      onClick={() => onDeclineInvite(room.id, invite.id)}
                      disabled={inviteActionId === invite.id}
                    >
                      {inviteActionId === invite.id ? "Working…" : "Decline"}
                    </button>
                  )}
                  {onAcceptInvite && (
                    <button
                      type="button"
                      className="btn btn--xs"
                      onClick={() => onAcceptInvite(room.id, invite.id)}
                      disabled={inviteActionId === invite.id}
                    >
                      {inviteActionId === invite.id ? "Working…" : "Accept"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {showInviteEmpty && showRoomsEmpty && (
        <p className="rooms-empty">
          You have no private rooms yet. Create one or accept an invitation.
        </p>
      )}

      {!loading && rooms.length > 0 && (
        <>
          <h3 className="manage-room__section-title">Your private rooms</h3>
          <ul className="rooms-list" aria-label="Private rooms">
          {rooms.map(({ room, membership }) => {
            const isAdminOrOwner =
              membership.role === "owner" || membership.role === "admin";
            return (
              <li key={room.id} className="rooms-list__item">
                <div className="rooms-list__info">
                  <span className="rooms-list__name">
                    {room.name}
                    <span className="rooms-badge rooms-badge--private">private</span>
                  </span>
                  {room.description && (
                    <span className="rooms-list__desc">{room.description}</span>
                  )}
                  <span className="rooms-list__meta">
                    {room.member_count} {room.member_count === 1 ? "member" : "members"}
                    {" · "}
                    <span className="rooms-list__role">{membership.role}</span>
                  </span>
                </div>
                <div className="rooms-list__actions">
                  {onOpenChat && (
                    <button
                      type="button"
                      className="btn btn--xs"
                      onClick={() => onOpenChat(room)}
                    >
                      Open chat
                    </button>
                  )}
                  {isAdminOrOwner && onManage && (
                    <button
                      type="button"
                      className="btn btn--soft btn--xs"
                      onClick={() => onManage(room)}
                    >
                      Manage room
                    </button>
                  )}
                  {onLeave && (
                    <button
                      type="button"
                      className="btn btn--soft btn--xs"
                      onClick={() => onLeave(room)}
                    >
                      Leave
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          </ul>
        </>
      )}
    </div>
  );
}
