/**
 * DetailedPresencePanel — demonstration surface for the detailed presence contract.
 *
 * This component renders a panel of users with EXPLICIT status text and,
 * for offline users, the textual `last seen` detail — aligned to the locked
 * detailed-surface design direction (D-11, D-13):
 *
 *   "In detail surfaces such as room/member info, explicit status text is shown,
 *    e.g. `Carol (AFK)`. When a user is offline, the UI should also show textual
 *    `last seen` information."
 *
 * Wireframe alignment:
 *   ● Alice           → online  (green dot + "online")
 *   ◐ Carol (AFK)    → afk     (amber dot + "AFK")
 *   ○ Mike (offline) → offline (gray dot + "offline" + last seen)
 *
 * This surface proves the detailed rendering contract is wired correctly.
 * Future room/contacts phases will use PresenceDot + PresenceLabel + PresenceTimestamp
 * directly in their own member-detail surfaces.
 */

import { PresenceDot, type PresenceStatus } from "./PresenceDot";
import { PresenceLabel } from "./PresenceLabel";
import { PresenceTimestamp } from "./PresenceTimestamp";

export interface DetailedPresenceMember {
  id: string;
  username: string;
  status: PresenceStatus;
  /** ISO 8601 string of the user's last-seen timestamp; required for offline display. */
  lastSeenAt?: string | null;
}

export interface DetailedPresencePanelProps {
  members: DetailedPresenceMember[];
  /** Optional panel heading. Defaults to "Room members". */
  title?: string;
}

/**
 * Renders a detailed member list with:
 * - Colored presence dot (shared PresenceDot primitive)
 * - Explicit status text, e.g. "AFK", "offline" (PresenceLabel)
 * - For offline members: textual "last seen N ago" (PresenceTimestamp)
 */
export function DetailedPresencePanel({
  members,
  title = "Room members",
}: DetailedPresencePanelProps) {
  if (members.length === 0) {
    return (
      <div className="detailed-presence-panel">
        <div className="detailed-presence-panel__title">{title}</div>
        <p className="detailed-presence-panel__empty">No members to show.</p>
      </div>
    );
  }

  return (
    <div className="detailed-presence-panel">
      <div className="detailed-presence-panel__title">{title}</div>
      <ul className="detailed-presence-panel__items" role="list">
        {members.map((m) => (
          <li key={m.id} className="detailed-presence-panel__item">
            {/* Dot + name + explicit status text (D-11) */}
            <PresenceDot status={m.status} />
            <div className="detailed-presence-panel__info">
              <span className="detailed-presence-panel__name">
                {m.username}{" "}
                {/* Parenthetical status text per wireframe: "Carol (AFK)" */}
                <span className="detailed-presence-panel__status-paren">
                  (<PresenceLabel status={m.status} />)
                </span>
              </span>
              {/* Textual last seen only for offline members (D-13) */}
              {m.status === "offline" && (
                <PresenceTimestamp
                  lastSeenAt={m.lastSeenAt}
                  className="detailed-presence-panel__last-seen"
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
