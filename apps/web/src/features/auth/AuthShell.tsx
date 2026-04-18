/**
 * AuthShell — Phase 2 locked auth shell.
 *
 * Single centered card layout (Variation A from the design prototype).
 * Three views are switchable within this shell:
 *   - "signin"   — default entry point (SignInView)
 *   - "register" — account creation (RegisterView)
 *   - "forgot"   — password reset request (ForgotPasswordView)
 *
 * The top bar shows the product logo and Sign in / Register navigation.
 * Switching views is handled by local state; no router required for Phase 2.
 */

import { useState } from "react";
import type { PublicUser } from "../../lib/api";
import { SignInView } from "./SignInView";
import { RegisterView } from "./RegisterView";
import { ForgotPasswordView } from "./ForgotPasswordView";

type AuthView = "signin" | "register" | "forgot";

interface AuthShellProps {
  onAuthenticated: (user: PublicUser) => void;
}

export function AuthShell({ onAuthenticated }: AuthShellProps) {
  const [view, setView] = useState<AuthView>("signin");

  return (
    <div className="auth-layout">
      {/* Top bar — logo + Sign in / Register toggle */}
      <header className="auth-topbar">
        <div className="auth-topbar__logo">&#9675; chatsrv</div>
        <nav className="auth-topbar__nav">
          <button
            type="button"
            className={`auth-topbar__btn${view === "signin" ? " auth-topbar__btn--active" : ""}`}
            onClick={() => setView("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-topbar__btn${view === "register" ? " auth-topbar__btn--active" : ""}`}
            onClick={() => setView("register")}
          >
            Register
          </button>
        </nav>
      </header>

      {/* Centered card area */}
      <main className="auth-center">
        <div className="auth-center__card">
          {view === "signin" && (
            <SignInView
              onSuccess={onAuthenticated}
              onSwitchToRegister={() => setView("register")}
              onSwitchToForgotPassword={() => setView("forgot")}
            />
          )}
          {view === "register" && (
            <RegisterView
              onSuccess={onAuthenticated}
              onSwitchToSignIn={() => setView("signin")}
            />
          )}
          {view === "forgot" && (
            <ForgotPasswordView
              onSwitchToSignIn={() => setView("signin")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
