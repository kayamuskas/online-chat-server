---
phase: 05-contacts-and-dm-policy
plan: "06"
subsystem: contacts-frontend-discoverability
tags: [contacts, frontend, react, app-wiring, discoverability, navigation, uat-gap]
dependency_graph:
  requires:
    - 05-05  # Existing ContactsView wiring and contacts shell state
  provides:
    - apps/web/src/App.tsx (first-class shell navigation into the existing contacts management tab)
    - apps/web/src/features/contacts/FriendRequestDropdown.tsx (secondary handoff into the same contacts management page)
    - apps/web/src/features/contacts/ContactsView.tsx (confirm flows for remove/block and blocked-user labels by username)
    - apps/api/src/contacts/contacts.repository.ts (blocked-user projection enriched with username)
  affects:
    - Phase 5 UAT discoverability of friend management and blocking controls
    - Contacts management UX clarity for destructive actions
tech_stack:
  added: []
  patterns:
    - Reuse existing tab="contacts" destination instead of building a duplicate management surface
    - Shared openContactsTab helper closes the request dropdown before routing into ContactsView
    - Persistent shell entry point plus contextual dropdown handoff for feature discoverability
    - Destructive friend-management actions require explicit confirmation before mutation
key_files:
  created: []
  modified:
    - apps/web/src/App.tsx
    - apps/web/src/features/contacts/FriendRequestDropdown.tsx
    - apps/web/src/features/contacts/ContactsView.tsx
    - apps/web/src/features/contacts/RemoveFriendConfirmModal.tsx
    - apps/web/src/lib/api.ts
    - apps/api/src/contacts/contacts.types.ts
    - apps/api/src/contacts/contacts.repository.ts
    - apps/api/src/contacts/contacts.service.ts
    - apps/api/src/__tests__/contacts/contacts-domain.spec.ts
key_decisions:
  - "Kept the primary management entry point as the single top-level `Contacts` nav item to avoid duplicate CTAs in the sidebar"
  - "Extended the bans projection with `banned_username` so the blocked list shows human-readable labels instead of UUIDs"
  - "Added a remove-friend confirmation modal to align destructive-action UX with the existing block confirmation"
patterns-established:
  - "Navigation fixes for hidden features should route users into the canonical existing view, not clone management UI into adjacent components"
  - "Contacts management lists should render usernames from API view models, not raw UUID identifiers"
requirements-completed:
  - FRND-03
  - FRND-04
duration: "~15 minutes"
completed: "2026-04-19"
---

# Phase 05 Plan 06 Summary

**The authenticated shell now exposes the existing contacts-management screen directly, with clear destructive-action confirms and blocked-user labels rendered by username instead of raw UUIDs.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-04-19
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added a first-class `Contacts` navigation item in the authenticated shell that lands in the existing `ContactsView`.
- Added a `Manage contacts` handoff inside the friend-request dropdown so request-driven users can reach the full management surface from the top nav.
- Added remove-friend confirmation and fixed blocked-user labels to use usernames from the API instead of `banned_user_id`.

## Files Modified

- `apps/web/src/App.tsx` - Added `openContactsTab()` helper, top-level `Contacts` nav button, and dropdown wiring into `tab === "contacts"`.
- `apps/web/src/features/contacts/FriendRequestDropdown.tsx` - Added footer action that opens the full contacts page.
- `apps/web/src/features/contacts/ContactsView.tsx` - Added remove confirmation flow and switched blocked-user rendering to `banned_username`.
- `apps/web/src/features/contacts/RemoveFriendConfirmModal.tsx` - Added destructive confirmation modal for removing a friend.
- `apps/api/src/contacts/contacts.repository.ts` - Enriched `/contacts/bans` rows with `banned_username`.

## Decisions Made

- Reused the existing `ContactsView` as the only management surface; no duplicate friend/block UI was introduced.
- Kept `Contacts` as the single persistent shell CTA after user feedback showed that a second sidebar CTA was redundant.
- Closed the request dropdown before routing into contacts management so the navigation state stays clean.

## Deviations from Plan

One small UX correction after manual review: the first pass added a redundant sidebar CTA next to the new top-level `Contacts` nav item. That duplicate was removed so the shell keeps one clear persistent entry point while preserving the dropdown handoff.

## Issues Encountered

- API build briefly failed after the contract extension because `ContactsService` still imported the old unused `UserBan` type. Removing the stale import resolved it immediately.

## Verification

- [x] `rg -n 'Manage contacts|Contacts' apps/web/src/features/contacts/ContactsSidebar.tsx apps/web/src/features/contacts/FriendRequestDropdown.tsx apps/web/src/App.tsx`
- [x] `rg -n 'setTab\\("contacts"\\)|tab === "contacts"' apps/web/src/App.tsx`
- [x] `pnpm --filter @chat/api exec vitest run src/__tests__/contacts/contacts-domain.spec.ts src/__tests__/contacts/contacts-eligibility.spec.ts`
- [x] `pnpm --filter @chat/api build`
- [x] `pnpm --filter @chat/web build`
- [ ] Human shell verification of the exact UAT path

## Next Phase Readiness

The code-side gap is closed and the management page is now reachable from visible shell surfaces.
One human verification pass remains to confirm the original UAT complaint is resolved in the browser end-to-end.
