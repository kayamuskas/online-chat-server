---
phase: 02-authentication-core
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - apps/api/package.json
  - apps/api/src/__tests__/auth/change-password.spec.ts
  - apps/api/src/__tests__/auth/db-schema.spec.ts
  - apps/api/src/__tests__/auth/logout.spec.ts
  - apps/api/src/__tests__/auth/password-reset.spec.ts
  - apps/api/src/__tests__/auth/passwords.spec.ts
  - apps/api/src/__tests__/auth/register-login.spec.ts
  - apps/api/src/__tests__/auth/session-policy.spec.ts
  - apps/api/src/app.module.ts
  - apps/api/src/auth/auth.controller.ts
  - apps/api/src/auth/auth.module.ts
  - apps/api/src/auth/auth.service.ts
  - apps/api/src/auth/auth.types.ts
  - apps/api/src/auth/change-password.service.ts
  - apps/api/src/auth/current-user.decorator.ts
  - apps/api/src/auth/current-user.guard.ts
  - apps/api/src/auth/password-reset-token.repository.ts
  - apps/api/src/auth/password-reset.controller.ts
  - apps/api/src/auth/password-reset.service.ts
  - apps/api/src/auth/passwords.ts
  - apps/api/src/auth/session-cookie.ts
  - apps/api/src/auth/session-policy.ts
  - apps/api/src/auth/session.repository.ts
  - apps/api/src/auth/user.repository.ts
  - apps/api/src/db/db.module.ts
  - apps/api/src/db/migrations/0001_auth_core.sql
  - apps/api/src/db/postgres.service.ts
  - apps/api/src/mail/mail.module.ts
  - apps/api/src/mail/mock-mail.service.ts
  - apps/api/src/main.ts
  - apps/api/vitest.config.ts
  - apps/web/src/App.tsx
  - apps/web/src/features/account/PasswordSettingsView.tsx
  - apps/web/src/features/account/SessionActionsView.tsx
  - apps/web/src/features/auth/AuthShell.tsx
  - apps/web/src/features/auth/ForgotPasswordView.tsx
  - apps/web/src/features/auth/RegisterView.tsx
  - apps/web/src/features/auth/SignInView.tsx
  - apps/web/src/lib/api.ts
  - docs/offline-runtime.md
  - infra/compose/compose.yaml
  - scripts/qa/phase2-auth-smoke.sh
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

Phase 2 implements the full authentication core: registration, sign-in, session cookie management, sign-out, password change, and password-reset-by-email. The overall architecture is well-structured — repository pattern, clean service boundaries, parameterised SQL throughout, bcrypt with a sensible work factor, and HttpOnly cookies with SameSite=Strict. The test suite is thorough and the QA smoke script covers the main happy paths.

Three critical issues were found:

1. **Wide-open CORS** — `app.enableCors()` with no origin restriction allows any website to make credentialed cross-origin requests, defeating the SameSite=Strict cookie protection and exposing all auth endpoints to CSRF.
2. **No server-side input validation** — the DTO classes carry no validation decorators, so the API accepts empty strings, excessively long inputs, and structurally invalid emails/passwords at the service layer. There is a client-side minimum-length check in the React forms, but it is trivially bypassed.
3. **Password-reset token mark-used is not atomic with password update** — `markUsed` and `updatePasswordHash` are issued as two separate queries with no transaction wrapper. A race between two concurrent confirm-reset requests with the same token can result in two password updates.

Five warnings and four informational items are documented below.

---

## Critical Issues

### CR-01: CORS configured with no origin restriction

**File:** `apps/api/src/main.ts:24`
**Issue:** `app.enableCors()` is called with no options, which defaults to `origin: "*"` (or reflects the request's `Origin` header depending on the NestJS version). Session cookies are issued with `SameSite=Strict` and `HttpOnly`, which provides strong same-site protection, but wildcard CORS combined with `credentials: "include"` on the frontend client undermines cross-origin isolation. Any attacker-controlled site can drive the browser to make credentialed requests to the API as long as the API echoes back `Access-Control-Allow-Origin` matching the attacker origin. In production this should be constrained to the configured frontend origin.
**Fix:**
```typescript
// main.ts
app.enableCors({
  origin: process.env['ALLOWED_ORIGIN'] ?? 'http://localhost:4173',
  credentials: true,
});
```
Add `ALLOWED_ORIGIN` to the compose environment block (already has `APP_BASE_URL` which is the same value) and to the runtime env contract.

---

### CR-02: No server-side input validation on any auth endpoint

**File:** `apps/api/src/auth/auth.controller.ts:39-54`
**Issue:** `RegisterDto`, `SignInDto`, and `ChangePasswordDto` are plain TypeScript classes with no validation decorators (e.g. `class-validator`). `ValidationPipe` is not registered globally or per-route. This means:
- An empty string `""` is accepted as an email, username, or password and will be hashed and stored.
- A password of 1 byte passes server-side — the 8-character minimum only exists in the React client.
- Extremely long inputs (e.g. a 10 MB password field) will be passed to bcrypt, which can cause a denial-of-service: bcrypt silently truncates at 72 bytes but the overhead before truncation is CPU-bound.
- Structurally invalid emails are stored without normalisation.

The same gap exists in `PasswordResetController` (`ResetRequestDto`, `ResetConfirmDto`).

**Fix:**
```typescript
// Install class-validator and class-transformer
// pnpm add class-validator class-transformer

// main.ts — register globally
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

// RegisterDto
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
```
Apply `@IsString() @MinLength(8) @MaxLength(128)` to all password fields and `@IsString() @IsNotEmpty()` to token fields.

---

### CR-03: Password-reset confirm is not atomic — double-spend race condition

**File:** `apps/api/src/auth/password-reset.service.ts:104-106`
**Issue:** The token mark-used and password update are two independent `UPDATE` statements:
```typescript
await this.resetTokens.markUsed(tokenRecord.id);
await this.users.updatePasswordHash(user.id, newHash);
```
Two concurrent requests with the same token will both pass the `used_at IS NULL` check (both read the row before either write completes), both call `markUsed`, and both call `updatePasswordHash`. The second password update silently wins, allowing an attacker who intercepts or races the reset link to set the password to a value of their choosing even after the legitimate user has already consumed the token.

The fix requires wrapping both operations in a single database transaction, or using an atomic `UPDATE ... WHERE used_at IS NULL RETURNING id` to claim the token, and only proceeding if a row was returned.

**Fix:**
```typescript
// password-reset.service.ts — replace the two-step sequence:

// Option A: atomic claim via returning-update (no transaction needed)
// In PasswordResetTokenRepository, add:
async claimToken(tokenId: string): Promise<boolean> {
  const result = await this.db.query(
    `UPDATE password_reset_tokens
       SET used_at = NOW()
     WHERE id = $1 AND used_at IS NULL
     RETURNING id`,
    [tokenId],
  );
  return result.rowCount === 1;
}

// In PasswordResetService.confirmReset, replace:
await this.resetTokens.markUsed(tokenRecord.id);
await this.users.updatePasswordHash(user.id, newHash);
// With:
const claimed = await this.resetTokens.claimToken(tokenRecord.id);
if (!claimed) {
  throw new BadRequestException('reset token has already been used');
}
await this.users.updatePasswordHash(user.id, newHash);
```

---

## Warnings

### WR-01: TRANSIENT session cookie sends Max-Age, creating a persistent cookie in the browser

**File:** `apps/api/src/auth/session-cookie.ts:56`
**Issue:** The comment on line 55 says "omit maxAge entirely so the browser treats it as a session cookie (cleared on browser close)". The implementation conditionally spreads `{ maxAge: opts.maxAge * 1000 }` only when `opts.persistent` is true — which is correct. However, `SESSION_TRANSIENT_TTL_SECONDS` (86400) is still passed as `opts.maxAge` from `auth.service.ts` line 89, and passed through to `setSessionCookie` as `maxAge: result.cookieMaxAge`. When `persistent: false` the spread is skipped, so the cookie is correctly session-only. This is working correctly, but the test in `logout.spec.ts` line 113 verifies `expect(entry.opts).not.toHaveProperty('maxAge')` which would catch a regression. No bug currently — but the naming is confusing: `cookieMaxAge` in `SignInResult` is used for DB-stored expiry purposes when non-persistent, but the value is meaningless for the cookie itself. This can lead a future maintainer to mistakenly always apply it.

**Fix:** Rename `cookieMaxAge` in `SignInResult` to `sessionMaxAgeSec` or add inline comments at the `setSessionCookie` call site clarifying that `maxAge` is only passed to the cookie when `isPersistent` is true. Consider not returning `cookieMaxAge` at all from `AuthService.signIn` for non-persistent sessions to eliminate the ambiguity.

---

### WR-02: `get` helper in api.ts calls `res.json()` unconditionally — crashes on empty 204 responses

**File:** `apps/web/src/lib/api.ts:70`
**Issue:** The `get<T>` helper calls `await res.json()` without checking for an empty body or 204 status. While the current `GET /auth/me` endpoint never returns 204, the pattern is fragile: if the status is 204 or the body is empty, `res.json()` will throw a SyntaxError that is not caught and will surface as an unhandled promise rejection rather than a typed API error. The `post` helper (line 45) correctly handles this with an early return for 204. The inconsistency will cause silent breakage if any future GET endpoint returns 204 or an empty body.

**Fix:**
```typescript
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
  });

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }

  const data = await res.json();
  // ... rest unchanged
}
```

---

### WR-03: `currentUser.decorator.ts` uses non-null assertion on `request.authContext`

**File:** `apps/api/src/auth/current-user.decorator.ts:21`
**Issue:** `return request.authContext!;` uses a non-null assertion. If `@CurrentUser()` is accidentally used on a route that does not have `@UseGuards(CurrentUserGuard)`, `authContext` will be `undefined` and the assertion will not throw — TypeScript compiles it away — so the handler will receive `undefined` typed as `AuthContext`. Any property access on `ctx.user` in that handler will throw a runtime `TypeError: Cannot read properties of undefined`. There is no runtime guard here.

**Fix:**
```typescript
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<Request & { authContext?: AuthContext }>();
    if (!request.authContext) {
      throw new Error(
        '@CurrentUser() used on a route without @UseGuards(CurrentUserGuard)',
      );
    }
    return request.authContext;
  },
);
```

---

### WR-04: `confirmReset` marks token used before verifying the user exists, but after hashing the new password

**File:** `apps/api/src/auth/password-reset.service.ts:97-106`
**Issue:** The ordering is: (1) find user, (2) throw if not found, (3) hash new password, (4) mark token used, (5) update password hash. If step 5 (`updatePasswordHash`) fails (e.g. a transient DB error), the token has already been consumed (step 4) but the user's password was not changed. The user is now locked out — their old password still works but the reset link is spent. While transient DB errors are uncommon, this is a correctness gap: token consumption should only be committed when the password update succeeds. The atomic approach in CR-03's fix (using a single transaction or the `RETURNING`-based claim) also resolves this ordering issue.

**Fix:** Use a database transaction (via `PostgresService.getClient()`) to wrap both the `markUsed` and `updatePasswordHash` calls, or apply the atomic claim approach described in CR-03.

---

### WR-05: No rate limiting on authentication endpoints

**File:** `apps/api/src/auth/auth.controller.ts` (all POST handlers)
**Issue:** The sign-in endpoint (`POST /auth/sign-in`), password-reset request (`POST /auth/password-reset/request`), and confirm-reset endpoints have no rate limiting. An attacker can issue unlimited sign-in attempts to brute-force passwords, and unlimited reset-request calls to flood the mock mail outbox (or a future real mail service). bcrypt with SALT_ROUNDS=12 provides some natural throttling per attempt, but it does not prevent distributed brute-force or mail flooding. This is a medium-severity security gap for a production deployment.

**Fix:** Add `@nestjs/throttler` as a dependency and configure `ThrottlerGuard` globally or on sensitive endpoints:
```typescript
// app.module.ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])

// auth.controller.ts — on sign-in and password-reset endpoints
@UseGuards(ThrottlerGuard)
```

---

## Info

### IN-01: `PublicUser` type in web client is missing `updated_at` field

**File:** `apps/web/src/lib/api.ts:23-28`
**Issue:** The `PublicUser` interface defined in the web client omits `updated_at` (and uses `createdAt` in camelCase rather than `created_at` as the API returns). The API returns `created_at` and `updated_at` as snake_case Date strings. If any component accesses `user.updated_at` it will get `undefined`. Currently no component uses these fields, so there is no runtime breakage, but the type definition is inconsistent with the server contract and will mislead future authors.

**Fix:** Align the web `PublicUser` type with the server's `PublicUser` shape (or document an explicit camelCase transformation layer):
```typescript
export interface PublicUser {
  id: string;
  email: string;
  username: string;
  created_at: string;
  updated_at: string;
}
```

---

### IN-02: Duplicate index definition on `session_token`

**File:** `apps/api/src/db/migrations/0001_auth_core.sql:40-44`
**Issue:** The migration defines both a `UNIQUE` table constraint (`CONSTRAINT sessions_session_token_unique UNIQUE (session_token)`) and a separate `CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions (session_token)`. In PostgreSQL a `UNIQUE` constraint automatically creates a unique index; the explicit `CREATE UNIQUE INDEX` therefore creates a second, redundant unique index on the same column. This wastes storage and adds unnecessary overhead to INSERT operations.

**Fix:** Remove the explicit `CREATE UNIQUE INDEX idx_sessions_session_token` — the `UNIQUE` constraint on line 40 already provides the required fast lookup. The same pattern (UNIQUE constraint + UNIQUE INDEX) is applied to `password_reset_tokens.token` but the `sessions` duplicate is the more impactful one given the access frequency.

---

### IN-03: `resolveSessionPolicy` in session-policy.ts is exported but untested, while `isCookiePersistent` is both exported and tested with equivalent logic

**File:** `apps/api/src/auth/session-policy.ts:88-90`
**Issue:** `resolveSessionPolicy` and `isCookiePersistent` do the same thing (map a boolean to either a `SessionPolicy` enum value or a boolean). Having two exports with identical semantics is confusing — callers must choose between them arbitrarily. The test file `session-policy.spec.ts` only tests `isCookiePersistent`, not `resolveSessionPolicy`.

**Fix:** Remove `isCookiePersistent` (it is just `resolveSessionPolicy(...) === SessionPolicy.PERSISTENT`) or remove `resolveSessionPolicy` and derive the enum value from `isCookiePersistent` at call sites. Pick one and delete the other.

---

### IN-04: `postgres` infrastructure service in compose.yaml has `pull_policy` commented out

**File:** `infra/compose/compose.yaml:14`
**Issue:** This finding is obsolete after the dependency-strategy change. The project now expects `docker compose up` to resolve base images and npm packages during build/startup as needed.

**Fix:** No action required. Keep Compose and docs aligned to the fresh-clone startup contract instead of reintroducing the old restricted-pull policy.

---

_Reviewed: 2026-04-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
