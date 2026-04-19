interface RemoveFriendConfirmModalProps {
  targetUsername: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}

export function RemoveFriendConfirmModal({
  targetUsername,
  onConfirm,
  onCancel,
  busy = false,
}: RemoveFriendConfirmModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Remove {targetUsername} from friends?</h3>
        <p>
          This will remove the friendship and close the direct contact relationship. You can add
          the user again later.
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
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
