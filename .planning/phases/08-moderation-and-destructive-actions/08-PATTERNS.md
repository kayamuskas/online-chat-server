# Phase 8: Moderation and Destructive Actions — Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/rooms/rooms.service.ts` | service | CRUD | self (modify banMember + add deleteRoom) | exact |
| `apps/api/src/rooms/rooms.repository.ts` | repository | CRUD | self (add deleteRoom, listOwnedRooms) | exact |
| `apps/api/src/rooms/rooms-management.controller.ts` | controller | request-response | self (add DELETE /:id endpoint) | exact |
| `apps/api/src/messages/messages.service.ts` | service | CRUD | self (add deleteMessage) | exact |
| `apps/api/src/messages/messages.repository.ts` | repository | CRUD | `apps/api/src/attachments/attachments.repository.ts` | role-match |
| `apps/api/src/messages/messages.gateway.ts` | gateway | event-driven | self (add broadcastMessageDeleted, broadcastRoomDeleted) | exact |
| `apps/api/src/attachments/attachments.service.ts` | service | file-I/O | self (add deleteForRoom) | exact |
| `apps/api/src/attachments/attachments.repository.ts` | repository | CRUD | self (add findByRoomId, deleteByRoomId) | exact |
| `apps/api/src/auth/auth.service.ts` | service | CRUD | self (add deleteAccount) | exact |
| `apps/api/src/auth/auth.controller.ts` | controller | request-response | self (add DELETE /account endpoint) | exact |
| `apps/web/src/features/messages/MessageTimeline.tsx` | component | request-response | self (add Delete button to action bar) | exact |
| `apps/web/src/features/rooms/ManageRoomView.tsx` | component | request-response | self (add Settings tab danger zone) | exact |
| `apps/web/src/features/account/AccountOverviewView.tsx` | component | request-response | `apps/web/src/features/account/RevokeSessionConfirm.tsx` | role-match |
| `apps/web/src/lib/api.ts` | utility | request-response | self (add deleteMessage, deleteRoom, deleteAccount) | exact |
| `apps/api/src/db/migrations/0008_destructive_actions_fk.sql` | migration | batch | `apps/api/src/db/migrations/0005_messages_core.sql` | role-match |
| `e2e/moderation/*.spec.ts` (4 files) | test | request-response | existing e2e specs | role-match |

---

## Pattern Assignments

### `apps/api/src/rooms/rooms.service.ts` — banMember() fix + deleteRoom() (service, CRUD)

**Analog:** self — `apps/api/src/rooms/rooms.service.ts`

**Imports pattern** (lines 16-31): no new imports needed; `ForbiddenException` and `NotFoundException` already imported.

**D-17 fix — banMember() insert before addBan call** (lines 302-319, insert after line 310):
```typescript
// D-17: admin cannot ban another admin — only owner can ban an admin
const targetIsAdmin = await this.roomsRepo.isAdmin(roomId, targetUserId);
if (targetIsAdmin) {
  const callerIsOwner = await this.isOwner(roomId, bannedByUserId);
  if (!callerIsOwner) {
    throw new ForbiddenException('Only the room owner can ban an admin');
  }
}
```

**deleteRoom() core pattern** — new method, follows same style as removeMemberAsBan() (lines 338-369):
```typescript
/**
 * Delete a room and all its associated data.
 *
 * Order: WS broadcast FIRST (D-06), then attachments FS+DB, then messages,
 * then memberships/bans/invites (ON DELETE CASCADE on room_id), then room record.
 */
async deleteRoom(roomId: string, actorId: string): Promise<void> {
  await this.getRoom(roomId);  // throws NotFoundException if not found
  // Ownership check is done at controller level via requireOwner()
  // but we can trust actorId was verified by caller
  await this.gateway.broadcastRoomDeleted(roomId);                    // D-06: WS FIRST
  await this.attachmentsService.deleteForRoom(roomId);               // FS + DB records
  await this.roomsRepo.deleteRoom(roomId);                            // CASCADE handles messages, memberships, bans, invites
}
```

Note: `gateway` and `attachmentsService` must be injected into RoomsService constructor. Follow pattern of `roomsRepo` and `userRepo` injection (lines 35-38).

**listOwnedRooms() — needed for AUTH-08 cascade**:
```typescript
async listOwnedRooms(userId: string): Promise<Room[]> {
  return this.roomsRepo.listOwnedRooms(userId);
}
```

---

### `apps/api/src/rooms/rooms.repository.ts` — deleteRoom() + listOwnedRooms() (repository, CRUD)

**Analog:** self — `apps/api/src/rooms/rooms.repository.ts`

**SQL pattern** (follows create() pattern, lines 39-49):
```typescript
/** Hard-delete a room by ID. ON DELETE CASCADE removes memberships, bans, invites, messages. */
async deleteRoom(roomId: string): Promise<void> {
  await this.db.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
}

/** List all rooms owned by a user — for AUTH-08 cascade. */
async listOwnedRooms(userId: string): Promise<Room[]> {
  const result = await this.db.query<Room>(
    `SELECT id, name, description, visibility, owner_id, created_at, updated_at
     FROM rooms WHERE owner_id = $1 ORDER BY created_at ASC`,
    [userId],
  );
  return result.rows;
}

/** Remove the user from all room_admins rows (for AUTH-08 cascade, non-owned rooms). */
async removeAdminFromAllRooms(userId: string): Promise<void> {
  await this.db.query(`DELETE FROM room_admins WHERE user_id = $1`, [userId]);
}

/** Remove the user from all room_memberships (for AUTH-08 cascade). */
async removeMemberFromAllRooms(userId: string): Promise<void> {
  await this.db.query(`DELETE FROM room_memberships WHERE user_id = $1`, [userId]);
}
```

---

### `apps/api/src/rooms/rooms-management.controller.ts` — DELETE /:id endpoint (controller, request-response)

**Analog:** self — `apps/api/src/rooms/rooms-management.controller.ts`

**DELETE endpoint pattern** (follows removeAdmin DELETE pattern, lines 141-150):
```typescript
/**
 * DELETE /api/v1/rooms/:id
 *
 * Permanently deletes the room and all its messages/attachments.
 * - Caller must be the room owner.
 * - WS event room-deleted is broadcast before data is deleted (D-06).
 * 204 on success.
 */
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@UseGuards(CurrentUserGuard)
async deleteRoom(
  @Param('id') roomId: string,
  @CurrentUser() ctx: AuthContext,
): Promise<void> {
  await requireOwner(this.roomsService, roomId, ctx.user.id);
  await this.roomsService.deleteRoom(roomId, ctx.user.id);
}
```

Note: `requireOwner` helper already defined at lines 67-76 — reuse directly, no duplication.

---

### `apps/api/src/messages/messages.service.ts` — deleteMessage() (service, CRUD)

**Analog:** self — editMessage() pattern (lines 201-236)

**deleteMessage() — follows editMessage() structure exactly**:
```typescript
/**
 * Delete a message.
 *
 * Permission tiers (D-02):
 *   - Room messages: author OR room admin/owner may delete.
 *   - DM messages: only the author may delete.
 *
 * Returns conversation context for WS fanout.
 */
async deleteMessage(
  messageId: string,
  callerId: string,
): Promise<{ conversation_type: 'room' | 'dm'; conversation_id: string }> {
  // 1. Fetch the existing message
  const message = await this.repo.findMessageById(messageId);
  if (!message) {
    throw new NotFoundException(`Message '${messageId}' not found`);
  }

  // 2. Permission check (D-02)
  if (message.conversation_type === 'room') {
    const isAuthor = message.author_id === callerId;
    const isAdmin = await this.roomsRepo.isAdmin(message.conversation_id, callerId);  // includes owner check
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('Only the author or a room admin may delete this message');
    }
  } else {
    // DM: only author (no admin concept in DMs)
    if (message.author_id !== callerId) {
      throw new ForbiddenException('Only the author may delete their DM message');
    }
  }

  // 3. Hard delete (D-01)
  await this.repo.deleteMessage(messageId);

  return { conversation_type: message.conversation_type, conversation_id: message.conversation_id };
}
```

Note: `roomsRepo.isAdmin()` at the repository level checks only `room_admins` table (not owner). Use `this.isAdmin()` from RoomsService or inject RoomsService instead of RoomsRepository to get the owner-inclusive check. Alternatively call both `roomsRepo.isAdmin()` and check `message.conversation_id` owner via roomsRepo. RESEARCH Pitfall 6 says `roomsRepo.isAdmin()` is explicit admins only — must also check owner. Consider injecting RoomsService into MessagesService or using the service-level isAdmin().

---

### `apps/api/src/messages/messages.repository.ts` — deleteMessage() + deleteByConversation() (repository, CRUD)

**Analog:** `apps/api/src/attachments/attachments.repository.ts` deleteById() (line 91-93)

**Delete SQL pattern** (follows attachments.repository.ts deleteById, line 91):
```typescript
/** Hard-delete a single message by ID. Attachment records are deleted via ON DELETE CASCADE. */
async deleteMessage(messageId: string): Promise<void> {
  await this.db.query(`DELETE FROM messages WHERE id = $1`, [messageId]);
}

/**
 * Delete all messages for a conversation (used by room deletion cascade).
 * Note: room deletion via FK CASCADE on room_id handles this automatically.
 * This method exists only if needed outside cascade context.
 */
async deleteByConversation(
  conversationType: 'room' | 'dm',
  conversationId: string,
): Promise<void> {
  await this.db.query(
    `DELETE FROM messages WHERE conversation_type = $1 AND conversation_id = $2`,
    [conversationType, conversationId],
  );
}
```

---

### `apps/api/src/messages/messages.gateway.ts` — broadcastMessageDeleted() + broadcastRoomDeleted() (gateway, event-driven)

**Analog:** self — broadcastMessageCreated() (lines 197-219) and broadcastMessageEdited() (lines 227-246)

**broadcastMessageDeleted() — follows broadcastMessageEdited() pattern**:
```typescript
/**
 * Broadcast a 'message-deleted' event to all sockets subscribed to the
 * relevant conversation channel.
 *
 * Payload is intentionally minimal (D-03 / Claude's Discretion: prefer { id }).
 * NOTE: event name is kebab-case `message-deleted` to match existing conventions
 * (Pitfall 5: existing events use message-created, message-edited).
 */
async broadcastMessageDeleted(
  messageId: string,
  conversationType: 'room' | 'dm',
  conversationId: string,
): Promise<void> {
  const channel =
    conversationType === 'room'
      ? roomChannel(conversationId)
      : dmChannel(conversationId);

  this.server.to(channel).emit('message-deleted', {
    conversation_type: conversationType,
    conversation_id: conversationId,
    message_id: messageId,
  });
}
```

**broadcastRoomDeleted() — emits to room channel before data delete (D-06)**:
```typescript
/**
 * Broadcast a 'room-deleted' event to all sockets subscribed to the room channel.
 *
 * Must be called BEFORE any data deletion (D-06) so clients can navigate away.
 * NOTE: uses roomChannel() helper already defined at line 67.
 */
async broadcastRoomDeleted(roomId: string): Promise<void> {
  this.server.to(roomChannel(roomId)).emit('room-deleted', {
    room_id: roomId,
  });
}
```

Both methods slot in after the existing `broadcastMessageEdited()` method (after line 246). No new imports needed — `roomChannel()` and `dmChannel()` helpers already defined at lines 67-70.

---

### `apps/api/src/attachments/attachments.service.ts` — deleteForRoom() (service, file-I/O)

**Analog:** self — onApplicationBootstrap() orphan cleanup (lines 49-62)

**deleteForRoom() — extends the unlink() loop from onApplicationBootstrap()**:
```typescript
/**
 * Delete all attachments for a room: unlink files from FS, then delete DB records.
 *
 * Called as step 1 of the room deletion cascade (D-07, D-08).
 * FS deletion is synchronous (D-08): if unlink throws unexpectedly, propagate.
 * Files already gone from disk are silently ignored (same pattern as onApplicationBootstrap).
 */
async deleteForRoom(roomId: string): Promise<void> {
  const attachments = await this.repo.findByRoomId(roomId);
  for (const att of attachments) {
    await unlink(att.storage_path).catch(() => { /* file may already be gone */ });
  }
  await this.repo.deleteByRoomId(roomId);
}
```

Note: `unlink` is already imported at line 24. `findByRoomId` and `deleteByRoomId` are new repo methods (see below).

---

### `apps/api/src/attachments/attachments.repository.ts` — findByRoomId() + deleteByRoomId() (repository, CRUD)

**Analog:** self — findOrphanedBefore() (lines 82-89) and deleteById() (lines 91-93)

**New SQL methods**:
```typescript
/** Find all attachments belonging to messages in a room (for room deletion cascade). */
async findByRoomId(roomId: string): Promise<Attachment[]> {
  const result = await this.db.query<Attachment>(
    `SELECT a.id, a.storage_path
     FROM attachments a
     JOIN messages m ON m.id = a.message_id
     WHERE m.conversation_type = 'room' AND m.conversation_id = $1`,
    [roomId],
  );
  return result.rows;
}

/** Delete all attachment DB records for messages in a room. */
async deleteByRoomId(roomId: string): Promise<void> {
  await this.db.query(
    `DELETE FROM attachments
     WHERE message_id IN (
       SELECT id FROM messages
       WHERE conversation_type = 'room' AND conversation_id = $1
     )`,
    [roomId],
  );
}
```

---

### `apps/api/src/auth/auth.service.ts` — deleteAccount() (service, CRUD)

**Analog:** self — signIn() password verification pattern (lines 104-134)

**Imports to add**: inject `RoomsService`, `ContactsRepository` (or `ContactsService`), `UserRepository` already injected.

**deleteAccount() — password verify first, then cascade (D-15)**:
```typescript
/**
 * Delete the user's account with full cascade (D-15):
 *   1. Verify password
 *   2. Delete owned rooms (with WS broadcast per room)
 *   3. Remove admin roles in non-owned rooms
 *   4. Remove remaining memberships
 *   5. Delete contacts/friendships/bans
 *   6. Delete DM conversations (NOT messages — D-13)
 *   7. Nullify author_id on DM messages (if FK is SET NULL) or rely on migration
 *   8. Delete sessions
 *   9. Delete user record
 */
async deleteAccount(userId: string, password: string): Promise<void> {
  const user = await this.users.findById(userId);
  if (!user) throw new UnauthorizedException('User not found');

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) throw new UnauthorizedException('Incorrect password');

  // 1. Delete owned rooms (each triggers WS broadcast + full cascade)
  const ownedRooms = await this.roomsService.listOwnedRooms(userId);
  for (const room of ownedRooms) {
    await this.roomsService.deleteRoom(room.id, userId);
  }

  // 2. Strip admin roles in non-owned rooms
  await this.roomsRepo.removeAdminFromAllRooms(userId);

  // 3. Remove remaining memberships
  await this.roomsRepo.removeMemberFromAllRooms(userId);

  // 4. Delete contacts/bans/friendships (delegated to ContactsRepository)
  await this.contactsRepo.deleteAllFor(userId);

  // 5. Delete DM conversations (not DM messages — D-13)
  await this.contactsRepo.deleteDmConversationsFor(userId);

  // 6. Nullify author_id on remaining DM messages (migration makes this a SET NULL FK)
  // No explicit call needed if migration 0008 sets ON DELETE SET NULL for author_id

  // 7. Delete all sessions
  await this.sessions.deleteAllByUserId(userId);

  // 8. Delete user record
  await this.users.deleteById(userId);
}
```

Note: `verifyPassword` already imported (line 22). `RoomsService` must be injected to avoid circular deps — use forwardRef if needed.

---

### `apps/api/src/auth/auth.controller.ts` — DELETE /account endpoint (controller, request-response)

**Analog:** self — changePassword POST endpoint (lines 150-163)

**deleteAccount endpoint — follows changePassword pattern**:
```typescript
/**
 * DELETE /api/v1/auth/account
 *
 * Permanently deletes the authenticated user's account.
 * Requires password confirmation (D-10).
 * On success: clears session cookie and returns 204 (client redirects to auth screen — D-16).
 */
@Delete('account')
@HttpCode(HttpStatus.NO_CONTENT)
@UseGuards(CurrentUserGuard)
async deleteAccount(
  @CurrentUser() ctx: AuthContext,
  @Body() body: unknown,
  @Res({ passthrough: true }) res: ResponseLike,
): Promise<void> {
  const b = (body ?? {}) as { password?: unknown };
  if (typeof b.password !== 'string' || b.password.trim().length === 0) {
    throw new BadRequestException('password is required');
  }

  await this.authService.deleteAccount(ctx.user.id, b.password);
  clearSessionCookie(res);  // already imported at line 39
}
```

Note: `Delete` and `BadRequestException` must be added to NestJS imports. `clearSessionCookie` already imported.

---

### `apps/web/src/features/messages/MessageTimeline.tsx` — Delete button in action bar (component, request-response)

**Analog:** self — existing Reply/Edit button block (lines 283-307)

**Delete button — inserts alongside Edit button in `msg-bubble__actions`** (after line 305):
```tsx
{/* Delete button: visible to own messages OR admin/owner (passed via prop) */}
{(isOwn || canDeleteAny) && onDelete && (
  <button
    type="button"
    className="msg-bubble__action msg-bubble__action--danger"
    onClick={() => onDelete(msg)}
    aria-label="Delete this message"
  >
    Delete
  </button>
)}
```

**Props to add** to `MessageTimelineProps` interface (after line 40):
```typescript
/** Called when user clicks Delete on a message. Visible to author or admin/owner. */
onDelete?: (message: MessageView) => void;
/** True if the current user can delete any message (admin or owner in a room). */
canDeleteAny?: boolean;
```

---

### `apps/web/src/features/rooms/ManageRoomView.tsx` — Settings tab danger zone (component, request-response)

**Analog:** `apps/web/src/features/account/RevokeSessionConfirm.tsx` — two-step inline confirm pattern

**Imports to add**:
```typescript
import { deleteRoom } from "../../lib/api";
```

**State to add** (follows leaving/leaveError pattern, lines 63-65):
```typescript
const [deletingRoom, setDeletingRoom] = useState(false);
const [deleteRoomError, setDeleteRoomError] = useState<string | null>(null);
const [confirmingDelete, setConfirmingDelete] = useState(false);
```

**Settings tab danger zone JSX** (add to Settings tab case in the tab content switch):
```tsx
{activeTab === "settings" && (
  <div className="manage-room__settings">
    <section className="manage-room__danger-zone">
      <h3>Danger Zone</h3>
      {isOwner && (
        <div className="danger-zone__item">
          <div>
            <strong>Delete this room</strong>
            <p>Permanently deletes all messages and attachments. This cannot be undone.</p>
          </div>
          {!confirmingDelete ? (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete Room
            </button>
          ) : (
            <div className="danger-zone__confirm">
              <p>Delete <strong>{room.name}</strong>? This action cannot be undone.</p>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void handleDeleteRoom()}
                disabled={deletingRoom}
              >
                {deletingRoom ? "Deleting…" : "Confirm Delete"}
              </button>
              <button
                type="button"
                className="btn btn--soft"
                onClick={() => setConfirmingDelete(false)}
                disabled={deletingRoom}
              >
                Cancel
              </button>
            </div>
          )}
          {deleteRoomError && <p className="error-msg">{deleteRoomError}</p>}
        </div>
      )}
    </section>
  </div>
)}
```

**handleDeleteRoom** (follows handleSignOutCurrent pattern from AccountOverviewView, lines 55-64):
```typescript
async function handleDeleteRoom() {
  setDeletingRoom(true);
  setDeleteRoomError(null);
  try {
    await deleteRoom(room.id);
    onBack?.();  // Navigate away after deletion
  } catch (err) {
    setDeleteRoomError(err instanceof Error ? err.message : "Failed to delete room");
    setDeletingRoom(false);
  }
}
```

**ManageRoomViewProps additions**:
```typescript
/** Called after the room is successfully deleted (to navigate the user away). */
onRoomDeleted?: () => void;
```

---

### `apps/web/src/features/account/AccountOverviewView.tsx` — Delete Account danger zone (component, request-response)

**Analog:** `apps/web/src/features/account/RevokeSessionConfirm.tsx` (lines 31-65) for two-step confirm; `AccountOverviewView.tsx` handleSignOutCurrent (lines 55-64) for error pattern

**State to add** (follows signingOut/error pattern, lines 21-23):
```typescript
const [deletePassword, setDeletePassword] = useState("");
const [deletingAccount, setDeletingAccount] = useState(false);
const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
const [confirmingDeleteAccount, setConfirmingDeleteAccount] = useState(false);
```

**handleDeleteAccount** (follows handleSignOutCurrent, lines 55-64):
```typescript
async function handleDeleteAccount() {
  setDeletingAccount(true);
  setDeleteAccountError(null);
  try {
    await deleteAccount({ password: deletePassword });
    onSignedOut();  // Same callback as sign-out — client redirects to auth (D-16)
  } catch (err) {
    setDeleteAccountError(err instanceof Error ? err.message : "Failed to delete account");
    setDeletingAccount(false);
  }
}
```

**Danger zone JSX** (append after the account-overview__grid section, before closing `</div>`):
```tsx
<section className="account-overview__danger-zone">
  <h3>Delete Account</h3>
  <p>This permanently deletes your account, owned rooms, and all their messages.</p>
  {!confirmingDeleteAccount ? (
    <button
      type="button"
      className="btn btn--danger"
      onClick={() => setConfirmingDeleteAccount(true)}
    >
      Delete Account
    </button>
  ) : (
    <div className="danger-zone__confirm">
      <label>
        Confirm your password:
        <input
          type="password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          disabled={deletingAccount}
          autoComplete="current-password"
        />
      </label>
      <button
        type="button"
        className="btn btn--danger"
        onClick={() => void handleDeleteAccount()}
        disabled={deletingAccount || deletePassword.length === 0}
      >
        {deletingAccount ? "Deleting…" : "Confirm Delete Account"}
      </button>
      <button
        type="button"
        className="btn btn--soft"
        onClick={() => { setConfirmingDeleteAccount(false); setDeletePassword(""); }}
        disabled={deletingAccount}
      >
        Cancel
      </button>
      {deleteAccountError && <p className="error-msg">{deleteAccountError}</p>}
    </div>
  )}
</section>
```

---

### `apps/web/src/lib/api.ts` — deleteMessage(), deleteRoom(), deleteAccount() (utility, request-response)

**Analog:** self — existing del() helper (lines 149-172) and existing exported functions (e.g., signOut lines 204-206, changePassword lines 220-225)

**New exported functions** (add in appropriate sections — auth section and messages section):
```typescript
/**
 * DELETE /api/v1/auth/account
 * Permanently deletes the authenticated account. Requires password confirmation.
 */
export async function deleteAccount(params: { password: string }): Promise<void> {
  // Cannot use del() because body must be sent — use fetch directly or a new delWithBody helper
  const res = await fetch(`${BASE_URL}/auth/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = typeof data?.message === "string" ? data.message : "Failed to delete account";
    throw Object.assign(new Error(msg), { statusCode: res.status });
  }
}

/**
 * DELETE /api/v1/rooms/:id
 * Permanently deletes the room (owner only).
 */
export async function deleteRoom(roomId: string): Promise<void> {
  return del(`/rooms/${roomId}`);
}

/**
 * DELETE /api/v1/messages/rooms/:roomId/messages/:messageId
 * Delete a message in a room.
 */
export async function deleteRoomMessage(roomId: string, messageId: string): Promise<void> {
  return del(`/messages/rooms/${roomId}/messages/${messageId}`);
}

/**
 * DELETE /api/v1/messages/dm/:conversationId/messages/:messageId
 * Delete a DM message (author only).
 */
export async function deleteDmMessage(conversationId: string, messageId: string): Promise<void> {
  return del(`/messages/dm/${conversationId}/messages/${messageId}`);
}
```

---

### `apps/api/src/db/migrations/0008_destructive_actions_fk.sql` — FK changes (migration, batch)

**Analog:** pattern from `apps/api/src/db/migrations/0005_messages_core.sql` (reply_to_id ON DELETE SET NULL)

**Migration content**:
```sql
-- Phase 8: Allow user deletion without destroying DM message history (D-13, Pitfall 1 + 4)
-- Change messages.author_id from ON DELETE RESTRICT to ON DELETE SET NULL
-- Change attachments.uploader_id from ON DELETE RESTRICT to ON DELETE SET NULL

ALTER TABLE messages
  ALTER COLUMN author_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS messages_author_id_fkey,
  ADD CONSTRAINT messages_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE attachments
  ALTER COLUMN uploader_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS attachments_uploader_id_fkey,
  ADD CONSTRAINT attachments_uploader_id_fkey
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL;
```

---

## Shared Patterns

### Permission Check Guard (requireOwner / requireAdminOrOwner)
**Source:** `apps/api/src/rooms/rooms-management.controller.ts` lines 54-76
**Apply to:** deleteRoom endpoint (requireOwner), deleteMessage endpoint (requireAdminOrOwner for room messages)

```typescript
/** Require caller to be owner or admin; throws ForbiddenException otherwise. */
async function requireAdminOrOwner(
  roomsService: RoomsService,
  roomId: string,
  userId: string,
): Promise<void> {
  const isAdmin = await roomsService.isAdmin(roomId, userId);
  if (!isAdmin) {
    throw new ForbiddenException('You must be a room admin or owner to perform this action');
  }
}

/** Require caller to be the room owner; throws ForbiddenException otherwise. */
async function requireOwner(
  roomsService: RoomsService,
  roomId: string,
  userId: string,
): Promise<void> {
  const isOwner = await roomsService.isOwner(roomId, userId);
  if (!isOwner) {
    throw new ForbiddenException('Only the room owner can perform this action');
  }
}
```

### Service Permission + Throw Pattern
**Source:** `apps/api/src/messages/messages.service.ts` editMessage() lines 201-236; `apps/api/src/rooms/rooms.service.ts` removeMemberAsBan() lines 338-369
**Apply to:** deleteMessage() in MessagesService, deleteAccount() in AuthService
- Always fetch resource first, throw NotFoundException if absent
- Then check permission, throw ForbiddenException if denied
- Then execute mutation
- Return minimal context needed by caller (for WS fanout)

### WS Broadcast After Mutation (except room deletion)
**Source:** `apps/api/src/messages/messages.gateway.ts` broadcastMessageCreated() lines 197-219
**Apply to:** message:deleted broadcast after DB delete; room:deleted broadcast BEFORE DB delete
- Use `roomChannel(id)` / `dmChannel(id)` helpers already defined at lines 67-70
- Event names are kebab-case: `message-deleted`, `room-deleted` (Pitfall 5)
- Emit via `this.server.to(channel).emit(eventName, payload)`

### File Unlink with Silent-Miss Pattern
**Source:** `apps/api/src/attachments/attachments.service.ts` onApplicationBootstrap() lines 59
**Apply to:** deleteForRoom() — each unlink call
```typescript
await unlink(att.storage_path).catch(() => { /* file may already be gone */ });
```

### Inline Two-Step Confirm (UI)
**Source:** `apps/web/src/features/account/RevokeSessionConfirm.tsx` lines 31-65
**Apply to:** Room deletion confirm in ManageRoomView, account deletion confirm in AccountOverviewView
- State: `[confirming, setConfirming] = useState(false)`
- First click: `setConfirming(true)` shows confirm/cancel buttons
- Second click: executes the destructive action
- Cancel: `setConfirming(false)` returns to original state
- Buttons disabled while action in flight

### API Client Delete Helper
**Source:** `apps/web/src/lib/api.ts` del() function lines 149-172; signOut() lines 204-206
**Apply to:** deleteRoom(), deleteRoomMessage(), deleteDmMessage() in api.ts
- `del(path)` handles 204 and error parsing automatically
- For DELETE with body (deleteAccount), inline fetch with JSON body is needed (del() doesn't accept body)

---

## No Analog Found

All files have analogs in the codebase. No files require fallback to external references only.

---

## Critical Implementation Notes

1. **WS event name convention:** Use `message-deleted` and `room-deleted` (kebab-case), NOT `message:deleted` / `room:deleted`. CONTEXT.md uses colon notation for concept names only. (RESEARCH Pitfall 5, verified against lines 203, 233 of messages.gateway.ts)

2. **room:deleted fires BEFORE data delete:** This is the single most important ordering constraint. broadcastRoomDeleted() call must be the very first statement in deleteRoom() after the ownership check. (D-06)

3. **FK migration required:** Before AUTH-08 deleteAccount() can delete the user row, migration 0008 must change `messages.author_id` and `attachments.uploader_id` from `ON DELETE RESTRICT` to `ON DELETE SET NULL`. Without this migration, `DELETE FROM users WHERE id = $1` will fail with a FK violation. (RESEARCH Pitfall 1 + 4, verified against migrations 0005 and 0006)

4. **isAdmin() levels:** `roomsRepo.isAdmin()` checks only the `room_admins` table (explicit admins). `roomsService.isAdmin()` adds owner check on top. For the D-17 fix in banMember(), use `roomsRepo.isAdmin()` for target check (correct — want explicit admin status) and `this.isOwner()` for caller check. (RESEARCH Pitfall 6)

5. **DM messages preserved:** AUTH-08 cascade must NOT delete DM messages (D-13). The correct cascade order deletes DM conversations but leaves messages. After migration 0008, deleting the user record will SET NULL the author_id on those messages automatically.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/features/`, `apps/web/src/lib/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-04-20
