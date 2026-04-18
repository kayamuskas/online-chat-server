# Phase 2: Authentication Core - Research

**Researched:** 2026-04-18  
**Domain:** account registration, password auth, durable sessions, password reset, mock mail delivery  
**Confidence:** MEDIUM

## User Constraints

These are locked by `02-CONTEXT.md`, project docs, and the source requirements. [VERIFIED: `.planning/phases/02-authentication-core/02-CONTEXT.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `requirements/requirements_raw.md`]

- The shipped auth UX uses a single sign-in screen with links that switch to register and forgot-password views within the same auth shell. [VERIFIED: `02-CONTEXT.md`]
- `Keep me signed in` is optional and visible.
- Without `Keep me signed in`, the session ends on browser close or after 24 hours, whichever comes first.
- With `Keep me signed in`, the session uses a 30-day idle timeout.
- Password reset must use an emailed reset link.
- Mock mail must be written as structured files to a local mounted directory, and logs must expose the artifact path.
- Current-session sign-out belongs to Phase 2; broader multi-session management is deferred to Phase 3.
- Email verification is not required.
- Offline startup and local-only dependencies remain non-negotiable. [VERIFIED: `.planning/PROJECT.md`, `docs/offline-runtime.md`]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Register with unique email, unique username, and password. [VERIFIED: `.planning/REQUIREMENTS.md`] | Use a durable `users` table plus unique indexes for email and username, with explicit API-level conflict handling. [INFERRED from requirement + PostgreSQL constraint] |
| AUTH-02 | Username remains immutable after registration. [VERIFIED: `.planning/REQUIREMENTS.md`] | Treat username as write-once at creation and exclude username mutation paths from Phase 2 handlers and UI. |
| AUTH-03 | Sign in with email and password. [VERIFIED: `.planning/REQUIREMENTS.md`] | Prefer opaque server-side sessions stored durably in PostgreSQL and delivered via `HttpOnly` cookie rather than JWT, because current-session logout and later session inventory need revocable per-browser records. [INFERRED] |
| AUTH-04 | Sign out only the current browser session. [VERIFIED: `.planning/REQUIREMENTS.md`] | Model each browser session as its own persisted session row keyed by a random session token so current-session revocation is a targeted delete/invalidate. [INFERRED] |
| AUTH-05 | Login persists across browser close/reopen. [VERIFIED: `.planning/REQUIREMENTS.md`] | Distinguish session policy by the `Keep me signed in` choice: session cookie + 24h cap when false, persistent cookie + 30-day idle timeout when true. [VERIFIED: `02-CONTEXT.md`] |
| AUTH-06 | User can reset password. [VERIFIED: `.planning/REQUIREMENTS.md`] | Persist reset tokens server-side, send only a reset link by mock mail, and consume the token through a dedicated reset-confirm endpoint. [VERIFIED: `02-CONTEXT.md`] |
| AUTH-07 | Logged-in user can change password. [VERIFIED: `.planning/REQUIREMENTS.md`] | Provide an authenticated password-change endpoint and minimal logged-in settings UI. |
| OPS-04 | SMTP-dependent flows can run against mocks or local test doubles. [VERIFIED: `.planning/REQUIREMENTS.md`] | Implement filesystem-backed mail artifacts plus log lines containing the file path; mount the output directory into the API container. [VERIFIED: `02-CONTEXT.md`] |

## Summary

Phase 2 should introduce the first real product state in the repository: users, sessions, password-reset tokens, and a QA-visible mail outbox. The repo already has the right macro-foundation for this: a Nest API, React web app, PostgreSQL/Redis compose stack, and shared runtime config. What does not exist yet is any persistence layer, migration discipline, auth module, cookie/session handling, or writable app volume for mock mail. [VERIFIED: repo scan]

The most important planning decision is to use **server-side opaque sessions backed by PostgreSQL**, not JWTs. The requirement that sign-out affect only the current browser session, plus the Phase 3 need for active-session inventory with browser/IP details, strongly favors one durable session record per browser/session. JWTs would make targeted revocation, idle-time refresh, and future session listing more awkward than necessary in this codebase. [INFERRED from `AUTH-04`, `AUTH-05`, Phase 3 roadmap]

The second key decision is to keep the initial persistence layer **pragmatic and local to the current stack**. The repo already has `pg` installed but no ORM or migration tool. For Phase 2 planning, the lowest-risk path is a small Postgres access layer plus checked-in SQL migrations/bootstrap scripts owned by the API package. This keeps Phase 2 focused on auth behavior instead of introducing a new infrastructure framework and forcing a whole-repo data-layer migration before user value appears. [VERIFIED: `apps/api/package.json`, repo scan]

The mail requirement should be treated as an **artifact generation problem**, not as infrastructure. The system does not need SMTP, preview UIs, or external doubles. It only needs deterministic reset-link generation, structured mail files in a mounted directory, and logs that point QA to the artifact path. Compose currently runs the API container as read-only, so the plan must introduce one narrowly scoped writable mount for mail output rather than weakening the broader read-only container posture. [VERIFIED: `infra/compose/compose.yaml`, `02-CONTEXT.md`]

**Primary recommendation:** break Phase 2 into four plans: persistence/auth foundations, backend auth/session flows, password reset + mock mail + password change, and web auth/settings UX with phase validation. This preserves dependency order, keeps current-session and future multi-session concerns cleanly separated, and gives the frontend stable auth surfaces before it replaces the Phase 1 shell. [INFERRED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User records and uniqueness | PostgreSQL | API | Email/username uniqueness must be enforced durably, not only in memory. |
| Password hashing and verification | API | PostgreSQL | Hashing belongs in the API; only the resulting hash is stored. |
| Durable browser sessions | PostgreSQL | API | Session rows must survive restart and support later inventory/revocation use cases. |
| Session cookie issuance and clearing | API | Browser | Cookie semantics live at the HTTP boundary, not in the database. |
| Password reset token generation/consumption | API | PostgreSQL | Server-generated random tokens plus durable consumption tracking keep resets deterministic and auditable. |
| Mock mail artifact output | API + local volume | Host filesystem | QA needs a visible filesystem artifact without any external mail system. |
| Auth shell and password UI | Web | API | React owns the UX shell; the API owns auth truth and cookie state. |

## Standard Stack

### Core

| Library / Tool | Current State | Purpose | Recommendation |
|----------------|--------------|---------|----------------|
| NestJS in `apps/api` | already present | REST API and auth module composition | Extend the existing Nest app rather than introducing a parallel server stack. |
| React + Vite in `apps/web` | already present | Auth and settings UX | Replace the Phase 1 status shell with the real auth shell in this phase. |
| `pg` | already present | PostgreSQL access | Use it for a narrow Phase 2 data layer and SQL migrations/bootstrap. |
| PostgreSQL service in Compose | already present | Durable user/session/reset storage | Keep PostgreSQL as source of truth for auth state. |
| Node `crypto` | standard library | Token generation and hashing helpers | Use secure random token generation for sessions/reset links. |

### Supporting

| Concern | Recommendation | Why |
|---------|----------------|-----|
| Password hashing | Add one dedicated password-hash library and wrap it behind an auth service boundary | The implementation should be replaceable and testable; raw hashing calls should not leak through controllers. |
| Session cookie policy | Centralize cookie creation/clearing in one auth HTTP helper | Session-expiry rules are phase-locked and must not drift across handlers. |
| Database bootstrap | Add checked-in SQL migrations plus a small runner or bootstrap entrypoint | There is no migration framework yet, but the schema must still be deterministic for QA. |
| Mail artifact schema | Store one structured file per generated mail in a predictable outbox directory | QA discovery and log linking both become straightforward. |

## Architecture Patterns

### Pattern 1: Opaque Server-Side Session Records

**What:** Persist one session row per browser/session, keyed by a random server-issued token and mirrored to a cookie sent to the browser.

**When to use:** For sign-in, auth lookup, current-session sign-out, and the future Phase 3 active-session inventory.

**Why this fits:** Current-browser-only sign-out is naturally a targeted invalidation of the current session row. Phase 3 can later add browser/IP metadata and session listing without replacing the core auth mechanism.

### Pattern 2: Write-Once Identity, Mutable Profile Boundary

**What:** Email and password may be updated through controlled flows; username is created once and never mutated afterward.

**When to use:** Registration, profile/account forms, and backend validation.

**Why this fits:** The requirements explicitly lock username immutability, and keeping it out of later mutation handlers reduces accidental drift.

### Pattern 3: Reset-Link Outbox Files

**What:** On reset-request, the API generates a reset token, persists a token record, writes a structured mail file containing reset-link metadata to a mounted outbox directory, and logs the artifact path.

**When to use:** Password reset and any later auth mail flow that must remain SMTP-free.

**Why this fits:** It satisfies OPS-04 directly while preserving offline startup and avoiding any extra preview service in Phase 2.

### Pattern 4: Minimal Authenticated Settings Surface

**What:** After login, expose only the minimum authenticated UI needed for Phase 2: password change and current-session sign-out.

**When to use:** Phase 2 web implementation.

**Why this fits:** It satisfies `AUTH-07` and `AUTH-04` without prematurely shipping the full classic chat shell that belongs to Phase 9.

## Phase Risks And Planning Implications

| Risk | Why It Matters | Planning Response |
|------|----------------|------------------|
| No existing DB/migration layer | Auth cannot ship without deterministic schema bootstrap | Plan 01 must establish schema ownership and migration/bootstrap flow before endpoints. |
| Read-only API container | Mock mail files cannot be written under the current compose policy | Plan 03 must add one explicit writable outbox mount instead of weakening container posture globally. |
| Session semantics can conflict with Phase 3 | Bad Phase 2 shortcuts can block future session inventory/IP tracking | Keep session records durable and per-browser from day one. |
| Phase 1 web shell is not product UI | Auth UX requires replacing the current placeholder app | Put the shipped auth shell in the final plan after backend APIs stabilize. |

## Recommended Plan Breakdown

1. **Plan 01 — Auth persistence and security primitives**
   Create SQL schema/bootstrap, API-side DB access, password-hash helpers, session policy helpers, and test scaffolding for auth.

2. **Plan 02 — Registration, sign-in, and current-session sign-out**
   Add auth module/controllers/services, enforce uniqueness and immutable username rules, issue/clear session cookies, and expose current-user/session endpoints.

3. **Plan 03 — Password reset, password change, and mock mail outbox**
   Implement reset-link flows, authenticated password change, filesystem-backed mock mail, compose mount changes, and QA-visible logging.

4. **Plan 04 — Web auth shell and phase validation**
   Replace the Phase 1 web shell with the locked auth UX, add minimal authenticated settings UX, and create Phase 2 validation/smoke coverage.

## Research Conclusion

Phase 2 is best treated as the project’s first durable application slice, not as just “some endpoints plus forms.” The durable session model, filesystem outbox, and auth UI shell each need to be shaped now so later phases can extend them instead of replacing them. The repo already has enough infrastructure to do that cleanly if the plan establishes schema/bootstrap first, then backend auth flows, then password/mail workflows, then frontend integration and validation.

