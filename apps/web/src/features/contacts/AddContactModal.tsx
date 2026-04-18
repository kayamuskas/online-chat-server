/**
 * AddContactModal — Phase 5 modal for sending a friend request by username (D-04, D-06, FRND-01).
 *
 * Fields:
 *   - Username (required) — the target username to send request to
 *   - Message (optional) — optional text to accompany the request (D-06, FRND-01)
 *
 * On success: shows "Request sent!" status, clears fields, calls onSuccess and onClose.
 */

import { useState } from "react";
import { sendFriendRequest } from "../../lib/api";

interface AddContactModalProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function AddContactModal({ onClose, onSuccess }: AddContactModalProps) {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await sendFriendRequest({
        targetUsername: username.trim(),
        message: message.trim() || undefined,
      });
      setSuccess("Request sent!");
      setUsername("");
      setMessage("");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Add contact</h3>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          {error && <p className="error-msg">{error}</p>}
          {success && <p style={{ color: "var(--color-success, #4ade80)" }}>{success}</p>}

          <div className="field">
            <label className="field__label" htmlFor="contact-username">
              Username
            </label>
            <input
              id="contact-username"
              className="field__input"
              type="text"
              placeholder="e.g. alice"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="contact-message">
              Message <span className="field__optional">(optional)</span>
            </label>
            <input
              id="contact-message"
              className="field__input"
              type="text"
              placeholder="Say hello…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--soft"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={submitting || !username.trim()}
            >
              {submitting ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
