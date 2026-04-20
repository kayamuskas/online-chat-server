# Phase 10: Performance, QA, and Release Hardening - Research

**Researched:** 2026-04-20
**Domain:** Release gates, perf-lite smoke validation, latency evidence, large-history browser integrity, and handoff artifacts
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

- Full-scale synthetic load proving 300 simultaneous users with hard pass/fail in CI (deferred beyond v1 phase-hardening scope).
- Cross-host/distributed performance scenarios and federation-level load (v2+ scope).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | System supports up to 300 simultaneous users, up to 1000 room members, and usable 10,000+ message history while meeting stated latency targets. [VERIFIED: `.planning/REQUIREMENTS.md`] | Use a perf-lite blocking gate made of: `docker compose` startup gate, Artillery smoke scenarios with threshold failure, and a product-aware p95 latency probe that measures `message-created` and `presence` event arrival against the live stack. [VERIFIED: codebase read] [CITED: https://www.artillery.io/docs/reference/extensions/ensure] [CITED: https://www.artillery.io/docs/reference/engines/socketio] |
| PERF-02 | Very old rooms with 100,000+ messages still support progressive upward scrolling with explicit test coverage. [VERIFIED: `.planning/REQUIREMENTS.md`] | Extend the existing Playwright history test into a seeded 100,000+ room-history integrity spec that validates progressive upward loading, monotonic watermarks, stable chronology, and no duplicate rows in loaded windows. [VERIFIED: codebase read] [CITED: https://playwright.dev/docs/test-assertions] |
</phase_requirements>

## Summary

Phase 10 should be implemented as a release-gate layer over the existing stack, not as a new feature slice. The repository already has the critical raw ingredients: `docker compose` smoke scripts, a Playwright E2E harness, cookie-based auth setup, websocket message fanout, presence transport, and history APIs with watermark-based pagination. [VERIFIED: codebase read]

The standard implementation split is: Artillery for perf-lite blocking smoke and transport-level threshold enforcement, a thin Node probe built on the app's actual Socket.IO contract for p95 message-delivery and presence-propagation evidence, and Playwright for the 100,000+ upward-scroll integrity proof. That split matches the locked decisions better than trying to make one tool do all three jobs. [VERIFIED: codebase read] [CITED: https://www.artillery.io/docs/reference/cli/run] [CITED: https://www.artillery.io/docs/reference/extensions/ensure] [CITED: https://playwright.dev/docs/auth] [CITED: https://playwright.dev/docs/test-reporters]

**Primary recommendation:** Use a dual-harness release gate: Artillery `ensure` for perf-lite blocking checks, product-aware Socket.IO latency probes for p95 business-event timing, and Playwright as the sole browser-level proof for `PERF-02`. [CITED: https://www.artillery.io/docs/reference/extensions/ensure] [CITED: https://playwright.dev/docs/auth] [VERIFIED: codebase read]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fresh-clone startup gate | Frontend/Backend runtime topology | Docker/Compose boundary | Existing release readiness already hinges on `infra/compose/compose.yaml` plus `scripts/qa/phase1-smoke.sh` and `phase1-offline-check.sh`. [VERIFIED: codebase read] |
| Perf-lite request/socket pressure generation | API / Backend | Frontend server boundary | Load generation should hit the real API and Socket.IO transports rather than DOM automation. [CITED: https://www.artillery.io/docs/reference/engines/socketio] [ASSUMED] |
| Message delivery p95 measurement | API / Backend | Browser / Client | The authoritative signal is the live `message-created` websocket event emitted by `MessagesGateway`, not just REST write completion. [VERIFIED: codebase read] |
| Presence propagation p95 measurement | API / Backend | Browser / Client | The presence transport is websocket-driven (`getPresence` -> `presence`) in `AppGateway`; measure that event path directly. [VERIFIED: codebase read] |
| 100,000+ history progressive upward integrity | Browser / Client | API / Backend | `PERF-02` is explicitly locked to automated Playwright E2E, and the browser must prove chronology/integrity while loading older pages. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] [CITED: https://playwright.dev/docs/test-assertions] |
| Baseline/current/diff artifact production | API / Backend | Docs/tooling layer | Machine-readable JSON belongs in `artifacts/perf/*.json`, with human-readable summaries in `docs/release/`. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] |

## Standard Stack

### Core

| Library / Tool | Verified Version | Purpose | Why Standard |
|----------------|------------------|---------|--------------|
| `@playwright/test` | `1.59.1` (published 2026-04-01) [VERIFIED: npm registry] | Blocking browser E2E for release UAT and 100,000+ progressive upward scroll validation | Already installed in the repo; official docs support auth-state reuse, JSON/HTML reporters, and polling assertions needed for history integrity checks. [VERIFIED: codebase read] [CITED: https://playwright.dev/docs/auth] [CITED: https://playwright.dev/docs/test-reporters] [CITED: https://playwright.dev/docs/test-assertions] |
| `artillery` | `2.0.30` (published 2026-02-05) [VERIFIED: npm registry] | Perf-lite smoke scenarios, Socket.IO/HTTP load generation, threshold-enforced pass/fail, JSON output | Official docs cover Socket.IO support, JSON report output, and `ensure` threshold failures with non-zero exit codes, which maps directly to blocking release gates. [CITED: https://www.artillery.io/docs/reference/engines/socketio] [CITED: https://www.artillery.io/docs/reference/cli/run] [CITED: https://www.artillery.io/docs/reference/extensions/ensure] |
| `socket.io-client` | `4.8.3` (published 2025-12-23) [VERIFIED: npm registry] | Thin product-aware latency probe for `message-created` and `presence` timing against the live server contract | The application already uses Socket.IO, and the gateways expose stable event names that a Node probe can measure without inventing a second transport. [VERIFIED: codebase read] |

### Supporting

| Library / Tool | Verified Version | Purpose | When to Use |
|----------------|------------------|---------|-------------|
| `vitest` | `4.1.4` (published 2026-04-09) [VERIFIED: npm registry] | Fast unit tests for artifact reducers, diff logic, and threshold evaluators | Use for non-browser validation around JSON artifact generation and regression comparison logic. [VERIFIED: codebase read] |
| `docker compose` | Local CLI `29.4.0` [VERIFIED: local command] | Blocking startup gate and release precondition | Reuse before any perf or browser evidence; do not run expensive checks against a stack that has not passed startup/health gating. [VERIFIED: codebase read] |
| `node` / `pnpm` | Local CLI `v25.9.0` / `10.9.0` [VERIFIED: local command] | Runtime for reducers, probes, and package-managed scripts | Use Node scripts for JSON reduction and release-summary generation instead of shell-only parsing. [VERIFIED: local command] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `artillery` perf-lite smoke | Custom shell loops and ad hoc `curl` floods | Reject this. You lose maintained Socket.IO support, JSON reports, and built-in threshold failure semantics. [CITED: https://www.artillery.io/docs/reference/engines/socketio] [CITED: https://www.artillery.io/docs/reference/cli/run] [CITED: https://www.artillery.io/docs/reference/extensions/ensure] |
| Playwright for all performance work | Real-browser load generation only | Reject this for the blocking perf-lite gate. Browser-level proof is required for `PERF-02`, but using Playwright as the main load tool would make the smoke gate heavier and less repeatable. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] [ASSUMED] |
| Raw SQL-only history seeding | Service/repository-backed seed helper | Raw SQL is faster, but it risks bypassing message invariants unless the schema and watermark rules are mirrored exactly. Prefer a dedicated seed helper that still writes valid message rows deterministically. [VERIFIED: codebase read] [ASSUMED] |

**Installation**

```bash
pnpm add -D artillery@2.0.30
```

If the product-aware latency probe lives outside `apps/web`, also add a root-level `socket.io-client` devDependency or colocate the probe with the existing web dependency to avoid workspace-resolution ambiguity. [VERIFIED: codebase read] [ASSUMED]

## Architecture Patterns

### System Architecture Diagram

```text
release-gate.sh
  |
  +--> qa/startup gate
  |      |
  |      +--> docker compose config/up --wait
  |      +--> phase1-offline-check.sh
  |
  +--> perf seed step
  |      |
  |      +--> create dedicated perf users/room
  |      +--> seed 10k / 100k history dataset
  |
  +--> perf-lite smoke
  |      |
  |      +--> Artillery HTTP + Socket.IO scenarios
  |      +--> ensure thresholds
  |      +--> artifacts/perf/current-artillery.json
  |
  +--> p95 business-event probe
  |      |
  |      +--> REST send/getPresence trigger
  |      +--> socket.io-client observer receives message-created / presence
  |      +--> reducer writes current/baseline/diff JSON
  |
  +--> browser integrity gate
  |      |
  |      +--> Playwright auth setup
  |      +--> 100k+ upward-scroll history spec
  |      +--> JSON + HTML reports
  |
  +--> release summary
         |
         +--> docs/release/*.md
         +--> artifacts/perf/baseline.json
         +--> artifacts/perf/current.json
         +--> artifacts/perf/diff.json
         +--> non-zero exit on any gate failure
```

### Recommended Project Structure

```text
scripts/
  qa/
    release-gate.sh            # orchestrates strict blocking order
  perf/
    perf-lite.yml              # Artillery scenarios
    probe-latency.ts           # socket.io-client product-aware p95 probe
    seed-history.ts            # deterministic 10k / 100k dataset seeding
    reduce-artifacts.ts        # baseline/current/diff synthesis

artifacts/
  perf/
    baseline.json
    current.json
    diff.json
    artillery-raw.json
    playwright-results.json

docs/
  release/
    phase-10-release-gate.md
    perf-baseline.md

e2e/
  perf/
    history-100k.spec.ts       # PERF-02 blocking Playwright spec
```

### Pattern 1: Split transport smoke from business-event latency

**What:** Use Artillery for repeatable perf-lite pressure and threshold failures, but measure release-blocking p95 latency for message delivery and presence propagation with a product-aware Node observer that speaks the same Socket.IO contract as the app. [CITED: https://www.artillery.io/docs/reference/extensions/ensure] [CITED: https://www.artillery.io/docs/reference/engines/socketio] [VERIFIED: codebase read]

**When to use:** Any gate that must distinguish "HTTP request completed" from "another connected client observed the realtime effect." [VERIFIED: codebase read]

**Why:** The current message write path is REST-based and only becomes visible to peers after `MessagesGateway.broadcastMessageCreated()`, while presence is emitted via `AppGateway` websocket events. Measuring only REST completion would under-measure the user-visible latency path. [VERIFIED: codebase read]

### Pattern 2: Seed large history outside the browser, validate it inside the browser

**What:** Generate the 100,000+ history dataset with a deterministic seed helper, then let Playwright validate the UI contract over that dataset. [VERIFIED: codebase read] [ASSUMED]

**When to use:** `PERF-02` and any regression test where dataset size matters more than end-user message composition behavior. [VERIFIED: `.planning/REQUIREMENTS.md`]

**Why:** The existing browser test only seeds 65 messages and the UI paginates by watermark-based history pages. Scaling dataset creation through the browser would add avoidable runtime and flake to a gate whose real purpose is scroll integrity. [VERIFIED: codebase read] [ASSUMED]

### Pattern 3: Make artifacts first-class outputs, not console side effects

**What:** Every gate writes machine-readable JSON and the final reducer writes `baseline`, `current`, and `diff` artifacts plus a short release doc. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`]

**When to use:** Always in this phase. These paths are locked decisions, not optional niceties. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`]

**Why:** Artillery can already write JSON output, Playwright can already write JSON reporter output, and the phase requires machine-readable regression evidence. [CITED: https://www.artillery.io/docs/reference/cli/run] [CITED: https://playwright.dev/docs/test-reporters]

### Pattern 4: Reuse Playwright auth-state support instead of bespoke cookie handling

**What:** Move Phase 10 browser auth state into a dedicated ignored auth directory and drive the new history-scale spec from stored browser state. [CITED: https://playwright.dev/docs/auth]

**When to use:** All new blocking Playwright specs for this phase. [CITED: https://playwright.dev/docs/auth]

**Why:** Official Playwright guidance recommends filesystem-backed auth state reuse and warns that state files contain sensitive cookies and headers. [CITED: https://playwright.dev/docs/auth]

### Anti-Patterns to Avoid

- **Single-tool absolutism:** Do not force Artillery to prove browser DOM integrity, and do not force Playwright to be the main perf-lite load generator. Use each tool for its natural tier. [CITED: https://www.artillery.io/docs/reference/engines/socketio] [CITED: https://playwright.dev/docs/test-assertions] [ASSUMED]
- **Console-only evidence:** A passing terminal log with no JSON artifacts violates the locked artifact contract. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`]
- **Release gate reordering:** Startup gate must run before perf and browser gates, because existing smoke scripts establish the fresh-clone contract. [VERIFIED: codebase read]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Perf-lite concurrency runner | Bash loops around `curl`, homegrown websocket spammers | Artillery scenarios plus `ensure` thresholds | Maintained Socket.IO engine, JSON report output, and non-zero threshold failure are already available. [CITED: https://www.artillery.io/docs/reference/engines/socketio] [CITED: https://www.artillery.io/docs/reference/cli/run] [CITED: https://www.artillery.io/docs/reference/extensions/ensure] |
| Browser release/UAT framework | A second browser tool or bespoke Puppeteer harness | Playwright only | TEST-01 already locks browser automation to Playwright, and the repo already has config, helpers, and global setup. [VERIFIED: `.planning/REQUIREMENTS.md`] [VERIFIED: codebase read] |
| Auth-state bootstrapping for browser tests | Manual cookie-file munging as the primary pattern | Playwright `storageState` setup project / auth files | Official guidance already covers persistent auth state and associated safety constraints. [CITED: https://playwright.dev/docs/auth] |
| Threshold exit logic | Custom shell parsing of console text | Artillery `ensure` plus a Node reducer for multi-artifact gates | Threshold semantics should fail cleanly and predictably in CI. `ensure` already exits non-zero on failures. [CITED: https://www.artillery.io/docs/reference/extensions/ensure] |
| 100k-history DOM assertions | Screenshot-only comparisons or "it scrolled" checks | Watermark-aware Playwright assertions against loaded rows | Current UI and API already expose watermark metadata, which is a better correctness signal than screenshots alone. [VERIFIED: codebase read] [CITED: https://playwright.dev/docs/test-assertions] |

**Key insight:** The only custom code Phase 10 should add is product-specific orchestration and measurement glue. The scheduler, browser runner, auth-state reuse, and threshold-failure semantics should come from maintained tools. [CITED: https://www.artillery.io/docs/reference/extensions/ensure] [CITED: https://playwright.dev/docs/auth]

## Common Pitfalls

### Pitfall 1: Measuring the wrong latency path

**What goes wrong:** The gate records REST `POST /messages/...` completion time and calls it "message delivery latency." [VERIFIED: codebase read]

**Why it happens:** The write path is REST, but user-visible completion happens only when another connected client receives `message-created`. Presence has the same issue: the business event is the `presence` response, not just the trigger call. [VERIFIED: codebase read]

**How to avoid:** Split request pressure from observer timing. Keep an observer socket connected and timestamp the triggering action and the received event. [VERIFIED: codebase read]

**Warning signs:** Very low latencies that never correlate with realtime regressions, or failures that show HTTP success while peer clients visibly lag. [ASSUMED]

### Pitfall 2: Breaking cookie auth in Artillery Socket.IO scenarios

**What goes wrong:** The perf script switches Artillery to websocket-only transport and then tries to pass session cookies via `extraHeaders`, so auth silently stops working. [CITED: https://www.artillery.io/docs/reference/engines/socketio]

**Why it happens:** Artillery documents that `extraHeaders` only work with the default polling transport. The current gateways authenticate from handshake cookies, not bearer tokens. [CITED: https://www.artillery.io/docs/reference/engines/socketio] [VERIFIED: codebase read]

**How to avoid:** Keep default polling transport for cookie-authenticated Artillery Socket.IO scenarios, or redesign auth for the perf harness explicitly. Do not assume websocket-only transport can carry the cookie header the same way. [CITED: https://www.artillery.io/docs/reference/engines/socketio] [VERIFIED: codebase read]

**Warning signs:** Sudden disconnects, zero valid response metrics, or all virtual users failing after a transport change. [ASSUMED]

### Pitfall 3: Seeding 100,000 messages through the browser

**What goes wrong:** The `PERF-02` test becomes slow, flaky, and dominated by setup time instead of history verification. [ASSUMED]

**Why it happens:** The current Playwright anchor test sends 65 messages through the UI only to force a second page. That pattern does not scale to a six-figure dataset. [VERIFIED: codebase read]

**How to avoid:** Seed the large dataset through a deterministic helper, then let Playwright validate the browser contract only. [VERIFIED: codebase read] [ASSUMED]

**Warning signs:** Multi-minute setup, intermittent browser timeouts before the actual scroll assertions start, and local reluctance to run the gate. [ASSUMED]

### Pitfall 4: Proving "loads older data" without proving integrity

**What goes wrong:** The test only checks that earlier rows appeared, but not that chronology stayed correct or that duplicates/gaps were avoided in the loaded window. [VERIFIED: codebase read]

**Why it happens:** A simple "first watermark got smaller" assertion is necessary but insufficient for a 100,000+ history guarantee. [VERIFIED: codebase read]

**How to avoid:** Assert monotonically increasing `data-watermark` values for the rendered window after every upward load, plus stable newest message and duplicate-free row IDs/text markers. [VERIFIED: codebase read] [ASSUMED]

**Warning signs:** Off-by-one load bugs, repeated bubbles after upward fetch, or row order changes around page boundaries. [ASSUMED]

### Pitfall 5: Committing browser auth artifacts

**What goes wrong:** Session-bearing auth state files end up in git or published artifacts. [CITED: https://playwright.dev/docs/auth]

**Why it happens:** Playwright auth state is convenient, but the official docs warn that those files may contain sensitive cookies and headers. [CITED: https://playwright.dev/docs/auth]

**How to avoid:** Put Phase 10 auth files under an ignored auth directory and keep release artifacts separate from session state. [CITED: https://playwright.dev/docs/auth]

**Warning signs:** Auth JSON files in `git status`, or release-doc jobs uploading session-bearing files. [ASSUMED]

## Code Examples

Verified patterns to adopt directly:

### Artillery perf-lite gate with JSON output and threshold failure

```yaml
# Source: https://www.artillery.io/docs/reference/engines/socketio
# Source: https://www.artillery.io/docs/reference/extensions/ensure
# Source: https://www.artillery.io/docs/reference/cli/run
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5
  socketio:
    path: '/socket.io'
    extraHeaders:
      Cookie: '{{ perf_cookie }}'
  plugins:
    ensure:
      thresholds:
        - 'socketio.response_time.p95': 3000

scenarios:
  - name: room-message-smoke
    engine: socketio
    flow:
      - emit:
          channel: 'joinRoom'
          data:
            roomId: '{{ room_id }}'
      - think: 1
```

Run with JSON artifact output:

```bash
artillery run --output artifacts/perf/artillery-raw.json scripts/perf/perf-lite.yml
```

### Playwright auth-state and JSON reporter configuration

```typescript
// Source: https://playwright.dev/docs/auth
// Source: https://playwright.dev/docs/test-reporters
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  reporter: [['json', { outputFile: 'artifacts/perf/playwright-results.json' }]],
  projects: [
    { name: 'setup', testMatch: /.*\\.setup\\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/perf-user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

### History integrity assertion pattern for the 100k upward-scroll spec

```typescript
// Source: current repo history test + Playwright expect.poll docs
// Verified local anchors:
// - e2e/realtime/history-load.spec.ts
// - apps/web/src/features/messages/MessageTimeline.tsx
// - https://playwright.dev/docs/test-assertions
const rows = page.locator('.msg-timeline li.msg-bubble');

await expect.poll(async () => {
  const watermarks = await rows.evaluateAll((els) =>
    els.map((el) => Number(el.getAttribute('data-watermark')))
  );
  for (let i = 1; i < watermarks.length; i += 1) {
    if (watermarks[i] <= watermarks[i - 1]) return false;
  }
  return true;
}, { timeout: 10_000 }).toBe(true);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Browser E2E as optional/UAT-only proof | Playwright is now the sole allowed browser automation framework via `TEST-01`. [VERIFIED: `.planning/REQUIREMENTS.md`] | Requirement updated 2026-04-20. [VERIFIED: `.planning/REQUIREMENTS.md`] | Phase 10 must not introduce Cypress/Selenium/Puppeteer as a parallel gate path. [VERIFIED: `.planning/REQUIREMENTS.md`] |
| Single-point latency summaries | Locked p95 release gates for message delivery and presence propagation. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] | Phase 10 context dated 2026-04-20. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] | Mean-only reporting is not enough for release decisions. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] |
| Small-page history smoke | 100,000+ progressive upward integrity proof in Playwright. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] | Locked in Phase 10 context on 2026-04-20. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] | Existing `history-load.spec.ts` is an anchor, not the finished gate. [VERIFIED: codebase read] |

**Deprecated/outdated**

- The testing inventory in `.planning/codebase/TESTING.md` still describes API unit/integration tests as Jest-based, while the live package manifest uses Vitest. Prefer the live `package.json` manifests for planning this phase. [VERIFIED: codebase read]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Playwright should stay out of the main perf-lite load-generation role because a real-browser load gate would be heavier and less repeatable than Artillery for v1 smoke. | Standard Stack / Alternatives | The planner could over-invest in browser-driven load and make the release gate too slow. |
| A2 | The 100,000+ history dataset should be seeded outside the browser for operational reliability. | Architecture Patterns / Common Pitfalls | The planner could design an impractical test that is correct in theory but too flaky to run. |
| A3 | Monotonic watermark checks plus duplicate detection are sufficient as the primary UI integrity signal for upward-load windows. | Common Pitfalls / Code Examples | Additional invariants may be needed if the UI virtualizes rows in a way that hides ordering bugs. |

## Open Questions (RESOLVED)

1. **What is the canonical seed path for the 100,000+ room dataset?**
   - Resolution: The canonical path is a repo-root deterministic seed helper at `scripts/perf/seed-history.mjs`, executed before Playwright and writing `artifacts/perf/history-seed-current.json` for the browser proof to consume.
   - Implementation rule: Seed outside the browser and outside ad hoc SQL shells. The helper may use direct PostgreSQL writes if needed for runtime, but it must preserve application-compatible message invariants, monotonic watermarks, and stable room metadata so `e2e/perf/history-100k.spec.ts` proves the real UI contract rather than a one-off fixture hack. [INFERRED from D-1005, D-1006, and codebase read]
   - Planning impact: Phase 10 plans should treat `scripts/perf/seed-history.mjs` as the single supported seed path for the 100,000+ dataset. No alternate browser-seed or internal HTTP-only seed path should appear in execution tasks.

2. **Where should the product-aware latency probe live for dependency resolution?**
   - Resolution: The latency probe lives at repo root as `scripts/perf/probe-latency.mjs`, and Phase 10 installs both `artillery@2.0.30` and `socket.io-client@4.8.3` in the root workspace devDependencies so all perf scripts resolve consistently from one execution surface.
   - Implementation rule: Run the probe from the repo root with Node after the startup gate passes. Do not depend on `apps/web`-local dependency resolution for a release-blocking QA script. [INFERRED from D-1007 and Environment Availability]
   - Planning impact: Package manifest/lockfile work must happen before the first `pnpm exec artillery ...` or `node scripts/perf/probe-latency.mjs ...` verification command in Phase 10.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Perf reducers, probes, Playwright/Artillery execution | yes [VERIFIED: local command] | `v25.9.0` [VERIFIED: local command] | - |
| pnpm | Workspace installs and script execution | yes [VERIFIED: local command] | `10.9.0` [VERIFIED: local command] | - |
| Docker / Compose | Fresh-clone startup gate | yes [VERIFIED: local command] | `29.4.0` [VERIFIED: local command] | - |
| jq | Local artifact inspection only | yes [VERIFIED: local command] | `1.8.1` [VERIFIED: local command] | Node reducer can replace it in automated gates. [VERIFIED: local command] |
| Artillery CLI | Perf-lite smoke gate | no [VERIFIED: local command] | - | Add `artillery@2.0.30` as a devDependency in this phase. [VERIFIED: npm registry] |

**Missing dependencies with no fallback**

- None, provided the phase installs `artillery` as part of the repo toolchain. [VERIFIED: npm registry]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest 4.1.4` for non-browser tests, `@playwright/test 1.59.1` for browser gates. [VERIFIED: npm registry] [VERIFIED: codebase read] |
| Config file | `playwright.config.ts` exists; Vitest is configured through package scripts/package manifests. [VERIFIED: codebase read] |
| Quick run command | `pnpm exec playwright test e2e/realtime/history-load.spec.ts --reporter=line` [VERIFIED: codebase read] |
| Full suite command | `bash scripts/qa/release-gate.sh`, which must run the startup gate, perf-lite smoke, p95 latency probe, the critical Playwright UAT suite, and the dedicated `e2e/perf/history-100k.spec.ts` proof in one blocking chain. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] [INFERRED] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Perf-lite load smoke does not regress beyond the locked p95 thresholds and writes JSON artifacts. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] | integration/perf gate | `pnpm install --frozen-lockfile && pnpm exec artillery run scripts/perf/perf-lite.yml --output artifacts/perf/artillery-current.json` [CITED: https://www.artillery.io/docs/reference/cli/run] | no - Wave 0 |
| PERF-01 | Message delivery and presence propagation p95 are measured from the live websocket observer path. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`] | integration/perf gate | `node scripts/perf/probe-latency.mjs --output artifacts/perf/latency-current.json` [INFERRED from resolved probe location] | no - Wave 0 |
| PERF-02 | A room with 100,000+ messages supports progressive upward loading with chronology/integrity checks. [VERIFIED: `.planning/REQUIREMENTS.md`] | Playwright E2E | `node scripts/perf/seed-history.mjs --count 100000 --output artifacts/perf/history-seed-current.json && pnpm exec playwright test e2e/perf/history-100k.spec.ts --reporter=line` [CITED: https://playwright.dev/docs/test-assertions] | no - Wave 0 |
| OPS-01 / OPS-02 support for release gate | Fresh clone starts via `docker compose up` and the repo avoids runtime dependency drift. [VERIFIED: `.planning/REQUIREMENTS.md`] | smoke/release gate | `scripts/qa/phase1-smoke.sh` and `scripts/qa/phase1-offline-check.sh` [VERIFIED: codebase read] | yes |

### Sampling Rate

- **Per task commit:** Run the smallest affected gate plus any touched unit tests. [ASSUMED]
- **Per wave merge:** Run the new release-gate orchestrator against a local compose stack. [ASSUMED]
- **Phase gate:** Startup gate, perf-lite gate, p95 probe, and 100k Playwright gate all green before `/gsd-verify-work`. [VERIFIED: `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`]

### Wave 0 Gaps

- [ ] `scripts/perf/perf-lite.yml` - Artillery scenario and threshold config for PERF-01.
- [ ] `scripts/perf/probe-latency.mjs` - product-aware observer for `message-created` and `presence`.
- [ ] `scripts/perf/seed-history.mjs` - deterministic 10k / 100k dataset seeding.
- [ ] `scripts/perf/reduce-artifacts.mjs` - baseline/current/diff writer for `artifacts/perf/*.json`.
- [ ] `e2e/perf/history-100k.spec.ts` - blocking Playwright `PERF-02` proof.
- [ ] `scripts/qa/release-gate.sh` - strict orchestration over startup, perf, and browser gates.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes [VERIFIED: codebase read] | Dedicated test users and cookie-authenticated sessions; never bypass auth for perf/browser gates. [VERIFIED: codebase read] |
| V3 Session Management | yes [CITED: https://playwright.dev/docs/auth] | Keep Playwright auth state in ignored files only; do not publish session-bearing artifacts. [CITED: https://playwright.dev/docs/auth] |
| V4 Access Control | yes [VERIFIED: codebase read] | Use the real room/DM membership and presence contracts during probes; do not add privileged test-only bypasses if the gate can reuse existing APIs. [VERIFIED: codebase read] |
| V5 Input Validation | yes [VERIFIED: codebase read] | Validate perf-script inputs and artifact schema in Node/Vitest; reject malformed thresholds and bad room/user IDs early. [VERIFIED: codebase read] [ASSUMED] |
| V6 Cryptography | no strong phase-specific expansion [VERIFIED: codebase read] | Reuse existing session/auth implementation; Phase 10 should not introduce new crypto. [VERIFIED: codebase read] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Checked-in auth state or session artifacts | Information Disclosure | Put auth state under ignored paths and keep release artifacts separate from session files. [CITED: https://playwright.dev/docs/auth] |
| False-green perf gate from transport-only timing | Tampering | Measure peer-observed realtime events, not just request completion. [VERIFIED: codebase read] |
| Gate bypass through optional thresholds | Elevation of Privilege / Tampering | Keep Artillery `ensure` checks strict and propagate non-zero exit codes through the release gate. [CITED: https://www.artillery.io/docs/reference/extensions/ensure] |

## Sources

### Primary (HIGH confidence)

- `npm view @playwright/test version time --json` - verified latest version `1.59.1`, published `2026-04-01`. [VERIFIED: npm registry]
- `npm view artillery version time --json` - verified latest version `2.0.30`, published `2026-02-05`. [VERIFIED: npm registry]
- `npm view socket.io-client version time --json` - verified latest version `4.8.3`, published `2025-12-23`. [VERIFIED: npm registry]
- `npm view vitest version time --json` - verified latest version `4.1.4`, published `2026-04-09`. [VERIFIED: npm registry]
- https://www.artillery.io/docs/reference/engines/socketio - Socket.IO engine support, `extraHeaders`, `transports`, response metrics, mixed HTTP + Socket.IO scenarios. [CITED: https://www.artillery.io/docs/reference/engines/socketio]
- https://www.artillery.io/docs/reference/extensions/ensure - threshold checks and non-zero failure semantics. [CITED: https://www.artillery.io/docs/reference/extensions/ensure]
- https://www.artillery.io/docs/reference/cli/run - JSON output support via `--output`. [CITED: https://www.artillery.io/docs/reference/cli/run]
- https://playwright.dev/docs/auth - auth-state reuse and security constraints. [CITED: https://playwright.dev/docs/auth]
- https://playwright.dev/docs/test-reporters - JSON reporter output. [CITED: https://playwright.dev/docs/test-reporters]
- https://playwright.dev/docs/test-assertions - retrying assertions and `expect.poll`. [CITED: https://playwright.dev/docs/test-assertions]
- Local code and planning artifacts:
  - `playwright.config.ts`
  - `e2e/global-setup.ts`
  - `e2e/helpers/ui-helpers.ts`
  - `e2e/realtime/history-load.spec.ts`
  - `scripts/qa/phase1-smoke.sh`
  - `scripts/qa/phase1-offline-check.sh`
  - `infra/compose/compose.yaml`
  - `apps/api/src/messages/messages.gateway.ts`
  - `apps/api/src/ws/app.gateway.ts`
  - `apps/api/src/messages/messages.controller.ts`
  - `apps/api/src/messages/messages.service.ts`
  - `apps/web/src/lib/api.ts`
  - `.planning/REQUIREMENTS.md`
  - `.planning/phases/10-performance-qa-and-release-hardening/10-CONTEXT.md`
  [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)

- None.

### Tertiary (LOW confidence)

- None beyond the explicit assumptions listed above.

## Metadata

**Confidence breakdown**

- Standard stack: HIGH - package versions were registry-verified and the critical tool capabilities were checked in official docs. [VERIFIED: npm registry] [CITED: official docs above]
- Architecture: HIGH - the recommended split follows locked Phase 10 decisions and the current repo's actual REST/websocket/history contracts. [VERIFIED: codebase read]
- Pitfalls: HIGH - the main risks are directly exposed by the existing auth, websocket, and history implementations plus official tool constraints. [VERIFIED: codebase read] [CITED: official docs above]

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 for repo-specific structure; re-verify package versions and Artillery/Playwright docs if planning starts later than 30 days from this research date. [VERIFIED: npm registry] [CITED: official docs above]
