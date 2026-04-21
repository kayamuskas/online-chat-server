---
phase: 2
slug: authentication-core
status: partial
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
updated: 2026-04-21
---

# Phase 2 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | API tests plus Phase 2 auth smoke harness |
| **Primary runtime under test** | `apps/api` + `apps/web` + Compose-mounted mock mail outbox |
| **Quick run command** | `pnpm --filter @chat/api test` |
| **Full suite command** | `scripts/qa/phase2-auth-smoke.sh` |
| **Estimated runtime** | ~30-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task’s `<automated>` command.
- **After every backend plan:** Run the API auth test command for the changed slice.
- **After Plan 03:** Confirm mail outbox artifact generation plus log-path visibility.
- **After Plan 04 / before `$gsd-verify-work`:** Run `scripts/qa/phase2-auth-smoke.sh`.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan/Task | Wave | Requirements | Threat Ref(s) | Secure Behavior | Test Type | Automated Command | Evidence Path | Status |
|---------|-----------|------|--------------|---------------|-----------------|-----------|-------------------|---------------|--------|
| 02-01-01 | 01 / Task 1 | 1 | AUTH-01, AUTH-02, AUTH-06 | T-02-01 | Auth schema is deterministic, durable, and enforces uniqueness plus reset-token persistence. | static | `rg -n "create table|users|sessions|password_reset|unique|username|email" apps/api/src/db/migrations/0001_auth_core.sql && rg -n "POSTGRES_HOST|POSTGRES_PORT|POSTGRES_DB|POSTGRES_USER|POSTGRES_PASSWORD" packages/shared/src/config.ts apps/api/src/db/postgres.service.ts apps/api/src/db/db.module.ts` | `apps/api/src/db/*`, `packages/shared/src/config.ts` | ✅ green |
| 02-01-02 | 01 / Task 2 | 1 | AUTH-03, AUTH-04, AUTH-05 | T-02-02, T-02-03 | Password hashing stays centralized and session-duration semantics match the locked Phase 2 rules exactly. | unit/static | `rg -n "24|30|keep|persistent|idle|browser" apps/api/src/auth/session-policy.ts apps/api/src/__tests__/auth/session-policy.spec.ts && rg -n "hash|verify|password" apps/api/src/auth/passwords.ts apps/api/src/__tests__/auth/passwords.spec.ts` | `apps/api/src/auth/passwords.ts`, `apps/api/src/auth/session-policy.ts`, auth helper tests | ✅ green |
| 02-02-01 | 02 / Task 1 | 2 | AUTH-01, AUTH-02, AUTH-03, AUTH-05 | T-02-04, T-02-05 | Register/sign-in/current-user enforce uniqueness, hide secrets, and issue durable per-browser sessions. | integration | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/auth/register-login.spec.ts` | `apps/api/src/auth/*`, register/login tests | ✅ green |
| 02-02-02 | 02 / Task 2 | 2 | AUTH-04 | T-02-05, T-02-06 | Current-session sign-out invalidates only the presented session and uses shared guard/decorator plumbing. | integration | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/auth/logout.spec.ts` | `apps/api/src/auth/*`, logout tests | ✅ green |
| 02-03-01 | 03 / Task 1 | 3 | AUTH-06, OPS-04 | T-02-07, T-02-09 | Reset-link flow is server-validated, writes QA-visible local artifacts, and exposes artifact paths through logs. | integration/smoke | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/auth/password-reset.spec.ts` | reset/mail services, compose mount, docs | ❌ red |
| 02-03-02 | 03 / Task 2 | 3 | AUTH-07 | T-02-08 | Password change requires authenticated current session and current-password verification. | integration | `cd apps/api && ./node_modules/.bin/vitest run src/__tests__/auth/change-password.spec.ts` | change-password service/tests | ❌ red |
| 02-04-01 | 04 / Task 1 | 4 | AUTH-01, AUTH-03, AUTH-05, AUTH-06 | T-02-10 | Shipped web app uses the locked auth shell with sign-in/register/forgot-password switching and visible keep-signed-in control. | static/UI | `rg -n "Sign in|Register|Forgot password|Keep me signed in" apps/web/src/App.tsx apps/web/src/features/auth/AuthShell.tsx apps/web/src/features/auth/SignInView.tsx apps/web/src/features/auth/RegisterView.tsx apps/web/src/features/auth/ForgotPasswordView.tsx` | `apps/web/src/features/auth/*`, `apps/web/src/App.tsx` | ✅ green |
| 02-04-02 | 04 / Task 2 | 4 | AUTH-04, AUTH-07 | T-02-11, T-02-12 | Logged-in web UI exposes only Phase 2 account actions and the phase ships with a smoke harness + complete validation map. | smoke/static | `rg -n "password|sign out|current session" apps/web/src/features/account/PasswordSettingsView.tsx apps/web/src/features/account/SessionActionsView.tsx apps/web/src/App.tsx && test -f scripts/qa/phase2-auth-smoke.sh && rg -n "02-01-01|02-01-02|02-02-01|02-02-02|02-03-01|02-03-02|02-04-01|02-04-02|T-02-01|T-02-09" .planning/phases/02-authentication-core/02-VALIDATION.md` | account UI, smoke script, validation doc | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Verification Artifacts Created By The Plans

- `apps/api/src/db/migrations/0001_auth_core.sql` - auth schema/bootstrap under test
- `apps/api/src/__tests__/auth/*` - helper and auth-flow backend coverage
- `apps/api/src/mail/mock-mail.service.ts` - local mail artifact generation
- `infra/compose/compose.yaml` - mounted mail outbox path for QA visibility
- `apps/web/src/features/auth/*` - shipped auth shell
- `apps/web/src/features/account/*` - minimal logged-in Phase 2 account actions
- `scripts/qa/phase2-auth-smoke.sh` - end-to-end Phase 2 auth smoke coverage

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QA can inspect a generated reset mail artifact from the mounted directory and follow the reset link flow manually | AUTH-06, OPS-04 | Needs human confirmation of artifact discoverability and legibility, not just generation | Trigger reset request, inspect the mounted outbox directory, confirm logs point to the artifact, then complete the reset from the generated link. |
| Browser-close semantics for non-persistent login | AUTH-05 | Browser cookie/session behavior is partly runtime/browser-specific | Sign in without `Keep me signed in`, close the browser, reopen, and confirm the session is gone or expires within the approved 24h cap. |

Manual UAT status on 2026-04-18: both manual-only checks passed in `02-HUMAN-UAT.md`.

Focused validation audit on 2026-04-21:
- `register-login.spec.ts`, `logout.spec.ts`, `passwords.spec.ts`, and `session-policy.spec.ts` are green.
- `password-reset.spec.ts` still has a failing `confirmReset` assertion.
- `change-password.spec.ts` still has failing service/controller assertions.
- `db-schema.spec.ts` still depends on missing local Postgres env vars and was not treated as a phase blocker.

---

## Validation Sign-Off

- [x] All planned tasks have `<automated>` verification.
- [x] Sampling continuity: every plan has at least one direct validation command.
- [x] Validation artifacts map to concrete plan outputs.
- [x] No Wave 0 placeholders remain.
- [x] Feedback latency target is under 120 seconds for per-task checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** partial — core auth/register/session validation is green, but password-reset and change-password focused specs still need repair before this phase can be marked complete
