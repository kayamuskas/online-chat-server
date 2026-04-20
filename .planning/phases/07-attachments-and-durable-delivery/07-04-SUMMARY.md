---
phase: 07-attachments-and-durable-delivery
plan: 04
subsystem: messages
tags: [attachments, messages, integration, websocket, left-join]
dependency_graph:
  requires: [07-01, 07-03]
  provides: [message-attachment-binding, attachment-enriched-history, attachment-ws-fanout]
  affects: [messages-module, messages-types, messages-repository, messages-service, messages-controller, messages-gateway]
tech_stack:
  added: []
  patterns: [left-join-json-agg, constructor-injection-cross-module]
key_files:
  created: []
  modified:
    - apps/api/src/messages/messages.types.ts
    - apps/api/src/messages/messages.repository.ts
    - apps/api/src/messages/messages.service.ts
    - apps/api/src/messages/messages.controller.ts
    - apps/api/src/messages/messages.module.ts
    - apps/api/src/messages/messages.gateway.ts
    - apps/api/src/__tests__/messages/messages-domain.spec.ts
    - apps/api/src/__tests__/messages/messages-service.spec.ts
    - apps/api/src/__tests__/messages/messages-transport.spec.ts
decisions:
  - "LEFT JOIN with json_agg sub-query chosen over N+1 getViewsByMessageIds for zero extra round-trips"
  - "attachments field added as required AttachmentView[] (not optional) -- always [] when no attachments"
  - "attachment_ids parsed and validated in controller layer, bound via AttachmentsRepository in service layer"
metrics:
  duration: "4m 41s"
  completed: "2026-04-20T06:36:04Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 9
---

# Phase 7 Plan 04: Message-Attachment Integration Summary

MessageView enriched with attachments[] via LEFT JOIN json_agg; sendMessage binds attachment_ids atomically; WS fanout includes attachment metadata.

## Completed Tasks

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Extend messages types with attachment fields | 79155bc | Added AttachmentView import, attachments: AttachmentView[] to MessageView, attachment_ids?: string[] to SendMessageInput, re-export of AttachmentView |
| 2 | Extend repository and service for attachment LEFT JOIN and binding | 1715a42 | Added LEFT JOIN with json_agg sub-query to listHistory and findMessageViewById, attachments field to MessageViewRow and rowToMessageView, injected AttachmentsRepository into MessagesService, added bindAttachments call after createMessage |
| 3 | Extend controller, module, and gateway for attachment wiring | 5ceca73 | Extended parseSendMessageBody to parse attachment_ids, passed attachment_ids to sendMessage in both room and DM send handlers, imported AttachmentsModule in MessagesModule, added attachments to broadcastMessageCreated payload |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test mocks missing attachments field**
- **Found during:** Task 3
- **Issue:** Three test spec files (messages-domain.spec.ts, messages-service.spec.ts, messages-transport.spec.ts) had MessageView mock objects missing the new required `attachments` field, causing TypeScript compilation errors.
- **Fix:** Added `attachments: []` to all makeMessageView helper functions in test files.
- **Files modified:** apps/api/src/__tests__/messages/messages-domain.spec.ts, apps/api/src/__tests__/messages/messages-service.spec.ts, apps/api/src/__tests__/messages/messages-transport.spec.ts
- **Commit:** 5ceca73

## Verification Results

- MessageView includes `attachments: AttachmentView[]` -- PASS
- SendMessageInput includes `attachment_ids?: string[]` -- PASS
- listHistory SQL includes LEFT JOIN on attachments table -- PASS
- findMessageViewById also includes LEFT JOIN on attachments -- PASS
- sendMessage calls bindAttachments after createMessage when attachment_ids provided -- PASS
- Gateway message-created event includes attachments field -- PASS
- MessagesModule imports AttachmentsModule -- PASS
- All tsc errors in source files are pre-existing (missing node_modules in worktree) -- no new errors introduced

## Architecture Notes

The LEFT JOIN uses a json_agg sub-query pattern to avoid N+1 queries:
```sql
LEFT JOIN (
  SELECT a2.message_id,
         json_agg(json_build_object(...) ORDER BY a2.created_at) AS attachments
  FROM attachments a2
  WHERE a2.message_id IS NOT NULL
  GROUP BY a2.message_id
) att ON att.message_id = m.id
```

This ensures a single query returns all messages with their attachments, with COALESCE defaulting to `'[]'::json` for messages without attachments.

The `rowToMessageView` function handles both array (native JSON) and string (serialized JSON) formats from the database driver, ensuring robust deserialization.

## Threat Model Compliance

- T-07-11 (Tampering): bindAttachments enforces `uploader_id = author_id AND message_id IS NULL` -- prevents hijacking and double-binding. Verified in AttachmentsRepository from Plan 01.
- T-07-12 (Info Disclosure): Attachment metadata visible to all conversation members by design (D-43). Accepted risk.
