/**
 * SessionActionsView — current-session sign-out surface.
 *
 * Phase 2 account action: allows the logged-in user to sign out their
 * current browser session only. Active-session inventory, sign-out-all,
 * and multi-session management are deferred to Phase 3 (D-07, D-14).
 *
 * API: POST /api/v1/auth/sign-out
 */

import { useState } from "react";
import { signOut } from "../../lib/api";

interface SessionActionsViewProps {
  username: string;
  onSignedOut: () => void;
}

export function SessionActionsView({
  username,
  onSignedOut,
}: SessionActionsViewProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setError(null);
    setLoading(true);
    try {
      await signOut();
      onSignedOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Current session</h2>
      <p className="sub">
        Sign out from this browser. Other sessions are not affected.
        Multi-session management is available in a future update.
      </p>

      <div className="session-box">
        <div className="session-box__label">SIGNED IN AS</div>
        <div className="session-box__user">@{username}</div>
        <div className="session-box__note">Current browser session</div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--soft"
          onClick={handleSignOut}
          disabled={loading}
        >
          {loading ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
