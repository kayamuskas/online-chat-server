# Phase 7: Attachments and Durable Delivery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 07-attachments-and-durable-delivery
**Areas discussed:** Attachment model, Upload/download flow, Access control, Durable delivery
**Mode:** Auto-resolved (all decisions selected by Claude without interactive user input)

---

## Attachment Model

| Option | Description | Selected |
|--------|-------------|----------|
| Separate entity (1:N) | Attachments as own table with FK to messages; multiple per message | ✓ |
| Inline in message | Attachment metadata stored as JSON column in messages table | |
| Separate entity (1:1) | One attachment per message only | |

**Claude's auto-selection:** Separate entity (1:N) — FILE-02 requires original filename + comment storage; multiple attachments is standard for chat apps.

---

## Upload/Download Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated upload endpoint | POST /attachments/upload returns ID; sendMessage accepts attachment_ids[] | ✓ |
| Inline multipart send | Single endpoint handles both message text and file upload simultaneously | |

**Claude's auto-selection:** Dedicated upload endpoint — enables upload progress before send, simpler error handling, paste support via same endpoint.

---

## Access Control

| Option | Description | Selected |
|--------|-------------|----------|
| API-proxied download | GET /attachments/:id/download checks membership then streams file | ✓ |
| Direct FS URLs with signed tokens | Static file serving with time-limited signed URLs | |

**Claude's auto-selection:** API-proxied download — FILE-03/FILE-04 require real-time membership check at download time; signed URLs would cache stale permissions.

---

## Durable Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Watermark-based catch-up | Client sends last watermark on reconnect; server returns missed via history endpoint | ✓ |
| Push delivery queue | Separate per-user inbox/queue that accumulates while offline | |
| Hybrid (queue + watermark) | Queue for recent, watermark for historical | |

**Claude's auto-selection:** Watermark-based catch-up — leverages existing Phase 6 watermark infrastructure (D-26..D-29); no secondary queue means MSG-09 bounded backlog is inherently satisfied.

---

## Claude's Discretion

- Multer configuration and middleware placement
- Orphaned attachment handling (upload before message send)
- Image thumbnail generation (not in spec)
- after_watermark endpoint design

## Deferred Ideas

- Image thumbnails — Phase 9 frontend polish
- Attachment file deletion on message delete — Phase 8
- Virus scanning — not in v1
- S3/CDN storage — v1 is local FS only
