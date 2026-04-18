/**
 * SessionRow — one row in the active-sessions table.
 *
 * Displays Device/Browser, IP, and Last active columns for a single session.
 * Shows a "This browser" badge when isCurrentSession is true.
 * Humanizes the lastSeenAt timestamp (now / Xm ago / Xh ago / yesterday / date).
 * Exact timestamp appears as a title attribute (hover).
 *
 * Locked reference semantics (D-01, D-05, D-06, D-07):
 *   - Device label: "Chrome · macOS", "Firefox · Windows", "Safari · iPhone"
 *   - IP shown in full, not masked
 *   - Primary label is humanized; exact time on hover
 *   - Per-row Sign out action
 */

import type { SessionInventoryItem } from "../../lib/api";

// ── User-agent parsing ────────────────────────────────────────────────────────

function parseBrowser(ua: string | null): string {
  if (!ua) return "Unknown browser";

  // Browser detection (order matters: Edge/OPR before Chrome)
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua) || /Opera\//.test(ua)) browser = "Opera";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Browser";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";
  else if (/MSIE|Trident/.test(ua)) browser = "IE";

  // OS detection
  let os = "Unknown OS";
  if (/iPhone/.test(ua)) os = "iPhone";
  else if (/iPad/.test(ua)) os = "iPad";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return `${browser} · ${os}`;
}

// ── Timestamp humanization ────────────────────────────────────────────────────

function humanizeLastSeen(isoDate: string): string {
  const now = Date.now();
  const ts = new Date(isoDate).getTime();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 2) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffDays === 1) return "Yesterday";
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function exactTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: SessionInventoryItem;
  onRevoke: (sessionId: string) => void;
  revoking: boolean;
}

export function SessionRow({ session, onRevoke, revoking }: SessionRowProps) {
  const deviceLabel = parseBrowser(session.userAgent);
  const humanTime = humanizeLastSeen(session.lastSeenAt);
  const exactTime = exactTimestamp(session.lastSeenAt);
  const signedInDate = new Date(session.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <tr className={session.isCurrentSession ? "sessions-table__row--current" : undefined}>
      <td className="sessions-table__cell">
        <span className="sessions-table__device">{deviceLabel}</span>
        {session.isCurrentSession && (
          <span className="sessions-badge">This browser</span>
        )}
        <div className="sessions-table__signed-in">Signed in {signedInDate}</div>
      </td>
      <td className="sessions-table__cell sessions-table__cell--mono">
        {session.ipAddress ?? "—"}
      </td>
      <td
        className="sessions-table__cell sessions-table__cell--mono"
        title={exactTime}
      >
        {humanTime}
      </td>
      <td className="sessions-table__cell sessions-table__cell--action">
        <button
          type="button"
          className="btn btn--soft btn--xs"
          onClick={() => onRevoke(session.sessionId)}
          disabled={revoking}
        >
          Sign out
        </button>
      </td>
    </tr>
  );
}
