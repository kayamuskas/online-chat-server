import { useEffect, useState } from "react";
import { listSessions, signOut, deleteAccount, type PublicUser, type SessionInventoryItem } from "../../lib/api";

interface AccountOverviewViewProps {
  user: PublicUser;
  onOpenPassword: () => void;
  onOpenSessions: () => void;
  onOpenPresence: () => void;
  onSignedOut: () => void;
}

export function AccountOverviewView({
  user,
  onOpenPassword,
  onOpenSessions,
  onOpenPresence,
  onSignedOut,
}: AccountOverviewViewProps) {
  const [sessions, setSessions] = useState<SessionInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDeleteAccount, setConfirmingDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      setLoading(true);
      setError(null);
      try {
        const result = await listSessions();
        if (!cancelled) {
          setSessions(result.sessions);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load account summary");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentSession = sessions.find((session) => session.isCurrentSession) ?? null;
  const otherSessionCount = sessions.filter((session) => !session.isCurrentSession).length;

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      await deleteAccount({ password: deletePassword });
      onSignedOut();  // Same callback as sign-out — redirects to auth screen (D-16)
    } catch (err) {
      setDeleteAccountError(err instanceof Error ? err.message : "Deletion failed. Please try again.");
      setDeletingAccount(false);
    }
  }

  async function handleSignOutCurrent() {
    setSigningOut(true);
    try {
      await signOut();
      onSignedOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
      setSigningOut(false);
    }
  }

  return (
    <div className="account-overview">
      <section className="account-overview__hero">
        <div>
          <p className="account-overview__kicker">Account</p>
          <h2>{user.username}</h2>
          <p className="sub">{user.email}</p>
        </div>
        <button
          type="button"
          className="btn btn--soft"
          onClick={() => void handleSignOutCurrent()}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out this browser"}
        </button>
      </section>

      {error && <p className="error-msg">{error}</p>}

      <div className="account-overview__grid">
        <button type="button" className="account-overview__card" onClick={onOpenPassword}>
          <span className="account-overview__label">Password</span>
          <strong>Change password</strong>
          <p>Rotate credentials and keep browser access under your control.</p>
        </button>

        <button type="button" className="account-overview__card" onClick={onOpenSessions}>
          <span className="account-overview__label">Sessions</span>
          <strong>{loading ? "Loading sessions…" : `${sessions.length} active sessions`}</strong>
          <p>
            {loading
              ? "Checking current browser and other signed-in devices."
              : `${otherSessionCount} other session${otherSessionCount === 1 ? "" : "s"} can be revoked.`}
          </p>
        </button>

        <button type="button" className="account-overview__card" onClick={onOpenPresence}>
          <span className="account-overview__label">Presence</span>
          <strong>Inspect presence surfaces</strong>
          <p>Verify compact and detailed status rendering inside the shipped shell.</p>
        </button>
      </div>

      {!loading && currentSession && (
        <section className="account-overview__snapshot">
          <p className="account-overview__label">Current browser</p>
          <div className="account-overview__snapshot-row">
            <span>{currentSession.userAgent ?? "Unknown browser"}</span>
            <span>{currentSession.ipAddress ?? "Unknown IP"}</span>
            <span>{new Date(currentSession.lastSeenAt).toLocaleString()}</span>
          </div>
        </section>
      )}

      <section className="danger-zone">
        <div className="danger-zone__title">Danger Zone</div>
        <p className="danger-zone__description">
          Permanently delete your account. All rooms you own will be deleted. You will be signed out immediately.
        </p>
        {!confirmingDeleteAccount ? (
          <button
            type="button"
            className="btn btn--danger btn--xs"
            onClick={() => setConfirmingDeleteAccount(true)}
          >
            Delete Account
          </button>
        ) : (
          <div className="danger-zone__confirm">
            <p className="danger-zone__confirm-text">
              Enter your password to confirm account deletion. This action cannot be undone.
            </p>
            <input
              type="password"
              className="field__input danger-zone__password-field"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              disabled={deletingAccount}
              autoComplete="current-password"
              placeholder="Your current password"
            />
            <div className="danger-zone__confirm-actions">
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void handleDeleteAccount()}
                disabled={deletingAccount || deletePassword.trim().length === 0}
              >
                {deletingAccount ? "Deleting\u2026" : "Confirm Delete Account"}
              </button>
              <button
                type="button"
                className="btn btn--soft"
                onClick={() => { setConfirmingDeleteAccount(false); setDeletePassword(""); setDeleteAccountError(null); }}
                disabled={deletingAccount}
              >
                Keep Account
              </button>
            </div>
            {deleteAccountError && <p className="error-msg">{deleteAccountError}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
