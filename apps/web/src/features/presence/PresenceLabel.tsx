/**
 * PresenceLabel — inline status text for detailed presence surfaces.
 *
 * Used in detailed contexts (room member panel, member-info popover)
 * where an explicit textual status such as "(AFK)" or "offline" is
 * displayed alongside the user's name.
 *
 * Compact list contexts (contacts list, sidebar) should use PresenceDot
 * instead and NOT render any label text per the locked design contract (D-10).
 *
 * Examples aligned to wireframes and design reference:
 *   online  → "online"      (or omitted; often implicit)
 *   afk     → "AFK"
 *   offline → "offline"
 *
 * Use `PresenceTimestamp` for the textual `last seen` detail when offline.
 */

import type { PresenceStatus } from "./PresenceDot";

export interface PresenceLabelProps {
  status: PresenceStatus;
  /** Additional CSS class names forwarded to the root element. */
  className?: string;
}

const STATUS_TEXT: Record<PresenceStatus, string> = {
  online: "online",
  afk: "AFK",
  offline: "offline",
};

/**
 * Renders the textual status label for a given presence status.
 * Styled with `presence-label--{status}` for color theming.
 */
export function PresenceLabel({ status, className = "" }: PresenceLabelProps) {
  return (
    <span
      className={`presence-label presence-label--${status}${className ? ` ${className}` : ""}`}
    >
      {STATUS_TEXT[status]}
    </span>
  );
}
