# Requirements: Online Chat Server

**Defined:** 2026-04-18
**Core Value:** A fresh clone must start a fully functional classic chat system locally, offline, and in a way that matches the written requirements more strictly than any existing prototype.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can register with unique email, unique username, and password.
- [x] **AUTH-02**: Username remains immutable after registration.
- [x] **AUTH-03**: User can sign in with email and password.
- [x] **AUTH-04**: User can sign out only the current browser session.
- [x] **AUTH-05**: User login persists across browser close and reopen.
- [x] **AUTH-06**: User can reset password.
- [x] **AUTH-07**: Logged-in user can change password.
- [ ] **AUTH-08**: User can delete their account, which deletes rooms they own and removes their membership elsewhere.

### Sessions and Presence

- [ ] **SESS-01**: User can view active sessions with browser and IP details.
- [ ] **SESS-02**: User can log out selected sessions without logging out all sessions.
- [ ] **SESS-03**: Contacts and room members show `online`, `AFK`, or `offline` presence.
- [ ] **SESS-04**: User becomes `AFK` only after all open tabs are inactive for more than one minute.
- [ ] **SESS-05**: User is `online` if at least one open tab is active and `offline` only when all tabs are closed/offloaded.
- [ ] **SESS-06**: System persists `last seen` while serving live presence from runtime state rather than frequent database reads.
- [ ] **SESS-07**: System tracks user IP addresses for active sessions.

### Contacts and Direct Messaging Eligibility

- [ ] **FRND-01**: User can send a friend request by username or from a room member list, with optional text.
- [ ] **FRND-02**: Friendship exists only after recipient confirmation.
- [ ] **FRND-03**: User can remove a friend.
- [ ] **FRND-04**: User can ban another user so they can no longer contact them.
- [ ] **FRND-05**: Existing DM history remains visible but becomes read-only after a user-to-user ban.
- [ ] **FRND-06**: Personal messaging is allowed only when users are friends and neither side has banned the other.

### Rooms and Moderation

- [ ] **ROOM-01**: Authenticated user can create a room with unique name, description, visibility, owner, admins, members, and ban list.
- [ ] **ROOM-02**: User can browse and search public rooms with description and member count.
- [ ] **ROOM-03**: User can freely join public rooms unless banned.
- [ ] **ROOM-04**: Private rooms are hidden from the public catalog and require invitation to join.
- [ ] **ROOM-05**: Members can leave rooms freely, but owners cannot leave their own room and must delete it instead.
- [ ] **ROOM-06**: Private-room invitations can be sent by username.
- [ ] **ROOM-10**: Room names are globally unique across both public and private rooms.
- [ ] **ROOM-11**: Room invitations can be sent only to already registered users.
- [ ] **ROOM-07**: Owner/admin permissions enforce room moderation, admin management, and ban-list management exactly as specified.
- [ ] **ROOM-08**: Removing a member from a room acts as a ban until the user is removed from the room ban list.
- [ ] **ROOM-09**: Deleting a room permanently deletes its messages and attachments.

### Messaging and History

- [ ] **MSG-01**: Room chats and personal dialogs support the same core message features from the UI perspective.
- [ ] **MSG-02**: User can send UTF-8 plain or multiline text messages up to 3 KB.
- [ ] **MSG-03**: User can send emoji and replies/reference another message.
- [ ] **MSG-04**: User can edit their own messages and the UI shows an edited marker.
- [ ] **MSG-05**: Message author can delete their own messages, and room admins can delete room messages.
- [ ] **MSG-06**: Messages are stored persistently, displayed chronologically, and delivered after reconnect when the recipient was offline.
- [ ] **MSG-07**: Chat history supports infinite scroll and smart autoscroll behavior.
- [ ] **MSG-08**: Each chat uses incremental watermarks so the client can detect missing history ranges and requery safely.
- [ ] **MSG-09**: Transient delivery queues remain bounded and do not grow indefinitely for long-absent users.

### Attachments

- [ ] **FILE-01**: User can send images and arbitrary files through upload button or paste.
- [ ] **FILE-02**: System preserves original filename and optional attachment comment.
- [ ] **FILE-03**: Only current room members or authorized DM participants can download an attachment.
- [ ] **FILE-04**: If a user loses room access, they also lose access to the room's messages, files, and images.
- [ ] **FILE-05**: Uploaded files remain stored unless the room is deleted, even if the uploader later loses access.
- [ ] **FILE-06**: File size limit is 20 MB and image size limit is 3 MB.

### Notifications and UI

- [ ] **NOTF-01**: UI shows unread indicators near room names and contact names.
- [ ] **NOTF-02**: Unread indicator clears when the user opens the corresponding chat.
- [ ] **UI-01**: Application presents a classic web chat layout with top menu, side lists, center messages, bottom composer, and right-side member/context panel.
- [ ] **UI-02**: After entering a room, the room list compacts into accordion style.
- [ ] **UI-03**: Administrative actions are available through menus and modal dialogs.

### Operations and Quality

- [ ] **OPS-01**: Fresh clone can be started by QA with `docker compose up`.
- [ ] **OPS-02**: Application runs without internet access during startup and usage, assuming required Docker base images already exist locally.
- [ ] **OPS-03**: Files are stored on the local filesystem and persist across restarts.
- [ ] **OPS-04**: SMTP-dependent flows can run against mocks or local test doubles without requiring a real external mail service.
- [ ] **ARCH-01**: System uses queues for asynchronous processing where deferred work exists.
- [ ] **ARCH-02**: System uses a mixed REST and WebSocket model so high-frequency updates do not rely on polling while non-streaming data does not require websocket-only transport.
- [ ] **PERF-01**: System supports up to 300 simultaneous users, up to 1000 room members, and usable 10,000+ message history while meeting stated latency targets.
- [ ] **PERF-02**: Very old rooms with 100,000+ messages still support progressive upward scrolling with explicit test coverage.

## v2 Requirements

### Jabber / Federation

- **XMPP-01**: Users can connect to the server with a Jabber/XMPP client.
- **XMPP-02**: Servers can federate and exchange messages between installations.
- **XMPP-03**: Admin UI shows Jabber connection and federation traffic information.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Jabber/XMPP in v1 | Explicitly deferred to v2 by project decision |
| Multi-server federation in v1 | Deferred with Jabber; v1 is single-server |
| Native mobile apps | Not required by the source specification |
| CDN-hosted runtime frontend assets | Conflicts with offline startup requirement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Complete |
| AUTH-07 | Phase 2 | Complete |
| AUTH-08 | Phase 8 | Pending |
| SESS-01 | Phase 3 | Pending |
| SESS-02 | Phase 3 | Pending |
| SESS-03 | Phase 3 | Pending |
| SESS-04 | Phase 3 | Pending |
| SESS-05 | Phase 3 | Pending |
| SESS-06 | Phase 3 | Pending |
| SESS-07 | Phase 3 | Pending |
| FRND-01 | Phase 5 | Pending |
| FRND-02 | Phase 5 | Pending |
| FRND-03 | Phase 5 | Pending |
| FRND-04 | Phase 5 | Pending |
| FRND-05 | Phase 5 | Pending |
| FRND-06 | Phase 5 | Pending |
| ROOM-01 | Phase 4 | Pending |
| ROOM-02 | Phase 4 | Pending |
| ROOM-03 | Phase 4 | Pending |
| ROOM-04 | Phase 4 | Pending |
| ROOM-05 | Phase 4 | Pending |
| ROOM-06 | Phase 4 | Pending |
| ROOM-10 | Phase 4 | Pending |
| ROOM-11 | Phase 4 | Pending |
| ROOM-07 | Phase 8 | Pending |
| ROOM-08 | Phase 8 | Pending |
| ROOM-09 | Phase 8 | Pending |
| MSG-01 | Phase 6 | Pending |
| MSG-02 | Phase 6 | Pending |
| MSG-03 | Phase 6 | Pending |
| MSG-04 | Phase 6 | Pending |
| MSG-05 | Phase 8 | Pending |
| MSG-06 | Phase 7 | Pending |
| MSG-07 | Phase 9 | Pending |
| MSG-08 | Phase 6 | Pending |
| MSG-09 | Phase 7 | Pending |
| FILE-01 | Phase 7 | Pending |
| FILE-02 | Phase 7 | Pending |
| FILE-03 | Phase 7 | Pending |
| FILE-04 | Phase 7 | Pending |
| FILE-05 | Phase 7 | Pending |
| FILE-06 | Phase 7 | Pending |
| NOTF-01 | Phase 9 | Pending |
| NOTF-02 | Phase 9 | Pending |
| UI-01 | Phase 9 | Pending |
| UI-02 | Phase 9 | Pending |
| UI-03 | Phase 9 | Pending |
| OPS-01 | Phase 1 | Pending |
| OPS-02 | Phase 1 | Pending |
| OPS-03 | Phase 7 | Pending |
| OPS-04 | Phase 2 | Complete |
| ARCH-01 | Phase 1 | Pending |
| ARCH-02 | Phase 1 | Pending |
| PERF-01 | Phase 10 | Pending |
| PERF-02 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0

---
*Requirements defined: 2026-04-18*
*Last updated: 2026-04-18 after initial definition*
