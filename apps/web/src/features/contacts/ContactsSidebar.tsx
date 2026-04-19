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
}

interface ContactsSidebarProps {
  contacts: ContactRow[];
  currentUserId: string;
  onAddContact?: () => void;
  onOpenDm?: (userId: string) => void;
  socket?: Socket | null;
  onPresenceUpdate?: (presenceMap: Record<string, { status: string }>) => void;
}

export function ContactsSidebar({
  contacts,
  currentUserId,
  onAddContact,
  onOpenDm,
  socket = null,
  onPresenceUpdate,
}: ContactsSidebarProps) {
  useEffect(() => {
    if (!socket || contacts.length === 0) {
      return;
    }

    const userIds = contacts.map((contact) => contact.userId);

    function requestPresence() {
      socket.emit("getPresence", { userIds });
    }

    function onPresence(presenceMap: Record<string, { status: string }>) {
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
