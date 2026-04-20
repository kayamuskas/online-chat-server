---
phase: 08-moderation-and-destructive-actions
verified: 2026-04-20T17:30:00Z
status: passed
score: 14/14 must-haves verified
re_verification: true
gaps: []
gap_fixes:
  - truth: "Admin cannot ban another admin — only the room owner can"
    fix: "D-17 guard added to removeMemberAsBan() in rooms.service.ts (commit 64d557f)"
    artifacts:
      - path: "apps/api/src/rooms/rooms.service.ts"
        issue: "removeMemberAsBan() bypasses D-17: no check that prevents a non-owner admin from targeting another admin for removal. The method only protects the owner, not other admins."
    missing:
      - "Add D-17 check in removeMemberAsBan() identical to banMember(): if targetIsAdmin and !callerIsOwner, throw ForbiddenException('Only the room owner can ban an admin')"
human_verification:
  - test: "Delete button visibility — authorized vs unauthorized users"
    expected: "Delete button appears on hover only for message author or room admin/owner. Non-authorized users see no delete button."
    why_human: "Hover state and conditional rendering require browser interaction to confirm visually."
  - test: "Danger zone owner-only visibility in ManageRoomView"
    expected: "Danger zone with 'Delete Room' button visible only to room owner. Non-owner admins and members do not see it."
    why_human: "Requires UI login as different roles to confirm conditional rendering."
  - test: "Account deletion UI flow in AccountOverviewView"
    expected: "Two-step confirm: 'Delete Account' button expands password input. Correct password triggers cascade and redirect to auth screen. Wrong password shows error inline."
    why_human: "Requires real account and live API to test cascade + cookie clear + redirect."
  - test: "Room deletion WS broadcast received by other clients before navigation"
    expected: "When owner deletes room, all other connected clients receive room-deleted WS event and navigate away before data is gone."
    why_human: "Requires multiple browser sessions to verify WS-first ordering."
---

# Phase 8: Moderation and Destructive Actions Verification Report

**Phase Goal:** Complete admin tooling and destructive flows with correct cascades.
**Verified:** 2026-04-20T17:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | messages.author_id FK is ON DELETE SET NULL (not RESTRICT) in bootstrap SQL | ✓ VERIFIED | `grep -c "ON DELETE SET NULL" postgres.service.ts` returns 5; migration file 0008_destructive_actions_fk.sql exists |
| 2 | attachments.uploader_id FK is ON DELETE SET NULL (not RESTRICT) in bootstrap SQL | ✓ VERIFIED | Same file — 5 SET NULL matches covers both author_id and uploader_id |
| 3 | Admin cannot ban another admin — only the room owner can | ✗ PARTIAL | D-17 check in `banMember()` is correct, but `removeMemberAsBan()` is a separate implementation that does NOT inherit the D-17 check and does NOT call `banMember()`. Admin-targeting-admin via the member-removal endpoint is unprotected. |
| 4 | ROOM-08 ban-as-removal behavior exists and is unbroken | ✓ VERIFIED | `removeMemberAsBan()` removes membership and creates ban record via `roomsRepo.addBan()`. Behavior functional. |
| 5 | Message author can delete their own message in rooms and DMs | ✓ VERIFIED | `deleteMessage()` in service checks `message.author_id === callerId` for both room and DM messages |
| 6 | Room admin/owner can delete any message in their room | ✓ VERIFIED | `deleteMessage()` calls `roomsService.isAdmin()` (includes owner) for room messages |
| 7 | DM messages can only be deleted by the author | ✓ VERIFIED | `deleteMessage()` for DMs enforces strict `author_id === callerId` with separate ForbiddenException |
| 8 | Deleted message disappears from all connected clients via WS event | ✓ VERIFIED | `broadcastMessageDeleted()` in MessagesGateway emits `'message-deleted'`; RoomChatView and DmChatView both register `socket.on('message-deleted', ...)` handlers |
| 9 | Delete button appears on hover for authorized users | ? HUMAN | CSS hover visible, button renders when `(isOwn \|\| canDeleteAny) && onDelete`. Human verification needed for visual behavior. |
| 10 | Only the room owner can delete a room | ✓ VERIFIED | `rooms-management.controller.ts` DELETE `/:id` calls `requireOwner()` before `roomsService.deleteRoom()`. Controller has class-level `@UseGuards(CurrentUserGuard)`. |
| 11 | room-deleted WS event broadcasts BEFORE data deletion | ✓ VERIFIED | `rooms.service.ts deleteRoom()` order: `broadcastRoomDeleted()` → `deleteForRoom()` → `roomsRepo.deleteRoom()` — sequential awaits enforce order |
| 12 | Room deletion cascade: FS attachments → DB attachments → messages → memberships/room | ✓ VERIFIED | `attachmentsService.deleteForRoom()` runs unlink+DB delete; `roomsRepo.deleteRoom()` uses FK CASCADE for messages/memberships/admins/bans/invites |
| 13 | User can delete their account with password confirmation and full cascade | ✓ VERIFIED | `auth.service.ts deleteAccount()` verifies password first, then follows D-15 order: owned rooms (WS) → admin roles → memberships → contacts → DM convos → sessions → user |
| 14 | Client redirects to auth screen after account deletion | ✓ VERIFIED | `AccountOverviewView.tsx` calls `onSignedOut()` on successful deleteAccount; `clearSessionCookie(res)` in controller; `deleteAllByUserId()` clears all sessions |

**Score:** 13/14 truths verified (1 partial = gap)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/api/src/db/migrations/0008_destructive_actions_fk.sql` | ✓ VERIFIED | Exists with ALTER TABLE for both messages.author_id and attachments.uploader_id |
| `apps/api/src/db/postgres.service.ts` | ✓ VERIFIED | 5 ON DELETE SET NULL occurrences; Phase 8 ALTER TABLE block appended |
| `apps/api/src/rooms/rooms.service.ts` (banMember D-17) | ✓ VERIFIED | `roomsRepo.isAdmin(roomId, targetUserId)` + `isOwner()` check exists; ForbiddenException with correct message |
| `apps/api/src/messages/messages.repository.ts` | ✓ VERIFIED | `async deleteMessage(messageId)` at line 312 |
| `apps/api/src/messages/messages.service.ts` | ✓ VERIFIED | `async deleteMessage(messageId, callerId)` at line 251 with permission tiers |
| `apps/api/src/messages/messages.controller.ts` | ✓ VERIFIED | DELETE `rooms/:roomId/messages/:messageId` (line 315) and DELETE `dm/:conversationId/messages/:messageId` (line 334) |
| `apps/api/src/messages/messages.gateway.ts` | ✓ VERIFIED | `broadcastMessageDeleted()` at line 254; `broadcastRoomDeleted()` at line 275 |
| `apps/web/src/features/messages/MessageTimeline.tsx` | ✓ VERIFIED | `onDelete` and `canDeleteAny` props; `msg-bubble__action--delete` button at line 315 |
| `apps/api/src/rooms/rooms.service.ts` (deleteRoom) | ✓ VERIFIED | `async deleteRoom(roomId, actorId)` at line 403 with WS-first ordering |
| `apps/api/src/rooms/rooms-management.controller.ts` (DELETE /:id) | ✓ VERIFIED | `@Delete(':id')` at line 219; `requireOwner()` called; class-level `@UseGuards(CurrentUserGuard)` |
| `apps/api/src/attachments/attachments.service.ts` | ✓ VERIFIED | `async deleteForRoom(roomId)` at line 157 with `unlink(path).catch(() => {})` |
| `apps/api/src/attachments/attachments.repository.ts` | ✓ VERIFIED | `findByRoomId` at line 96; `deleteByRoomId` at line 108 |
| `apps/web/src/features/rooms/ManageRoomView.tsx` | ✓ VERIFIED | `.danger-zone` block at lines 355+; two-step confirm; owner-guarded |
| `apps/api/src/auth/user.repository.ts` | ✓ VERIFIED | `async deleteById(userId)` at line 62 |
| `apps/api/src/auth/session.repository.ts` | ✓ VERIFIED | `async deleteAllByUserId(userId)` at line 127 |
| `apps/api/src/contacts/contacts.repository.ts` | ✓ VERIFIED | `deleteAllFor` at line 391; `deleteDmConversationsFor` at line 410 |
| `apps/api/src/auth/auth.service.ts` | ✓ VERIFIED | `async deleteAccount(userId, password)` at line 250; D-15 cascade order confirmed |
| `apps/api/src/auth/auth.controller.ts` | ✓ VERIFIED | `@Delete('account')` at line 174; password validation; `clearSessionCookie(res)` |
| `apps/web/src/lib/api.ts` | ✓ VERIFIED | `deleteRoomMessage` (877), `deleteDmMessage` (885), `deleteRoom`, `deleteAccount` (231) all present |
| `apps/web/src/features/account/AccountOverviewView.tsx` | ✓ VERIFIED | `.danger-zone` section; two-step confirm with password input; `onSignedOut()` on success |
| `apps/web/src/styles.css` | ✓ VERIFIED | `.msg-bubble__action--delete:hover` (line 2055); `.danger-zone` and child classes (lines 2062+) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `messages.controller.ts` | `messages.service.ts` | `messagesService.deleteMessage()` | ✓ WIRED | Both DELETE endpoints call deleteMessage then broadcastMessageDeleted |
| `messages.controller.ts` | `messages.gateway.ts` | `gateway.broadcastMessageDeleted()` | ✓ WIRED | Both endpoints call gateway after service |
| `MessageTimeline.tsx` | `api.ts` | `onDelete` prop → `deleteRoomMessage`/`deleteDmMessage` | ✓ WIRED | RoomChatView and DmChatView wire `handleDeleteMessage` to `onDelete`; API functions confirmed at lines 877, 885 |
| `rooms.service.ts` | `messages.gateway.ts` | `gateway.broadcastRoomDeleted()` FIRST | ✓ WIRED | Line 407 calls broadcastRoomDeleted before attachmentsService (line 410) and roomsRepo.deleteRoom (line 415) |
| `rooms.service.ts` | `attachments.service.ts` | `attachmentsService.deleteForRoom()` | ✓ WIRED | AttachmentsService injected at constructor line 43 |
| `rooms.service.ts` | `rooms.repository.ts` | `roomsRepo.deleteRoom()` | ✓ WIRED | Line 415 |
| `auth.service.ts` | `rooms.service.ts` | `roomsService.deleteRoom()` for each owned room | ✓ WIRED | Cascade loops ownedRooms and calls deleteRoom per room |
| `auth.service.ts` | `rooms.repository.ts` | `roomsRepo.removeAdminFromAllRooms/removeMemberFromAllRooms` | ✓ WIRED | Both called in D-15 order |
| `auth.service.ts` | `contacts.repository.ts` | `contactsRepo.deleteAllFor/deleteDmConversationsFor` | ✓ WIRED | Both called in D-15 order |
| `auth.controller.ts` | `auth.service.ts` | `authService.deleteAccount()` | ✓ WIRED | Line 187 |
| `AccountOverviewView.tsx` | `api.ts` | `deleteAccount({ password })` | ✓ WIRED | Line 63 |
| `RoomChatView.tsx` | WS | `socket.on('message-deleted')` + `socket.on('room-deleted')` | ✓ WIRED | Lines 263-264; cleanup at 270-271 |
| `DmChatView.tsx` | WS | `socket.on('message-deleted')` | ✓ WIRED | Line 339; cleanup at 346 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `messages.service.ts deleteMessage` | `message` from `repo.findMessageById()` | PostgreSQL `SELECT` query | Yes — real DB lookup before permission check | ✓ FLOWING |
| `rooms.service.ts deleteRoom` | `room` from `getRoom()` | PostgreSQL via `findById()` | Yes — real DB lookup, throws NotFoundException if missing | ✓ FLOWING |
| `auth.service.ts deleteAccount` | `user` from `users.findById()` | PostgreSQL `SELECT` query | Yes — real DB lookup, verifyPassword on real hash | ✓ FLOWING |
| `App.tsx isAdminOrOwner` | `activeRoom.role` from `membership.role` | `loadPrivateRoomData` API call → membership data | Yes — `role` stored in ShellRoomLink from real API response | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for endpoints requiring running server. No standalone runnable entry points can be tested without starting the API.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ROOM-07 | 08-01 | Owner/admin permissions enforce moderation exactly as specified | ✗ PARTIAL | D-17 implemented in `banMember()` but `removeMemberAsBan()` lacks admin-targeting-admin protection — admin can remove another admin via member management endpoint |
| ROOM-08 | 08-01 | Removing a member acts as a ban until removed from ban list | ✓ SATISFIED | `removeMemberAsBan()` removes membership and creates ban record; user blocked from rejoining until explicitly unbanned |
| ROOM-09 | 08-03 | Deleting a room permanently deletes its messages and attachments | ✓ SATISFIED | WS-first cascade: broadcastRoomDeleted → deleteForRoom (FS+DB) → deleteRoom (FK CASCADE messages/memberships) |
| MSG-05 | 08-02 | Message author can delete own messages; room admins can delete room messages | ✓ SATISFIED | Permission tiers in `deleteMessage()`: author OR `isAdmin()` for rooms; author-only for DMs |
| AUTH-08 | 08-04 | User can delete their account; owned rooms deleted; memberships removed elsewhere | ✓ SATISFIED | Full D-15 cascade in `deleteAccount()` with password verification |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `rooms.service.ts` | ~353 | `removeMemberAsBan()` does not delegate to `banMember()` — implements removal+ban inline without D-17 check | ⚠️ Warning | Admin can use the member-removal endpoint to ban another admin, bypassing the D-17 permission check that only exists in `banMember()`. The plan stated removeMemberAsBan inherits D-17 via delegation to banMember — this is incorrect. |

No TODO/FIXME/placeholder/stub patterns found in the modified files. No `return null` or `return []` without data source. All delete operations flow to real DB queries.

### Human Verification Required

#### 1. Delete button conditional visibility

**Test:** Log in as a regular member, open a room, hover over a message sent by another user. Then log in as a room admin, hover over any message.
**Expected:** Regular member sees no Delete button on others' messages (only their own). Admin sees Delete button on all messages.
**Why human:** Hover state and `canDeleteAny` prop conditional require browser interaction.

#### 2. Danger zone owner-only in ManageRoomView

**Test:** Open ManageRoomView as an admin (non-owner), then as the owner. Check Settings tab.
**Expected:** Admin sees no danger zone. Owner sees danger zone with "Delete Room" button.
**Why human:** Requires login as different roles to observe conditional rendering.

#### 3. Account deletion end-to-end

**Test:** Create an account that owns one room. Open AccountOverviewView, enter wrong password. Then enter correct password.
**Expected:** Wrong password shows inline error. Correct password deletes owned room (other connected clients navigate away), then redirects to auth screen.
**Why human:** Requires live API, real account, WS connections, and observing redirect behavior.

#### 4. Room deletion WS-first behavior

**Test:** Connect two browser sessions to the same room. Owner deletes the room from session 1.
**Expected:** Session 2 receives `room-deleted` WS event and navigates away before the room data is gone from the database.
**Why human:** Requires multiple simultaneous connections to verify ordering.

### Gaps Summary

**1 gap blocking full ROOM-07 compliance:**

The D-17 fix ("admin cannot ban another admin — only owner can") was implemented correctly in `banMember()` but `removeMemberAsBan()` is a separate code path used by the `DELETE /:id/manage/members/:userId` endpoint. This method does NOT call `banMember()` internally and does NOT have its own D-17 check. The plan's SUMMARY incorrectly stated that "removeMemberAsBan() inherits the D-17 fix via its internal banMember() delegation" — the actual code shows `removeMemberAsBan()` calls `roomsRepo.removeMember()` and `roomsRepo.addBan()` directly.

**Fix:** Add the same D-17 admin-targeting check at the start of `removeMemberAsBan()` (after the owner protection check):
```typescript
// D-17: admin cannot remove/ban another admin — only owner can
const targetIsAdmin = await this.roomsRepo.isAdmin(roomId, targetUserId);
if (targetIsAdmin) {
  const callerIsOwner = await this.isOwner(roomId, removedByUserId);
  if (!callerIsOwner) {
    throw new ForbiddenException('Only the room owner can ban an admin');
  }
}
```

All other phase-8 deliverables are fully implemented and wired: FK migration (Plan 01), message deletion with WS broadcast (Plan 02), room deletion cascade (Plan 03), and account deletion cascade (Plan 04).

---

_Verified: 2026-04-20T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
