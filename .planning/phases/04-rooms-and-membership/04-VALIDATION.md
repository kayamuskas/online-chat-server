---
phase: 4
slug: rooms-and-membership
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
updated: 2026-04-21
finalized: 2026-04-21
---

# Phase 4 — Validation Strategy

> Retroactive validation contract reconstructed from the completed Phase 4 plans and the refreshed `04-VERIFICATION.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest for rooms domain slices + app builds |
| **Primary runtime under test** | `apps/api` rooms domain and `apps/web` room shell |
| **Quick run command** | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/rooms/rooms-domain.spec.ts src/__tests__/rooms/rooms-catalog.spec.ts` |
| **Full suite command** | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/rooms/rooms-domain.spec.ts src/__tests__/rooms/rooms-catalog.spec.ts src/__tests__/rooms/rooms-management.spec.ts src/__tests__/rooms/rooms-private-membership.spec.ts && pnpm --filter @chat/web build` |
| **Estimated runtime** | ~30-90 seconds |

---

## Sampling Rate

- **After every backend task commit:** Run the relevant `rooms-*.spec.ts` slice for the changed behavior.
- **After every plan wave:** Re-run the focused rooms test set and at least one build.
- **After private-room invite flow wiring:** Re-run `rooms-private-membership.spec.ts` and `pnpm --filter @chat/web build`.
- **Max feedback latency:** 90 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Evidence Path | Status |
|---------|------|------|-------------|-----------|-------------------|---------------|--------|
| 04-01-01 | 04-01 | 1 | ROOM-01, ROOM-10, ROOM-11 | unit/static | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/rooms/rooms-domain.spec.ts` | schema, repository, service foundation | ✅ green |
| 04-02-01 | 04-02 | 2 | ROOM-02, ROOM-03, ROOM-05 | unit | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/rooms/rooms-catalog.spec.ts` | catalog and join/leave domain tests | ✅ green |
| 04-03-01 | 04-03 | 3 | ROOM-04, ROOM-06, ROOM-11 | unit | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/rooms/rooms-management.spec.ts` | invite and management tests | ✅ green |
| 04-04-01 | 04-04 | 3 | ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05 | build/static | `pnpm --filter @chat/web build` | Phase 4 room shell in `App.tsx` and room views | ✅ green |
| 04-05-01 | 04-05 | 4 | ROOM-04, ROOM-06, ROOM-11 | unit/build | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/rooms/rooms-private-membership.spec.ts && pnpm --filter @chat/web build` | recipient invite actions and private-room membership flow | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Wave 0 Requirements

- [x] `apps/api/src/__tests__/rooms/rooms-domain.spec.ts`
- [x] `apps/api/src/__tests__/rooms/rooms-catalog.spec.ts`
- [x] `apps/api/src/__tests__/rooms/rooms-management.spec.ts`
- [x] `apps/api/src/__tests__/rooms/rooms-private-membership.spec.ts`

Validation evidence refreshed from `04-VERIFICATION.md` on 2026-04-21:
- `rooms-domain.spec.ts`: `23 passed`
- `rooms-catalog.spec.ts`: `23 passed`
- `rooms-management.spec.ts`: `26 passed`
- `rooms-private-membership.spec.ts`: `8 passed`
- `pnpm --filter @chat/api build`: pass
- `pnpm --filter @chat/web build`: pass

---

## Manual-Only Verifications

No blocking manual-only validation items remain for the Phase 4 contract.

Deferred-but-accepted UI scope:
- `ManageRoomView` member hydration was explicitly deferred to Phase 9 and is already tracked in `04-VERIFICATION.md`; it is not a Phase 4 validation blocker.

---

## Validation Sign-Off

- [x] All plans have direct automated verification coverage.
- [x] Sampling continuity is preserved across schema, API, and web-shell work.
- [x] Wave 0 coverage exists for all durable room-domain behaviors.
- [x] No watch-mode or placeholder-only checks are required.
- [x] Feedback latency remains under 90 seconds for focused validation slices.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** complete
