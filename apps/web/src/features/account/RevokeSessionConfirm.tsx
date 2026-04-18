/**
 * RevokeSessionConfirm — reusable inline confirmation for destructive session actions.
 *
 * Renders as a compact inline block (not a modal) so the confirm interaction
 * feels fast and contextual. Supports both per-row revoke and bulk "sign out
 * all other sessions" flows.
 *
 * Props:
 *   label    — primary confirm question (e.g. "Sign out this session?")
 *   detail   — secondary explanation text
 *   onConfirm — called when user clicks the destructive confirm button
 *   onCancel  — called when user clicks Cancel
 *   loading   — disables both buttons while the revoke call is in flight
 *   danger    — when true, styles the confirm button as btn--danger (default: btn--danger)
 *
 * Threat model (T-03-08):
 *   - Destructive action is always explicit — no single-click revoke
 *   - Cancel returns to the normal row state without side effects
 *   - Wording distinguishes per-row vs bulk actions clearly
 */

interface RevokeSessionConfirmProps {
  label: string;
  detail: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  danger?: boolean;
}

export function RevokeSessionConfirm({
  label,
  detail,
  onConfirm,
  onCancel,
  loading,
  danger = true,
}: RevokeSessionConfirmProps) {
  return (
    <div className="revoke-confirm">
      <div className="revoke-confirm__text">
        <div className="revoke-confirm__label">{label}</div>
        <div className="revoke-confirm__detail">{detail}</div>
      </div>
      <div className="revoke-confirm__actions">
        <button
          type="button"
          className="btn btn--soft btn--xs"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`btn btn--xs${danger ? " btn--danger" : ""}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
