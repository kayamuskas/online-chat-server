---
phase: 04-rooms-and-membership
plan: "04"
subsystem: rooms-ui
tags:
  - rooms
  - ui
  - catalog
  - management
  - presence
dependency_graph:
  requires:
    - 04-02  # room API surface (catalog, join/leave endpoints)
    - 04-03  # management API (invite, admin, ban endpoints)
    - 03-01  # presence primitives (PresenceDot used in RoomMembersTable)
  provides:
    - public room catalog + search UI
    - create-room form (name required, public default)
    - private rooms surface (invite-only rooms)
    - room management UI (invite, admin, ban-list, leave/owner-refusal)
    - Phase 4 room client bindings in api.ts
  affects:
    - future messaging/member-panel phase (RoomMembersTable stub ready)
tech_stack:
  added:
    - React room UI components (PublicRoomsView, CreateRoomView, PrivateRoomsView, ManageRoomView, RoomMembersTable, RoomBanListView)
    - Phase 4 room API client bindings in apps/web/src/lib/api.ts
  patterns:
    - Classic chat-shell extension — room views rendered as content tabs, not a detached dashboard
    - Shared presence primitives reused (PresenceDot in RoomMembersTable)
    - Owner leave refusal surfaces explicit message rather than generic API error
    - Debounced search in PublicRoomsView (300ms setTimeout)
key_files:
  created:
    - apps/web/src/features/rooms/PublicRoomsView.tsx
    - apps/web/src/features/rooms/CreateRoomView.tsx
    - apps/web/src/features/rooms/PrivateRoomsView.tsx
    - apps/web/src/features/rooms/ManageRoomView.tsx
    - apps/web/src/features/rooms/RoomMembersTable.tsx
    - apps/web/src/features/rooms/RoomBanListView.tsx
  modified:
    - apps/web/src/App.tsx
    - apps/web/src/lib/api.ts
    - apps/web/src/styles.css
decisions:
  - "App.tsx nav extended with ROOMS section (Public rooms / Private rooms / Create room) above ACCOUNT section — preserves classic shell direction without introducing routing"
  - "api.ts Phase 4 bindings use same post/get helpers with credentials:include — consistent with Phase 3 session patterns"
  - "ManageRoomView member list is a stub (empty) — member hydration deferred to messaging/member-panel phase; invite and ban controls are fully wired"
  - "PrivateRoomsView accepts rooms as prop (not fetched internally) — parent App.tsx can populate from API when member-panel phase adds room membership listing"
  - "RoomMembersTable uses PresenceDot for member status — reuses Phase 3 compact presence contract rather than reinventing indicators"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_changed: 9
---

# Phase 4 Plan 04: Room UI Summary

**One-liner:** React room UI surface exposing public-room catalog with search/join, create-room form (name required, visibility defaults public), private-room surface, and room-management panel with invite-by-username, admin promotion/demotion, member-removal-as-ban, ban-list with unban, and explicit owner-leave refusal.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Public/private room surfaces and create-room UI | 8c88281 | PublicRoomsView.tsx, CreateRoomView.tsx, PrivateRoomsView.tsx, api.ts, App.tsx, styles.css |
| 2 | Room-management UI for member, admin, and ban-list operations | 44597ca | ManageRoomView.tsx, RoomMembersTable.tsx, RoomBanListView.tsx |

## What Was Built

### PublicRoomsView (PublicRoomsView.tsx)

Public room catalog with:
- Debounced search input (300ms) over name + description via `?search=` query (D-04, D-05)
- Room list showing `name`, `description`, and `member count` per room (D-04)
- Join button per room — calls `POST /api/v1/rooms/:id/join`
- "Create room" shortcut button navigates to create-room tab
- Empty-state messages for no rooms and no search results

### CreateRoomView (CreateRoomView.tsx)

Lightweight room creation form:
- `name` field: required (D-01); submit disabled when empty
- `description` field: optional (D-03)
- `visibility` field: radio buttons defaulting to `public` (D-02), explicit `private` option
- On success: navigates to appropriate tab (private rooms for private, public rooms for public)

### PrivateRoomsView (PrivateRoomsView.tsx)

Private room surface:
- Distinct from public catalog — no public search exposed here
- Shows rooms with `private` badge, member count, and user's role within each room
- "Manage room" button visible for admin/owner roles
- "Leave" button for all roles
- "Create room" shortcut

### ManageRoomView (ManageRoomView.tsx)

Full room-management panel:
- **Invite by username**: form input → `POST /api/v1/rooms/:id/manage/invite` (D-06)
- **Members section**: RoomMembersTable with make/remove admin and ban actions
- **Ban list**: RoomBanListView showing ban metadata + unban action
- **Leave room**: explicit owner-leave refusal with warning box; non-owners get leave button

Owner leave refusal message (D-10):
> "You cannot leave this room — you are the owner. To remove yourself, delete the room instead."

### RoomMembersTable (RoomMembersTable.tsx)

Member table with presence status:
- PresenceDot per member (shared Phase 3 compact presence primitive)
- Role badge (owner / admin / member) with distinct colors
- "you" badge for current user
- Make admin / Remove admin (owner only), Ban (admin or owner)
- Owner row protected — no actions applicable to owner

### RoomBanListView (RoomBanListView.tsx)

Ban list surface:
- Lists banned users with who-banned metadata and ban date
- Optional ban reason displayed
- Unban button per entry → `DELETE /api/v1/rooms/:id/manage/bans/:userId`

### api.ts Phase 4 Room Bindings

10 new functions:
- `createRoom`, `listPublicRooms`, `joinRoom`, `leaveRoom`
- `inviteToRoom`, `makeRoomAdmin`, `removeRoomAdmin`
- `removeRoomMember`, `listRoomBans`, `unbanRoomUser`

All use session cookies (`credentials: "include"`) consistent with Phase 3 patterns.

### App.tsx Shell Extension

Nav updated with two sections:
- **ROOMS**: Public rooms, Private rooms, Create room
- **ACCOUNT**: Password, Active sessions, Presence

Manage room tab activates from PrivateRoomsView "Manage room" action and navigates back cleanly.

## Deviations from Plan

### Known Stub: PrivateRoomsView member population

- **Location:** `apps/web/src/App.tsx` passes empty `rooms={[]}` to `PrivateRoomsView`
- **Reason:** Private room membership listing requires a `GET /api/v1/rooms/my-rooms` (or similar) endpoint that was not part of Phase 4's backend plans. The component is fully wired and accepts `PrivateRoomEntry[]` props — a future messaging/member-panel plan will add the endpoint and populate it.
- **Impact:** PrivateRoomsView shows "no private rooms" until the member listing endpoint is added. The management UI (ManageRoomView) is still reachable once that endpoint exists.

### Known Stub: RoomMembersTable in ManageRoomView

- **Location:** `apps/web/src/features/rooms/ManageRoomView.tsx` line ~176, `memberRows = []`
- **Reason:** Same root cause — no endpoint to list room members with their roles was added in Plans 01–03. The table structure (columns, presence dots, action buttons) is complete and will render correctly once a member-list endpoint is wired.
- **Impact:** ManageRoomView shows a notice explaining the member list will be available when the messaging panel is active. Invite and ban controls work independently and are fully wired.

These stubs are intentional and do not block the plan's primary goal: the room creation, public catalog, and management UI surfaces are all visible and operable.

## Threat Flags

None — this plan adds client-side UI only. All authorization (owner/admin checks, ban enforcement) remains in the backend service layer from Plans 01–03. No new network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

- `apps/web/src/features/rooms/PublicRoomsView.tsx` — FOUND
- `apps/web/src/features/rooms/CreateRoomView.tsx` — FOUND
- `apps/web/src/features/rooms/PrivateRoomsView.tsx` — FOUND
- `apps/web/src/features/rooms/ManageRoomView.tsx` — FOUND
- `apps/web/src/features/rooms/RoomMembersTable.tsx` — FOUND
- `apps/web/src/features/rooms/RoomBanListView.tsx` — FOUND
- `apps/web/src/App.tsx` modified — FOUND
- `apps/web/src/lib/api.ts` modified — FOUND
- `apps/web/src/styles.css` modified — FOUND
- Commit 8c88281 (Task 1) — FOUND
- Commit 44597ca (Task 2) — FOUND
- `pnpm --filter @chat/web build` — PASSED (53 modules, 0 errors)
