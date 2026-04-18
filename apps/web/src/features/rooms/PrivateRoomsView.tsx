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

import { type RoomCatalogRow, type RoomMembership } from "../../lib/api";

interface PrivateRoomEntry {
  room: RoomCatalogRow;
  membership: RoomMembership;
}

interface PrivateRoomsViewProps {
  /** Private rooms this user is a member of. */
  rooms: PrivateRoomEntry[];
  /** Called when user selects a room to manage. */
  onManage?: (room: RoomCatalogRow) => void;
  /** Called when user wants to leave a room. */
  onLeave?: (room: RoomCatalogRow) => void;
  /** Called when user wants to create a new private room. */
  onCreateRoom?: () => void;
  loading?: boolean;
}

export function PrivateRoomsView({
  rooms,
  onManage,
  onLeave,
  onCreateRoom,
  loading = false,
}: PrivateRoomsViewProps) {
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

      {loading && <p className="rooms-loading">Loading private rooms…</p>}

      {!loading && rooms.length === 0 && (
        <p className="rooms-empty">
          You have no private rooms yet. Create one or accept an invitation.
        </p>
      )}

      {!loading && rooms.length > 0 && (
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
      )}
    </div>
  );
}
