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

import { useEffect, useState } from "react";
import type { PublicUser } from "../../lib/api";
import { SignInView } from "./SignInView";
import { RegisterView } from "./RegisterView";
import { ForgotPasswordView } from "./ForgotPasswordView";
import { ResetPasswordView } from "./ResetPasswordView";

type AuthView = "signin" | "register" | "forgot" | "reset";

interface AuthShellProps {
  onAuthenticated: (user: PublicUser) => void;
}

function getLocationState(): { view: AuthView; token: string | null } {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (window.location.pathname === "/reset-password") {
    return { view: "reset", token };
  }

  return { view: "signin", token: null };
}

export function AuthShell({ onAuthenticated }: AuthShellProps) {
  const initialState = getLocationState();
  const [view, setView] = useState<AuthView>(initialState.view);
  const [resetToken, setResetToken] = useState<string | null>(initialState.token);

  function navigate(nextView: AuthView, token: string | null = null) {
    setView(nextView);
    setResetToken(token);

    let nextUrl = "/";
    if (nextView === "reset") {
      const params = new URLSearchParams();
      if (token) {
        params.set("token", token);
      }
      nextUrl = `/reset-password${params.toString() ? `?${params.toString()}` : ""}`;
    }

    window.history.replaceState(null, "", nextUrl);
  }

  useEffect(() => {
    function syncFromLocation() {
      const state = getLocationState();
      setView(state.view);
      setResetToken(state.token);
    }

    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  return (
    <div className="auth-layout">
      {/* Top bar — logo + Sign in / Register toggle */}
      <header className="auth-topbar">
        <div className="auth-topbar__logo">&#9675; chatsrv</div>
        <nav className="auth-topbar__nav">
          <button
            type="button"
            className={`auth-topbar__btn${view === "signin" || view === "forgot" || view === "reset" ? " auth-topbar__btn--active" : ""}`}
            onClick={() => navigate("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-topbar__btn${view === "register" ? " auth-topbar__btn--active" : ""}`}
            onClick={() => navigate("register")}
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
              onSwitchToRegister={() => navigate("register")}
              onSwitchToForgotPassword={() => navigate("forgot")}
            />
          )}
          {view === "register" && (
            <RegisterView
              onSuccess={onAuthenticated}
              onSwitchToSignIn={() => navigate("signin")}
            />
          )}
          {view === "forgot" && (
            <ForgotPasswordView
              onSwitchToSignIn={() => navigate("signin")}
            />
          )}
          {view === "reset" && (
            <ResetPasswordView
              token={resetToken}
              onSwitchToSignIn={() => navigate("signin")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
