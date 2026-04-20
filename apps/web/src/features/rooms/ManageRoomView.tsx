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

type ManageTab = "members" | "admins" | "banned" | "invitations" | "settings";

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
  const [activeTab, setActiveTab] = useState<ManageTab>("members");

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
  const adminRows = memberRows.filter((member) => (
    member.membership.role === "owner" || member.membership.role === "admin"
  ));

  function renderMembersTab() {
    if (memberRows.length === 0) {
      return (
        <div className="manage-room__panel-note">
          <p className="rooms-notice">
            Member list hydration is still lightweight in the current backend shape.
            The modal keeps the correct workflow, and the live member/context rail
            will fill this tab as Phase 9 continues.
          </p>
        </div>
      );
    }

    return (
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
    );
  }

  function renderAdminsTab() {
    return (
      <div className="manage-room__stack">
        <div className="manage-room__rule-card">
          <p className="manage-room__section-title">Rules</p>
          <p className="sub">
            The owner is always an admin and cannot lose admin authority. Removing a
            member from the room still acts as a ban until they are unbanned.
          </p>
        </div>

        {adminRows.length === 0 ? (
          <p className="rooms-notice">
            The owner/admin workflow is available, but member-role hydration is still
            deferred. Use the invitations and ban controls in this modal for now.
          </p>
        ) : (
          <RoomMembersTable
            members={adminRows}
            currentUserId={currentUserId}
            ownerUserId={room.owner_id}
            currentUserIsAdmin={currentUserIsAdmin}
            currentUserIsOwner={isOwner}
            onMakeAdmin={(uid) => void handleMakeAdmin(uid)}
            onRemoveAdmin={(uid) => void handleRemoveAdmin(uid)}
            actionBusy={actionBusy}
          />
        )}
      </div>
    );
  }

  function renderBannedTab() {
    return (
      <div className="manage-room__stack">
        {bansLoading && <p className="rooms-loading">Loading ban list…</p>}
        {bansError && <p className="error-msg">{bansError}</p>}
        {!bansLoading && !bansError && (
          <RoomBanListView
            bans={bans}
            onUnban={(uid) => void handleUnban(uid)}
            unbanBusy={actionBusy}
          />
        )}
        <p className="manage-room__fineprint">
          Banned users cannot rejoin until removed from this list.
        </p>
      </div>
    );
  }

  function renderInvitationsTab() {
    return (
      <div className="manage-room__stack">
        <div className="manage-room__rule-card">
          <p className="manage-room__section-title">Invitation flow</p>
          <p className="sub">
            Private rooms require invites. Public rooms can still use invites for a
            controlled entry flow.
          </p>
        </div>

        <form
          className="invite-form"
          onSubmit={(e) => void handleInvite(e)}
          noValidate
        >
          <div className="field">
            <input
              className="field__input"
              type="text"
              placeholder="Invite by username…"
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

        {inviteResult && <p className="success-msg">{inviteResult}</p>}
        {inviteError && <p className="error-msg">{inviteError}</p>}
      </div>
    );
  }

  function renderSettingsTab() {
    return (
      <div className="manage-room__stack">
        <div className="manage-room__settings-card">
          <div className="manage-room__setting">
            <span className="manage-room__setting-label">Room name</span>
            <strong>{room.name}</strong>
          </div>
          <div className="manage-room__setting">
            <span className="manage-room__setting-label">Description</span>
            <span>{room.description ?? "No description yet."}</span>
          </div>
          <div className="manage-room__setting">
            <span className="manage-room__setting-label">Members</span>
            <span>{room.member_count} total</span>
          </div>
        </div>

        {isOwner ? (
          <div className="owner-leave-warning">
            <span className="owner-leave-warning__icon" aria-hidden="true">&#9888;</span>
            <p className="owner-leave-warning__text">
              <strong>You cannot leave this room</strong> — you are the owner.
              To remove yourself, delete the room instead.
            </p>
          </div>
        ) : (
          <div className="manage-room__danger-card">
            <p className="manage-room__section-title">Danger zone</p>
            <p className="sub">Leaving removes your membership from this room.</p>
            <button
              type="button"
              className="btn btn--danger btn--xs"
              onClick={() => void handleLeave()}
              disabled={leaving}
            >
              {leaving ? "Leaving…" : "Leave room"}
            </button>
            {leaveError && <p className="error-msg" style={{ marginTop: "0.5rem" }}>{leaveError}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="manage-room manage-room--modal">
      <div className="manage-room__modal">
        <div className="manage-room__header">
          <div>
            <h2>Manage room</h2>
            <p className="sub">
              <strong>{room.name}</strong>
              {" · "}
              {room.description ?? "No description."}
            </p>
          </div>
          {onBack && (
            <button type="button" className="btn btn--soft btn--xs" onClick={onBack}>
              Close
            </button>
          )}
        </div>

        <div className="manage-room__tabs" role="tablist" aria-label="Manage room sections">
          <button
            type="button"
            className={`manage-room__tab${activeTab === "members" ? " manage-room__tab--active" : ""}`}
            onClick={() => setActiveTab("members")}
          >
            Members
          </button>
          <button
            type="button"
            className={`manage-room__tab${activeTab === "admins" ? " manage-room__tab--active" : ""}`}
            onClick={() => setActiveTab("admins")}
          >
            Admins
          </button>
          <button
            type="button"
            className={`manage-room__tab${activeTab === "banned" ? " manage-room__tab--active" : ""}`}
            onClick={() => setActiveTab("banned")}
          >
            Banned users
          </button>
          <button
            type="button"
            className={`manage-room__tab${activeTab === "invitations" ? " manage-room__tab--active" : ""}`}
            onClick={() => setActiveTab("invitations")}
          >
            Invitations
          </button>
          <button
            type="button"
            className={`manage-room__tab${activeTab === "settings" ? " manage-room__tab--active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </div>

        {(actionError || actionSuccess) && (
          <div className="manage-room__flash">
            {actionError && <p className="error-msg">{actionError}</p>}
            {actionSuccess && <p className="success-msg">{actionSuccess}</p>}
          </div>
        )}

        <div className="manage-room__body">
          {activeTab === "members" && renderMembersTab()}
          {activeTab === "admins" && renderAdminsTab()}
          {activeTab === "banned" && renderBannedTab()}
          {activeTab === "invitations" && renderInvitationsTab()}
          {activeTab === "settings" && renderSettingsTab()}
        </div>

        <div className="manage-room__footer">
          <span className="manage-room__fineprint">
            Remove from room is treated as a ban until the user is explicitly unbanned.
          </span>
          {onBack && (
            <button type="button" className="btn btn--soft btn--xs" onClick={onBack}>
              Close
            </button>
          )}
        </div>
      </div>

      {addFriendTarget && (
        <AddContactModal
          onClose={() => setAddFriendTarget(null)}
          onSuccess={() => setAddFriendTarget(null)}
        />
      )}
    </div>
  );
}
