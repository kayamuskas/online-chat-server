/**
 * RegisterView — account creation view within the Phase 2 auth shell.
 *
 * Shows:
 *   - Email, Username, Password, Confirm password fields
 *   - Username permanence reminder
 *   - Submit button ("Create account")
 *   - "Already registered? Sign in" link
 */

import { useState, type FormEvent } from "react";
import type { PublicUser } from "../../lib/api";
import { register } from "../../lib/api";

interface RegisterViewProps {
  onSuccess: (user: PublicUser) => void;
  onSwitchToSignIn: () => void;
}

export function RegisterView({ onSuccess, onSwitchToSignIn }: RegisterViewProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const result = await register({ email, username, password });
      onSuccess(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Create account</h2>
      <p className="auth-card__sub">
        Email and username must be unique. Username is permanent.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="reg-email" className="field__label">
            Email
          </label>
          <input
            id="reg-email"
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
          <label htmlFor="reg-username" className="field__label">
            Username
          </label>
          <input
            id="reg-username"
            type="text"
            className="field__input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="pick a handle (permanent)"
            required
            autoComplete="username"
          />
        </div>

        <div className="field">
          <label htmlFor="reg-password" className="field__label">
            Password
          </label>
          <input
            id="reg-password"
            type="password"
            className="field__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 8 characters"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="field">
          <label htmlFor="reg-confirm-password" className="field__label">
            Confirm password
          </label>
          <input
            id="reg-confirm-password"
            type="password"
            className="field__input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="repeat password"
            required
            autoComplete="new-password"
          />
        </div>

        {error && <p className="auth-card__error">{error}</p>}

        <button type="submit" className="btn btn--block" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="auth-card__foot">
          Already registered?{" "}
          <button type="button" className="link" onClick={onSwitchToSignIn}>
            Sign in
          </button>
        </p>
      </form>
    </div>
  );
}
