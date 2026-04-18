---
phase: 03-sessions-and-presence
verified: 2026-04-18T20:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visit /account while signed in and verify the Active Sessions tab renders a real session row with Device/Browser, IP, and Last active columns"
    expected: "A table row appears showing the current session with 'This browser' badge, browser label (e.g. 'Chrome · macOS'), an IP address, and a humanized last-active time such as 'now' or 'Xm ago'"
    why_human: "Requires a running stack (Docker Compose up) and a live browser session; cannot verify rendered HTML or actual API response from grep alone"
  - test: "Click 'Sign out' on the current session row and confirm with the inline dialog"
    expected: "The current tab immediately returns to the sign-in screen (onSignedOut fires)"
    why_human: "Requires interaction with the live UI and observation of navigation behavior"
  - test: "With two signed-in sessions (two browsers or tabs), click 'Sign out all other sessions'"
    expected: "The non-current session rows disappear from the list; the calling session remains; the other browser is redirected to sign-in on next request"
    why_human: "Requires two simultaneous authenticated sessions and live API round-trip observation"
  - test: "Open two tabs signed in as the same user, interact in one tab, then leave both idle for more than one minute, and verify presence status"
    expected: "Status transitions from 'online' to 'afk' after one minute of inactivity across all tabs; transitions to 'offline' after both tabs are closed"
    why_human: "Requires a running WebSocket stack, a browser client sending activity events, and observation of server-side AFK timer expiry — one-minute real-time wait; cannot be tested purely statically"
  - test: "Close all browser tabs for a signed-in user and then query the sessions inventory for that user"
    expected: "'lastSeenAt' timestamp on the session row reflects the time of disconnection (durable last seen was written on offline transition)"
    why_human: "Requires a running Postgres + WebSocket stack to observe the write-behind last_seen_at update after tab disconnect"
---

# Phase 3: Sessions and Presence — Verification Report

**Phase Goal:** Make session inventory, IP tracking, last-seen persistence, and multi-tab presence semantics correct.
**Verified:** 2026-04-18T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All 10 must-haves are derived from the four plans' `must_haves.truths` sections merged with the REQUIREMENTS.md phase assignment for SESS-01 through SESS-07.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Active sessions are a first-class authenticated API surface backed by the existing opaque-session model | ✓ VERIFIED | `SessionManagementController` at `apps/api/src/auth/session-management.controller.ts` exposes `GET /api/v1/sessions`, `DELETE /api/v1/sessions/:id`, and `DELETE /api/v1/sessions/others`, all guarded by `CurrentUserGuard` |
| 2 | Every session row stores metadata needed for inventory: browser/device details, full IP, current-session awareness, and activity timestamps | ✓ VERIFIED | Migration `0002_session_presence.sql` adds `ip_address` and `user_agent` columns; `session.repository.ts` persists them at creation time; `auth.controller.ts` calls `buildSessionMetadata` at sign-in |
| 3 | Per-session revoke and sign-out-all-other-sessions are scoped to the authenticated user and never invalidate unrelated accounts | ✓ VERIFIED | `SessionRepository.deleteById` and `deleteAllOtherByUserId` both include `user_id` predicate; `AuthService.revokeSession` additionally fetches the session list first for defense-in-depth |
| 4 | Live presence is served from runtime state rather than PostgreSQL reads | ✓ VERIFIED | `PresenceService.getUserPresence` reads only the in-memory `tabs` Map; `PresenceRepository.persistLastSeen` is called only on offline transition (fire-and-forget); no DB reads in live presence paths |
| 5 | User presence is aggregated across all active tabs/connections and obeys the one-minute AFK rule | ✓ VERIFIED | `PresenceService` maintains `userId → Map<socketId, TabRecord>` runtime state; `getUserPresence` returns `online` if any tab has `lastActivityAt` within `afkTimeoutMs` (60 000 ms production); returns `afk` only if all tabs exceed threshold |
| 6 | Durable `last seen` is persisted without making the database the primary live presence source | ✓ VERIFIED | `PresenceService.tabDisconnected` calls `repo.persistLastSeen` fire-and-forget only when `userTabs.size === 0` (offline transition); live reads never touch Postgres |
| 7 | The authenticated web UI shows the active-sessions screen with current-session marker, per-row revoke, and sign-out-all-other-sessions | ✓ VERIFIED | `ActiveSessionsView.tsx` renders a three-column table with `This browser` badge (via `SessionRow.tsx`), per-row `Sign out` via `RevokeSessionConfirm`, and a conditional "Sign out all other sessions" button when `otherSessionCount > 0` |
| 8 | Phase 3 defines one shared rendering contract for compact and detailed presence surfaces | ✓ VERIFIED | `PresenceDot` (dot only, no text) consumed by `CompactPresenceList`; `PresenceLabel` + `PresenceTimestamp` consumed by `DetailedPresencePanel`; `App.tsx` imports and wires both panels in a Presence tab |
| 9 | Compact contexts use colored indicators without status text; detailed contexts show status text and offline last-seen | ✓ VERIFIED | `CompactPresenceList` imports only `PresenceDot` (grep confirms no `PresenceLabel` import); `DetailedPresencePanel` renders `username (STATUS)` with conditional `PresenceTimestamp` for `status === "offline"` |
| 10 | Phase 3 closes with a smoke/validation loop covering session-management UX and presence transitions | ✓ VERIFIED | `scripts/qa/phase3-session-presence-smoke.sh` exists and covers task IDs 03-01-01 through 03-04-02 and threat IDs T-03-01 through T-03-10; `03-VALIDATION.md` all rows marked green |

**Score: 10/10 truths verified**

---

### Required Artifacts

| Artifact | Plan | Status | Details |
|----------|------|--------|---------|
| `apps/api/src/db/migrations/0002_session_presence.sql` | 03-01 | ✓ VERIFIED | EXISTS — adds `ip_address TEXT`, `user_agent TEXT`, and `idx_sessions_ip_address`; substantive DDL; referenced by `postgres.service.ts` bootstrap SQL |
| `apps/api/src/auth/session.repository.ts` | 03-01 | ✓ VERIFIED | EXISTS — `findAllByUserId`, `deleteById`, `deleteAllOtherByUserId` added with user_id predicates; `CREATE` now persists `ip_address`/`user_agent`; used by `AuthService` |
| `apps/api/src/auth/session-management.controller.ts` | 03-01 | ✓ VERIFIED | EXISTS — three endpoints; registered in `auth.module.ts` controllers array; guarded by `CurrentUserGuard`; delegates to `AuthService` |
| `apps/api/src/auth/session-metadata.ts` | 03-01 | ✓ VERIFIED | EXISTS — `extractClientIp` (X-Forwarded-For → request.ip → socket.remoteAddress → "unknown") and `buildSessionMetadata`; called from `auth.controller.ts` at sign-in |
| `apps/api/src/presence/presence.service.ts` | 03-02 | ✓ VERIFIED | EXISTS — runtime tabs Map, `tabConnected/tabDisconnected/tabActivity/getUserPresence/getUsersPresence`; calls `repo.persistLastSeen` on offline transition |
| `apps/api/src/ws/app.gateway.ts` | 03-02 | ✓ VERIFIED | EXISTS — authenticates via session cookie at `handleConnection`, registers/deregisters tabs with `PresenceService`, handles `activity` and `getPresence` socket events |
| `apps/api/src/presence/presence-config.ts` | 03-02 | ✓ VERIFIED | EXISTS — `PRESENCE_CONFIG_TOKEN`, `PresenceConfig` interface, `DEFAULT_PRESENCE_CONFIG` with `afkTimeoutMs: 60_000` |
| `apps/api/src/presence/presence.repository.ts` | 03-02 | ✓ VERIFIED | EXISTS — `persistLastSeen` updates `last_seen_at` on the most recent non-expired session row; real DB write, no static/empty return |
| `apps/web/src/features/account/ActiveSessionsView.tsx` | 03-03 | ✓ VERIFIED | EXISTS — loads sessions via `listSessions()`, renders table with `SessionRow`/`RevokeSessionConfirm`, handles current-session revoke via `onSignedOut`, and bulk-other revoke |
| `apps/web/src/lib/api.ts` | 03-03 | ✓ VERIFIED | EXISTS — `SessionInventoryItem` type, `listSessions`, `revokeSession`, `revokeOtherSessions` functions with proper HTTP verbs and 204 handling |
| `apps/web/src/features/account/RevokeSessionConfirm.tsx` | 03-03 | ✓ VERIFIED | EXISTS — reusable inline confirmation component; renders Cancel and destructive Sign-out buttons; distinguishes per-row vs bulk via `label`/`detail` props |
| `apps/web/src/features/presence/PresenceDot.tsx` | 03-04 | ✓ VERIFIED | EXISTS — renders colored dot with `aria-label`; no status text; imported by `CompactPresenceList` and `DetailedPresencePanel` |
| `apps/web/src/features/presence/DetailedPresencePanel.tsx` | 03-04 | ✓ VERIFIED | EXISTS — renders `username (STATUS)` with `PresenceDot + PresenceLabel`, and `PresenceTimestamp` conditionally for offline members |
| `scripts/qa/phase3-session-presence-smoke.sh` | 03-04 | ✓ VERIFIED | EXISTS — executable; covers sections 1–13 including health, register, sign-in, session inventory, targeted revoke, sign-out-all-others, durable last_seen, static UI checks, WebSocket smoke note, and build verification |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.controller.ts` | `session-metadata.ts` | `buildSessionMetadata` called at sign-in | ✓ WIRED | `import { buildSessionMetadata }` on line 40; called on line 92 and passed to `AuthService.signIn` |
| `auth.service.ts` | `session.repository.ts` | session creation and targeted revoke | ✓ WIRED | `listSessions` calls `findAllByUserId`; `revokeSession` calls `findAllByUserId` then `deleteById`; `revokeAllOtherSessions` calls `deleteAllOtherByUserId` |
| `session-management.controller.ts` | `auth.service.ts` | inventory and revoke orchestration | ✓ WIRED | Controller delegates `listSessions`, `revokeSession`, `revokeAllOtherSessions` to `AuthService` |
| `app.gateway.ts` | `auth.service.ts` | socket identity from session cookie | ✓ WIRED | `handleConnection` calls `extractSessionToken(client)` then `authService.getCurrentUser(token)` |
| `app.gateway.ts` | `presence.service.ts` | tab lifecycle and activity | ✓ WIRED | `handleConnection` → `presenceService.tabConnected`; `handleDisconnect` → `tabDisconnected`; `handleActivity` → `tabActivity`; `handleGetPresence` → `getUsersPresence` |
| `presence.service.ts` | `presence.repository.ts` | durable last seen on offline transition | ✓ WIRED | `tabDisconnected` calls `void this.repo.persistLastSeen(userId, new Date())` when `userTabs.size === 0` |
| `ActiveSessionsView.tsx` | `apps/web/src/lib/api.ts` | session inventory and revoke calls | ✓ WIRED | `import { listSessions, revokeSession, revokeOtherSessions }` on line 23; called in `load()`, `handleRevokeConfirm()`, `handleRevokeOthersConfirm()` |
| `App.tsx` | `ActiveSessionsView.tsx` | sessions tab rendering | ✓ WIRED | `import { ActiveSessionsView }` on line 18; rendered when `tab === "sessions"` |
| `App.tsx` | `CompactPresenceList` + `DetailedPresencePanel` | presence tab rendering | ✓ WIRED | Imported on lines 19–20; rendered in Presence tab with `DEMO_MEMBERS` fixture (demonstration surface — live data wiring deferred to contacts/rooms phase) |
| `presence.module.ts` | `PresenceService`, `PresenceRepository`, `PRESENCE_CONFIG_TOKEN` | NestJS DI wiring | ✓ WIRED | All three provided in the module; `PresenceService` exported for `AppGateway` injection |
| `app.module.ts` | `PresenceModule` | global registration | ✓ WIRED | `PresenceModule` imported on line 8, included in `imports` array on line 31 |
| `auth.module.ts` | `SessionManagementController` | controller registration | ✓ WIRED | Imported line 14, added to `controllers` array line 26 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ActiveSessionsView.tsx` | `sessions` (SessionInventoryItem[]) | `listSessions()` → `GET /api/v1/sessions` → `AuthService.listSessions` → `SessionRepository.findAllByUserId` (PostgreSQL SELECT) | Yes — real DB query with `WHERE user_id = $1 AND expires_at > NOW()` | ✓ FLOWING |
| `PresenceService.getUserPresence` | `tabs` Map | `tabConnected/tabActivity` events from `AppGateway` (WebSocket) | Yes — populated from live socket events, not static | ✓ FLOWING |
| `PresenceRepository.persistLastSeen` | `last_seen_at` column | `tabDisconnected` offline transition path | Yes — real `UPDATE sessions SET last_seen_at = $2 WHERE id = (...)` | ✓ FLOWING |
| `CompactPresenceList` / `DetailedPresencePanel` in `App.tsx` | `members` prop | `DEMO_MEMBERS` fixture (hardcoded for demonstration) | Intentional fixture — presence rendering contract demonstration only; live data wiring deferred to Phase 4 (rooms/contacts) | ⚠️ STATIC (intentional — see note below) |

**Note on DEMO_MEMBERS:** The SUMMARY for Plan 04 explicitly documents this as a demonstration fixture with a computed timestamp (`new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()` for "mike"). The presence primitives themselves (`PresenceDot`, `PresenceLabel`, `PresenceTimestamp`) are real implementations that will be wired to live `PresenceService` data in the Phase 4 rooms/contacts surfaces. This is not a blocker — the Phase 3 goal is to prove the rendering contract, not to build the full contacts UI. The backend presence engine (Plan 02) is fully wired to real runtime data.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `session-metadata.ts` exports substantive functions | `grep -n "export function" apps/api/src/auth/session-metadata.ts` | `extractClientIp`, `buildSessionMetadata` found | ✓ PASS |
| Smoke script is executable | `ls -l scripts/qa/phase3-session-presence-smoke.sh` | File exists with execute bit | ✓ PASS |
| Presence config token wired in module | `grep PRESENCE_CONFIG_TOKEN apps/api/src/presence/presence.module.ts` | Found on `provide:` line | ✓ PASS |
| CompactPresenceList does NOT import PresenceLabel | `grep PresenceLabel apps/web/src/features/presence/CompactPresenceList.tsx` | No match — dot-only contract enforced at component boundary | ✓ PASS |
| Live stack smoke (end-to-end) | `./scripts/qa/phase3-session-presence-smoke.sh` | Requires running Docker Compose stack | ? SKIP — needs running stack |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| SESS-01 | 03-01, 03-03 | User can view active sessions with browser and IP details | ✓ SATISFIED | `GET /api/v1/sessions` returns `SessionInventoryItem[]` with `ipAddress`, `userAgent`, `lastSeenAt`; `ActiveSessionsView` renders Device/Browser, IP, Last active columns |
| SESS-02 | 03-01, 03-03 | User can log out selected sessions without logging out all sessions | ✓ SATISFIED | `DELETE /api/v1/sessions/:id` (per-row revoke) and `DELETE /api/v1/sessions/others` (bulk other); per-row revoke leaves other sessions intact |
| SESS-03 | 03-02, 03-04 | Contacts and room members show online, AFK, or offline presence | ✓ SATISFIED (backend + rendering contract) | `PresenceService` derives `online/afk/offline` from runtime tabs; `PresenceDot`/`PresenceLabel`/`PresenceTimestamp` primitives ship the correct rendering contract; live contact/room wiring deferred to Phase 4 |
| SESS-04 | 03-02, 03-04 | User becomes AFK only after all open tabs are inactive for more than one minute | ✓ SATISFIED | `getUserPresence` returns `afk` only when all tabs exceed `afkTimeoutMs` (60 000 ms); `online` if any single tab is within threshold |
| SESS-05 | 03-02, 03-04 | User is online if at least one open tab is active; offline only when all tabs are closed | ✓ SATISFIED | `tabConnected` registers tab; `tabDisconnected` deregisters; `getUserPresence` returns `offline` only when `tabs.size === 0` |
| SESS-06 | 03-02, 03-04 | System persists last seen while serving live presence from runtime state | ✓ SATISFIED | `PresenceRepository.persistLastSeen` writes only on offline transition (fire-and-forget); live reads (`getUserPresence`) read only in-memory Map |
| SESS-07 | 03-01, 03-03 | System tracks user IP addresses for active sessions | ✓ SATISFIED | `session-metadata.ts` `buildSessionMetadata` captures IP at sign-in via X-Forwarded-For chain; stored in `ip_address` column; returned in session inventory |

**All 7 phase requirements (SESS-01 through SESS-07) are satisfied.**

No orphaned requirements: REQUIREMENTS.md Traceability table assigns only SESS-01 through SESS-07 to Phase 3.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `apps/web/src/App.tsx` — `DEMO_MEMBERS` fixture | Hardcoded presence member list in Presence tab | ℹ️ INFO | Intentional demonstration surface documented in SUMMARY; contacts/rooms wiring deferred to Phase 4; presence primitives and backend are real |
| `apps/web/src/features/account/PasswordSettingsView.tsx` | HTML `placeholder` attributes on form inputs | ℹ️ INFO | Standard HTML form placeholders — not a stub; unrelated to Phase 3 |

No blockers or warnings identified in Phase 3 artifacts.

---

### Human Verification Required

#### 1. Active Sessions Screen — Live Render

**Test:** Start the Docker Compose stack, sign in at `/account`, and navigate to the Sessions tab.
**Expected:** A table renders with at least one row showing the current session. Columns show a browser label (e.g. "Chrome · macOS"), full IP address, and humanized last-active time (e.g. "now" or "Xm ago"). A "This browser" badge appears on the current row.
**Why human:** Requires a running stack with a real PostgreSQL session row containing captured `ip_address` and `user_agent` metadata; the rendered HTML and actual API JSON cannot be verified by static code analysis.

#### 2. Current-Session Revoke — Immediate Redirect

**Test:** Click "Sign out" on the "This browser" row, confirm in the inline dialog.
**Expected:** The current tab immediately navigates to the sign-in screen without a page reload.
**Why human:** Requires live UI interaction and observation of the navigation transition; `onSignedOut` callback behavior is conditional on `isCurrentSession` which only resolves with a real API response.

#### 3. Sign Out All Other Sessions

**Test:** Sign in from two different browsers (or an incognito window). From the first browser, click "Sign out all other sessions" and confirm.
**Expected:** The second browser's session row disappears from the first browser's list. The second browser is redirected to sign-in on next request.
**Why human:** Requires two concurrent authenticated sessions and cross-browser observation.

#### 4. Multi-Tab AFK Transition

**Test:** Open two tabs while signed in. Send activity from both (mouse moves). Leave both idle for more than one minute. Observe the WebSocket presence state.
**Expected:** After one minute of all-tabs inactivity, `getUserPresence` returns `afk`. Closing both tabs transitions to `offline`.
**Why human:** One-minute real-time wait; requires a running WebSocket stack and server-side inspection (or WebSocket trace) to observe the timer expiry; cannot be simulated without running the app.

#### 5. Durable Last Seen Write

**Test:** Sign in, establish a WebSocket connection, then close all browser tabs. Query the session inventory endpoint shortly after.
**Expected:** The `lastSeenAt` field on the session row reflects the time the last tab disconnected (write-behind persisted by `PresenceRepository.persistLastSeen`).
**Why human:** Requires a live Postgres + Socket.IO stack to observe the `last_seen_at` column update triggered by the offline transition.

---

### Gaps Summary

No gaps found. All 10 must-haves are verified. All 7 requirements (SESS-01 through SESS-07) are satisfied. All required artifacts exist, are substantive, and are wired correctly. No blocker anti-patterns were identified.

The only outstanding items are the 5 human-verification tests above, which require a running Docker Compose stack and real browser interaction to confirm end-to-end behavior. These are expected for a phase of this scope — the code paths are correctly implemented; they simply cannot be exercised by static analysis.

---

_Verified: 2026-04-18T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
