---
quick_id: 260421-jyc
description: "ENV-based config: Redis auth, SMTP mail, dev/prod switching"
date: 2026-04-21
status: complete
---

# Quick Task: ENV-based config for dev/prod environments

## Task 1: Add REDIS_PASSWORD support
- Add `REDIS_PASSWORD` to RuntimeEnv interface
- Update `redisConnectionOptions()` to accept optional password
- Update BullMQ connection in app.module.ts to pass REDIS_PASSWORD
- Update worker main.ts and createSystemWorker to pass password
- Update compose.yaml with REDIS_PASSWORD env var

## Task 2: Add SMTP mail service with env-based switching
- Create MailService interface (mail.service.ts) with MAIL_SERVICE injection token
- Create SmtpMailService using nodemailer (smtp-mail.service.ts)
- Update MockMailService to implement MailService interface
- Update MailModule to switch: SMTP_HOST set → SmtpMailService, otherwise → MockMailService
- Update PasswordResetService to inject via MAIL_SERVICE token
- Add SMTP_* env vars to RuntimeEnv and compose.yaml
- Install nodemailer + @types/nodemailer

## Task 3: Update compose.yaml
- Add REDIS_PASSWORD, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM to API service
- Add REDIS_PASSWORD to worker service
