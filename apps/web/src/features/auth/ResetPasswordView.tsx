/**
 * ResetPasswordView — password reset confirmation view.
 *
 * This screen is reached from the reset link in the mock mail artifact:
 *   /reset-password?token=...
 *
 * It collects the new password, confirms it, and calls the Phase 2
 * password-reset confirm API endpoint.
 */

import { useState, type FormEvent } from "react";
import { confirmPasswordReset } from "../../lib/api";

interface ResetPasswordViewProps {
  token: string | null;
  onSwitchToSignIn: () => void;
}

export function ResetPasswordView({
  token,
  onSwitchToSignIn,
}: ResetPasswordViewProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset({ token, newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="auth-card">
        <h2>Password updated</h2>
        <p className="auth-card__sub">
          Your password has been reset. You can now sign in with the new password.
        </p>
        <button type="button" className="btn btn--block" onClick={onSwitchToSignIn}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Choose a new password</h2>
      <p className="auth-card__sub">
        Enter your new password to complete the reset flow.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="reset-new-password" className="field__label">
            New password
          </label>
          <input
            id="reset-new-password"
            type="password"
            className="field__input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="at least 8 characters"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="field">
          <label htmlFor="reset-confirm-password" className="field__label">
            Confirm new password
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            className="field__input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="repeat new password"
            required
            autoComplete="new-password"
          />
        </div>

        {error && <p className="auth-card__error">{error}</p>}

        <button type="submit" className="btn btn--block" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </button>

        <p className="auth-card__foot">
          <button type="button" className="link" onClick={onSwitchToSignIn}>
            &larr; Back to sign in
          </button>
        </p>
      </form>
    </div>
  );
}
