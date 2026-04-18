/**
 * CompactPresenceList — a demonstration surface for the compact presence contract.
 *
 * This component renders a list of users with ONLY colored presence dots and NO
 * status text, matching the locked compact-list design direction (D-10):
 *
 *   "In compact lists such as contacts and chat lists, presence is shown like
 *    the design reference: colored indicator only, without explicit status text."
 *
 * This surface is used in the Phase 3 authenticated account view to prove that
 * the compact rendering contract is wired up and behaves correctly. Future
 * contacts/chat-list phases will use PresenceDot directly.
 *
 * Colors:
 *   green (online)  — var(--presence-online)
 *   amber (AFK)     — var(--presence-afk)
 *   gray  (offline) — var(--presence-offline)
 */

import { PresenceDot, type PresenceStatus } from "./PresenceDot";

export interface CompactPresenceMember {
  id: string;
  username: string;
  status: PresenceStatus;
}

export interface CompactPresenceListProps {
  members: CompactPresenceMember[];
  /** Optional heading shown above the list. Defaults to "Members". */
  title?: string;
}

/**
 * Renders a compact member list with colored presence dots.
 * No status text is rendered — dots only, per the locked contract.
 */
export function CompactPresenceList({
  members,
  title = "Members",
}: CompactPresenceListProps) {
  if (members.length === 0) {
    return (
      <div className="compact-presence-list">
        <div className="compact-presence-list__title">{title}</div>
        <p className="compact-presence-list__empty">No members to show.</p>
      </div>
    );
  }

  return (
    <div className="compact-presence-list">
      <div className="compact-presence-list__title">{title}</div>
      <ul className="compact-presence-list__items" role="list">
        {members.map((m) => (
          <li key={m.id} className="compact-presence-list__item">
            {/* Compact context: dot only, no status text (D-10) */}
            <PresenceDot status={m.status} />
            <span className="compact-presence-list__name">{m.username}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
