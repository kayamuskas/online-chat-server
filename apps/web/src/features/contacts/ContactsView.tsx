/**
 * ContactsView — Phase 5 full contacts management page (D-09, FRND-03, FRND-04).
 *
 * Three sections:
 *   1. Incoming Requests — with Accept/Decline per row
 *   2. My Friends — with Remove and Block buttons per row
 *   3. Blocked Users — with Unblock button per row
 *
 * Fetches all three on mount. After each mutation, refreshes the affected section.
 * Shows BanConfirmModal before banning (D-07).
 */

import { useEffect, useState, useCallback } from "react";
import {
  getIncomingRequests,
  getMyFriends,
  getMyBans,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  banUser,
  unbanUser,
  type IncomingFriendRequestView,
  type FriendWithPresence,
  type UserBan,
} from "../../lib/api";
import { BanConfirmModal } from "./BanConfirmModal";
import { RemoveFriendConfirmModal } from "./RemoveFriendConfirmModal";

interface ContactsViewProps {
  currentUserId: string;
}

export function ContactsView({ currentUserId: _currentUserId }: ContactsViewProps) {
  const [requests, setRequests] = useState<IncomingFriendRequestView[]>([]);
  const [friends, setFriends] = useState<FriendWithPresence[]>([]);
  const [bans, setBans] = useState<UserBan[]>([]);

  const [requestsLoading, setRequestsLoading] = useState(true);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [bansLoading, setBansLoading] = useState(true);

  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [bansError, setBansError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<string | null>(null);

  /** State for ban confirmation modal — null = hidden. */
  const [confirmBan, setConfirmBan] = useState<{ userId: string; username: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; username: string } | null>(null);

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const result = await getIncomingRequests();
      setRequests(result.requests);
    } catch (e) {
      setRequestsError(e instanceof Error ? e.message : "Failed to load requests");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    setFriendsLoading(true);
    setFriendsError(null);
    try {
      const result = await getMyFriends();
      setFriends(result.friends);
    } catch (e) {
      setFriendsError(e instanceof Error ? e.message : "Failed to load friends");
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const fetchBans = useCallback(async () => {
    setBansLoading(true);
    setBansError(null);
    try {
      const result = await getMyBans();
      setBans(result.bans);
    } catch (e) {
      setBansError(e instanceof Error ? e.message : "Failed to load blocked users");
    } finally {
      setBansLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    void fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    void fetchBans();
  }, [fetchBans]);

  // ── Action handlers ─────────────────────────────────────────────────────────

  async function handleAccept(requestId: string) {
    setActionBusy(requestId);
    try {
      await acceptFriendRequest(requestId);
      void fetchRequests();
      void fetchFriends();
    } catch (e) {
      setRequestsError(e instanceof Error ? e.message : "Failed to accept request");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDecline(requestId: string) {
    setActionBusy(requestId);
    try {
      await declineFriendRequest(requestId);
      void fetchRequests();
    } catch (e) {
      setRequestsError(e instanceof Error ? e.message : "Failed to decline request");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRemoveConfirmed() {
    if (!confirmRemove) return;
    const { userId } = confirmRemove;
    setActionBusy(userId);
    setConfirmRemove(null);
    try {
      await removeFriend(userId);
      void fetchFriends();
    } catch (e) {
      setFriendsError(e instanceof Error ? e.message : "Failed to remove friend");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleBanConfirmed() {
    if (!confirmBan) return;
    const { userId } = confirmBan;
    setActionBusy(userId);
    setConfirmBan(null);
    try {
      await banUser(userId);
      void fetchFriends();
      void fetchBans();
    } catch (e) {
      setFriendsError(e instanceof Error ? e.message : "Failed to block user");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleUnban(userId: string) {
    setActionBusy(userId);
    try {
      await unbanUser(userId);
      void fetchBans();
    } catch (e) {
      setBansError(e instanceof Error ? e.message : "Failed to unblock user");
    } finally {
      setActionBusy(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rooms-view">
      <div className="rooms-view__header">
        <h2>Contacts</h2>
      </div>

      {/* ── Incoming Requests ─────────────────────────────────────────────── */}
      <section>
        <h3 className="manage-room__section-title">Incoming Requests</h3>
        {requestsError && <p className="error-msg">{requestsError}</p>}
        {requestsLoading && <p className="rooms-loading">Loading…</p>}
        {!requestsLoading && requests.length === 0 && (
          <p className="rooms-empty">No pending requests.</p>
        )}
        {!requestsLoading && requests.length > 0 && (
          <ul className="rooms-list" aria-label="Incoming friend requests">
            {requests.map((req) => (
              <li key={req.id} className="rooms-list__item">
                <div className="rooms-list__info">
                  <span className="rooms-list__name">{req.requester_username}</span>
                  {req.message && (
                    <span className="rooms-list__desc">{req.message}</span>
                  )}
                </div>
                <div className="rooms-list__actions">
                  <button
                    type="button"
                    className="btn btn--soft btn--xs"
                    onClick={() => void handleDecline(req.id)}
                    disabled={actionBusy === req.id}
                  >
                    {actionBusy === req.id ? "…" : "Decline"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--xs"
                    onClick={() => void handleAccept(req.id)}
                    disabled={actionBusy === req.id}
                  >
                    {actionBusy === req.id ? "…" : "Accept"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── My Friends ────────────────────────────────────────────────────── */}
      <section>
        <h3 className="manage-room__section-title">My Friends</h3>
        {friendsError && <p className="error-msg">{friendsError}</p>}
        {friendsLoading && <p className="rooms-loading">Loading…</p>}
        {!friendsLoading && friends.length === 0 && (
          <p className="rooms-empty">No friends yet.</p>
        )}
        {!friendsLoading && friends.length > 0 && (
          <ul className="rooms-list" aria-label="Friends list">
            {friends.map((f) => (
              <li key={f.userId} className="rooms-list__item">
                <div className="rooms-list__info">
                  <span className="rooms-list__name">{f.username}</span>
                </div>
                <div className="rooms-list__actions">
                  <button
                    type="button"
                    className="btn btn--soft btn--xs"
                    onClick={() => setConfirmRemove({ userId: f.userId, username: f.username })}
                    disabled={actionBusy === f.userId}
                  >
                    {actionBusy === f.userId ? "…" : "Remove"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--xs"
                    onClick={() => setConfirmBan({ userId: f.userId, username: f.username })}
                    disabled={actionBusy === f.userId}
                  >
                    Block
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Blocked Users ─────────────────────────────────────────────────── */}
      <section>
        <h3 className="manage-room__section-title">Blocked Users</h3>
        {bansError && <p className="error-msg">{bansError}</p>}
        {bansLoading && <p className="rooms-loading">Loading…</p>}
        {!bansLoading && bans.length === 0 && (
          <p className="rooms-empty">No blocked users.</p>
        )}
        {!bansLoading && bans.length > 0 && (
          <ul className="rooms-list" aria-label="Blocked users list">
            {bans.map((ban) => (
              <li key={ban.id} className="rooms-list__item">
                <div className="rooms-list__info">
                  <span className="rooms-list__name">{ban.banned_username}</span>
                </div>
                <div className="rooms-list__actions">
                  <button
                    type="button"
                    className="btn btn--soft btn--xs"
                    onClick={() => void handleUnban(ban.banned_user_id)}
                    disabled={actionBusy === ban.banned_user_id}
                  >
                    {actionBusy === ban.banned_user_id ? "…" : "Unblock"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Ban confirm modal ─────────────────────────────────────────────── */}
      {confirmBan && (
        <BanConfirmModal
          targetUsername={confirmBan.username}
          onConfirm={() => void handleBanConfirmed()}
          onCancel={() => setConfirmBan(null)}
          busy={actionBusy === confirmBan.userId}
        />
      )}
      {confirmRemove && (
        <RemoveFriendConfirmModal
          targetUsername={confirmRemove.username}
          onConfirm={() => void handleRemoveConfirmed()}
          onCancel={() => setConfirmRemove(null)}
          busy={actionBusy === confirmRemove.userId}
        />
      )}
    </div>
  );
}
