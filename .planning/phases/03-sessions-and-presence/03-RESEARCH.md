# Phase 3: Sessions and Presence - Research

**Researched:** 2026-04-18  
**Domain:** active session inventory, targeted session revocation, IP/browser tracking, multi-tab presence, durable `last seen`, runtime-state presence fanout  
**Confidence:** MEDIUM

## User Constraints

These are locked by `03-CONTEXT.md`, project docs, and source requirements. [VERIFIED: `.planning/phases/03-sessions-and-presence/03-CONTEXT.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `requirements/requirements_raw.md`]

- The active-sessions screen should match the provided reference closely: `Device / Browser`, `IP`, `Last active`, per-row `Sign out`, `This browser` badge, and a visible `Sign out all other sessions` action.
- The current browser session is revocable from the same screen; revoking it should immediately return the user to sign-in.
- `Last active` should be shown primarily in humanized form (`now`, `2h ago`, `yesterday`), with exact timestamp as optional secondary detail.
- Presence uses exactly `online`, `AFK`, and `offline`.
- Compact surfaces like contact/chat lists use presence dots without explicit text; detailed surfaces like room/member info show explicit status text such as `(AFK)`.
- `online` is green, `AFK` is muted yellow/amber, `offline` is gray.
- `offline` should also expose textual `last seen`.
- Presence activity should consider mouse, keyboard, focus, and tab visibility signals.
- Presence semantics must stay practical and non-aggressive around tab hibernation/offload and resume.
- Full IPs should be shown, and IP extraction should remain compatible with `X-Forwarded-For`.
- Phase 3 must preserve the Phase 2 opaque-session model rather than replacing it. [VERIFIED: prior phase artifacts]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | User can view active sessions with browser and IP details. [VERIFIED: `.planning/REQUIREMENTS.md`] | Extend the existing `sessions` records with client metadata capture at sign-in, then expose an authenticated inventory endpoint ordered around the current session. [INFERRED from existing schema + context] |
| SESS-02 | User can log out selected sessions without logging out all sessions. [VERIFIED: `.planning/REQUIREMENTS.md`] | Keep revocation at the per-session row level and add separate actions for `revoke one` vs `sign out all other sessions`; never collapse them into a bulk logout primitive. |
| SESS-03 | Contacts and room members show `online`, `AFK`, or `offline` presence. [VERIFIED: `.planning/REQUIREMENTS.md`] | Build shared presence presentation primitives now, and wire them into the first compact-list and detailed-member surfaces available in Phase 3 so later room/contact phases reuse the same rendering contract. [INFERRED from roadmap ordering + design refs] |
| SESS-04 | User becomes `AFK` only after all open tabs are inactive for more than one minute. [VERIFIED: `.planning/REQUIREMENTS.md`, `requirements/requirements_raw.md`] | Presence must aggregate activity across tabs/connections and compute `AFK` from the least-active overall state, not from one tab in isolation. |
| SESS-05 | User is `online` if at least one open tab is active and `offline` only when all tabs are closed/offloaded. [VERIFIED: `.planning/REQUIREMENTS.md`, `requirements/requirements_raw.md`] | Track tab/connection state separately in runtime memory/Redis, then derive user-level presence from the aggregate. |
| SESS-06 | System persists `last seen` while serving live presence from runtime state rather than frequent database reads. [VERIFIED: `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`] | Treat durable `last seen` as a write-on-transition or write-behind event, not as the primary live source; runtime state should answer presence reads. |
| SESS-07 | System tracks user IP addresses for active sessions. [VERIFIED: `.planning/REQUIREMENTS.md`] | Capture normalized client IP at session creation and persist it with session metadata so inventory does not depend on transient request state later. |

## Summary

Phase 3 should build on the Phase 2 opaque-session foundation rather than revisiting identity. The repository already has the correct base model for targeted revocation: one PostgreSQL row per browser session, `last_seen_at`, and current-session-only sign-out. What Phase 3 must add is the rest of the product contract around those rows: browser/IP metadata, current-session awareness, per-session revoke vs `sign out all other sessions`, and runtime presence semantics that aggregate multiple tabs correctly. [VERIFIED: `apps/api/src/auth/session.repository.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/db/migrations/0001_auth_core.sql`]

The most important backend planning decision is to keep **live presence outside PostgreSQL** and use the database only for durable `last seen` and session inventory metadata. The project-level constraints already lock this direction, and the existing architecture research points to Redis as the right home for low-latency ephemeral coordination. Using PostgreSQL as the main live presence source would create frequent writes/reads, make tab-hibernation handling noisier, and directly violate the intended runtime model. [VERIFIED: `.planning/PROJECT.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`]

The second major planning decision is to model presence at the **tab/connection level first**, then aggregate upward to a user presence state. The raw requirements are explicit: one active tab keeps the user `online`; `AFK` starts only when all open tabs are inactive for over one minute; `offline` begins only when all tabs are gone or offloaded. That rules out any single-session or single-socket shortcut. The system needs per-connection heartbeats/activity timestamps plus an aggregation service that answers “what is this user’s current presence?” from the full set. [VERIFIED: `requirements/requirements_raw.md` §2.2]

The biggest product ambiguity is not technical; it is roadmap ordering. Phase 3 owns presence semantics, but full rooms and contacts workflows are scheduled later. The cleanest planning response is to split the work in two layers: (1) build the actual session/presence backend and shared UI primitives now; (2) wire those primitives into the earliest Phase 3 web surfaces that can prove the compact-vs-detailed rendering contract without pulling in full room/contact CRUD. That keeps the scope aligned with the roadmap while still satisfying the locked design direction. [INFERRED from roadmap order + `03-CONTEXT.md`]

**Primary recommendation:** break Phase 3 into four plans: session metadata + inventory/revoke backend, realtime presence engine + durable `last seen`, active-sessions web UI, and presence rendering/validation assets. This preserves dependency order, keeps session management separate from presence aggregation, and makes the validation surface explicit before rooms and contacts expand the UI. [INFERRED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session inventory and revoke truth | PostgreSQL | API | Active sessions and revocation remain durable auth state, not ephemeral cache state. |
| IP/browser/session metadata capture | API | PostgreSQL | Metadata is extracted at request/session creation time and persisted for later inventory reads. |
| Live user presence | Redis / runtime state | API/WebSocket | Presence changes need low-latency fanout and aggregation across tabs without DB polling. |
| Presence activity signal capture | Browser + WebSocket | API | Mouse/keyboard/focus/visibility live in the browser and need a realtime transport to reach the backend. |
| Durable `last seen` | PostgreSQL | API | This is historical account state that must survive restart and disconnect. |
| Session inventory UX | Web | API | UI formatting, confirmation flow, and current-session handling are frontend concerns over API truth. |
| Presence rendering semantics | Web | API/runtime | Backend decides state; frontend decides compact vs detailed presentation according to the locked references. |

## Standard Stack

### Core

| Library / Tool | Current State | Purpose | Recommendation |
|----------------|--------------|---------|----------------|
| NestJS auth module | already present | Session lookup, current-user resolution, authenticated HTTP endpoints | Extend it with session inventory and revoke surfaces rather than creating a parallel account module. |
| Existing `sessions` table | already present | Durable per-browser session rows | Add session metadata columns and preserve row-per-session granularity. |
| NestJS WebSocket gateway | foundation only | Realtime presence transport | Upgrade it from Phase 1 handshake-only behavior to authenticated presence events and fanout. |
| Redis in Compose | already present | Ephemeral presence state and low-latency aggregation | Use it for per-tab/connection activity state rather than pushing live presence into PostgreSQL. |
| React account shell in `apps/web` | already present | Active-sessions UI and phase-scoped presence surfaces | Extend `/account` rather than replacing Phase 2 auth work. |

### Supporting

| Concern | Recommendation | Why |
|---------|----------------|-----|
| Browser labeling | Persist raw user-agent and derive display label server-side or in one helper boundary | Session inventory should not reimplement UA parsing ad hoc in every UI surface. |
| IP extraction | Centralize request-IP extraction with `X-Forwarded-For` handling and direct remote-address fallback | Inventory and audit fields need deterministic, future-safe metadata. |
| Presence timers in tests | Make heartbeat/idle timers configurable for tests | Real one-minute AFK waits are too slow for the validation loop. |
| Revoke propagation | Emit explicit events or rely on fast auth re-checks for current-session invalidation | Current-browser revoke must feel immediate, especially when revoking `This browser`. |
| Humanized time display | Keep one shared formatter for `now / 2h ago / yesterday` plus exact timestamp fallback | The same semantics are required across session and presence surfaces. |

## Architecture Patterns

### Pattern 1: Session Metadata At Creation Time

**What:** When a session row is created, also persist the normalized client IP, raw user-agent, and any derived/session-display metadata the inventory UI depends on.

**When to use:** Session creation, active-session inventory, current-session badge logic, future security/account views.

**Why this fits:** Inventory should not depend on transient per-request data or reverse-engineering browser details after the fact.

### Pattern 2: Targeted Session Revocation As Row-Level Auth Operations

**What:** Treat `revoke this session`, `revoke selected session`, and `sign out all other sessions` as explicit operations over durable session rows tied to the current authenticated user.

**When to use:** Account session management UI and authenticated API endpoints.

**Why this fits:** The Phase 2 model already proved row-level current-session logout; Phase 3 extends it without losing per-session precision.

### Pattern 3: Runtime Presence Aggregator Over Per-Tab State

**What:** Track each tab/connection as its own ephemeral activity record, then compute user-level presence from the aggregate.

**When to use:** Online/AFK/offline decisions, hibernation handling, presence fanout, local latency tests.

**Why this fits:** The raw spec’s “most active tab” and “all tabs inactive for one minute” rules cannot be represented correctly by a single mutable user flag.

### Pattern 4: Durable `Last Seen` On State Transition

**What:** Persist `last seen` when a user transitions to fully offline (or via controlled write-behind), while continuing to answer live presence from runtime state.

**When to use:** Offline transitions, member/contact detail views, reconnect after disconnect.

**Why this fits:** It satisfies durable history without turning the database into a live presence polling target.

### Pattern 5: Shared Presence Presentation Primitives

**What:** One shared UI contract for compact presence (dot only) and detailed presence (dot/text/last-seen detail).

**When to use:** Session/presence web work in Phase 3 and later room/contact/member screens.

**Why this fits:** The user has already locked different rendering rules for compact versus detailed contexts, and later phases should reuse those rules instead of inventing new ones.

## Phase Risks And Planning Implications

| Risk | Why It Matters | Planning Response |
|------|----------------|------------------|
| Session metadata missing today | Inventory cannot show browser/IP details without new capture/persistence work | Plan 01 must add session metadata before UI work starts. |
| IP/header spoofing ambiguity | Full-IP display becomes misleading or unsafe if extraction is ad hoc | Centralize trusted IP extraction with explicit `X-Forwarded-For` fallback rules. |
| Hibernated/offloaded tabs | Users can appear falsely online or AFK if runtime state is not expired cleanly | Plan 02 must use heartbeat/expiry semantics, not only connect/disconnect events. |
| Real one-minute AFK timer is slow to test | Validation loop becomes too slow or flaky | Make timers configurable for local tests while preserving the production one-minute rule. |
| Roadmap order: presence before rooms/contacts | SESS-03 needs UI evidence before later entity workflows exist | Plan 04 should add reusable presence primitives and the minimum Phase 3 surfaces that prove compact and detailed rendering without importing full room/contact feature scope. |

## Recommended Plan Breakdown

1. **Plan 01 — Session metadata, inventory, and revoke backend**
   Extend durable session rows with browser/IP metadata, then add authenticated inventory/revoke/`sign out all other sessions` HTTP surfaces plus focused tests.

2. **Plan 02 — Realtime presence engine and durable `last seen`**
   Add authenticated websocket presence handling, per-tab runtime aggregation, Redis-backed ephemeral state, transition-aware `last seen` persistence, and latency-oriented tests.

3. **Plan 03 — Active sessions web UI**
   Replace the minimal Phase 2 sign-out card with the Phase 3 active-sessions screen, including `This browser`, humanized `Last active`, per-row revoke, and `sign out all other sessions`.

4. **Plan 04 — Presence presentation and validation**
   Add shared compact/detailed presence UI primitives, wire them into the minimum Phase 3 authenticated surfaces needed to prove the contract, and create Phase 3 smoke/validation assets.

## Research Conclusion

Phase 3 is not “just account settings plus a websocket.” It is the point where the project’s auth model, realtime transport, runtime state strategy, and UI semantics all converge. The right shape is to keep session inventory as durable auth state, keep presence as runtime-aggregated ephemeral state, persist only the historical `last seen` boundary, and make the compact-vs-detailed UI contract explicit now so later room/contact phases inherit it cleanly.
