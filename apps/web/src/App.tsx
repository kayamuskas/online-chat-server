/**
 * Phase 2 app entry — authentication core.
 *
 * Ships the locked Phase 2 auth shell as the default entry point.
 * Once the user authenticates, the app switches to the minimal Phase 2
 * logged-in surface (password change + current-session sign-out).
 *
 * Product features beyond auth (rooms, messaging) are out of scope for Phase 2.
 */

import { useState } from "react";
import type { PublicUser } from "./lib/api";
import { AuthShell } from "./features/auth/AuthShell";
import { PasswordSettingsView } from "./features/account/PasswordSettingsView";
import { SessionActionsView } from "./features/account/SessionActionsView";

type AccountTab = "password" | "session";

function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [tab, setTab] = useState<AccountTab>("password");

  if (!user) {
    return <AuthShell onAuthenticated={setUser} />;
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
            className={`app-account__nav-item${tab === "session" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("session")}
          >
            Sign out
          </button>
        </nav>

        <div className="app-account__content">
          {tab === "password" && <PasswordSettingsView />}
          {tab === "session" && (
            <SessionActionsView
              username={user.username}
              onSignedOut={() => setUser(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
