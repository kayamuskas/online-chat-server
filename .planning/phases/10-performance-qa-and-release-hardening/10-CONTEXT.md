# Phase 10: Performance, QA, and Release Hardening - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 hardens release readiness for the implemented v1 chat product by adding measurable performance/latency checks, large-history integrity verification, and explicit release gates.

This phase does not add new end-user product capabilities. It formalizes quality evidence and release-blocking criteria for what already exists.
</domain>

<decisions>
## Implementation Decisions

### Load profile strategy (`PERF-01`)

- **D-1001:** v1 uses performance smoke (perf-lite) gates, not full-scale 300-user load as a blocking requirement in this phase.
- **D-1002:** Full-scale performance benchmarking is explicitly deferred beyond v1 hardening.

### Latency acceptance gate

- **D-1003:** Blocking latency metric is **p95**:
  - message delivery p95 < 3 seconds
  - presence propagation p95 < 2 seconds
- **D-1004:** Mean-only metrics are not sufficient for release decisions.

### `PERF-02` history-scale proof

- **D-1005:** `PERF-02` must be validated by automated Playwright browser E2E.
- **D-1006:** The E2E must prove progressive upward loading behavior and chronology/integrity checks over very large history (100,000+ messages scenario).

### Release-blocking gates

- **D-1007:** Release gates are strict/blocking and must include:
  - fresh-clone startup (`git clone && docker compose up` contract)
  - critical Playwright UAT coverage
  - phase-defined perf gates (for v1: perf-lite smoke + p95 latency checks)
  - 100,000+ history progressive-scroll validation

### QA/performance artifacts

- **D-1008:** Keep human-readable release docs in `docs/release/`.
- **D-1009:** Keep machine-readable performance artifacts in `artifacts/perf/*.json`.
- **D-1010:** Persist baseline + current run + diff-style comparison artifacts for regression visibility.

### Decision strictness for downstream planning

- **D-1011:** Decisions above are locked and must be treated as non-negotiable by researcher/planner/executor for this phase.
- **D-1012:** Planner discretion is limited to implementation mechanics, not gate definitions.

### the agent's Discretion

- Exact tooling choice for perf-lite scenario generation (as long as outputs satisfy D-1008..D-1010).
- Exact JSON schema shape for artifacts, if it preserves baseline/current/diff comparability.
- CI wiring details (job names, step ordering), provided blocking semantics remain intact.
</decisions>

<specifics>
## Specific Ideas

- Prioritize deterministic and repeatable local evidence over “aspirational” large-load claims.
- Keep Phase 10 focused on release confidence and regression detection, not feature expansion.
- Use existing Playwright-centered testing direction as the canonical browser-level validation path.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and phase contract
- `.planning/ROADMAP.md` — Phase 10 goal and success criteria
- `.planning/REQUIREMENTS.md` — `PERF-01`, `PERF-02`, and startup/testing constraints (`OPS-01`, `OPS-02`, `TEST-01`)
- `requirements/requirements_raw.md` — capacity, latency, infinite scroll, and submission/runtime expectations

### Testing and QA baseline
- `.planning/codebase/TESTING.md` — existing test stack and Playwright policy
- `playwright.config.ts` — current E2E runner contract
- `e2e/global-setup.ts` — fixture/session bootstrap pattern
- `e2e/helpers/ui-helpers.ts` — reusable browser interaction helpers
- `e2e/realtime/history-load.spec.ts` — current upward history behavior test anchor

### Existing release/startup checks
- `scripts/qa/phase1-smoke.sh` — compose startup baseline check
- `scripts/qa/phase1-offline-check.sh` — startup/dependency constraints audit
- `infra/compose/compose.yaml` — runtime topology and health dependencies
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing Playwright E2E harness already validates realtime and history behavior and can be extended for phase gates.
- Existing QA shell scripts already cover fresh-clone/compose startup expectations and can be promoted into release gates.
- Message history surfaces already expose watermark/range semantics suitable for integrity assertions at large history depth.

### Established Patterns
- Playwright is the only allowed browser automation framework (`TEST-01`), so all phase E2E gates must use it.
- Phase artifacts in `.planning/phases/*` already follow validation/verification/report conventions that Phase 10 can mirror for release hardening evidence.

### Integration Points
- CI/release pipeline should consume `artifacts/perf/*.json` and fail on gate violation.
- Release docs in `docs/release/` should summarize gate outcomes and point to machine artifacts.
- Existing `docker compose` QA flow should be reused as a blocking prerequisite before performance checks.
</code_context>

<deferred>
## Deferred Ideas

- Full-scale synthetic load proving 300 simultaneous users with hard pass/fail in CI (deferred beyond v1 phase-hardening scope).
- Cross-host/distributed performance scenarios and federation-level load (v2+ scope).
</deferred>

---

*Phase: 10-performance-qa-and-release-hardening*
*Context gathered: 2026-04-20*
