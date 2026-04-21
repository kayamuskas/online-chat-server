---
quick_id: 260421-jyc
status: complete
date: 2026-04-21
---

# Summary: ENV-based config for dev/prod environments

## What changed

### Redis authentication
- Added `REDIS_PASSWORD` to `RuntimeEnv` interface in shared config
- Updated `redisConnectionOptions()` to accept optional password param
- BullMQ connection in `app.module.ts` now passes `REDIS_PASSWORD` when set
- Worker `main.ts` + `createSystemWorker()` pass password through
- Dev: no password needed (default). Prod/Dokploy: set `REDIS_PASSWORD` env var

### SMTP mail service
- Created `MailService` interface + `MAIL_SERVICE` DI token (`mail.service.ts`)
- Created `SmtpMailService` using nodemailer (`smtp-mail.service.ts`)
- `MockMailService` now implements `MailService` interface
- `MailModule` switches implementation: `SMTP_HOST` set → SmtpMailService, else → MockMailService
- `PasswordResetService` now injects via `@Inject(MAIL_SERVICE)` instead of concrete `MockMailService`
- Dev: file-based mock (unchanged). Prod: set SMTP_HOST/PORT/USER/PASS/FROM for real emails

### Compose / Environment
- Added REDIS_PASSWORD, SMTP_* vars to API and worker services in compose.yaml
- All new vars are optional with safe defaults — zero breaking changes for dev

## Files modified
- `packages/shared/src/config.ts` — RuntimeEnv + parseRuntimeEnv extended
- `packages/shared/src/queue.ts` — redisConnectionOptions accepts password
- `apps/api/src/app.module.ts` — BullMQ connection uses REDIS_PASSWORD
- `apps/api/src/mail/mail.service.ts` — NEW: MailService interface
- `apps/api/src/mail/smtp-mail.service.ts` — NEW: SmtpMailService
- `apps/api/src/mail/mock-mail.service.ts` — implements MailService
- `apps/api/src/mail/mail.module.ts` — env-based provider switching
- `apps/api/src/auth/password-reset.service.ts` — uses MAIL_SERVICE token
- `apps/worker/src/main.ts` — passes REDIS_PASSWORD
- `apps/worker/src/system.worker.ts` — accepts password param
- `infra/compose/compose.yaml` — new env vars for API + worker
- `apps/api/package.json` — nodemailer dependency
