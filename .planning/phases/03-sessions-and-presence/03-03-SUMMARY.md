---
phase: 03-sessions-and-presence
plan: 03
subsystem: web-ui
tags: [react, session-management, active-sessions, revoke, humanized-timestamps, presence-ui]

requires:
  - phase: 03-sessions-and-presence
    plan: 01
    provides: GET /api/v1/sessions, DELETE /api/v1/sessions/:id, DELETE /api/v1/sessions/others, SessionInventoryItem type with isCurrentSession marker

provides:
  - ActiveSessionsView: full Phase 3 session inventory screen replacing Phase 2 minimal sign-out card
  - SessionRow: session table row with humanized last-active, This browser badge, per-row Sign out
  - RevokeSessionConfirm: reusable inline confirmation block for destructive session actions
  - api.ts: listSessions, revokeSession, revokeOtherSessions client bindings
  - styles.css: session table, badge, footer, and revoke-confirm CSS rules

affects:
  - 03-04-presence-presentation (account surface is now stable; presence badge can be added later)
  - future chat-shell phases (account tab pattern reusable)

tech-stack:
  added: []
  patterns:
    - "Inline confirmation state machine: null | sessionId | 'others' — avoids modal overhead"
    - "Current-session revoke routes through onSignedOut callback to reuse the existing sign-in transition path"
    - "Optimistic list removal: revoking another session filters local state without reload"
    - "User-agent parsing: browser detection order Edge→OPR→Firefox→Samsung→Chrome→Safari→IE to avoid false positives"
    - "Humanized timestamps: now / Xm ago / Xh ago / Yesterday / locale date; exact time on hover (title attr)"

key-files:
  created:
    - apps/web/src/features/account/ActiveSessionsView.tsx
    - apps/web/src/features/account/SessionRow.tsx
    - apps/web/src/features/account/RevokeSessionConfirm.tsx
  modified:
    - apps/web/src/App.tsx
    - apps/web/src/lib/api.ts
    - apps/web/src/styles.css

key-decisions:
  - "Inline confirm block chosen over modal (D-04 agent discretion): faster, contextual, no overlay state"
  - "Current-session revoke calls onSignedOut directly (T-03-09): reuses same sign-in return path as POST /sign-out"
  - "Optimistic list update on revoke-other: removes row without page reload to avoid clearing unrelated UI state"
  - "Sign out all other sessions button hidden when only one session exists (no others to sign out)"

requirements-completed:
  - SESS-01
  - SESS-02
  - SESS-07

duration: 15min
completed: 2026-04-18
---

# Phase 3 Plan 03: Active Sessions Web UI Summary

**Phase 2 minimal sign-out card replaced with the full Phase 3 session inventory: Device/Browser, IP, Last active table with This browser badge, per-row Sign out, and explicit Sign out all other sessions — backed by real API calls**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-04-18
- **Tasks:** 2 (both auto)
- **Files created:** 3, modified: 3

## Accomplishments

- `ActiveSessionsView` loads real session inventory from `GET /api/v1/sessions`, renders a three-column table matching the locked reference (D-01, D-02), and manages a per-row confirmation state machine
- `SessionRow` humanizes `lastSeenAt` (now / Xm ago / Xh ago / Yesterday / locale date) with exact timestamp on hover; shows "This browser" badge on the current session; per-row Sign out button
- User-agent parsing (`parseBrowser`) produces labels like "Chrome · macOS" and "Firefox · Windows" from raw UA strings (D-06)
- IP shown in full (D-07); null mapped to "—"
- `RevokeSessionConfirm` is a reusable inline confirmation block used for both per-row revoke and bulk revoke-others flows
- Revoking "This browser" calls `onSignedOut` immediately, routing through the same sign-in transition path (T-03-09)
- Revoking another session removes only that row from local state; revoking all others keeps only the current-session row
- "Sign out all other sessions" button only renders when `otherSessionCount > 0`
- `api.ts` client bindings: `listSessions`, `revokeSession`, `revokeOtherSessions` with proper DELETE method and 204 handling
- `styles.css` adds all required CSS: `.sessions-table`, `.sessions-table__*`, `.sessions-badge`, `.sessions-footer`, `.btn--xs`, `.revoke-confirm` layout rules
- `App.tsx` sessions tab now renders `ActiveSessionsView` (Phase 3) replacing the Phase 2 `SessionActionsView` component
- Full production build succeeds: 42 modules, 213 KB JS, 7.86 KB CSS

## Task Commits

1. **Task 1: Active-sessions inventory screen and API client glue** — `368c6a5` (feat)
2. **Task 2: Explicit confirmation flow for destructive session actions** — `3c2eb8f` (feat)

## Files Created/Modified

- `apps/web/src/features/account/ActiveSessionsView.tsx` — session inventory screen with load, table render, and all revoke flows
- `apps/web/src/features/account/SessionRow.tsx` — table row: UA parsing, timestamp humanization, This browser badge, Sign out button
- `apps/web/src/features/account/RevokeSessionConfirm.tsx` — reusable inline confirm block for destructive session actions
- `apps/web/src/App.tsx` — sessions tab renders ActiveSessionsView; comment updated to Phase 3
- `apps/web/src/lib/api.ts` — SessionInventoryItem type, listSessions, revokeSession, revokeOtherSessions
- `apps/web/src/styles.css` — session table, badge, footer, btn--xs, revoke-confirm rules

## Decisions Made

- **Inline confirm over modal**: D-04 grants agent discretion; a compact inline block on the row keeps the revoke interaction fast and avoids overlay state management.
- **Current-session revoke via onSignedOut**: wires to the existing sign-in transition path (T-03-09) — no separate auth-state reset code path needed.
- **Optimistic list removal**: removed sessions are filtered from local state immediately without reload so the password tab and other unrelated state are not disturbed.
- **Button conditionally rendered**: "Sign out all other sessions" is hidden when there are no other sessions, keeping the screen clean for single-device users.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all columns render real data from the `SessionInventoryItem` API response. `ipAddress` uses "—" only when the backend returns null (which it may in development/localhost). No hardcoded values, no placeholder text.

## Threat Flags

All two threat-model mitigations from the plan were implemented:

| Flag | File | Description |
|------|------|-------------|
| T-03-08 mitigated | ActiveSessionsView.tsx, RevokeSessionConfirm.tsx | Destructive actions are explicit, separate, and wording distinguishes per-row vs bulk |
| T-03-09 mitigated | ActiveSessionsView.tsx | Current-session revoke calls onSignedOut immediately, routing through the sign-in return path |

## Self-Check

Files exist:
- apps/web/src/features/account/ActiveSessionsView.tsx — FOUND
- apps/web/src/features/account/SessionRow.tsx — FOUND
- apps/web/src/features/account/RevokeSessionConfirm.tsx — FOUND
- apps/web/src/lib/api.ts (listSessions, revokeSession, revokeOtherSessions) — FOUND
- apps/web/src/styles.css (session table and revoke-confirm rules) — FOUND

Commits exist:
- 368c6a5 (Task 1: active-sessions inventory) — in git log
- 3c2eb8f (Task 2: confirmation flow) — in git log

Build: pnpm --filter @chat/web build — PASSED (42 modules, 0 errors)

Verification grep: both plan-specified rg checks return expected matches.

## Self-Check: PASSED

## Next Phase Readiness

- Plan 04 (presence presentation) has a stable account surface; presence badges can be added to session rows or contacts/room views without disrupting the session management screen
- The confirmation pattern (RevokeSessionConfirm) is reusable for any future destructive account action
- The humanized timestamp utilities in SessionRow.tsx are available for reuse in chat message timestamps

---
*Phase: 03-sessions-and-presence*
*Completed: 2026-04-18*
