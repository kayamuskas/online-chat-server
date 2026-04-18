/**
 * FriendRequestDropdown — Phase 5 notification dropdown for incoming friend requests (D-01, D-02, D-03).
 *
 * Shows incoming friend requests with Accept and Decline actions per row.
 * Does NOT show outgoing requests (D-03).
 * Positioned as a dropdown panel from the notification icon in the top nav.
 */

import { type IncomingFriendRequestView } from "../../lib/api";

interface FriendRequestDropdownProps {
  requests: IncomingFriendRequestView[];
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  actionBusy?: string | null;
  onClose?: () => void;
}

export function FriendRequestDropdown({
  requests,
  onAccept,
  onDecline,
  actionBusy,
  onClose,
}: FriendRequestDropdownProps) {
  return (
    <div className="notif-dropdown" role="dialog" aria-label="Friend requests">
      <div className="notif-dropdown__header">
        <span>Friend Requests</span>
        <button type="button" className="btn btn--soft btn--xs" onClick={onClose}>
          ✕
        </button>
      </div>
      {requests.length === 0 && (
        <p className="rooms-empty">No pending requests.</p>
      )}
      {requests.map((req) => (
        <div key={req.id} className="notif-row">
          <div>
            <strong>{req.requester_username}</strong>
            {req.message && (
              <p className="sub" style={{ margin: 0, fontSize: "0.8rem" }}>
                {req.message}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button
              type="button"
              className="btn btn--soft btn--xs"
              onClick={() => onDecline?.(req.id)}
              disabled={actionBusy === req.id}
            >
              {actionBusy === req.id ? "…" : "Decline"}
            </button>
            <button
              type="button"
              className="btn btn--xs"
              onClick={() => onAccept?.(req.id)}
              disabled={actionBusy === req.id}
            >
              {actionBusy === req.id ? "…" : "Accept"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
