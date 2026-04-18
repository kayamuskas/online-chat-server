/**
 * PasswordSettingsView — authenticated password change surface.
 *
 * Phase 2 account action: allows the logged-in user to change their password
 * by providing the current password and a new one.
 *
 * API: POST /api/v1/auth/change-password
 */

import { useState, type FormEvent } from "react";
import { changePassword } from "../../lib/api";

export function PasswordSettingsView() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmNew) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Change password</h2>
      <p className="sub">No forced periodic change. Passwords are stored hashed.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="pw-current" className="field__label">
            Current password
          </label>
          <input
            id="pw-current"
            type="password"
            className="field__input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="your current password"
            required
            autoComplete="current-password"
          />
        </div>

        <div className="field">
          <label htmlFor="pw-new" className="field__label">
            New password
          </label>
          <input
            id="pw-new"
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
          <label htmlFor="pw-confirm-new" className="field__label">
            Confirm new password
          </label>
          <input
            id="pw-confirm-new"
            type="password"
            className="field__input"
            value={confirmNew}
            onChange={(e) => setConfirmNew(e.target.value)}
            placeholder="repeat new password"
            required
            autoComplete="new-password"
          />
        </div>

        {error && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">Password changed successfully.</p>}

        <div className="form-actions">
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Changing…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}
