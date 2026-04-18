/**
 * ActiveSessionsView — Phase 3 active-sessions inventory screen.
 *
 * Replaces the Phase 2 minimal current-session sign-out card.
 * Matches the locked reference layout (account.jsx, D-01 through D-08):
 *
 *   - Section title "Active sessions" + explanatory subcopy
 *   - Three-column table: Device / Browser | IP | Last active
 *   - "This browser" badge on the current session row
 *   - Per-row Sign out action
 *   - Explicit "Sign out all other sessions" at the bottom (danger style)
 *
 * Revocation behavior (D-03, T-03-08, T-03-09):
 *   - Revoking "This browser" → immediate sign-out (onSignedOut callback)
 *   - Revoking another session → removes it from the list, no page reload
 *   - Revoking all others → removes all non-current rows from the list
 *
 * Confirmation UX (D-04): compact inline confirm state on the row action.
 * The confirmation is handled by RevokeSessionConfirm.
 */

import { useEffect, useState } from "react";
import { listSessions, revokeSession, revokeOtherSessions } from "../../lib/api";
import type { SessionInventoryItem } from "../../lib/api";
import { SessionRow } from "./SessionRow";
import { RevokeSessionConfirm } from "./RevokeSessionConfirm";

interface ActiveSessionsViewProps {
  onSignedOut: () => void;
}

export function ActiveSessionsView({ onSignedOut }: ActiveSessionsViewProps) {
  const [sessions, setSessions] = useState<SessionInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Confirmation state: null = no confirm open; "others" = bulk; string = sessionId
  const [confirming, setConfirming] = useState<string | "others" | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listSessions();
      setSessions(result.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // ── Per-row revoke ────────────────────────────────────────────────────────

  function handleRevokeRequest(sessionId: string) {
    setConfirming(sessionId);
  }

  async function handleRevokeConfirm() {
    if (!confirming || confirming === "others") return;
    const sessionId = confirming;
    const target = sessions.find((s) => s.sessionId === sessionId);
    setRevoking(true);
    setError(null);
    try {
      await revokeSession(sessionId);
      if (target?.isCurrentSession) {
        // Revoking this browser — return to sign-in immediately (T-03-09)
        onSignedOut();
        return;
      }
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
    } finally {
      setRevoking(false);
      setConfirming(null);
    }
  }

  // ── Bulk revoke others ────────────────────────────────────────────────────

  function handleRevokeOthersRequest() {
    setConfirming("others");
  }

  async function handleRevokeOthersConfirm() {
    setRevoking(true);
    setError(null);
    try {
      await revokeOtherSessions();
      // Keep only the current session in the list
      setSessions((prev) => prev.filter((s) => s.isCurrentSession));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
    } finally {
      setRevoking(false);
      setConfirming(null);
    }
  }

  // ── Confirmation cancel ───────────────────────────────────────────────────

  function handleCancel() {
    setConfirming(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const otherSessionCount = sessions.filter((s) => !s.isCurrentSession).length;

  return (
    <div>
      <h2>Active sessions</h2>
      <p className="sub">
        Sign out individual browsers. Signing out here doesn't affect your
        other devices unless you use "Sign out all other sessions".
      </p>

      {error && <p className="error-msg">{error}</p>}

      {loading ? (
        <p className="sessions-loading">Loading sessions…</p>
      ) : (
        <>
          <table className="sessions-table">
            <thead>
              <tr>
                <th className="sessions-table__th">Device / Browser</th>
                <th className="sessions-table__th">IP</th>
                <th className="sessions-table__th">Last active</th>
                <th className="sessions-table__th" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) =>
                confirming === session.sessionId ? (
                  <tr key={session.sessionId}>
                    <td colSpan={4}>
                      <RevokeSessionConfirm
                        label={
                          session.isCurrentSession
                            ? "Sign out this browser?"
                            : "Sign out this session?"
                        }
                        detail={
                          session.isCurrentSession
                            ? "You will be returned to the sign-in screen immediately."
                            : "This session will be ended and the device will need to sign in again."
                        }
                        onConfirm={handleRevokeConfirm}
                        onCancel={handleCancel}
                        loading={revoking}
                      />
                    </td>
                  </tr>
                ) : (
                  <SessionRow
                    key={session.sessionId}
                    session={session}
                    onRevoke={handleRevokeRequest}
                    revoking={revoking}
                  />
                )
              )}
            </tbody>
          </table>

          {otherSessionCount > 0 && (
            <div className="sessions-footer">
              {confirming === "others" ? (
                <RevokeSessionConfirm
                  label="Sign out all other sessions?"
                  detail={`This will end ${otherSessionCount} other session${otherSessionCount !== 1 ? "s" : ""}. Your current browser session is not affected.`}
                  onConfirm={handleRevokeOthersConfirm}
                  onCancel={handleCancel}
                  loading={revoking}
                  danger
                />
              ) : (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleRevokeOthersRequest}
                  disabled={revoking}
                >
                  Sign out all other sessions
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
