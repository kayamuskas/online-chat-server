---
phase: 10
slug: performance-qa-and-release-hardening
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
---

# Phase 10 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell release gates, Artillery perf smoke, Node perf probes/reducers, and Playwright browser E2E |
| **Config files** | `playwright.config.ts`, `scripts/perf/perf-lite.yml`, `infra/compose/compose.yaml` |
| **Quick run command** | `bash scripts/qa/phase10-startup-gate.sh` |
| **Full suite command** | `bash scripts/qa/release-gate.sh` |
| **Estimated runtime** | ~3-10 minutes locally, dominated by Compose startup plus Playwright |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command.
- **After Wave 1:** Re-run `bash scripts/qa/phase10-startup-gate.sh`.
- **After Wave 2:** Re-run Artillery smoke, latency probe, and 100k history proof inputs for the touched slice.
- **After Wave 3 / before `$gsd-verify-work`:** Run `bash scripts/qa/release-gate.sh`.
- **Max feedback latency:** startup-only checks under ~180 seconds; full release gate under ~10 minutes.

---

## Per-Task Verification Map

| Task ID | Plan/Task | Wave | Requirements | Threat Ref(s) | Secure Behavior | Test Type | Automated Command | Evidence Path | Status |
|---------|-----------|------|--------------|---------------|-----------------|-----------|-------------------|---------------|--------|
| 10-01-01 | 01 / Task 1 | 1 | PERF-01, OPS-01, OPS-02 | T-10-01, T-10-03 | Startup preflight reuses existing smoke scripts and fails fast on any startup contract breach. | smoke | `bash scripts/qa/phase10-startup-gate.sh` | `scripts/qa/phase10-startup-gate.sh`, startup console summary | ⬜ pending |
| 10-01-02 | 01 / Task 2 | 1 | PERF-01, OPS-01, OPS-02 | T-10-02 | Startup evidence exposes stable step names and PASS/FAIL output for downstream orchestration. | smoke/static | `bash scripts/qa/phase10-startup-gate.sh >/tmp/phase10-startup.log && rg -n "PASS|FAIL|phase1-smoke|phase1-offline-check|phase1-queue-check|phase1-transport-check" /tmp/phase10-startup.log` | `/tmp/phase10-startup.log` | ⬜ pending |
| 10-02-01 | 02 / Task 1 | 2 | PERF-01 | T-10-04, T-10-05 | Root workspace resolves Artillery deterministically before the perf-lite gate runs. | integration/perf | `rg -n '"artillery": "2.0.30"' package.json pnpm-lock.yaml && pnpm install --frozen-lockfile && bash scripts/qa/phase10-startup-gate.sh && pnpm exec artillery run scripts/perf/perf-lite.yml --output artifacts/perf/artillery-current.json` | `package.json`, `pnpm-lock.yaml`, `artifacts/perf/artillery-current.json` | ⬜ pending |
| 10-02-02 | 02 / Task 2 | 2 | PERF-01 | T-10-04, T-10-06 | Latency evidence measures peer-observed realtime events and fails on p95 threshold breaches, not mean-only summaries. | integration/perf | `bash scripts/qa/phase10-startup-gate.sh && node scripts/perf/probe-latency.mjs --output artifacts/perf/latency-current.json` | `artifacts/perf/latency-current.json` | ⬜ pending |
| 10-03-01 | 03 / Task 1 | 2 | PERF-02, TEST-01 | T-10-07 | Large-history seed path is deterministic, browser-independent, and preserves message ordering invariants. | integration/fixture | `bash scripts/qa/phase10-startup-gate.sh && node scripts/perf/seed-history.mjs --count 100000 --output artifacts/perf/history-seed-current.json` | `artifacts/perf/history-seed-current.json` | ⬜ pending |
| 10-03-02 | 03 / Task 2 | 2 | PERF-02, TEST-01 | T-10-08, T-10-09 | Playwright-only 100k proof verifies progressive upward loading, chronology, monotonic watermarks, and duplicate-free DOM windows. | Playwright E2E | `bash scripts/qa/phase10-startup-gate.sh && node scripts/perf/seed-history.mjs --count 100000 --output artifacts/perf/history-seed-current.json && pnpm exec playwright test e2e/perf/history-100k.spec.ts --reporter=json` | Playwright JSON output plus `e2e/perf/history-100k.spec.ts` | ⬜ pending |
| 10-04-01 | 04 / Task 1 | 3 | PERF-01, PERF-02 | T-10-10 | Reducer refuses silent gaps and writes comparable baseline/current/diff outputs with explicit pass/fail. | integration/static | `node scripts/perf/reduce-artifacts.mjs --baseline artifacts/perf/baseline.json --current artifacts/perf/current.json --diff artifacts/perf/diff.json` | `artifacts/perf/baseline.json`, `artifacts/perf/current.json`, `artifacts/perf/diff.json` | ⬜ pending |
| 10-04-02 | 04 / Task 2 | 3 | PERF-01, PERF-02, OPS-01, OPS-02, TEST-01 | T-10-11, T-10-12 | Release gate enforces startup, perf-lite, latency, critical Playwright UAT, and dedicated 100k-history proof in a fixed blocking order. | release gate | `bash scripts/qa/release-gate.sh` | `scripts/qa/release-gate.sh`, `artifacts/perf/current.json`, `artifacts/perf/diff.json` | ⬜ pending |
| 10-05-01 | 05 / Task 1 | 4 | PERF-01, PERF-02, OPS-01, OPS-02, TEST-01 | T-10-13, T-10-15 | Human-readable release docs point to the exact supported commands, artifacts, and blocking conditions. | static/docs | `rg -n "phase10-startup-gate|release-gate|baseline.json|current.json|diff.json|history-100k.spec.ts|p95" docs/release/phase-10-release-checklist.md docs/release/phase-10-release-handoff.md` | `docs/release/phase-10-release-checklist.md`, `docs/release/phase-10-release-handoff.md` | ⬜ pending |
| 10-05-02 | 05 / Task 2 | 4 | PERF-01, PERF-02, OPS-01, OPS-02, TEST-01 | T-10-13, T-10-14 | Verification record maps phase truths to exact gate commands and artifact paths so audit does not depend on memory. | static/docs | `rg -n "PERF-01|PERF-02|OPS-01|OPS-02|TEST-01|artifacts/perf|release-gate.sh|history-100k.spec.ts" .planning/phases/10-performance-qa-and-release-hardening/10-VERIFICATION.md` | `.planning/phases/10-performance-qa-and-release-hardening/10-VERIFICATION.md` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Verification Artifacts Created By The Plans

- `scripts/qa/phase10-startup-gate.sh` - strict startup preflight for D-1007.
- `scripts/perf/perf-lite.yml` - Artillery smoke scenario and threshold policy.
- `scripts/perf/probe-latency.mjs` - product-aware message/presence p95 probe.
- `scripts/perf/seed-history.mjs` - deterministic 100,000+ history seed path.
- `e2e/perf/history-100k.spec.ts` - dedicated Playwright `PERF-02` proof.
- `scripts/qa/release-gate.sh` - single blocking Phase 10 entrypoint.
- `artifacts/perf/baseline.json`, `artifacts/perf/current.json`, `artifacts/perf/diff.json` - regression comparison outputs.
- `docs/release/phase-10-release-checklist.md` and `docs/release/phase-10-release-handoff.md` - human-readable release evidence.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Release handoff is understandable to a human operator without prior shell history context | D-1008 support, release usability | Documentation clarity still benefits from a quick human read after generation | Open `docs/release/phase-10-release-checklist.md` and `docs/release/phase-10-release-handoff.md`; confirm they reference the exact gate commands, artifact paths, thresholds, and the deferred full-scale benchmark note. |

---

## Validation Sign-Off

- [x] All planned tasks have `<automated>` verification.
- [x] Sampling continuity preserved across all five plans.
- [x] No Wave 0 placeholder commands remain.
- [x] Full release-gate command is explicit before execution.
- [x] Critical Playwright UAT coverage and the dedicated 100k proof are both named explicitly.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** draft-ready — validation contract is explicit before execution.
