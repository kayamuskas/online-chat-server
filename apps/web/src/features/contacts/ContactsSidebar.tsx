/**
 * ContactsSidebar — Phase 5 contacts section in the left sidebar.
 *
 * Renders the CONTACTS section below the ROOMS section (D-15, D-16, D-17, D-18).
 * Each contact row shows a PresenceDot and username.
 * The whole row is keyboard-accessible when DM is allowed (D-13).
 */

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { PresenceDot, type PresenceStatus } from "../presence/PresenceDot";

export interface ContactRow {
  userId: string;
  username: string;
  presenceStatus?: PresenceStatus;
  dmEligible: boolean;
  canOpenConversation?: boolean;
  unreadCount?: number;
}

interface ContactsSidebarProps {
  contacts: ContactRow[];
  currentUserId: string;
  onOpenDm?: (userId: string) => void;
  socket?: Socket | null;
  onPresenceUpdate?: (presenceMap: Record<string, string>) => void;
  activePartnerId?: string | null;
}

interface PresenceUpdatePayload {
  userId?: string;
  status?: string;
}

export function ContactsSidebar({
  contacts,
  currentUserId,
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

    function onPresenceUpdateEvent(payload: PresenceUpdatePayload) {
      if (
        typeof payload.userId !== "string" ||
        (payload.status !== "online" && payload.status !== "afk" && payload.status !== "offline")
      ) {
        return;
      }

      if (!userIds.includes(payload.userId)) {
        return;
      }

      onPresenceUpdate?.({ [payload.userId]: payload.status });
    }

    requestPresence();
    const intervalId = window.setInterval(requestPresence, 30_000);
    socket.on("ready", requestPresence);
    socket.on("presence", onPresence);
    socket.on("presence-update", onPresenceUpdateEvent);

    return () => {
      window.clearInterval(intervalId);
      socket.off("ready", requestPresence);
      socket.off("presence", onPresence);
      socket.off("presence-update", onPresenceUpdateEvent);
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
        const canDm =
          (c.canOpenConversation ?? c.dmEligible) && c.userId !== currentUserId;
        return (
          <div
            key={c.userId}
            className={`contacts-sidebar__row${activePartnerId === c.userId ? " contacts-sidebar__row--active" : ""}${canDm ? " contacts-sidebar__row--clickable" : ""}`}
            onClick={canDm ? () => onOpenDm?.(c.userId) : undefined}
            role={canDm ? "button" : undefined}
            tabIndex={canDm ? 0 : undefined}
            aria-label={canDm ? `Open direct messages with ${c.username}` : undefined}
            onKeyDown={canDm ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDm?.(c.userId);
              }
            } : undefined}
            title={
              !c.dmEligible && c.userId !== currentUserId
                ? canDm
                  ? "Open previous conversation"
                  : "Add as friend to message"
                : undefined
            }
          >
            <PresenceDot status={c.presenceStatus ?? "offline"} />
            <span className={`contacts-sidebar__name${c.username === '[deleted]' ? ' contacts-sidebar__name--deleted' : ''}`}>
              {c.username}
            </span>
            {!!c.unreadCount && c.unreadCount > 0 && (
              <span className="app-shell__thread-badge" aria-label={`${c.unreadCount} unread messages`}>
                {c.unreadCount}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
