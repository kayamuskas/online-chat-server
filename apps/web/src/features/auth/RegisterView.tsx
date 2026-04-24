/**
 * RegisterView — account creation view within the Phase 2 auth shell.
 *
 * Shows:
 *   - Email, Username, Password, Confirm password fields
 *   - Inline AVAILABLE/TAKEN badges after submit (D-9.1-02)
 *   - Password strength indicator after submit (D-9.1-03)
 *   - Username permanence reminder (D-9.1-05)
 *   - Submit button ("Create account")
 *   - "Already registered? Sign in" link
 *
 * Validation runs on submit only — no keystroke/debounce checking (D-9.1-01).
 */

import { useState, type FormEvent } from "react";
import type { PublicUser } from "../../lib/api";
import { register } from "../../lib/api";

interface RegisterViewProps {
  onSuccess: (user: PublicUser) => void;
  onSwitchToSignIn: () => void;
}

function checkPasswordStrength(pw: string): "strong" | "weak" {
  if (pw.length >= 12) return "strong";
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  if (pw.length >= 8 && hasUpper && hasLower && hasDigit) return "strong";
  return "weak";
}

export function RegisterView({ onSuccess, onSwitchToSignIn }: RegisterViewProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Inline validation state — set after submit only (D-9.1-01)
  const [emailStatus, setEmailStatus] = useState<"available" | "taken" | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<"available" | "taken" | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<"strong" | "weak" | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailStatus(null);
    setUsernameStatus(null);
    setPasswordStrength(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    // Compute password strength before the API call (D-9.1-03)
    setPasswordStrength(checkPasswordStrength(password));

    setLoading(true);
    try {
      const result = await register({ email, username, password });
      // Both fields passed — show available badges before calling onSuccess
      setEmailStatus("available");
      setUsernameStatus("available");
      onSuccess(result.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("email is already registered")) {
        // Backend checks email first; if it fails, username was never checked
        // Only show "taken" for the failing field — no badge for unchecked username (D-9.1-04, Pitfall 1)
        setEmailStatus("taken");
        setUsernameStatus(null);
      } else if (msg.includes("username is already taken")) {
        // Email passed uniqueness check before the username check ran
        setUsernameStatus("taken");
        setEmailStatus("available");
      } else {
        setError(msg || "Registration failed");
      }
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
          {emailStatus && (
            <span className={`badge ${emailStatus === "available" ? "ok" : "warn"}`}>
              {emailStatus === "available" ? "available" : "taken"}
            </span>
          )}
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
          {usernameStatus && (
            <span className={`badge ${usernameStatus === "available" ? "ok" : "warn"}`}>
              {usernameStatus === "available" ? "available" : "taken"}
            </span>
          )}
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
          {passwordStrength && (
            <span className={`badge ${passwordStrength === "strong" ? "ok" : "warn"}`}>
              {passwordStrength}
            </span>
          )}
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

        {/* D-9.1-05: Immutable username reminder */}
        <p className="auth-card__note" style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-muted)", marginTop: "8px" }}>
          &#9998; username is immutable after sign-up
        </p>

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
