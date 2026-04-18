---
phase: 05-contacts-and-dm-policy
plan: "04"
subsystem: contacts-frontend
tags: [contacts, frontend, react, components, api-client, typescript]
dependency_graph:
  requires:
    - 05-03  # ContactsController 12 REST routes at /api/v1/contacts/*
    - 04-04  # apps/web PresenceDot, RoomMembersTable, PublicRoomsView patterns
  provides:
    - apps/web/src/lib/api.ts (13 contacts API functions, 6 contact type interfaces, del<T> helper)
    - apps/web/src/features/contacts/ContactsSidebar.tsx
    - apps/web/src/features/contacts/ContactsView.tsx
    - apps/web/src/features/contacts/AddContactModal.tsx
    - apps/web/src/features/contacts/FriendRequestDropdown.tsx
    - apps/web/src/features/contacts/BanConfirmModal.tsx
    - apps/web/src/features/contacts/DmScreenStub.tsx
  affects:
    - apps/web/src/App.tsx (consumed by 05-05 wiring plan)
tech_stack:
  added: []
  patterns:
    - useCallback + useEffect fetch pattern matching PublicRoomsView
    - actionBusy (string | null) per-row loading state
    - modal-overlay > modal wrapper pattern matching existing room modals
    - PresenceDot from features/presence — no new dot implementation (Phase 3 contract)
    - del<T> helper added to api.ts following same pattern as get<T>/post<T>
key_files:
  created:
    - apps/web/src/features/contacts/ContactsSidebar.tsx
    - apps/web/src/features/contacts/ContactsView.tsx
    - apps/web/src/features/contacts/AddContactModal.tsx
    - apps/web/src/features/contacts/FriendRequestDropdown.tsx
    - apps/web/src/features/contacts/BanConfirmModal.tsx
    - apps/web/src/features/contacts/DmScreenStub.tsx
  modified:
    - apps/web/src/lib/api.ts
decisions:
  - "del<T> helper added to api.ts (Rule 3 auto-fix) — contacts functions used del() but no generic DELETE helper existed; pattern mirrors get<T>/post<T>"
  - "ContactsView shows ban.banned_user_id as display name in Blocked Users list — the UserBan DTO has no username field; backend may need to enrich this in Phase 5/6"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
---

# Phase 05 Plan 04: Contacts and DM Frontend UI Summary

**One-liner:** 6 contacts React components (sidebar with PresenceDot, contacts management view, friend request dropdown, add-contact modal, ban confirmation modal, DM screen stub) and extended api.ts with del<T> helper + 13 typed contacts functions covering all 12 backend endpoints.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend API client with contacts functions | 0bd4bd7 | apps/web/src/lib/api.ts |
| 2 | Build contacts feature components | 84f8bdd | apps/web/src/features/contacts/*.tsx (6 files) |

## What Was Built

### api.ts extensions

**New type interfaces (6):**
- `FriendRequest` — raw friend request record from backend
- `Friendship` — normalized friendship record (user_a_id < user_b_id)
- `UserBan` — directional ban record
- `DmConversation` — DM conversation with `frozen` flag
- `FriendWithPresence` — friend with optional presence status
- `IncomingFriendRequestView` — enriched view with requester_username

**New helper:**
- `del<T>(path)` — generic DELETE helper following same 204 / error pattern as `get<T>` and `post<T>`

**New API functions (13):**
- `sendFriendRequest`, `getIncomingRequests`, `getOutgoingRequests`
- `acceptFriendRequest`, `declineFriendRequest`, `cancelFriendRequest`
- `getMyFriends`, `removeFriend`
- `banUser`, `getMyBans`, `unbanUser`
- `initiateDm`
- `getPendingRequestCount`

### ContactsSidebar.tsx

Renders CONTACTS section in left sidebar (D-15, D-16, D-17, D-18):
- Each row: `PresenceDot` + username + "Msg" button
- "Msg" button disabled with `title="Add as friend to message"` when `dmEligible=false` (D-13)
- Self-row filtered out (no Msg button for current user)
- "+ Add contact" button at bottom triggers `onAddContact` callback

### ContactsView.tsx

Full contacts management page (D-09, FRND-03, FRND-04):
- Section 1: Incoming Requests — Accept/Decline per row, refreshes friends list on accept
- Section 2: My Friends — Remove (soft) and Block (danger) buttons per row
- Section 3: Blocked Users — Unblock button per row
- BanConfirmModal shown before executing ban (D-07)
- Per-section loading/error states
- `actionBusy` string tracks in-flight action per row

### AddContactModal.tsx

Modal for sending friend requests (D-04, D-06, FRND-01):
- Username field (required, autoFocus)
- Message field (optional, id="contact-message") per D-06 and FRND-01
- Disabled submit when `submitting || !username.trim()`
- Success message + field clear on success before calling callbacks

### FriendRequestDropdown.tsx

Notification dropdown (D-01, D-02, D-03):
- Shows only incoming requests (D-03 — outgoing not shown here)
- Accept/Decline buttons per row with per-row busy state
- Empty state: "No pending requests."
- `role="dialog"`, `aria-label="Friend requests"` for accessibility

### BanConfirmModal.tsx

Ban confirmation dialog (D-07):
- Text: "This will block the user and remove the friendship. This action can be reversed from your account settings."
- Cancel (btn--soft) and Block (btn--danger) buttons
- Busy state disables both buttons, changes Block text to "Blocking…"

### DmScreenStub.tsx

DM empty-state screen (D-12, D-08, FRND-05):
- Shows "This conversation is read-only." when `frozen=true`
- Shows "This user has restricted contact with you." for `ban_exists` ineligible reason (D-08)
- Shows "Add as friend to start messaging." for `not_friends` reason
- Shows neutral placeholder when not frozen and no ineligible reason
- Phase 6 replaces this with real message engine

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Added del<T> helper to api.ts**
- **Found during:** Task 1
- **Issue:** Plan specified 13 contacts API functions that call `del<T>(path)`, but no such generic helper existed in api.ts — existing DELETE calls used inline `fetch()` wrappers
- **Fix:** Added `del<T>(path)` helper following exact same pattern as `get<T>` and `post<T>` (204 early return, json parse, error throw)
- **Files modified:** apps/web/src/lib/api.ts
- **Commit:** 0bd4bd7

## Known Stubs

**ContactsView.tsx — Blocked Users display name:** `ban.banned_user_id` is shown as display name in the Blocked Users section. The `UserBan` DTO returned by `GET /contacts/bans` contains only `banned_user_id` (UUID), not a username. The backend would need to enrich this response (join with users table) for a proper display name. This does not block the plan's goal (the unblock action works correctly via UUID), but the display is non-user-friendly. Tracked for Phase 5/6 backend enrichment.

## Threat Surface Scan

No new network endpoints or auth paths added. All API calls route through existing authenticated session cookie mechanism. The `del<T>` helper follows the same credential handling as `get<T>` and `post<T>`. No new trust boundary surface.

## Self-Check: PASSED

- [x] `apps/web/src/lib/api.ts` modified: `grep "export async function sendFriendRequest"` matches
- [x] `apps/web/src/lib/api.ts` modified: `grep "export async function initiateDm"` matches
- [x] `apps/web/src/lib/api.ts` modified: `grep "async function del"` matches
- [x] `apps/web/src/features/contacts/ContactsSidebar.tsx` exists (commit 84f8bdd)
- [x] `apps/web/src/features/contacts/ContactsView.tsx` exists (commit 84f8bdd)
- [x] `apps/web/src/features/contacts/AddContactModal.tsx` exists (commit 84f8bdd)
- [x] `apps/web/src/features/contacts/FriendRequestDropdown.tsx` exists (commit 84f8bdd)
- [x] `apps/web/src/features/contacts/BanConfirmModal.tsx` exists (commit 84f8bdd)
- [x] `apps/web/src/features/contacts/DmScreenStub.tsx` exists (commit 84f8bdd)
- [x] TypeScript: `tsc --noEmit -p apps/web/tsconfig.json` exits 0
- [x] `grep "PresenceDot" apps/web/src/features/contacts/ContactsSidebar.tsx` matches
- [x] `grep "Add as friend to message"` matches (D-13)
- [x] `grep "This user has restricted contact"` matches (D-08)
- [x] `grep "block the user and remove the friendship"` matches (D-07)
- [x] `grep "contact-message"` in AddContactModal.tsx matches (D-06)
- [x] `grep "requester_username"` in FriendRequestDropdown.tsx matches
