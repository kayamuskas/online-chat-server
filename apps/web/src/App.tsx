/**
 * Phase 4 app entry — classic chat shell with room surfaces.
 *
 * Extends the Phase 3 authenticated shell with:
 *   - "Rooms" top-level nav section containing Public, Private, and Create sub-views
 *   - Room management surface for admin/owner operations (ManageRoomView)
 *
 * Phase 3 tabs preserved:
 *   - "Sessions" → ActiveSessionsView
 *   - "Presence"  → CompactPresenceList + DetailedPresencePanel
 *
 * Phase 4 tabs added:
 *   - "Public rooms"  → PublicRoomsView: public catalog + search + join
 *   - "Private rooms" → PrivateRoomsView: invite-only rooms the user belongs to
 *   - "Create room"   → CreateRoomView: lightweight room creation form
 *   - "Manage room"   → ManageRoomView: owner/admin/member and ban-list operations
 */

import { useEffect, useState } from "react";
import {
  me,
  getMyPrivateRooms,
  getPendingPrivateInvites,
  acceptRoomInvite,
  declineRoomInvite,
  leaveRoom,
  type PublicUser,
  type PendingRoomInviteEntry,
  type PrivateRoomEntry,
  type RoomCatalogRow,
  type Room,
} from "./lib/api";
import { AuthShell } from "./features/auth/AuthShell";
import { PasswordSettingsView } from "./features/account/PasswordSettingsView";
import { ActiveSessionsView } from "./features/account/ActiveSessionsView";
import { CompactPresenceList } from "./features/presence/CompactPresenceList";
import { DetailedPresencePanel } from "./features/presence/DetailedPresencePanel";
import { PublicRoomsView } from "./features/rooms/PublicRoomsView";
import { CreateRoomView } from "./features/rooms/CreateRoomView";
import { PrivateRoomsView } from "./features/rooms/PrivateRoomsView";
import { ManageRoomView } from "./features/rooms/ManageRoomView";

type AppTab =
  | "password"
  | "sessions"
  | "presence"
  | "public-rooms"
  | "private-rooms"
  | "create-room"
  | "manage-room";

function isAccountRoute() {
  return window.location.pathname === "/account";
}

/**
 * Representative members used to prove the compact and detailed presence
 * rendering contracts (D-10, D-11, D-13). These match the wireframe and
 * contacts.jsx design reference names/statuses.
 */
const DEMO_MEMBERS = [
  { id: "alice", username: "alice", status: "online" as const, lastSeenAt: null },
  { id: "bob", username: "bob", status: "afk" as const, lastSeenAt: null },
  { id: "carol", username: "carol", status: "afk" as const, lastSeenAt: null },
  { id: "mike", username: "mike", status: "offline" as const, lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: "dave", username: "dave", status: "online" as const, lastSeenAt: null },
];

function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [tab, setTab] = useState<AppTab>("public-rooms");
  const [checkingSession, setCheckingSession] = useState(isAccountRoute());
  const [managedRoom, setManagedRoom] = useState<RoomCatalogRow | null>(null);
  const [privateRooms, setPrivateRooms] = useState<PrivateRoomEntry[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingRoomInviteEntry[]>([]);
  const [privateRoomsLoading, setPrivateRoomsLoading] = useState(false);
  const [privateRoomsError, setPrivateRoomsError] = useState<string | null>(null);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);

  function handleAuthenticated(nextUser: PublicUser) {
    setUser(nextUser);
    window.history.replaceState(null, "", "/account");
  }

  function handleSignedOut() {
    setUser(null);
    setPrivateRooms([]);
    setPendingInvites([]);
    setManagedRoom(null);
    window.history.replaceState(null, "", "/");
  }

  useEffect(() => {
    if (!isAccountRoute()) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      setCheckingSession(true);
      try {
        const result = await me();
        if (!cancelled) {
          setUser(result.user);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          window.history.replaceState(null, "", "/");
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleManageRoom(room: RoomCatalogRow) {
    setManagedRoom(room);
    setTab("manage-room");
  }

  async function loadPrivateRoomData() {
    setPrivateRoomsLoading(true);
    setPrivateRoomsError(null);
    try {
      const [roomsResult, invitesResult] = await Promise.all([
        getMyPrivateRooms(),
        getPendingPrivateInvites(),
      ]);
      setPrivateRooms(roomsResult.rooms);
      setPendingInvites(invitesResult.invites);
    } catch (error) {
      setPrivateRoomsError(
        error instanceof Error ? error.message : "Failed to load private-room data",
      );
    } finally {
      setPrivateRoomsLoading(false);
    }
  }

  function handleRoomCreated(room: Room) {
    // After creating, if private navigate to private rooms; else public rooms
    if (room.visibility === "private") {
      void loadPrivateRoomData();
      setTab("private-rooms");
    } else {
      setTab("public-rooms");
    }
  }

  function handleRoomJoined(_room: RoomCatalogRow) {
    setTab("public-rooms");
  }

  async function handleAcceptInvite(roomId: string, inviteId: string) {
    setInviteActionId(inviteId);
    setPrivateRoomsError(null);
    try {
      await acceptRoomInvite(roomId, inviteId);
      await loadPrivateRoomData();
    } catch (error) {
      setPrivateRoomsError(
        error instanceof Error ? error.message : "Failed to accept invite",
      );
    } finally {
      setInviteActionId(null);
    }
  }

  async function handleDeclineInvite(roomId: string, inviteId: string) {
    setInviteActionId(inviteId);
    setPrivateRoomsError(null);
    try {
      await declineRoomInvite(roomId, inviteId);
      await loadPrivateRoomData();
    } catch (error) {
      setPrivateRoomsError(
        error instanceof Error ? error.message : "Failed to decline invite",
      );
    } finally {
      setInviteActionId(null);
    }
  }

  async function handleLeavePrivateRoom(room: RoomCatalogRow) {
    setPrivateRoomsError(null);
    try {
      await leaveRoom(room.id);
      if (managedRoom?.id === room.id) {
        setManagedRoom(null);
      }
      await loadPrivateRoomData();
    } catch (error) {
      setPrivateRoomsError(
        error instanceof Error ? error.message : "Failed to leave private room",
      );
    }
  }

  useEffect(() => {
    if (!user) {
      setPrivateRooms([]);
      setPendingInvites([]);
      setManagedRoom(null);
      return;
    }

    void loadPrivateRoomData();
  }, [user]);

  if (checkingSession) {
    return (
      <div className="auth-layout">
        <main className="auth-center">
          <div className="auth-center__card">
            <div className="auth-card">
              <h2>Checking session</h2>
              <p className="auth-card__sub">
                Verifying the current browser session.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return <AuthShell onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-layout">
      <header className="app-topbar">
        <div className="app-topbar__logo">&#9675; chatsrv</div>
        <span className="app-topbar__user">{user.username}</span>
      </header>

      <main className="app-account">
        <nav className="app-account__nav">
          <div className="app-account__nav-label">ROOMS</div>
          <button
            type="button"
            className={`app-account__nav-item${tab === "public-rooms" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("public-rooms")}
          >
            Public rooms
          </button>
          <button
            type="button"
            className={`app-account__nav-item${tab === "private-rooms" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("private-rooms")}
          >
            Private rooms
          </button>
          <button
            type="button"
            className={`app-account__nav-item${tab === "create-room" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("create-room")}
          >
            Create room
          </button>

          <div className="app-account__nav-label" style={{ marginTop: "1rem" }}>ACCOUNT</div>
          <button
            type="button"
            className={`app-account__nav-item${tab === "password" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("password")}
          >
            Password
          </button>
          <button
            type="button"
            className={`app-account__nav-item${tab === "sessions" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("sessions")}
          >
            Active sessions
          </button>
          <button
            type="button"
            className={`app-account__nav-item${tab === "presence" ? " app-account__nav-item--active" : ""}`}
            onClick={() => setTab("presence")}
          >
            Presence
          </button>
        </nav>

        <div className="app-account__content">
          {tab === "public-rooms" && (
            <PublicRoomsView
              onJoined={handleRoomJoined}
              onCreateRoom={() => setTab("create-room")}
            />
          )}
          {tab === "private-rooms" && (
            <PrivateRoomsView
              rooms={privateRooms}
              pendingInvites={pendingInvites}
              onManage={handleManageRoom}
              onLeave={(room) => void handleLeavePrivateRoom(room)}
              onAcceptInvite={(roomId, inviteId) => void handleAcceptInvite(roomId, inviteId)}
              onDeclineInvite={(roomId, inviteId) => void handleDeclineInvite(roomId, inviteId)}
              onCreateRoom={() => setTab("create-room")}
              loading={privateRoomsLoading}
              error={privateRoomsError}
              inviteActionId={inviteActionId}
            />
          )}
          {tab === "create-room" && (
            <CreateRoomView
              onCreated={handleRoomCreated}
              onCancel={() => setTab("public-rooms")}
            />
          )}
          {tab === "manage-room" && managedRoom && (
            <ManageRoomView
              room={managedRoom}
              currentUserId={user.id}
              onBack={() => setTab("private-rooms")}
            />
          )}
          {tab === "password" && <PasswordSettingsView />}
          {tab === "sessions" && (
            <ActiveSessionsView onSignedOut={handleSignedOut} />
          )}
          {tab === "presence" && (
            <div className="presence-demo">
              <h2>Presence rendering</h2>
              <p className="sub">
                Phase 3 presence contract: compact list surfaces show colored
                dots only; detailed surfaces show explicit status text and
                offline last&nbsp;seen.
              </p>
              <div className="presence-demo__panels">
                <div className="presence-demo__panel">
                  <CompactPresenceList
                    members={DEMO_MEMBERS}
                    title="Compact — dot only (contacts/chat list)"
                  />
                </div>
                <div className="presence-demo__panel">
                  <DetailedPresencePanel
                    members={DEMO_MEMBERS}
                    title="Detailed — status text + last seen (room member panel)"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
