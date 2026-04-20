---
phase: 8
slug: moderation-and-destructive-actions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (NestJS e2e) + vitest (web) |
| **Config file** | `apps/api/test/jest-e2e.json` |
| **Quick run command** | `npm run test:e2e --workspace=apps/api -- --testPathPattern=moderation` |
| **Full suite command** | `npm run test:e2e --workspace=apps/api` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:e2e --workspace=apps/api -- --testPathPattern=moderation`
- **After every plan wave:** Run `npm run test:e2e --workspace=apps/api`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | ROOM-07 | — | Admin cannot ban admin (only owner can) | e2e | `npm run test:e2e -- --testPathPattern=rooms-ban` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | ROOM-08 | — | Ban persists until explicitly reversed | e2e | `npm run test:e2e -- --testPathPattern=rooms-ban` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | MSG-05 | — | Author deletes own message; admin deletes any | e2e | `npm run test:e2e -- --testPathPattern=messages-delete` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | MSG-05 | — | WS message:deleted event emitted to room channel | e2e | `npm run test:e2e -- --testPathPattern=messages-delete` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | ROOM-09 | — | Room deletion cascades: attachments → messages → memberships → room | e2e | `npm run test:e2e -- --testPathPattern=rooms-delete` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 2 | ROOM-09 | — | room:deleted WS event broadcast before data delete | e2e | `npm run test:e2e -- --testPathPattern=rooms-delete` | ❌ W0 | ⬜ pending |
| 08-04-01 | 04 | 3 | AUTH-08 | — | Account deletion with password confirmation | e2e | `npm run test:e2e -- --testPathPattern=account-delete` | ❌ W0 | ⬜ pending |
| 08-04-02 | 04 | 3 | AUTH-08 | — | Owned rooms deleted with full cascade on account delete | e2e | `npm run test:e2e -- --testPathPattern=account-delete` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/test/moderation/rooms-ban.e2e-spec.ts` — stubs for ROOM-07, ROOM-08
- [ ] `apps/api/test/moderation/messages-delete.e2e-spec.ts` — stubs for MSG-05
- [ ] `apps/api/test/moderation/rooms-delete.e2e-spec.ts` — stubs for ROOM-09
- [ ] `apps/api/test/moderation/account-delete.e2e-spec.ts` — stubs for AUTH-08

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Delete button visible on hover for author/admin in MessageTimeline | MSG-05 | UI interaction | Open room, hover message, verify button appears for author; verify admin sees button on all messages |
| Danger zone in ManageRoomView Settings tab | ROOM-09 | UI integration | Open room settings, verify Delete Room section with confirmation step |
| Danger zone in AccountOverviewView | AUTH-08 | UI integration | Open account settings, verify Delete Account section with password input |
| room:deleted event causes client navigation away | ROOM-09 | WS + UI | Delete a room you're viewing; verify client navigates away without crash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
