/**
 * PresenceDot — compact presence indicator primitive.
 *
 * Used in list contexts (contacts, chat-list sidebar) where only a
 * colored dot is shown without explicit status text.
 *
 * Colors follow the locked Phase 3 direction (D-12):
 *   online  → green  (#4ade80  / var(--presence-online))
 *   afk     → amber  (#f59e0b  / var(--presence-afk))
 *   offline → gray   (#6b7280  / var(--presence-offline))
 *
 * The dot uses a CSS class so the host element can apply spacing and
 * layout without importing extra CSS. Styles are in styles.css.
 */

export type PresenceStatus = "online" | "afk" | "offline";

export interface PresenceDotProps {
  status: PresenceStatus;
  /** Accessible label override; defaults to the status string. */
  label?: string;
  /** Additional CSS class names forwarded to the root element. */
  className?: string;
}

/**
 * Renders a small colored dot representing presence status.
 * Does NOT render any text — use PresenceLabel for status text.
 */
export function PresenceDot({ status, label, className = "" }: PresenceDotProps) {
  const ariaLabel = label ?? statusToAriaLabel(status);
  return (
    <span
      className={`presence-dot presence-dot--${status}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
    />
  );
}

function statusToAriaLabel(status: PresenceStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "afk":
      return "Away from keyboard";
    case "offline":
      return "Offline";
  }
}
