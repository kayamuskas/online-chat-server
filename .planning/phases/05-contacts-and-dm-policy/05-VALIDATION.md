---
phase: 5
slug: contacts-and-dm-policy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already installed) |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npm test -- src/__tests__/contacts/ --reporter=verbose` |
| **Full suite command** | `cd apps/api && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test -- src/__tests__/contacts/ --reporter=verbose`
- **After every plan wave:** Run `cd apps/api && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 05-01 | 1 | FRND-01..06 | unit | `cd apps/api && npm test -- src/__tests__/contacts/` | ❌ Wave 0 | ⬜ pending |
| 05-01-02 | 05-01 | 1 | FRND-01..06 | unit | `cd apps/api && npm test -- src/__tests__/contacts/` | ❌ Wave 0 | ⬜ pending |
| 05-01-03 | 05-01 | 1 | FRND-01..06 | unit | `cd apps/api && npm test -- src/__tests__/contacts/` | ❌ Wave 0 | ⬜ pending |
| 05-02-01 | 05-02 | 2 | FRND-01, FRND-02, FRND-03 | unit | `cd apps/api && npm test -- src/__tests__/contacts/contacts-domain.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 05-02-02 | 05-02 | 2 | FRND-04, FRND-05, FRND-06 | unit | `cd apps/api && npm test -- src/__tests__/contacts/contacts-eligibility.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 05-03-01 | 05-03 | 3 | FRND-01, FRND-02, FRND-03, FRND-04 | unit | `cd apps/api && npm test -- src/__tests__/contacts/` | ❌ Wave 0 | ⬜ pending |
| 05-03-02 | 05-03 | 3 | FRND-06 | unit | `cd apps/api && npm test -- src/__tests__/contacts/` | ❌ Wave 0 | ⬜ pending |
| 05-04-01 | 05-04 | 4 | FRND-01, FRND-03, FRND-04 | manual | `npm run build` in apps/web (TypeScript compiles) | ✅ | ⬜ pending |
| 05-04-02 | 05-04 | 4 | FRND-06 | manual | Sidebar renders contacts with presence dots | ✅ | ⬜ pending |
| 05-05-01 | 05-05 | 5 | FRND-01..06 | manual | App.tsx integrates contacts state; badge count updates | ✅ | ⬜ pending |
| 05-05-02 | 05-05 | 5 | FRND-01 | manual | Room member list shows Add Friend button for non-friends | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/__tests__/contacts/contacts-domain.spec.ts` — stubs for FRND-01, FRND-02, FRND-03, FRND-04, FRND-05
- [ ] `apps/api/src/__tests__/contacts/contacts-eligibility.spec.ts` — DM eligibility matrix tests for FRND-06

*These files are created in Plan 05-01 Task 3.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Notification badge shows count | FRND-01, FRND-02 | UI state | Send request as user A; verify badge appears for user B |
| Accept/Decline via dropdown | FRND-02 | UI interaction | Click badge → confirm dropdown shows request → accept |
| Disabled DM button with tooltip | FRND-06 | UI state | View non-friend profile; verify button is disabled |
| Ban confirmation modal | FRND-04 | UI flow | Attempt ban; verify modal appears before action executes |
| Banned user sees explicit message | FRND-04 | UI state | As banned user, try to contact banner; verify message |
| DM history frozen after ban | FRND-05 | Data state | Ban user with existing DM; verify read-only state |
| Unban restores contact ability | FRND-04 | Full flow | Unban from settings; verify DM becomes available again |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
