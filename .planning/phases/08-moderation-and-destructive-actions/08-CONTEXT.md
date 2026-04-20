# Phase 8: Moderation and Destructive Actions - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete admin tooling enforcement and implement three cascaded destructive flows: message deletion (MSG-05), room deletion (ROOM-09), and account deletion (AUTH-08). Also enforce the ROOM-07 permission matrix exactly — including the admin-cannot-ban-admin rule not yet in code.

This phase does NOT cover: message editing UI changes, room transfer/ownership handoff, soft-deletes, audit logging, or federation.

</domain>

<decisions>
## Implementation Decisions

### MSG-05: Message Deletion

- **D-01:** Hard delete — the message row is purged from the database entirely. No "message deleted" placeholder is shown. Reply previews (`reply_preview`) that referenced the deleted message become stale/null — acceptable; no extra handling needed.
- **D-02:** Permission tiers: message author can delete own message; room owner + room admin can delete any message in that room. DM messages: only the author can delete their own message (no admin concept in DMs).
- **D-03:** WS event `message:deleted` with `{ messageId, roomId/dmConversationId }` fanned out to the room/DM channel immediately after DB delete — consistent with the existing `message:new` and `message:edit` pattern from Phase 6.1.
- **D-04:** UI — a Delete button appears on hover over a message row, visible only to the author (for own messages) or admin/owner (for any room message). Inline with the message action bar that already exists in MessageTimeline.

### ROOM-09: Room Deletion

- **D-05:** Only the room owner can trigger room deletion.
- **D-06:** WS event `room:deleted { roomId }` is broadcast to all room members **before** any data is deleted, so clients can navigate away cleanly.
- **D-07:** Cascade order after WS broadcast:
  1. Delete attachment files from filesystem (synchronously via AttachmentsService)
  2. Delete attachment DB records
  3. Delete messages
  4. Delete memberships, bans, admin rows, pending invites
  5. Delete room record
- **D-08:** File deletion is synchronous — if filesystem throws, the entire operation fails and rolls back. No background queue for this.
- **D-09:** UI — "Delete Room" button in ManageRoomView → Settings tab, in a visually distinct danger zone. Requires an inline confirmation step (type room name or click confirm).

### AUTH-08: Account Deletion

- **D-10:** Password confirmation required — endpoint `POST /auth/delete-account` accepts `{ password }`. Backend verifies password before proceeding.
- **D-11:** Owned rooms are deleted first, each with its own `room:deleted` WS broadcast and full cascade (attachments → messages → memberships → room record).
- **D-12:** Rooms where the user was admin (but not owner) — admin role is simply stripped. No transfer, no notification. Room continues with its existing owner.
- **D-13:** DM message history is preserved — `sender_id` on messages continues pointing to the deleted user's ID (no FK cascade on messages). The DM conversation record is left in place; the other participant still sees the history.
- **D-14:** All sessions deleted → WS sockets get 401 on next auth check and disconnect automatically. No explicit `user:deleted` WS event.
- **D-15:** Full cascade order: delete owned rooms (with WS) → strip admin roles in non-owned rooms → remove memberships elsewhere → delete contacts/friendships/bans → delete DM conversations (not messages) → delete sessions → delete user record.
- **D-16:** UI — "Delete Account" section in AccountOverviewView (danger zone), with password input field and confirmation button. After success, client is redirected to the auth screen (same as sign-out).

### ROOM-07: Permission Matrix Enforcement

- **D-17:** Admin cannot ban another admin — only the room owner can ban an admin. `banMember()` must add a check: if the target user is an admin, reject unless the caller is the owner. This check is missing from the current Phase 4 implementation and must be added.
- **D-18:** Ban reason is optional (nullable) — already nullable in the DB schema. No change needed; UI shows a reason input as optional.
- **D-19:** Actions requiring `requireOwner`: add admin, remove admin, delete room.
- **D-20:** Actions requiring `requireAdminOrOwner` (against non-admin members only): ban member, unban member, remove member, delete message.

### Claude's Discretion

- Exact confirmation UX for room deletion (type-name vs click-confirm button).
- HTTP verb and route shape for delete-account (suggest `DELETE /api/v1/auth/account` with body `{ password }`).
- Whether `message:deleted` carries full message payload or just `{ id }` — prefer `{ id }` to keep event payload minimal.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §ROOM-07, §ROOM-08, §ROOM-09, §MSG-05, §AUTH-08 — authoritative requirement text

### Existing Phase 4 implementation (rooms admin/ban foundation)
- `apps/api/src/rooms/rooms.service.ts` — `banMember`, `unbanMember`, `removeMemberAsBan`, `addAdmin`, `removeAdmin`, `isAdmin`, `isOwner`
- `apps/api/src/rooms/rooms-management.controller.ts` — `requireAdminOrOwner`, `requireOwner` guards; all existing admin endpoints
- `apps/api/src/rooms/rooms.repository.ts` — `addBan`, `removeBan`, `isBanned`, `listBans`, `addAdmin`, `removeAdmin`

### Existing Phase 6 implementation (messages foundation)
- `apps/api/src/messages/messages.service.ts` — `sendMessage`, `editMessage`, `listHistory`; `deleteMessage` is NOT YET implemented
- `apps/api/src/messages/messages.repository.ts` — no `deleteMessage` yet
- `apps/api/src/messages/messages.gateway.ts` — existing WS fanout patterns for `message:new`, `message:edit`

### Existing Phase 7 implementation (attachments)
- `apps/api/src/attachments/` — `AttachmentsService` with upload/download/ACL; must expose a `deleteAttachmentsForRoom(roomId)` method for ROOM-09 cascade

### Existing Phase 9 UI (where delete actions integrate)
- `apps/web/src/features/rooms/ManageRoomView.tsx` — Settings tab (add danger zone here for room deletion)
- `apps/web/src/features/account/AccountOverviewView.tsx` — add danger zone here for account deletion
- `apps/web/src/features/messages/MessageTimeline.tsx` — add hover delete button here

### Design reference
- `requirements/desing_v1/components/manage.jsx` — room management interaction reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireAdminOrOwner` / `requireOwner` helpers in `rooms-management.controller.ts` — reuse directly; only need to add the admin-targeting check in `banMember`
- `AttachmentsService` — already handles filesystem I/O; extend with `deleteForRoom(roomId)` method
- WS gateway in `messages.gateway.ts` — extend with `message:deleted` and `room:deleted` emit patterns

### Established Patterns
- Service-level permission checks throw `ForbiddenException` — keep this pattern for `deleteMessage` and `deleteAccount`
- Repository layer owns all SQL — `deleteMessage` and `deleteRoom` cascade SQL belongs in repository, not service
- Phase 6.1 WS events use `{ roomId, ...payload }` shape — `message:deleted` and `room:deleted` should follow same convention

### Integration Points
- `ManageRoomView.tsx` Settings tab → `DELETE /api/v1/rooms/:roomId` (new endpoint)
- `AccountOverviewView.tsx` danger zone → `DELETE /api/v1/auth/account` with `{ password }` body
- `MessageTimeline.tsx` hover actions → `DELETE /api/v1/messages/:messageId` (new endpoint)
- `messages.gateway.ts` → new `message:deleted` and `room:deleted` emit calls

</code_context>

<specifics>
## Specific Ideas

- The admin-cannot-ban-admin rule (D-17) is the most likely integration bug — it requires a targeted fix to `banMember()` in `rooms.service.ts`, not a new endpoint.
- For the account deletion cascade, owned rooms should be deleted using the same `deleteRoom()` logic (including WS broadcast) so all deletion-related side effects fire consistently — not a separate raw SQL delete.
- `message:deleted` and `room:deleted` WS events should be emitted through the existing gateway infrastructure, not a new gateway.

</specifics>

<deferred>
## Deferred Ideas

- Admin transfer / room ownership handoff on account deletion — deferred, not in requirements
- Soft-delete / message audit log — deferred, not scoped
- Bulk message moderation tools — deferred to a future moderation phase

</deferred>

---

*Phase: 08-moderation-and-destructive-actions*
*Context gathered: 2026-04-20*
