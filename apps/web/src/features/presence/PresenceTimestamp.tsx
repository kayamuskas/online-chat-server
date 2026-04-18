/**
 * PresenceTimestamp — textual "last seen" display for offline detail surfaces.
 *
 * Per the locked design contract (D-13), when a user is offline the detailed
 * surface must show a textual `last seen` timestamp alongside the offline status.
 * This component is used exclusively in DetailedPresencePanel for offline users.
 *
 * For compact list contexts use PresenceDot only; do NOT render timestamps there.
 */

export interface PresenceTimestampProps {
  /**
   * ISO 8601 string of the user's last seen time, e.g. from SessionInventoryItem.lastSeenAt
   * or a presence API response. May be null/undefined when data is unavailable.
   */
  lastSeenAt: string | null | undefined;
  /** Additional CSS class names forwarded to the root element. */
  className?: string;
}

/**
 * Renders a humanized "last seen N ago" or absolute date string.
 * Returns null if lastSeenAt is not available.
 */
export function PresenceTimestamp({ lastSeenAt, className = "" }: PresenceTimestampProps) {
  if (!lastSeenAt) {
    return null;
  }

  const humanized = humanizeLastSeen(lastSeenAt);
  const isoLabel = new Date(lastSeenAt).toLocaleString();

  return (
    <span
      className={`presence-timestamp${className ? ` ${className}` : ""}`}
      title={isoLabel}
    >
      last seen {humanized}
    </span>
  );
}

/**
 * Converts an ISO timestamp to a human-readable relative label.
 * Uses the same bucketing style as SessionRow (now / Xm / Xh / yesterday / date).
 */
function humanizeLastSeen(isoString: string): string {
  const then = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const yesterdayMidnight = new Date(todayMidnight);
  yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);

  if (then >= yesterdayMidnight && then < todayMidnight) {
    return "yesterday";
  }

  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: then.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
