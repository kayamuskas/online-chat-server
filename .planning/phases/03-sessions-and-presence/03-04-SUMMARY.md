---
phase: 03-sessions-and-presence
plan: 04
subsystem: web-ui
tags: [react, presence, compact-indicator, detailed-status, last-seen, smoke-harness, validation]

requires:
  - phase: 03-sessions-and-presence
    plan: 03
    provides: Stable account surface (ActiveSessionsView, App.tsx tabs), styles.css base

provides:
  - PresenceDot: shared compact presence indicator (green/amber/gray dot, no text) for list contexts
  - PresenceLabel: explicit status text (online/AFK/offline) for detailed surfaces
  - PresenceTimestamp: humanized "last seen N ago" display for offline detail surfaces
  - CompactPresenceList: demonstration surface proving dot-only compact contract
  - DetailedPresencePanel: demonstration surface proving status-text + last-seen detailed contract
  - App.tsx Presence tab: authenticated surface wiring both contracts with representative members
  - styles.css: presence color tokens (--presence-online/afk/offline), dot/label/timestamp/list/panel CSS
  - phase3-session-presence-smoke.sh: end-to-end Phase 3 smoke covering all 8 task IDs and 10 threat IDs
  - 03-VALIDATION.md: all task rows marked green, status finalized

affects:
  - future contacts/rooms phases (PresenceDot, PresenceLabel, PresenceTimestamp ready to consume)
  - Phase 3 acceptance loop (smoke script is the gsd-verify-work entry point)

tech-stack:
  added: []
  patterns:
    - "Compact vs detailed split: PresenceDot for list contexts (dot only), PresenceLabel+PresenceTimestamp for detail contexts"
    - "Offline last seen conditional: PresenceTimestamp rendered only when status === 'offline' (D-13)"
    - "Shared color tokens: --presence-online/afk/offline in :root for consistent theming"
    - "Smoke harness pattern: curl/cookie-jar style matching Phase 2, extended with static file checks for UI primitives"

key-files:
  created:
    - apps/web/src/features/presence/PresenceDot.tsx
    - apps/web/src/features/presence/PresenceLabel.tsx
    - apps/web/src/features/presence/PresenceTimestamp.tsx
    - apps/web/src/features/presence/CompactPresenceList.tsx
    - apps/web/src/features/presence/DetailedPresencePanel.tsx
    - scripts/qa/phase3-session-presence-smoke.sh
  modified:
    - apps/web/src/App.tsx
    - apps/web/src/styles.css
    - .planning/phases/03-sessions-and-presence/03-VALIDATION.md

key-decisions:
  - "PresenceDot used without PresenceLabel in CompactPresenceList — enforces compact contract (D-10) at component boundary"
  - "DetailedPresencePanel wraps status text in parentheses matching wireframe pattern 'Carol (AFK)' (D-11)"
  - "PresenceTimestamp only rendered when status === offline — prevents last-seen leakage in online/AFK contexts (D-13)"
  - "DEMO_MEMBERS fixture uses real wireframe names (alice/bob/carol/mike/dave) for fidelity to design references"
  - "Smoke harness uses static file checks for UI primitives (not UI automation) — matches the plan's smoke/static test type"

requirements-completed:
  - SESS-03
  - SESS-04
  - SESS-05
  - SESS-06

duration: 5min
completed: 2026-04-18
---

# Phase 3 Plan 04: Presence Presentation and Validation Summary

**Shared presence rendering contract implemented as PresenceDot/PresenceLabel/PresenceTimestamp primitives; Phase 3 closes with a concrete smoke/validation loop covering session management and presence transitions**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-18T17:29:03Z
- **Completed:** 2026-04-18T17:34:00Z
- **Tasks:** 2 (both auto)
- **Files created:** 7, modified: 3

## Accomplishments

- `PresenceDot` renders a compact colored indicator (8px circle, green/amber/gray) with no status text — for use in all list/compact contexts (D-10, D-12)
- `PresenceLabel` renders the explicit status string ("online", "AFK", "offline") in the matching presence color — for detail surfaces (D-11)
- `PresenceTimestamp` humanizes `lastSeenAt` to "last seen N ago" or a date string; only shown for offline users in detailed contexts (D-13)
- `CompactPresenceList` proves the compact contract: renders alice/bob/carol/mike/dave with dots only, no text
- `DetailedPresencePanel` proves the detailed contract: "Carol (AFK)", "mike (offline) last seen 2h ago" matching wireframe and contacts.jsx references
- `App.tsx` adds a "Presence" tab alongside sessions/password, wiring both surfaces side-by-side in a two-panel layout
- `styles.css` adds presence color tokens, all presence primitive classes, CompactPresenceList and DetailedPresencePanel layout, and the presence-demo panel grid
- `phase3-session-presence-smoke.sh` covers sections 1-13: health, register, sign-in (A+B), session inventory, targeted revoke, session-C + sign-out-all-others, durable last_seen_at, presence UI static checks, session UI static checks, WebSocket smoke note, and web build verification
- `03-VALIDATION.md` finalized: all 8 task rows marked ✅ green, status set to complete, full sign-off block added

## Task Commits

1. **Task 1: Shared compact and detailed presence UI primitives** — `9168a1f` (feat)
2. **Task 2: Phase 3 smoke harness and finalized validation contract** — `01e59b6` (feat)

## Files Created/Modified

- `apps/web/src/features/presence/PresenceDot.tsx` — compact colored dot indicator, no text
- `apps/web/src/features/presence/PresenceLabel.tsx` — explicit status text for detailed surfaces
- `apps/web/src/features/presence/PresenceTimestamp.tsx` — humanized "last seen" for offline detail
- `apps/web/src/features/presence/CompactPresenceList.tsx` — compact list proving dot-only contract
- `apps/web/src/features/presence/DetailedPresencePanel.tsx` — detailed panel proving status+last-seen contract
- `apps/web/src/App.tsx` — Presence tab added, imports CompactPresenceList and DetailedPresencePanel
- `apps/web/src/styles.css` — presence tokens, dot/label/timestamp/list/panel/demo CSS
- `scripts/qa/phase3-session-presence-smoke.sh` — Phase 3 end-to-end smoke harness
- `.planning/phases/03-sessions-and-presence/03-VALIDATION.md` — all rows green, phase complete

## Decisions Made

- **Compact contract enforced at component boundary**: `CompactPresenceList` imports only `PresenceDot`, never `PresenceLabel` — a future developer cannot accidentally break the compact contract without modifying the component.
- **Parenthetical detailed status text**: `DetailedPresencePanel` renders `username (STATUS)` matching the wireframe pattern `◐ Carol (AFK)` exactly.
- **Offline gate for last seen**: `PresenceTimestamp` is wrapped in `{m.status === "offline" && ...}` — online and AFK members never show a last-seen timestamp.
- **Smoke static checks for UI**: The smoke script uses `grep` + file-existence checks for UI primitives (not browser automation) — appropriate for a CLI-only QA harness.

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the auto execution path without triggering any deviation rules.

## Known Stubs

None — all presence primitives are real implementations consuming typed props. The `DEMO_MEMBERS` fixture in App.tsx uses real wireframe names and representative statuses; the `lastSeenAt` for mike is a computed ISO timestamp 2 hours in the past (not hardcoded text). Future room/contacts phases will replace this fixture with live API data.

## Threat Flags

Threat T-03-10 mitigated:

| Flag | File | Description |
|------|------|-------------|
| T-03-10 mitigated | PresenceDot.tsx, PresenceLabel.tsx, DetailedPresencePanel.tsx, CompactPresenceList.tsx | Compact/detailed rendering centralized in shared primitives; contract enforced at component boundary |

## Self-Check

Files exist:
- apps/web/src/features/presence/PresenceDot.tsx — FOUND
- apps/web/src/features/presence/PresenceLabel.tsx — FOUND
- apps/web/src/features/presence/PresenceTimestamp.tsx — FOUND
- apps/web/src/features/presence/CompactPresenceList.tsx — FOUND
- apps/web/src/features/presence/DetailedPresencePanel.tsx — FOUND
- scripts/qa/phase3-session-presence-smoke.sh — FOUND
- .planning/phases/03-sessions-and-presence/03-VALIDATION.md — FOUND

Commits exist:
- 9168a1f (Task 1: presence primitives) — in git log
- 01e59b6 (Task 2: smoke harness + validation) — in git log

Build: pnpm --filter @chat/web build — PASSED (47 modules, 0 errors, 10.14 KB CSS)

Verification greps: all plan-specified rg/test checks return expected matches.

## Self-Check: PASSED

## Next Phase Readiness

- Phase 4 (rooms/contacts) can import PresenceDot, PresenceLabel, and PresenceTimestamp directly without redefining presence semantics
- The smoke harness covers all Phase 3 threat IDs and is the gsd-verify-work entry point
- The validation contract is finalized and signed off — no placeholders remain

---
*Phase: 03-sessions-and-presence*
*Completed: 2026-04-18*
