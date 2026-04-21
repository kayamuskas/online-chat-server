---
phase: 6
slug: messaging-core
status: complete
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
| 06-06-01 | 06-06 | 6 | MSG-03 | browser/e2e | `pnpm exec playwright test e2e/realtime/gap-verification.spec.ts --reporter=line` | reply-preview hydration fix | ✅ green |
| 06-06-02 | 06-06 | 6 | MSG-01 | code-verify | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/contacts/contacts-eligibility.spec.ts` | DM eligibility precedence and conversation-row maintenance | ✅ green |
| 06-07-01 | 06-07 | 6 | MSG-01 | browser/e2e | `pnpm exec playwright test e2e/realtime/gap-verification.spec.ts --reporter=line` | banned-DM frozen-history fix + DM re-entry path | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ pending live recheck*

---

## Wave 0 Requirements

- [x] `apps/api/src/__tests__/messages/messages-domain.spec.ts`
- [x] `apps/api/src/__tests__/messages/messages-watermarks.spec.ts`
- [x] `apps/api/src/__tests__/messages/messages-transport.spec.ts`

Validation evidence refreshed from `06-VERIFICATION.md` and `06-UAT.md` on 2026-04-21:
- `06-UAT.md`: `7/10` user-facing scenarios passed, and the three major gaps are documented as resolved by plans `06-06` and `06-07`.
- `06-VERIFICATION.md`: all `5/5` roadmap success criteria are code-verified.
- `pnpm exec playwright test e2e/realtime/gap-verification.spec.ts --reporter=line` passed the send-time reply-chip and banned-DM re-entry checks.
- `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/contacts/contacts-eligibility.spec.ts` passed after fixing ban precedence so `ban_exists` wins over `not_friends`.

---

## Validation Sign-Off

- [x] All plans have direct automated verification coverage.
- [x] Wave 0 tests exist for the shared messaging invariants.
- [x] API and web builds backstop the transport and UI integration layers.
- [x] `nyquist_compliant: true` set in frontmatter.
- [x] The banned-DM frozen-history browser path has been re-verified end-to-end from the current UI surface.

**Approval:** complete — messaging core is re-verified end-to-end, including the banned-DM frozen-history browser path
