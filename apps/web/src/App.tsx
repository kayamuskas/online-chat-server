/**
 * Phase 5 app entry — classic chat shell with room and contacts surfaces.
 *
 * Extends Phase 4 with:
 *   - CONTACTS sidebar section with PresenceDot per friend (D-15, D-16, D-18)
 *   - Notification badge in topbar for pending friend requests (D-01, D-02)
 *   - FriendRequestDropdown with Accept / Decline (D-02, D-03)
 *   - DM stub navigation on contact click (D-12)
 *   - AddContactModal from sidebar (D-04, D-17)
 *
 * Phase 4 tabs preserved:
 *   - "Public rooms"  → PublicRoomsView
 *   - "Private rooms" → PrivateRoomsView
 *   - "Create room"   → CreateRoomView
 *   - "Manage room"   → ManageRoomView
 *
 * Phase 5 tabs added:
 *   - "contacts" → ContactsView (full management page)
 *   - "dm"       → DmChatView (real DM conversation surface; Phase 6)
 */

import { useEffect, useState, useCallback } from "react";
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
  getMyFriends,
  getIncomingRequests,
  acceptFriendRequest,
  declineFriendRequest,
  type FriendWithPresence,
  type IncomingFriendRequestView,
} from "./lib/api";
import { ContactsSidebar, type ContactRow } from "./features/contacts/ContactsSidebar";
import { FriendRequestDropdown } from "./features/contacts/FriendRequestDropdown";
import { AddContactModal } from "./features/contacts/AddContactModal";
import { DmChatView } from "./features/messages/DmChatView";
import { ContactsView } from "./features/contacts/ContactsView";
import { AuthShell } from "./features/auth/AuthShell";
import { PasswordSettingsView } from "./features/account/PasswordSettingsView";
import { ActiveSessionsView } from "./features/account/ActiveSessionsView";
import { CompactPresenceList } from "./features/presence/CompactPresenceList";
import { DetailedPresencePanel } from "./features/presence/DetailedPresencePanel";
import { PublicRoomsView } from "./features/rooms/PublicRoomsView";
import { CreateRoomView } from "./features/rooms/CreateRoomView";
import { PrivateRoomsView } from "./features/rooms/PrivateRoomsView";
import { ManageRoomView } from "./features/rooms/ManageRoomView";
import { RoomChatView } from "./features/messages/RoomChatView";
import { SocketProvider, useSocket } from "./features/socket/SocketProvider";

type AppTab =
  | "password"
  | "sessions"
  | "presence"
  | "public-rooms"
  | "private-rooms"
  | "create-room"
  | "manage-room"
  | "contacts"    // Phase 5: full contacts page
  | "dm"          // Phase 6: real DM conversation
  | "room-chat";  // Phase 6: real room conversation

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

interface AuthenticatedShellProps {
  user: PublicUser;
  tab: AppTab;
  pendingRequests: IncomingFriendRequestView[];
  requestDropdownOpen: boolean;
  requestActionBusy: string | null;
  contacts: FriendWithPresence[];
  privateRooms: PrivateRoomEntry[];
  pendingInvites: PendingRoomInviteEntry[];
  privateRoomsLoading: boolean;
  privateRoomsError: string | null;
  inviteActionId: string | null;
  managedRoom: RoomCatalogRow | null;
  activeRoom: { id: string; name: string } | null;
  dmPartnerId: string | null;
  addContactOpen: boolean;
  onToggleRequestDropdown: () => void;
  onAcceptRequest: (id: string) => void;
  onDeclineRequest: (id: string) => void;
  onOpenContacts: () => void;
  onCloseRequestDropdown: () => void;
  onSelectTab: (tab: AppTab) => void;
  onAddContactOpen: () => void;
  onOpenDm: (userId: string) => void;
  onPresenceUpdate: (presenceMap: Record<string, { status: string }>) => void;
  onRoomJoined: (room: RoomCatalogRow) => void;
  onManageRoom: (room: RoomCatalogRow) => void;
  onLeavePrivateRoom: (room: RoomCatalogRow) => void;
  onAcceptInvite: (roomId: string, inviteId: string) => void;
  onDeclineInvite: (roomId: string, inviteId: string) => void;
  onRoomCreated: (room: Room) => void;
  onBackFromManageRoom: () => void;
  onBackFromRoomChat: () => void;
  onSignedOut: () => void;
  onAddContactClose: () => void;
  onAddContactSuccess: () => void;
}

function AuthenticatedShell({
  user,
  tab,
  pendingRequests,
  requestDropdownOpen,
  requestActionBusy,
  contacts,
  privateRooms,
  pendingInvites,
  privateRoomsLoading,
  privateRoomsError,
  inviteActionId,
  managedRoom,
  activeRoom,
  dmPartnerId,
  addContactOpen,
  onToggleRequestDropdown,
  onAcceptRequest,
  onDeclineRequest,
  onOpenContacts,
  onCloseRequestDropdown,
  onSelectTab,
  onAddContactOpen,
  onOpenDm,
  onPresenceUpdate,
  onRoomJoined,
  onManageRoom,
  onLeavePrivateRoom,
  onAcceptInvite,
  onDeclineInvite,
  onRoomCreated,
  onBackFromManageRoom,
  onBackFromRoomChat,
  onSignedOut,
  onAddContactClose,
  onAddContactSuccess,
}: AuthenticatedShellProps) {
  const socket = useSocket();
  const isCompactNavigation =
    tab === "room-chat" || tab === "dm" || tab === "manage-room";
  const partner = dmPartnerId
    ? contacts.find((contact) => contact.userId === dmPartnerId) ?? null
    : null;
  const sidebarContacts: ContactRow[] = contacts.map((contact) => ({
    userId: contact.userId,
    username: contact.username,
    presenceStatus: contact.presenceStatus,
    dmEligible: true,
  }));
  const rightRailMembers = contacts.slice(0, 6).map((contact) => ({
    id: contact.userId,
    username: contact.username,
    status: (contact.presenceStatus ?? "offline") as "online" | "afk" | "offline",
    lastSeenAt: contact.presenceStatus === "offline" ? new Date().toISOString() : null,
  }));

  let shellTitle = "Classic chat";
  let shellSubtitle = "Rooms, contacts, and account surfaces in one product shell.";

  if (tab === "room-chat" && activeRoom) {
    shellTitle = activeRoom.name;
    shellSubtitle = "Active room conversation";
  } else if (tab === "dm" && partner) {
    shellTitle = partner.username;
    shellSubtitle = "Direct conversation";
  } else if (tab === "manage-room" && managedRoom) {
    shellTitle = `Manage ${managedRoom.name}`;
    shellSubtitle = "Room authority, invites, bans, and membership controls";
  } else if (tab === "contacts") {
    shellTitle = "Contacts";
    shellSubtitle = "Friendships, DMs, and relationship management";
  } else if (tab === "private-rooms") {
    shellTitle = "Private rooms";
    shellSubtitle = "Invite-only rooms, pending invites, and management entry points";
  } else if (tab === "public-rooms") {
    shellTitle = "Public rooms";
    shellSubtitle = "Discover, join, and navigate shared spaces";
  } else if (tab === "create-room") {
    shellTitle = "Create room";
    shellSubtitle = "Start a new public or private chat space";
  } else if (tab === "sessions") {
    shellTitle = "Active sessions";
    shellSubtitle = "Inspect browsers, IPs, and revoke access cleanly";
  } else if (tab === "password") {
    shellTitle = "Account settings";
    shellSubtitle = "Password and authentication controls";
  } else if (tab === "presence") {
    shellTitle = "Presence";
    shellSubtitle = "Compact and detailed presence surfaces";
  }

  function renderMainPanel() {
    if (tab === "public-rooms") {
      return (
        <PublicRoomsView
          onJoined={onRoomJoined}
          onCreateRoom={() => onSelectTab("create-room")}
        />
      );
    }

    if (tab === "private-rooms") {
      return (
        <PrivateRoomsView
          rooms={privateRooms}
          pendingInvites={pendingInvites}
          onManage={onManageRoom}
          onLeave={(room) => void onLeavePrivateRoom(room)}
          onAcceptInvite={(roomId, inviteId) => void onAcceptInvite(roomId, inviteId)}
          onDeclineInvite={(roomId, inviteId) => void onDeclineInvite(roomId, inviteId)}
          onCreateRoom={() => onSelectTab("create-room")}
          onOpenChat={(room) => {
            onRoomJoined(room);
            onSelectTab("room-chat");
          }}
          loading={privateRoomsLoading}
          error={privateRoomsError}
          inviteActionId={inviteActionId}
        />
      );
    }

    if (tab === "create-room") {
      return (
        <CreateRoomView
          onCreated={onRoomCreated}
          onCancel={() => onSelectTab("public-rooms")}
        />
      );
    }

    if (tab === "manage-room" && managedRoom) {
      return (
        <ManageRoomView
          room={managedRoom}
          currentUserId={user.id}
          onBack={onBackFromManageRoom}
        />
      );
    }

    if (tab === "room-chat" && activeRoom) {
      return (
        <RoomChatView
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          currentUserId={user.id}
          onBack={onBackFromRoomChat}
        />
      );
    }

    if (tab === "contacts") {
      return <ContactsView currentUserId={user.id} />;
    }

    if (tab === "dm" && dmPartnerId) {
      return (
        <DmChatView
          partnerId={dmPartnerId}
          partnerUsername={partner?.username ?? dmPartnerId}
          currentUserId={user.id}
        />
      );
    }

    if (tab === "password") {
      return <PasswordSettingsView />;
    }

    if (tab === "sessions") {
      return <ActiveSessionsView onSignedOut={onSignedOut} />;
    }

    return (
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
    );
  }

  function renderRightRail() {
    if (tab === "room-chat" && activeRoom) {
      return (
        <>
          <section className="app-shell__rail-card">
            <p className="app-shell__rail-label">Room context</p>
            <h3>{activeRoom.name}</h3>
            <p className="app-shell__rail-copy">
              This rail is reserved for room members and conversation context.
              Member hydration is intentionally pulled into Phase 9 shell work.
            </p>
          </section>
          <section className="app-shell__rail-card">
            <DetailedPresencePanel
              members={rightRailMembers}
              title="Members & presence"
            />
          </section>
        </>
      );
    }

    if (tab === "manage-room" && managedRoom) {
      return (
        <>
          <section className="app-shell__rail-card">
            <p className="app-shell__rail-label">Room overview</p>
            <h3>{managedRoom.name}</h3>
            <p className="app-shell__rail-copy">
              {managedRoom.description ?? "No description yet."}
            </p>
          </section>
          <section className="app-shell__rail-card">
            <p className="app-shell__rail-label">Authority model</p>
            <p className="app-shell__rail-copy">
              Owner/admin and ban-list mechanics already exist. Phase 8 destructive
              cascades remain deferred.
            </p>
          </section>
        </>
      );
    }

    if (tab === "dm" && partner) {
      return (
        <>
          <section className="app-shell__rail-card">
            <p className="app-shell__rail-label">Direct message</p>
            <h3>{partner.username}</h3>
            <p className="app-shell__rail-copy">
              Presence: {partner.presenceStatus ?? "offline"}
            </p>
          </section>
          <section className="app-shell__rail-card">
            <CompactPresenceList
              members={rightRailMembers}
              title="Friends online now"
            />
          </section>
        </>
      );
    }

    if (tab === "contacts") {
      return (
        <>
          <section className="app-shell__rail-card">
            <p className="app-shell__rail-label">Relationship inbox</p>
            <h3>{pendingRequests.length} pending</h3>
            <p className="app-shell__rail-copy">
              Friend-request notifications live in the topbar and route back into
              contacts management.
            </p>
          </section>
          <section className="app-shell__rail-card">
            <CompactPresenceList
              members={rightRailMembers}
              title="Contacts snapshot"
            />
          </section>
        </>
      );
    }

    return (
      <>
        <section className="app-shell__rail-card">
          <p className="app-shell__rail-label">Workspace</p>
          <h3>{privateRooms.length} private rooms</h3>
          <p className="app-shell__rail-copy">
            {contacts.length} contacts, {pendingInvites.length} pending room invites,
            and {pendingRequests.length} incoming friend requests.
          </p>
        </section>
        <section className="app-shell__rail-card">
          <CompactPresenceList
            members={rightRailMembers.length > 0 ? rightRailMembers : DEMO_MEMBERS}
            title="Live presence"
          />
        </section>
      </>
    );
  }

  return (
    <div className="app-layout">
      <header className="app-topbar">
        <div className="app-topbar__brand">
          <div className="app-topbar__logo">&#9675; chatsrv</div>
          <div className="app-topbar__meta">
            <strong>{shellTitle}</strong>
            <span>{shellSubtitle}</span>
          </div>
        </div>
        <div className="app-topbar__actions">
          <button
            type="button"
            className="app-topbar__notif"
            onClick={onToggleRequestDropdown}
            aria-label="Friend requests"
          >
            &#128276;
            {pendingRequests.length > 0 && (
              <span className="notif-badge">{pendingRequests.length}</span>
            )}
          </button>
          {requestDropdownOpen && (
            <FriendRequestDropdown
              requests={pendingRequests}
              onAccept={(id) => void onAcceptRequest(id)}
              onDecline={(id) => void onDeclineRequest(id)}
              actionBusy={requestActionBusy}
              onOpenContacts={onOpenContacts}
              onClose={onCloseRequestDropdown}
            />
          )}
          <span className="app-topbar__user">{user.username}</span>
        </div>
      </header>

      <main className={`app-account${isCompactNavigation ? " app-account--compact" : ""}`}>
        <nav className="app-account__nav app-shell__sidebar">
          <section className="app-shell__nav-section">
            <div className="app-account__nav-label">Rooms</div>
            <button
              type="button"
              className={`app-account__nav-item${tab === "public-rooms" ? " app-account__nav-item--active" : ""}`}
              onClick={() => onSelectTab("public-rooms")}
            >
              Public rooms
            </button>
            <button
              type="button"
              className={`app-account__nav-item${tab === "private-rooms" ? " app-account__nav-item--active" : ""}`}
              onClick={() => onSelectTab("private-rooms")}
            >
              Private rooms
            </button>
            <button
              type="button"
              className={`app-account__nav-item${tab === "create-room" ? " app-account__nav-item--active" : ""}`}
              onClick={() => onSelectTab("create-room")}
            >
              Create room
            </button>
          </section>

          <section className="app-shell__nav-section">
            <div className="app-account__nav-label">Contacts</div>
            <button
              type="button"
              className={`app-account__nav-item${tab === "contacts" ? " app-account__nav-item--active" : ""}`}
              onClick={onOpenContacts}
            >
              Contacts
            </button>
            <ContactsSidebar
              contacts={sidebarContacts}
              currentUserId={user.id}
              socket={socket}
              onPresenceUpdate={onPresenceUpdate}
              onAddContact={onAddContactOpen}
              onOpenDm={onOpenDm}
            />
          </section>

          <section className="app-shell__nav-section app-shell__nav-section--account">
            <div className="app-account__nav-label">Account</div>
            <button
              type="button"
              className={`app-account__nav-item${tab === "password" ? " app-account__nav-item--active" : ""}`}
              onClick={() => onSelectTab("password")}
            >
              Password
            </button>
            <button
              type="button"
              className={`app-account__nav-item${tab === "sessions" ? " app-account__nav-item--active" : ""}`}
              onClick={() => onSelectTab("sessions")}
            >
              Active sessions
            </button>
            <button
              type="button"
              className={`app-account__nav-item${tab === "presence" ? " app-account__nav-item--active" : ""}`}
              onClick={() => onSelectTab("presence")}
            >
              Presence
            </button>
          </section>
        </nav>

        <section className="app-shell__center">
          <div className="app-shell__content-head">
            <div>
              <p className="app-shell__content-kicker">
                {isCompactNavigation ? "Compact navigation mode" : "Workspace"}
              </p>
              <h1 className="app-shell__content-title">{shellTitle}</h1>
              <p className="app-shell__content-sub">{shellSubtitle}</p>
            </div>
          </div>
          <div className="app-account__content">
            {renderMainPanel()}
          </div>
        </section>

        <aside className="app-shell__aside">
          {renderRightRail()}
        </aside>
      </main>

      {addContactOpen && (
        <AddContactModal
          onClose={onAddContactClose}
          onSuccess={onAddContactSuccess}
        />
      )}
    </div>
  );
}

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

  // Phase 5: contacts state
  const [contacts, setContacts] = useState<FriendWithPresence[]>([]);
  const [pendingRequests, setPendingRequests] = useState<IncomingFriendRequestView[]>([]);
  const [requestDropdownOpen, setRequestDropdownOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [dmPartnerId, setDmPartnerId] = useState<string | null>(null);
  const [requestActionBusy, setRequestActionBusy] = useState<string | null>(null);
  // Phase 6: active room for room-chat tab
  const [activeRoom, setActiveRoom] = useState<{ id: string; name: string } | null>(null);

  function handleAuthenticated(nextUser: PublicUser) {
    setUser(nextUser);
    window.history.replaceState(null, "", "/account");
  }

  function handleSignedOut() {
    setUser(null);
    setPrivateRooms([]);
    setPendingInvites([]);
    setManagedRoom(null);
    setContacts([]);
    setPendingRequests([]);
    setDmPartnerId(null);
    setActiveRoom(null);
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

  const loadContacts = useCallback(async () => {
    try {
      const result = await getMyFriends();
      setContacts(result.friends);
    } catch {
      // non-fatal: sidebar shows empty state
    }
  }, []);

  const loadPendingRequests = useCallback(async () => {
    try {
      const result = await getIncomingRequests();
      setPendingRequests(result.requests);
    } catch {
      // non-fatal: badge shows 0
    }
  }, []);

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

  function handleRoomJoined(room: RoomCatalogRow) {
    setActiveRoom({ id: room.id, name: room.name });
    setTab("room-chat");
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

  async function handleAcceptRequest(requestId: string) {
    setRequestActionBusy(requestId);
    try {
      await acceptFriendRequest(requestId);
      // Refetch both contacts and pending requests — Pitfall 5 fix
      await Promise.all([loadContacts(), loadPendingRequests()]);
    } catch {
      // ignore — badge will refresh on next open
    } finally {
      setRequestActionBusy(null);
    }
  }

  async function handleDeclineRequest(requestId: string) {
    setRequestActionBusy(requestId);
    try {
      await declineFriendRequest(requestId);
      await loadPendingRequests();
    } catch {
      // ignore
    } finally {
      setRequestActionBusy(null);
    }
  }

  function openContactsTab() {
    setRequestDropdownOpen(false);
    setTab("contacts");
  }

  function handlePresenceUpdate(presenceMap: Record<string, { status: string }>) {
    setContacts((prev) =>
      prev.map((contact) => {
        const nextStatus = presenceMap[contact.userId]?.status;
        if (
          nextStatus !== "online" &&
          nextStatus !== "afk" &&
          nextStatus !== "offline"
        ) {
          return contact;
        }

        return {
          ...contact,
          presenceStatus: nextStatus,
        };
      }),
    );
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
      setContacts([]);
      setPendingRequests([]);
      return;
    }

    void loadPrivateRoomData();
    void loadContacts();
    void loadPendingRequests();
  }, [user, loadContacts, loadPendingRequests]);

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
    <SocketProvider authenticated={!!user}>
      <AuthenticatedShell
        user={user}
        tab={tab}
        pendingRequests={pendingRequests}
        requestDropdownOpen={requestDropdownOpen}
        requestActionBusy={requestActionBusy}
        contacts={contacts}
        privateRooms={privateRooms}
        pendingInvites={pendingInvites}
        privateRoomsLoading={privateRoomsLoading}
        privateRoomsError={privateRoomsError}
        inviteActionId={inviteActionId}
        managedRoom={managedRoom}
        activeRoom={activeRoom}
        dmPartnerId={dmPartnerId}
        addContactOpen={addContactOpen}
        onToggleRequestDropdown={() => setRequestDropdownOpen((open) => !open)}
        onAcceptRequest={(id) => void handleAcceptRequest(id)}
        onDeclineRequest={(id) => void handleDeclineRequest(id)}
        onOpenContacts={openContactsTab}
        onCloseRequestDropdown={() => setRequestDropdownOpen(false)}
        onSelectTab={setTab}
        onAddContactOpen={() => setAddContactOpen(true)}
        onOpenDm={(userId) => {
          setDmPartnerId(userId);
          setTab("dm");
        }}
        onPresenceUpdate={handlePresenceUpdate}
        onRoomJoined={handleRoomJoined}
        onManageRoom={handleManageRoom}
        onLeavePrivateRoom={(room) => void handleLeavePrivateRoom(room)}
        onAcceptInvite={(roomId, inviteId) => void handleAcceptInvite(roomId, inviteId)}
        onDeclineInvite={(roomId, inviteId) => void handleDeclineInvite(roomId, inviteId)}
        onRoomCreated={handleRoomCreated}
        onBackFromManageRoom={() => setTab("private-rooms")}
        onBackFromRoomChat={() => setTab("public-rooms")}
        onSignedOut={handleSignedOut}
        onAddContactClose={() => setAddContactOpen(false)}
        onAddContactSuccess={() => {
          void loadContacts();
          void loadPendingRequests();
        }}
      />
    </SocketProvider>
  );
}

export default App;
