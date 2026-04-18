/**
 * ForgotPasswordView — password reset request view within the Phase 2 auth shell.
 *
 * Shows:
 *   - Email field
 *   - Submit button ("Send reset link")
 *   - Back to sign in link
 *
 * The API always returns 200 regardless of whether the email is registered
 * (server-side enumeration protection). We show a success message after submit.
 */

import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "../../lib/api";

interface ForgotPasswordViewProps {
  onSwitchToSignIn: () => void;
}

export function ForgotPasswordView({ onSwitchToSignIn }: ForgotPasswordViewProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset({ email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-card">
        <h2>Reset password</h2>
        <p className="auth-card__sub">
          If an account with that email exists, a reset link has been sent. Check
          your mail outbox.
        </p>
        <button type="button" className="btn btn--block" onClick={onSwitchToSignIn}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Reset password</h2>
      <p className="auth-card__sub">
        We'll send a password reset link to your email.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="forgot-email" className="field__label">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            className="field__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        {error && <p className="auth-card__error">{error}</p>}

        <button type="submit" className="btn btn--block" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
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
