/**
 * BanConfirmModal — Phase 5 confirmation dialog before banning a user (D-07).
 *
 * Text confirms that banning will block the user and remove the friendship.
 * Includes Cancel and Block (confirm) buttons with busy state.
 */

interface BanConfirmModalProps {
  targetUsername: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}

export function BanConfirmModal({
  targetUsername,
  onConfirm,
  onCancel,
  busy = false,
}: BanConfirmModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Block {targetUsername}?</h3>
        <p>
          This will block the user and remove the friendship. This action can be reversed from
          your account settings.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--soft"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Blocking…" : "Block"}
          </button>
        </div>
      </div>
    </div>
  );
}
