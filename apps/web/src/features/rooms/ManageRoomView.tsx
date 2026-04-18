/**
 * ManageRoomView — Phase 4 room-management UI for admins and owners.
 *
 * Exposed actions:
 *   - Invite by username (admin or owner; D-06)
 *   - Make admin / Remove admin (owner only; D-11)
 *   - Remove member as ban (admin or owner; D-12)
 *   - Unban (admin or owner)
 *   - Leave room — with explicit owner refusal message (D-09, D-10)
 *
 * Owner leave refusal is surfaced clearly, not as a generic failure (D-10):
 *   "You cannot leave — you own this room. Delete the room instead."
 *
 * Stays within the classic chat-shell direction: rendered as a content panel,
 * not a detached dashboard. Uses shared presence primitives for member status.
 */

import { useEffect, useState, useCallback } from "react";
import {
  inviteToRoom,
  makeRoomAdmin,
  removeRoomAdmin,
  removeRoomMember,
  listRoomBans,
  unbanRoomUser,
  leaveRoom,
  type RoomCatalogRow,
  type RoomBan,
} from "../../lib/api";
import { RoomMembersTable, type MemberRow } from "./RoomMembersTable";
import { RoomBanListView } from "./RoomBanListView";
import { AddContactModal } from "../contacts/AddContactModal";

interface ManageRoomViewProps {
  room: RoomCatalogRow;
  /** The currently authenticated user's ID. */
  currentUserId: string;
  onBack?: () => void;
}

export function ManageRoomView({ room, currentUserId, onBack }: ManageRoomViewProps) {
  // For Phase 4 the member list is a stub — real member fetch is part of a
  // later messaging/member-panel phase. We load ban list and expose management
  // actions. Member rows are populated from the ban list and owner info.
  const [bans, setBans] = useState<RoomBan[]>([]);
  const [bansLoading, setBansLoading] = useState(false);
  const [bansError, setBansError] = useState<string | null>(null);

  // Invite form state
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Action busy state (userId or special token)
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Leave state
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Phase 5: Add friend from member row (D-05)
  const [addFriendTarget, setAddFriendTarget] = useState<string | null>(null);

  const isOwner = room.owner_id === currentUserId;
  // For phase 4 we treat the current user as admin if they have access to this view
  // (parent ManageRoomView only renders for admin/owner from PrivateRoomsView)
  const currentUserIsAdmin = true;

  const fetchBans = useCallback(async () => {
    setBansLoading(true);
    setBansError(null);
    try {
      const result = await listRoomBans(room.id);
      setBans(result.bans);
    } catch (e) {
      setBansError(e instanceof Error ? e.message : "Failed to load ban list");
    } finally {
      setBansLoading(false);
    }
  }, [room.id]);

  useEffect(() => {
    void fetchBans();
  }, [fetchBans]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteResult(null);
    try {
      await inviteToRoom(room.id, inviteUsername.trim());
      setInviteResult(`Invite sent to ${inviteUsername.trim()}.`);
      setInviteUsername("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleMakeAdmin(userId: string) {
    setActionBusy(userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await makeRoomAdmin(room.id, userId);
      setActionSuccess("Admin promoted successfully.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to make admin");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRemoveAdmin(userId: string) {
    setActionBusy(userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await removeRoomAdmin(room.id, userId);
      setActionSuccess("Admin removed.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove admin");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRemoveMember(userId: string) {
    setActionBusy(userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await removeRoomMember(room.id, userId);
      setActionSuccess("Member removed and banned.");
      void fetchBans();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleUnban(userId: string) {
    setActionBusy(userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await unbanRoomUser(room.id, userId);
      setActionSuccess("User unbanned.");
      setBans((prev) => prev.filter((b) => b.banned_user_id !== userId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to unban");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleLeave() {
    if (isOwner) {
      // Owner leave refusal — explicit message, not a generic error (D-10)
      setLeaveError(
        "You cannot leave — you own this room. Delete the room instead.",
      );
      return;
    }
    setLeaving(true);
    setLeaveError(null);
    try {
      await leaveRoom(room.id);
      onBack?.();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : "Failed to leave room");
    } finally {
      setLeaving(false);
    }
  }

  // Stub member list — Phase 4 surfaces the management UI; member hydration
  // comes in the messaging/member-panel phase. We show an empty table with
  // correct column structure here.
  const memberRows: MemberRow[] = [];

  return (
    <div className="manage-room">
      <div className="manage-room__header">
        <div>
          <h2>Manage room: {room.name}</h2>
          <p className="sub">
            {room.description ?? "No description."}
            {" · "}
            {room.member_count} {room.member_count === 1 ? "member" : "members"}
          </p>
        </div>
        {onBack && (
          <button type="button" className="btn btn--soft btn--xs" onClick={onBack}>
            &#8592; Back
          </button>
        )}
      </div>

      {actionError && <p className="error-msg">{actionError}</p>}
      {actionSuccess && <p className="success-msg">{actionSuccess}</p>}

      {/* ── Invite by username (D-06) ─────────────────────────────────────── */}
      <section className="manage-room__section">
        <h3 className="manage-room__section-title">Invite by username</h3>
        <form
          className="invite-form"
          onSubmit={(e) => void handleInvite(e)}
          noValidate
        >
          <div className="field">
            <input
              className="field__input"
              type="text"
              placeholder="Enter username…"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              autoComplete="off"
              aria-label="Username to invite"
            />
          </div>
          <button
            type="submit"
            className="btn"
            disabled={inviting || !inviteUsername.trim()}
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>
        {inviteResult && <p className="success-msg" style={{ marginTop: "0.5rem" }}>{inviteResult}</p>}
        {inviteError && <p className="error-msg" style={{ marginTop: "0.5rem" }}>{inviteError}</p>}
      </section>

      {/* ── Members table ─────────────────────────────────────────────────── */}
      <section className="manage-room__section">
        <h3 className="manage-room__section-title">Members</h3>
        {memberRows.length === 0 ? (
          <p className="rooms-notice">
            Member list hydration is available once the messaging panel is active.
            Use the invite and ban controls above and below to manage membership.
          </p>
        ) : (
          <>
            <RoomMembersTable
              members={memberRows}
              currentUserId={currentUserId}
              ownerUserId={room.owner_id}
              currentUserIsAdmin={currentUserIsAdmin}
              currentUserIsOwner={isOwner}
              onMakeAdmin={(uid) => void handleMakeAdmin(uid)}
              onRemoveAdmin={(uid) => void handleRemoveAdmin(uid)}
              onRemoveMember={(uid) => void handleRemoveMember(uid)}
              actionBusy={actionBusy}
              onSendFriendRequest={(_userId, username) => setAddFriendTarget(username)}
            />
            {addFriendTarget && (
              <AddContactModal
                onClose={() => setAddFriendTarget(null)}
                onSuccess={() => setAddFriendTarget(null)}
              />
            )}
          </>
        )}
      </section>

      {/* ── Ban list ──────────────────────────────────────────────────────── */}
      <section className="manage-room__section">
        <h3 className="manage-room__section-title">Ban list</h3>
        {bansLoading && <p className="rooms-loading">Loading ban list…</p>}
        {bansError && <p className="error-msg">{bansError}</p>}
        {!bansLoading && !bansError && (
          <RoomBanListView
            bans={bans}
            onUnban={(uid) => void handleUnban(uid)}
            unbanBusy={actionBusy}
          />
        )}
      </section>

      {/* ── Leave room ────────────────────────────────────────────────────── */}
      <section className="manage-room__section">
        <h3 className="manage-room__section-title">Leave room</h3>

        {isOwner ? (
          /* Owner leave refusal — explicit, not a generic failure (D-10) */
          <div className="owner-leave-warning">
            <span className="owner-leave-warning__icon" aria-hidden="true">&#9888;</span>
            <p className="owner-leave-warning__text">
              <strong>You cannot leave this room</strong> — you are the owner.
              To remove yourself, delete the room instead.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--danger btn--xs"
              onClick={() => void handleLeave()}
              disabled={leaving}
            >
              {leaving ? "Leaving…" : "Leave room"}
            </button>
            {leaveError && <p className="error-msg" style={{ marginTop: "0.5rem" }}>{leaveError}</p>}
          </>
        )}
      </section>
    </div>
  );
}
