/**
 * ContactsSidebar — Phase 5 contacts section in the left sidebar.
 *
 * Renders the CONTACTS section below the ROOMS section (D-15, D-16, D-17, D-18).
 * Each contact row shows a PresenceDot and username.
 * The Message button is disabled with tooltip when dmEligible is false (D-13).
 * Bottom of the list has "+ Add contact" button.
 */

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { PresenceDot, type PresenceStatus } from "../presence/PresenceDot";

export interface ContactRow {
  userId: string;
  username: string;
  presenceStatus?: PresenceStatus;
  dmEligible: boolean;
  unreadCount?: number;
}

interface ContactsSidebarProps {
  contacts: ContactRow[];
  currentUserId: string;
  onAddContact?: () => void;
  onOpenDm?: (userId: string) => void;
  socket?: Socket | null;
  onPresenceUpdate?: (presenceMap: Record<string, string>) => void;
  activePartnerId?: string | null;
}

export function ContactsSidebar({
  contacts,
  currentUserId,
  onAddContact,
  onOpenDm,
  socket = null,
  onPresenceUpdate,
  activePartnerId = null,
}: ContactsSidebarProps) {
  useEffect(() => {
    if (!socket || contacts.length === 0) {
      return;
    }

    const userIds = contacts.map((contact) => contact.userId);

    function requestPresence() {
      socket.emit("getPresence", { userIds });
    }

    function onPresence(presenceMap: Record<string, string>) {
      onPresenceUpdate?.(presenceMap);
    }

    requestPresence();
    const intervalId = window.setInterval(requestPresence, 30_000);
    socket.on("presence", onPresence);

    return () => {
      window.clearInterval(intervalId);
      socket.off("presence", onPresence);
    };
  }, [contacts, onPresenceUpdate, socket]);

  return (
    <div>
      {contacts.length === 0 && (
        <p className="rooms-empty" style={{ fontSize: "0.8rem", padding: "0.25rem 0" }}>
          No contacts yet.
        </p>
      )}
      {contacts.map((c) => {
        const canDm = c.dmEligible && c.userId !== currentUserId;
        return (
          <div
            key={c.userId}
            className={`contacts-sidebar__row${activePartnerId === c.userId ? " contacts-sidebar__row--active" : ""}${canDm ? " contacts-sidebar__row--clickable" : ""}`}
            onClick={canDm ? () => onOpenDm?.(c.userId) : undefined}
            role={canDm ? "button" : undefined}
            tabIndex={canDm ? 0 : undefined}
            onKeyDown={canDm ? (e) => { if (e.key === "Enter" || e.key === " ") onOpenDm?.(c.userId); } : undefined}
            title={!c.dmEligible && c.userId !== currentUserId ? "Add as friend to message" : undefined}
          >
            <PresenceDot status={c.presenceStatus ?? "offline"} />
            <span className="contacts-sidebar__name">{c.username}</span>
            {!!c.unreadCount && c.unreadCount > 0 && (
              <span className="app-shell__thread-badge" aria-label={`${c.unreadCount} unread messages`}>
                {c.unreadCount > 9 ? "9+" : c.unreadCount}
              </span>
            )}
          </div>
        );
      })}
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
