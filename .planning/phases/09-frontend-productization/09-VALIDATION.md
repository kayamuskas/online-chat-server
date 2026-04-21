---
phase: 9
slug: frontend-productization
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
finalized: 2026-04-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for the already executed frontend productization work.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vite production build as primary automated gate |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick run command** | `pnpm --filter @chat/web build` |
| **Full suite command** | `pnpm --filter @chat/web build` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every plan slice:** Run `pnpm --filter @chat/web build`
- **Before phase verification:** Re-run `pnpm --filter @chat/web build`
- **Max feedback latency:** ~1 second

---

## Per-Plan Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 09-01-01 | 09-01 | UI-01, UI-02 | build | `pnpm --filter @chat/web build` | green |
| 09-02-01 | 09-02 | UI-01 | build | `pnpm --filter @chat/web build` | green |
| 09-03-01 | 09-03 | NOTF-01, NOTF-02 | build | `pnpm --filter @chat/web build` | green |
| 09-04-01 | 09-04 | MSG-07 | build | `pnpm --filter @chat/web build` | green |
| 09-05-01 | 09-05 | UI-03 | build | `pnpm --filter @chat/web build` | green |
| 09-06-01 | 09-06 | UI-01 | build | `pnpm --filter @chat/web build` | green |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shell visually matches the intended warm `desing_v1` direction on desktop and mobile | UI-01 | Requires rendered browser inspection | Open the app on desktop and mobile widths and compare with `requirements/desing_v1/` |
| Manage-room tabs behave as a modal-style product flow | UI-03 | Requires interactive browser navigation | Open `Manage room`, switch tabs, trigger invite/unban/leave actions |

Browser-backed evidence already confirmed outside the manual-only subset:
- Playwright realtime suite passed on 2026-04-21, covering unread badge behavior and upward infinite history.
- Manual browser recheck on 2026-04-21 confirmed the Account hub sign-out path returns the user to auth cleanly.

---

## Validation Sign-Off

- [x] Every executed Phase 9 plan has an automated build verification
- [x] Sampling continuity preserved through repeated web builds
- [x] No watch-mode or flaky background verification required
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete for validation contract; remaining items are explicit manual-only browser checks
