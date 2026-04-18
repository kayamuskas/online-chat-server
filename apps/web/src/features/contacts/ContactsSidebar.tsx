/**
 * ContactsSidebar — Phase 5 contacts section in the left sidebar.
 *
 * Renders the CONTACTS section below the ROOMS section (D-15, D-16, D-17, D-18).
 * Each contact row shows a PresenceDot and username.
 * The Message button is disabled with tooltip when dmEligible is false (D-13).
 * Bottom of the list has "+ Add contact" button.
 */

import { PresenceDot, type PresenceStatus } from "../presence/PresenceDot";

export interface ContactRow {
  userId: string;
  username: string;
  presenceStatus?: PresenceStatus;
  dmEligible: boolean;
}

interface ContactsSidebarProps {
  contacts: ContactRow[];
  currentUserId: string;
  onAddContact?: () => void;
  onOpenDm?: (userId: string) => void;
}

export function ContactsSidebar({
  contacts,
  currentUserId,
  onAddContact,
  onOpenDm,
}: ContactsSidebarProps) {
  return (
    <div>
      {contacts.length === 0 && (
        <p className="rooms-empty" style={{ fontSize: "0.8rem", padding: "0.25rem 0" }}>
          No contacts yet.
        </p>
      )}
      {contacts.map((c) => (
        <div
          key={c.userId}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.2rem 0" }}
        >
          <PresenceDot status={c.presenceStatus ?? "offline"} />
          <span style={{ flex: 1, fontSize: "0.9rem" }}>{c.username}</span>
          {c.userId !== currentUserId && (
            <button
              type="button"
              className="btn btn--soft btn--xs"
              disabled={!c.dmEligible}
              title={!c.dmEligible ? "Add as friend to message" : undefined}
              onClick={c.dmEligible ? () => onOpenDm?.(c.userId) : undefined}
            >
              Msg
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="app-account__nav-item"
        onClick={onAddContact}
        style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}
      >
        + Add contact
      </button>
    </div>
  );
}
