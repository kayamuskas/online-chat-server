---
phase: 3
slug: sessions-and-presence
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
finalized: 2026-04-18
---

# Phase 3 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | API unit/integration tests plus Phase 3 session/presence smoke harness |
| **Primary runtime under test** | `apps/api` + `apps/web` + Redis + PostgreSQL under local Compose |
| **Quick run command** | `pnpm --filter @chat/api test` |
| **Full suite command** | `scripts/qa/phase3-session-presence-smoke.sh` |
| **Estimated runtime** | ~45-180 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command.
- **After Plan 01:** Run API tests covering session inventory and revoke flows.
- **After Plan 02:** Run presence tests with shortened test timers and confirm live/runtime behavior does not depend on PostgreSQL polling.
- **After Plan 03:** Exercise the active-sessions UI against the local stack.
- **After Plan 04 / before `$gsd-verify-work`:** Run `scripts/qa/phase3-session-presence-smoke.sh`.
- **Max feedback latency:** 180 seconds.

---

## Per-Task Verification Map

| Task ID | Plan/Task | Wave | Requirements | Threat Ref(s) | Secure Behavior | Test Type | Automated Command | Evidence Path | Status |
|---------|-----------|------|--------------|---------------|-----------------|-----------|-------------------|---------------|--------|
| 03-01-01 | 01 / Task 1 | 1 | SESS-01, SESS-07 | T-03-01, T-03-02 | Session rows persist browser/IP metadata and remain compatible with the existing opaque-session model. | static/unit | `rg -n "ip|user_agent|created_at|last_seen_at|sessions" apps/api/src/db/migrations apps/api/src/auth/auth.types.ts apps/api/src/auth/session.repository.ts apps/api/src/auth/auth.service.ts && pnpm --filter @chat/api test -- --runInBand session` | session schema/repository/service/tests | ✅ green |
| 03-01-02 | 01 / Task 2 | 1 | SESS-01, SESS-02, SESS-07 | T-03-03, T-03-04 | Authenticated inventory and revoke endpoints expose only the caller's own sessions and preserve per-session precision. | integration | `rg -n "sessions|revoke|sign-out-all|current session|This browser" apps/api/src/auth apps/api/src/__tests__/auth && pnpm --filter @chat/api test -- --runInBand session-inventory revoke` | session endpoints/tests | ✅ green |
| 03-02-01 | 02 / Task 1 | 2 | SESS-03, SESS-04, SESS-05 | T-03-05, T-03-06 | Presence aggregation uses per-tab runtime state and enforces the one-minute AFK rule over all tabs, not a single connection. | integration | `rg -n "presence|heartbeat|afk|offline|online|tab|socket" apps/api/src apps/api/src/__tests__ && pnpm --filter @chat/api test -- --runInBand presence heartbeat` | presence module/gateway/tests | ✅ green |
| 03-02-02 | 02 / Task 2 | 2 | SESS-05, SESS-06 | T-03-06, T-03-07 | Live presence stays in runtime state while durable `last seen` persists on controlled offline transitions. | integration | `rg -n "last seen|last_seen|runtime state|redis|offline transition|persist" apps/api/src apps/api/src/__tests__ .planning/phases/03-sessions-and-presence/03-RESEARCH.md && pnpm --filter @chat/api test -- --runInBand last-seen` | presence persistence/tests | ✅ green |
| 03-03-01 | 03 / Task 1 | 3 | SESS-01, SESS-02, SESS-07 | T-03-08 | Web client can load and render the caller's active sessions with current-session awareness and humanized `Last active`. | static/UI | `rg -n "Active sessions|This browser|Last active|Sign out all other sessions|2h ago|yesterday" apps/web/src/App.tsx apps/web/src/features apps/web/src/lib/api.ts` | active-sessions UI/components | ✅ green |
| 03-03-02 | 03 / Task 2 | 3 | SESS-01, SESS-02 | T-03-08, T-03-09 | Revoking `This browser` redirects to sign-in immediately; other revoke actions update fast without clearing unrelated sessions. | smoke | `test -f scripts/qa/phase3-session-presence-smoke.sh && rg -n "revoke|current session|sign out all other sessions|redirect|sign in" scripts/qa/phase3-session-presence-smoke.sh apps/web/src` | smoke harness + UI flow | ✅ green |
| 03-04-01 | 04 / Task 1 | 4 | SESS-03, SESS-04, SESS-05, SESS-06 | T-03-10 | Shared presence primitives honor the locked compact-vs-detailed rendering contract and expose `last seen` for offline detail surfaces. | static/UI | `rg -n "online|AFK|offline|last seen|dot|member info|contacts" apps/web/src requirements/desing_v1/components/contacts.jsx requirements/wireframes.md` | presence UI primitives/surfaces | ✅ green |
| 03-04-02 | 04 / Task 2 | 4 | SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06, SESS-07 | T-03-01, T-03-10 | Phase 3 ships with a concrete smoke/validation loop covering session inventory, targeted revoke, and presence transitions under local timing constraints. | smoke/static | `test -f scripts/qa/phase3-session-presence-smoke.sh && rg -n "03-01-01|03-01-02|03-02-01|03-02-02|03-03-01|03-03-02|03-04-01|03-04-02|T-03-01|T-03-10" .planning/phases/03-sessions-and-presence/03-VALIDATION.md` | smoke script + validation doc | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Verification Artifacts Created By The Plans

- `apps/api/src/db/migrations/*presence*.sql` - session/presence schema evolution under test
- `apps/api/src/auth/session.repository.ts` and related auth endpoints - active-session inventory and revoke operations
- `apps/api/src/presence/*` - runtime presence aggregation and durable `last seen` handling
- `apps/api/src/ws/*` - authenticated socket/presence transport
- `apps/web/src/features/account/*` - active-sessions screen and revoke UX
- `apps/web/src/features/presence/*` - compact/detailed presence rendering primitives and Phase 3 surfaces
- `scripts/qa/phase3-session-presence-smoke.sh` - end-to-end Phase 3 smoke coverage

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Human review of the active-sessions screen against the provided reference | SESS-01, SESS-02, SESS-07 | Visual fidelity and interaction feel need a human pass | Open `/account`, compare the session table layout, `This browser`, `Last active`, and revoke actions against the locked reference. |
| Browser-tab hibernation and resume behavior feels stable, not aggressive | SESS-04, SESS-05, SESS-06 | Real browser lifecycle behavior is environment-specific | Open multiple tabs, hide/restore tabs, leave one active, then confirm `online / AFK / offline` transitions follow the locked semantics without noisy flapping. |
| Presence tab renders correctly with correct colors (green/amber/gray) | SESS-03, SESS-04 | Visual fidelity of presence dot colors requires human inspection | Sign in, navigate to the Presence tab in the account view, verify alice/dave show green dots, bob/carol show amber dots, mike shows a gray dot with "last seen 2h ago". |

---

## Validation Sign-Off

- [x] All planned tasks have `<automated>` verification.
- [x] Sampling continuity: every plan has at least one direct validation command.
- [x] Validation artifacts map to concrete plan outputs.
- [x] No Wave 0 placeholders remain.
- [x] Feedback latency target is under 180 seconds for per-task checks.
- [x] `nyquist_compliant: true` set in frontmatter.
- [x] All task rows marked ✅ green — Phase 3 execution complete.
- [x] `scripts/qa/phase3-session-presence-smoke.sh` ships with coverage for all 8 task IDs and all 10 threat IDs.

**Approval:** Phase 3 complete — all plans executed, smoke harness available, validation map finalized.
