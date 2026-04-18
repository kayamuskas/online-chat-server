---
phase: 05-contacts-and-dm-policy
plan: "05"
subsystem: contacts-frontend-wiring
tags: [contacts, frontend, react, app-wiring, sidebar, notification-badge, dm-stub]
dependency_graph:
  requires:
    - 05-04  # ContactsSidebar, FriendRequestDropdown, AddContactModal, DmScreenStub, ContactsView, api.ts contacts functions
  provides:
    - apps/web/src/App.tsx (Phase 5 fully wired: contacts sidebar, notification badge, DM stub, add-contact modal)
    - apps/web/src/features/rooms/RoomMembersTable.tsx (inline Add friend action, D-05)
    - apps/web/src/features/rooms/ManageRoomView.tsx (AddContactModal wired from member rows)
  affects:
    - Full Phase 5 UI surface visible to users
tech_stack:
  added: []
  patterns:
    - useCallback loaders for contacts and pending requests (same pattern as loadPrivateRoomData)
    - Pitfall-5 double-refetch: acceptFriendRequest refetches both contacts and pending requests
    - requestActionBusy (string | null) per-row loading state for FriendRequestDropdown
    - dmEligible hardcoded to true for confirmed friends (ban enforced server-side per T-05-15)
    - Optional props (onSendFriendRequest?, friendUserIds?) keep RoomMembersTable backward-compatible
key_files:
  created: []
  modified:
    - apps/web/src/App.tsx
    - apps/web/src/features/rooms/RoomMembersTable.tsx
    - apps/web/src/features/rooms/ManageRoomView.tsx
decisions:
  - "dmEligible hardcoded to true in ContactsSidebar — all confirmed friends are DM-eligible by definition; ban enforcement happens server-side at POST /contacts/dm/:userId (T-05-15 accepted risk)"
  - "addFriendTarget stores username string in ManageRoomView to avoid prop-drilling contacts list through room management hierarchy"
  - "RoomMembersTable Add friend button shown only when onSendFriendRequest callback is provided — backward compatible with all existing call sites"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
---

# Phase 05 Plan 05: App.tsx Contacts Wiring Summary

**One-liner:** App.tsx wired with full Phase 5 contacts UI — CONTACTS sidebar with PresenceDot, notification bell badge with FriendRequestDropdown Accept/Decline, DM stub navigation, AddContactModal, and inline Add friend button on RoomMembersTable member rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire contacts into App.tsx | 7ea1c1a | apps/web/src/App.tsx |
| 2 | Add inline friend-request action to RoomMembersTable (D-05) | f2392a4 | apps/web/src/features/rooms/RoomMembersTable.tsx, apps/web/src/features/rooms/ManageRoomView.tsx |

## What Was Built

### App.tsx (Task 1)

**AppTab union extended:**
- Added `"contacts"` — full contacts management page (ContactsView)
- Added `"dm"` — DM empty-state stub (DmScreenStub, replaced in Phase 6)

**New imports:**
- ContactsSidebar, FriendRequestDropdown, AddContactModal, DmScreenStub, ContactsView
- getMyFriends, getIncomingRequests, acceptFriendRequest, declineFriendRequest, FriendWithPresence, IncomingFriendRequestView from api.ts

**New state (Phase 5):**
- `contacts: FriendWithPresence[]` — confirmed friend list
- `pendingRequests: IncomingFriendRequestView[]` — incoming friend requests
- `requestDropdownOpen: boolean` — controls FriendRequestDropdown visibility
- `addContactOpen: boolean` — controls AddContactModal visibility
- `dmPartnerId: string | null` — tracks the DM target for tab="dm"
- `requestActionBusy: string | null` — per-request loading state

**Loaders:**
- `loadContacts()` — useCallback, fetches getMyFriends(), non-fatal
- `loadPendingRequests()` — useCallback, fetches getIncomingRequests(), non-fatal
- Both called in user useEffect alongside existing loadPrivateRoomData()

**Handlers:**
- `handleAcceptRequest(requestId)` — accepts, then refetches both contacts AND pending (Pitfall 5 fix)
- `handleDeclineRequest(requestId)` — declines, refetches pending

**Topbar notification bell (D-01, D-02):**
- Bell icon button with red badge showing pendingRequests.length when > 0
- FriendRequestDropdown rendered when requestDropdownOpen=true

**Sidebar CONTACTS section (D-15, D-16, D-17, D-18):**
- ContactsSidebar rendered below ACCOUNT section
- All friends mapped with dmEligible=true (ban enforced server-side)
- onAddContact → setAddContactOpen(true)
- onOpenDm → setDmPartnerId + setTab("dm")

**Tab rendering:**
- `tab === "contacts"` → ContactsView
- `tab === "dm"` → DmScreenStub with partner username looked up from contacts array

**AddContactModal at root level:**
- Rendered when addContactOpen=true
- onSuccess refetches both contacts and pending requests

### RoomMembersTable.tsx (Task 2)

**New optional props (D-05):**
- `onSendFriendRequest?: (userId: string, username: string) => void`
- `friendUserIds?: Set<string>` — hides button for already-friends

**Add friend button:**
- Shown when `!isCurrentUser && !friendUserIds?.has(m.userId) && onSendFriendRequest`
- `btn btn--soft btn--xs` class, marginLeft: 0.25rem
- All existing call sites unaffected (props are optional)

### ManageRoomView.tsx (Task 2)

- Imports AddContactModal from `../contacts/AddContactModal`
- Local state `addFriendTarget: string | null`
- Passes `onSendFriendRequest={(_userId, username) => setAddFriendTarget(username)}` to RoomMembersTable
- Renders AddContactModal when addFriendTarget is set, inside a React fragment with the table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSX fragment wrapping in ManageRoomView ternary**
- **Found during:** Task 2 — TypeScript compilation error
- **Issue:** Plan placed `{addFriendTarget && <AddContactModal />}` after `<RoomMembersTable />` inside a ternary branch — JSX requires a single root element per branch
- **Fix:** Wrapped both elements in a React fragment `<>...</>`
- **Files modified:** apps/web/src/features/rooms/ManageRoomView.tsx
- **Commit:** f2392a4

## Known Stubs

None — all Phase 5 UI surface is functionally wired. DmScreenStub is intentional for Phase 5 (real message engine ships in Phase 6).

## Threat Surface Scan

No new network endpoints. All contacts API calls route through existing authenticated session cookie mechanism. Badge count and DM eligibility are informational client-side only — security enforcement remains at the backend (T-05-15, T-05-16 accepted per threat model).

## Self-Check: PASSED

- [x] `apps/web/src/App.tsx` modified: `grep '"contacts".*Phase 5'` matches (line 65)
- [x] `apps/web/src/App.tsx` modified: `grep "FriendRequestDropdown"` — import + usage match
- [x] `apps/web/src/App.tsx` modified: `grep "CONTACTS"` returns sidebar label
- [x] `apps/web/src/App.tsx` modified: `grep "pendingRequests.length"` returns badge count
- [x] `apps/web/src/App.tsx` modified: `grep "loadContacts\|loadPendingRequests"` returns ≥4 matches
- [x] `apps/web/src/features/rooms/RoomMembersTable.tsx` modified: `grep "Add friend"` matches
- [x] `apps/web/src/features/rooms/RoomMembersTable.tsx` modified: `grep "onSendFriendRequest"` matches props + JSX
- [x] `apps/web/src/features/rooms/ManageRoomView.tsx` modified: `grep "AddContactModal"` matches import + usage
- [x] TypeScript: `tsc --noEmit -p apps/web/tsconfig.json` exits 0
- [x] Commits exist: 7ea1c1a (Task 1), f2392a4 (Task 2)
