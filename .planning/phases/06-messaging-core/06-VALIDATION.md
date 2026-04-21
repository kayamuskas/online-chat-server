---
phase: 6
slug: messaging-core
status: partial
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
updated: 2026-04-21
---

# Phase 6 — Validation Strategy

> Retroactive validation contract reconstructed from the completed Phase 6 plans, `06-UAT.md`, and `06-VERIFICATION.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest for messaging slices + API/web builds |
| **Primary runtime under test** | `apps/api` messaging core, `apps/web` room/DM chat surfaces |
| **Quick run command** | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/messages/messages-domain.spec.ts src/__tests__/messages/messages-watermarks.spec.ts` |
| **Full suite command** | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/messages/messages-domain.spec.ts src/__tests__/messages/messages-watermarks.spec.ts src/__tests__/messages/messages-transport.spec.ts && pnpm --filter @chat/api build && pnpm --filter @chat/web build` |
| **Estimated runtime** | ~30-120 seconds |

---

## Sampling Rate

- **After every backend task commit:** Run the relevant `messages-*.spec.ts` slice.
- **After every frontend messaging task:** Run `pnpm --filter @chat/web build`.
- **After gap-closure plans `06-06` / `06-07`:** Re-run builds plus the targeted messaging transport slice.
- **Before marking the phase complete:** Re-run the full focused messaging suite and the three live browser checks listed below.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Evidence Path | Status |
|---------|------|------|-------------|-----------|-------------------|---------------|--------|
| 06-01-01 | 06-01 | 1 | MSG-01, MSG-02, MSG-03, MSG-04, MSG-08 | unit/schema | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/messages/messages-domain.spec.ts src/__tests__/messages/messages-watermarks.spec.ts` | shared message schema, types, watermark invariants | ✅ green |
| 06-02-01 | 06-02 | 2 | MSG-01, MSG-02, MSG-03, MSG-04 | unit | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/messages/messages-transport.spec.ts` | send/edit/history transport layer | ✅ green |
| 06-03-01 | 06-03 | 3 | MSG-01, MSG-02, MSG-04 | build/static | `pnpm --filter @chat/api build` | messages module/controller/service wiring | ✅ green |
| 06-04-01 | 06-04 | 4 | MSG-01, MSG-03, MSG-04, MSG-08 | build/static | `pnpm --filter @chat/web build` | `MessageTimeline`, `MessageComposer`, room chat shell | ✅ green |
| 06-05-01 | 06-05 | 5 | MSG-01, MSG-02, MSG-03, MSG-04, MSG-08 | manual/browser | see `06-UAT.md` tests 1, 2, 4, 5, 8, 9, 10 | messaging shell walkthrough | ✅ green |
| 06-06-01 | 06-06 | 6 | MSG-03 | build/code-verify | `pnpm --filter @chat/api build && pnpm --filter @chat/web build` | reply-preview hydration fix | ⚠ pending live recheck |
| 06-06-02 | 06-06 | 6 | MSG-01 | build/code-verify | `pnpm --filter @chat/api build && pnpm --filter @chat/web build` | DM unfreeze after unban fix | ⚠ pending live recheck |
| 06-07-01 | 06-07 | 6 | MSG-01 | build/code-verify | `pnpm --filter @chat/api build && pnpm --filter @chat/web build` | banned-DM frozen-history fix | ⚠ pending live recheck |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ pending live recheck*

---

## Wave 0 Requirements

- [x] `apps/api/src/__tests__/messages/messages-domain.spec.ts`
- [x] `apps/api/src/__tests__/messages/messages-watermarks.spec.ts`
- [x] `apps/api/src/__tests__/messages/messages-transport.spec.ts`

Validation evidence refreshed from `06-VERIFICATION.md` and `06-UAT.md` on 2026-04-21:
- `06-UAT.md`: `7/10` user-facing scenarios passed, and the three major gaps are documented as resolved by plans `06-06` and `06-07`.
- `06-VERIFICATION.md`: all `5/5` roadmap success criteria are code-verified.
- `findMessageViewById`, `unfreezeConversation`, and the `ban_exists => eligible:false` flow are present and wired in the current codebase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reply chip appears in timeline immediately after send, without reload | MSG-03 | Requires live browser send-time render over the hydrated response / WS path | Reply to an existing room message, send it, and confirm the timeline row immediately shows author + snippet chip. |
| DM becomes writable again after unban | MSG-01 | Requires live DB state transition from frozen to unfrozen | Ban a friend, confirm read-only DM, unban, reopen DM, confirm writable composer returns. |
| Banned DM shows frozen history with read-only banner instead of raw error string | MSG-01 | Requires a real two-user ban scenario and browser rendering | Ban another account, open DM from the banned side, confirm history renders with frozen banner and no raw `not allowed` string. |

---

## Validation Sign-Off

- [x] All plans have direct automated verification coverage.
- [x] Wave 0 tests exist for the shared messaging invariants.
- [x] API and web builds backstop the transport and UI integration layers.
- [x] `nyquist_compliant: true` set in frontmatter.
- [ ] Gap-closure fixes from `06-06` and `06-07` have been re-verified end-to-end in a live browser session.

**Approval:** partial — messaging core is code-verified, but the three gap-closure browser checks still need a fresh live pass before this phase can be marked complete
