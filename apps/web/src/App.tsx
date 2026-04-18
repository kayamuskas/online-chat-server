/**
 * Phase 3 app entry — authentication core + active-sessions account UI + presence rendering.
 *
 * Ships the locked Phase 3 auth shell at `/` and the authenticated account
 * surface at `/account`. On a direct `/account` load, the app asks the API
 * for the current user so browser-close semantics can be verified via URL.
 *
 * Phase 3 tabs:
 *   - "Sessions" → ActiveSessionsView: full active-session inventory
 *   - "Presence"  → CompactPresenceList + DetailedPresencePanel: proves the compact-vs-detailed
 *                   rendering contract (D-10, D-11, D-13) using representative fixture members
 */

import { useEffect, useState } from "react";
import { me, type PublicUser } from "./lib/api";
import { AuthShell } from "./features/auth/AuthShell";
import { PasswordSettingsView } from "./features/account/PasswordSettingsView";
import { ActiveSessionsView } from "./features/account/ActiveSessionsView";
import { CompactPresenceList } from "./features/presence/CompactPresenceList";
import { DetailedPresencePanel } from "./features/presence/DetailedPresencePanel";

type AccountTab = "password" | "sessions" | "presence";

function isAccountRoute() {
  return window.location.pathname === "/account";
}

/**
 * Representative members used to prove the compact and detailed presence
 * rendering contracts (D-10, D-11, D-13). These match the wireframe and
 * contacts.jsx design reference names/statuses.
 */
const DEMO_MEMBERS = [
  { id: "alice", username: "alice", status: "online" as const, lastSeenAt: null },
  { id: "bob", username: "bob", status: "afk" as const, lastSeenAt: null },
  { id: "carol", username: "carol", status: "afk" as const, lastSeenAt: null },
  { id: "mike", username: "mike", status: "offline" as const, lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: "dave", username: "dave", status: "online" as const, lastSeenAt: null },
];

function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [tab, setTab] = useState<AccountTab>("sessions");
  const [checkingSession, setCheckingSession] = useState(isAccountRoute());

  function handleAuthenticated(nextUser: PublicUser) {
    setUser(nextUser);
    window.history.replaceState(null, "", "/account");
  }

  function handleSignedOut() {
    setUser(null);
    window.history.replaceState(null, "", "/");
  }

  useEffect(() => {
    if (!isAccountRoute()) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      setCheckingSession(true);
      try {
        const result = await me();
        if (!cancelled) {
          setUser(result.user);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          window.history.replaceState(null, "", "/");
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checkingSession) {
    return (
      <div className="auth-layout">
        <main className="auth-center">
          <div className="auth-center__card">
            <div className="auth-card">
              <h2>Checking session</h2>
              <p className="auth-card__sub">
                Verifying the current browser session.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return <AuthShell onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-layout">
      <header className="app-topbar">
        <div className="app-topbar__logo">&#9675; chatsrv</div>
        <span className="app-topbar__user">{user.username}</span>
      </header>

      <main className="app-account">
        <nav className="app-account__nav">
          <div className="app-account__nav-label">ACCOUNT</div>
          <button
            type="button"
            className={`app-account__nav-item${tab === "password" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("password")}
          >
            Password
          </button>
          <button
            type="button"
            className={`app-account__nav-item${tab === "sessions" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("sessions")}
          >
            Active sessions
          </button>
          <button
            type="button"
            className={`app-account__nav-item${tab === "presence" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("presence")}
          >
            Presence
          </button>
        </nav>

        <div className="app-account__content">
          {tab === "password" && <PasswordSettingsView />}
          {tab === "sessions" && (
            <ActiveSessionsView onSignedOut={handleSignedOut} />
          )}
          {tab === "presence" && (
            <div className="presence-demo">
              <h2>Presence rendering</h2>
              <p className="sub">
                Phase 3 presence contract: compact list surfaces show colored
                dots only; detailed surfaces show explicit status text and
                offline last&nbsp;seen.
              </p>
              <div className="presence-demo__panels">
                <div className="presence-demo__panel">
                  <CompactPresenceList
                    members={DEMO_MEMBERS}
                    title="Compact — dot only (contacts/chat list)"
                  />
                </div>
                <div className="presence-demo__panel">
                  <DetailedPresencePanel
                    members={DEMO_MEMBERS}
                    title="Detailed — status text + last seen (room member panel)"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
