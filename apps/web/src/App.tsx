/**
 * Phase 3 app entry — authentication core + active-sessions account UI.
 *
 * Ships the locked Phase 3 auth shell at `/` and the authenticated account
 * surface at `/account`. On a direct `/account` load, the app asks the API
 * for the current user so browser-close semantics can be verified via URL.
 *
 * Phase 3 change: the "Sessions" tab now renders ActiveSessionsView (the full
 * active-session inventory) instead of the Phase 2 minimal sign-out card.
 */

import { useEffect, useState } from "react";
import { me, type PublicUser } from "./lib/api";
import { AuthShell } from "./features/auth/AuthShell";
import { PasswordSettingsView } from "./features/account/PasswordSettingsView";
import { ActiveSessionsView } from "./features/account/ActiveSessionsView";

type AccountTab = "password" | "sessions";

function isAccountRoute() {
  return window.location.pathname === "/account";
}

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
        </nav>

        <div className="app-account__content">
          {tab === "password" && <PasswordSettingsView />}
          {tab === "sessions" && (
            <ActiveSessionsView onSignedOut={handleSignedOut} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
