---
phase: 7
slug: attachments-and-durable-delivery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
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

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | FILE-01, FILE-02, FILE-06 | T-07-01 | Upload validates MIME + size; UUID filenames prevent traversal | unit | `npx jest --testPathPattern=attachments` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | FILE-03, FILE-04 | T-07-02 | Download checks membership at request time | unit | `npx jest --testPathPattern=attachments` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | MSG-06, MSG-09 | — | N/A | unit | `npx jest --testPathPattern=messages` | ✅ | ⬜ pending |
| 07-04-01 | 04 | 2 | FILE-01 | — | N/A | manual | Browser test | — | ⬜ pending |
| 07-05-01 | 05 | 3 | OPS-03, FILE-05 | — | Volume mount persists across restart | integration | `docker compose restart api && curl upload` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/__tests__/attachments/` — test directory and stubs for FILE-01..FILE-06
- [ ] Multer dependency installed (`multer@2.x`, `@types/multer`)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Paste upload from clipboard | FILE-01 | Browser clipboard API | 1. Open chat 2. Ctrl+V image 3. Verify upload triggers |
| Files persist across container restart | OPS-03 | Docker volume test | 1. Upload file 2. `docker compose restart api` 3. Download same file |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
