---
status: partial
phase: 09-frontend-productization
source:
  - 09-01-SUMMARY.md
  - 09-02-SUMMARY.md
  - 09-03-SUMMARY.md
  - 09-04-SUMMARY.md
  - 09-05-SUMMARY.md
  - 09-06-SUMMARY.md
started: 2026-04-20T08:20:00Z
updated: 2026-04-21T09:12:00Z
---

## Current Test

[runtime checks complete; only visual-baseline and manage-room browser checks remain]

## Tests

### 1. Cold Start Runtime Smoke
expected: `docker compose -f infra/compose/compose.yaml up --build --wait` completes, and all five services report healthy.
result: pass

### 2. Web Shell Is Reachable
expected: `http://localhost:4173` serves the built app shell and `http://localhost:4173/healthz` responds successfully.
result: pass

### 3. API Health Is Reachable
expected: `http://localhost:3000/healthz` returns `{"status":"ok","service":"api"}`.
result: pass

### 4. Authenticated Session Restore
expected: After sign-in, `GET /api/v1/auth/me` returns the authenticated user for both local test accounts.
result: pass

### 5. Active Session Inventory
expected: `GET /api/v1/sessions` returns the current browser plus older sessions with `isCurrentSession` flags.
result: pass

### 6. Contact Request Flow
expected: User A can send a friend request to User B; User B sees it in `GET /api/v1/contacts/requests`; accepting it creates a friendship.
result: pass

### 7. DM Eligibility After Friendship
expected: After friendship is established, `POST /api/v1/contacts/dm/:userId` returns `{ eligible: true, frozen: false }`.
result: pass

### 8. Public Room Creation and Join
expected: User A can create a public room; User B can join it successfully.
result: pass

### 9. Current-Browser Sign-Out
expected: `POST /api/v1/auth/sign-out` returns 204 and the previous cookie no longer authenticates `GET /api/v1/auth/me`.
result: pass

### 10. Visual Shell / Unread / Infinite Scroll / Modal UX
expected: Browser inspection confirms the Phase 9 UI behaves as designed.
result: pending
blocked_by: "Visual baseline comparison against requirements/desing_v1 and manage-room modal interaction are still not fully rechecked."

## Summary

total: 10
passed: 9
issues: 0
pending: 1
skipped: 0
blocked: 0

## Remaining Human Checks

- Compare the shipped shell visually against `requirements/desing_v1/` on desktop and mobile.
- Confirm `Manage room` tab switching and action layout feel correct in the browser.

## Notes

- Runtime was verified against a live Docker stack, not just static code or local builds.
- One stale test cookie for the first user became invalid before the main flow; re-authentication succeeded immediately and the later sign-out invalidation check behaved correctly. This was treated as a test-session artifact, not a confirmed product bug.
- `pnpm exec playwright test e2e/realtime/ws-auth.spec.ts e2e/realtime/room-realtime.spec.ts e2e/realtime/dm-realtime.spec.ts e2e/realtime/presence.spec.ts e2e/realtime/autoscroll.spec.ts e2e/realtime/reconnect.spec.ts e2e/realtime/unread-sidebar.spec.ts e2e/realtime/history-load.spec.ts --reporter=line` passed on 2026-04-21, covering unread behavior and infinite upward history.
- Browser recheck on 2026-04-21 confirmed the Account hub renders current-session details and `Sign out this browser` returns the app to the auth shell.
