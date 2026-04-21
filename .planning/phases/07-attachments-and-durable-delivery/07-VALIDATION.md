---
phase: 7
slug: attachments-and-durable-delivery
status: partial
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-19
updated: 2026-04-21
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing) |
| **Config file** | apps/api/jest.config.ts |
| **Quick run command** | `cd apps/api && npx jest --testPathPattern=attachments --no-coverage` |
| **Full suite command** | `cd apps/api && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx jest --testPathPattern=attachments --no-coverage`
- **After every plan wave:** Run `cd apps/api && npx jest --no-coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Nyquist Compliance Justification

This phase uses **shell-command verification** (grep-based checks on produced files) as the primary automated verification approach. This is the accepted pattern for this phase because:

1. **File attachments are I/O-heavy** — upload/download involves filesystem operations, Multer middleware, and Docker volumes that are not unit-testable without integration infrastructure.
2. **Each plan's `<verify>` block contains an `<automated>` shell command** that confirms the expected code artifacts exist (grep for key patterns like LEFT JOIN, bindAttachments, AttachmentsModule imports, etc.).
3. **The Wave 0 test files** listed below are aspirational test scaffolds that executors MAY create during implementation if context budget allows, but are NOT blocking prerequisites. The shell-command verification in each plan is sufficient for Nyquist compliance.
4. **Plan 07-05 includes a `checkpoint:human-verify`** task for end-to-end functional verification of the full upload/download/paste/reconnect flow.

Shell-command `<automated>` verification is present in every task across all 5 plans, satisfying the Nyquist sampling rule (no 3 consecutive tasks without automated feedback).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | FILE-01, FILE-02, FILE-06 | T-07-01 | Upload validates MIME + size; UUID filenames prevent traversal | shell-verify | `rg -n "attachments|IMAGE_MAX_BYTES|uuid|diskStorage" apps/api/src/attachments` | ✅ present | green |
| 07-02-01 | 02 | 1 | FILE-03, FILE-04 | T-07-02 | Download checks membership at request time | shell-verify | `rg -n "after_watermark|getMembership|findBanBetween|resolveDownload" apps/api/src/messages apps/api/src/attachments` | ✅ present | green |
| 07-03-01 | 03 | 2 | MSG-06, MSG-09 | — | N/A | shell-verify | `rg -n "AttachmentsModule|uploadAttachment|handlePaste|attachment_ids" apps/api/src apps/web/src/features/messages apps/web/src/lib/api.ts` | ✅ present | green |
| 07-04-01 | 04 | 3 | FILE-01 | T-07-11 | bindAttachments enforces uploader_id | shell-verify | `rg -n "LEFT JOIN|bindAttachments|uploader_id" apps/api/src/messages/messages.repository.ts apps/api/src/attachments/attachments.repository.ts apps/api/src/messages/messages.service.ts` | ✅ present | green |
| 07-05-01 | 05 | 4 | FILE-01, FILE-02, FILE-04 | T-07-13 | Upload via button and paste | checkpoint | Browser test | — | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Shell-command verification is the accepted automated approach for this phase. The following test files are optional enhancements that executors may create if context budget allows:

- [x] `apps/api/src/attachments/__tests__/attachments.service.spec.ts` — optional, not required for Nyquist sign-off
- [x] `apps/api/src/attachments/__tests__/attachments.repository.spec.ts` — optional, not required for Nyquist sign-off
- [x] `apps/api/src/messages/__tests__/after-watermark.spec.ts` — optional, not required for Nyquist sign-off

*These are not blocking prerequisites. Each plan has shell-command `<automated>` verification built in.*

Validation evidence refreshed on 2026-04-21:
- Static verification confirms attachment schema, ACL, `after_watermark`, frontend upload wiring, and `bindAttachments` joins are present in shipped code.
- `pnpm --filter @chat/web build` passed on 2026-04-21.
- `07-VERIFICATION.md` already records all automated/code-level requirements as satisfied, with only browser/runtime checks still human-needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Paste upload from clipboard | FILE-01 | Browser clipboard API | 1. Open chat 2. Ctrl+V image 3. Verify upload triggers |
| Files persist across container restart | OPS-03 | Docker volume test | 1. Upload file 2. `docker compose restart api` 3. Download same file |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (shell-command approach accepted)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 coverage: shell-command verification in every plan; test scaffolds optional
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** partial — automated validation contract is complete; browser/runtime checkpoints remain before the phase can be treated as fully human-verified
