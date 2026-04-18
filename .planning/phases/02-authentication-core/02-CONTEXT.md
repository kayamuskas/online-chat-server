# Phase 2: Authentication Core - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement account registration, sign-in, current-session sign-out, durable login behavior, password reset, password change, and mockable mail behavior for QA. Multi-session management remains out of scope for this phase except where Phase 2 choices must preserve compatibility with Phase 3 session features.

</domain>

<decisions>
## Implementation Decisions

### Auth entry flow
- **D-01:** The shipped auth experience uses a single sign-in screen as the default entry point.
- **D-02:** Registration and forgot-password are reachable from that screen via links and open as separate dedicated views within the same auth shell, matching the prototype direction rather than a split sign-in/register layout.
- **D-03:** The auth shell should follow the existing prototype direction shown in `requirements/desing_v1/components/auth.jsx` Variation A: one centered card, top-right auth navigation, and inline links for secondary actions.

### Session persistence and sign-out behavior
- **D-04:** `Keep me signed in` is optional and visible on the sign-in form.
- **D-05:** If `Keep me signed in` is not selected, the session lasts until the user closes the browser or 24 hours pass, whichever happens first.
- **D-06:** If `Keep me signed in` is selected, the session uses a 30-day idle timeout.
- **D-07:** Phase 2 only needs current-session sign-out UX. “Sign out all other sessions” and broader active-session management are deferred to Phase 3.

### Password lifecycle
- **D-08:** Password reset uses an emailed reset link, not a one-time code flow.
- **D-09:** Logged-in users can change their password from account settings in this phase.
- **D-10:** No email verification is required during registration.

### Mock mail behavior
- **D-11:** Mail delivery for password reset and related auth flows must be mocked without real SMTP.
- **D-12:** Mock mail should be written as structured files into a local mounted directory so QA can inspect generated messages directly.
- **D-13:** Application logs should expose the filesystem path of each generated mail artifact to make QA discovery explicit.

### Phase boundary clarifications
- **D-14:** Multi-session inventory, browser/IP session management UI, and “sign out all other sessions” are intentionally deferred to Phase 3.

### the agent's Discretion
- Exact visual styling inside the established auth shell
- Token/session storage implementation details
- Reset-link token format and expiry length
- Mail file schema, as long as it is structured and QA-readable
- Exact password validation copy beyond the locked product rules

</decisions>

<specifics>
## Specific Ideas

- User wants the auth screen to work like the provided screenshot: one sign-in card, with `Register` and `Forgot password?` available as switches/links from the same auth window.
- Prototype direction to preserve:
  - top bar with logo plus `Sign in` / `Register`
  - centered auth card
  - visible `Keep me signed in` checkbox
  - `Forgot password?` link near password controls
  - `No account yet? Register` link below submit button
- “Filesystem/log capture” for mock mail is acceptable as the QA-facing mechanism; no in-app mail viewer is required for this phase.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authentication requirements
- `requirements/requirements_raw.md` §2.1 — Registration, immutable username, sign-in, current-session sign-out, persistent login, password reset/change, and account removal rules
- `.planning/REQUIREMENTS.md` — Phase mapping for `AUTH-01` through `AUTH-07` and `OPS-04`
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria

### Auth and account UI references
- `requirements/wireframes.md` — Appendix A auth screens and top-level navigation structure
- `requirements/desing_v1/components/auth.jsx` — Auth layout variants; Variation A is the closest locked direction
- `requirements/desing_v1/components/account.jsx` — Password-change and future sessions/account settings reference screens

### Runtime and offline constraints
- `.planning/PROJECT.md` — Project-wide constraints: PostgreSQL, mixed REST/WebSocket, offline QA startup, mocked mail acceptable
- `docs/offline-runtime.md` — Offline-runtime and QA packaging constraints that mail mocking must not violate

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/app.module.ts`: NestJS API root already exists and is ready for auth controllers/modules to be added.
- `apps/web/src/App.tsx`: current web app is only a Phase 1 shell, so Phase 2 can replace it with the first real product-facing auth UI.
- `packages/shared/src/config.ts`: shared runtime config already defines PostgreSQL and service-port expectations that auth infrastructure can reuse.
- `infra/compose/compose.yaml`: existing compose topology already includes the services Phase 2 auth will need to integrate with.

### Established Patterns
- Backend direction is NestJS in `apps/api/`; planner should extend the existing module-based API instead of introducing a separate server pattern.
- Frontend direction is Vite + React in `apps/web/`; planner should translate the wireframe auth flow into the shipped app rather than keeping it as a static prototype-only artifact.
- Queue infrastructure already exists from Phase 1, so any deferred auth work like mocked mail generation can use the established async foundation when useful.
- Offline startup is non-negotiable; any auth dependency, including mail mocking, must remain local-only and Docker-compatible.

### Integration Points
- Auth API will integrate with PostgreSQL-backed persistence via the existing app runtime and compose environment.
- Web auth screens must replace the temporary Phase 1 shell while preserving the known service endpoints and shared contracts.
- Mock mail artifacts must integrate with container volumes/logging so QA can inspect them without external services.
- Phase 2 decisions must avoid boxing in Phase 3 session-management work, especially around durable session records and per-browser session identity.

</code_context>

<deferred>
## Deferred Ideas

- Active-session inventory UI with browser/IP details — Phase 3
- “Sign out all other sessions” action — Phase 3
- Broader multi-session management and targeted session revocation — Phase 3

</deferred>

---

*Phase: 02-authentication-core*
*Context gathered: 2026-04-18*
