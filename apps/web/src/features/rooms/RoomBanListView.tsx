/**
 * RoomBanListView — Phase 4 ban-list surface for room admins and owners.
 *
 * Displays all banned users with:
 *   - Banned username (from ban metadata).
 *   - Who banned them and when.
 *   - Optional ban reason.
 *   - Unban action (admin or owner only).
 *
 * Ban state is durable (survives leave/rejoin cycles per D-09 domain model).
 */

import type { RoomBan } from "../../lib/api";

interface BanRow extends RoomBan {
  /** Display name of the banned user (resolved by parent). */
  bannedUsername?: string;
  /** Display name of the user who issued the ban (resolved by parent). */
  bannedByUsername?: string;
}

interface RoomBanListViewProps {
  bans: BanRow[];
  onUnban?: (userId: string) => void;
  unbanBusy?: string | null;
}

export function RoomBanListView({ bans, onUnban, unbanBusy }: RoomBanListViewProps) {
  if (bans.length === 0) {
    return <p className="ban-list__empty">No banned users.</p>;
  }

  return (
    <ul className="ban-list" aria-label="Banned users">
      {bans.map((ban) => {
        const busy = unbanBusy === ban.banned_user_id;
        const when = new Date(ban.banned_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        return (
          <li key={ban.id} className="ban-list__item">
            <div className="ban-list__info">
              <span className="ban-list__username">
                {ban.bannedUsername ?? ban.banned_user_id}
              </span>
              <span className="ban-list__meta">
                Banned {when}
                {ban.bannedByUsername && ` by ${ban.bannedByUsername}`}
                {ban.reason && ` · ${ban.reason}`}
              </span>
            </div>
            {onUnban && (
              <button
                type="button"
                className="btn btn--soft btn--xs"
                onClick={() => onUnban(ban.banned_user_id)}
                disabled={busy}
              >
                {busy ? "…" : "Unban"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
