/**
 * SignInView — default entry point of the Phase 2 auth shell.
 *
 * Shows:
 *   - Email + password fields
 *   - "Keep me signed in" checkbox (visible per D-04)
 *   - "Forgot password?" link to switch to ForgotPasswordView
 *   - Submit button ("Sign in")
 *   - "No account yet? Register" link to switch to RegisterView
 */

import { useState, type FormEvent } from "react";
import type { PublicUser } from "../../lib/api";
import { signIn } from "../../lib/api";

interface SignInViewProps {
  onSuccess: (user: PublicUser) => void;
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword: () => void;
}

export function SignInView({
  onSuccess,
  onSwitchToRegister,
  onSwitchToForgotPassword,
}: SignInViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn({ email, password, keepSignedIn });
      onSuccess(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Sign in</h2>
      <p className="auth-card__sub">
        Welcome back. Your session stays signed in on this browser.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="signin-email" className="field__label">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            className="field__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="signin-password" className="field__label">
            Password
          </label>
          <input
            id="signin-password"
            type="password"
            className="field__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="your password"
            required
            autoComplete="current-password"
          />
        </div>

        <div className="auth-card__row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
            />
            <span>Keep me signed in</span>
          </label>
          <button
            type="button"
            className="link"
            onClick={onSwitchToForgotPassword}
          >
            Forgot password?
          </button>
        </div>

        {error && <p className="auth-card__error">{error}</p>}

        <button type="submit" className="btn btn--block" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="auth-card__foot">
          No account yet?{" "}
          <button type="button" className="link" onClick={onSwitchToRegister}>
            Register
          </button>
        </p>
      </form>
    </div>
  );
}
