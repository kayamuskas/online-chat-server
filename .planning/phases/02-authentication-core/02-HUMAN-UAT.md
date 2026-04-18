---
status: partial
phase: 02-authentication-core
source: [02-VERIFICATION.md]
started: 2026-04-18T16:45:00Z
updated: 2026-04-18T16:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Mail Artifact End-to-End (AUTH-06 + OPS-04)
expected: Start Docker Compose stack, trigger password-reset for a registered email, locate JSON artifact in `.volumes/mail-outbox/`, extract the `resetLink`, call `POST /auth/password-reset/confirm` with the token, then verify sign-in with the new password succeeds.
result: [pending]

### 2. Browser-Close Session Semantics (AUTH-05)
expected: Sign in without "Keep me signed in", close all browser windows, reopen browser, confirm the session cookie is gone and user is logged out.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
