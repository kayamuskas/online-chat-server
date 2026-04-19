# Phase 7: Attachments and Durable Delivery - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Auto-resolved (all decisions made by Claude without interactive discussion)

<domain>
## Phase Boundary

Add file/image attachment upload and download with ACL enforcement, persist attachments on the local filesystem, implement durable message delivery for offline reconnect scenarios, and ensure delivery backlog mechanisms remain bounded. This phase does NOT implement message deletion, unread indicators, infinite scroll polish, or admin moderation flows.

</domain>

<decisions>
## Implementation Decisions

### Attachment model

- **D-40:** Attachments are a separate database entity with a foreign key to the messages table. One message can have multiple attachments (1:N relationship).
- **D-41:** Each attachment record stores: original filename (FILE-02), MIME type, file size in bytes, storage path on disk (UUID-based), optional comment text, and uploader user ID.
- **D-42:** The messages table gains no new columns — attachment association is entirely through the attachments table FK.
- **D-43:** Attachment metadata is included in MessageView responses as an `attachments[]` array so existing history endpoints serve attachment info without extra fetches.

### Upload and download flow

- **D-44:** Upload uses a dedicated endpoint (`POST /attachments/upload`) that accepts multipart form data via Multer, stores the file on the local filesystem with a UUID filename, and returns the attachment record (including ID).
- **D-45:** Sending a message with attachments: the client uploads files first (gets attachment IDs), then calls sendMessage with an optional `attachment_ids[]` field to bind them to the message atomically.
- **D-46:** Clipboard paste (FILE-01) is handled client-side by converting the paste event into a File object and uploading through the same upload endpoint.
- **D-47:** File size limits enforced at the Multer layer: 20 MB for arbitrary files, 3 MB for images (determined by MIME type). Violations return 413.
- **D-48:** Files are stored under a configurable base directory (e.g., `./uploads/`) with UUID filenames to prevent path traversal and collisions. Original filenames are preserved only in the database.

### Access control

- **D-49:** File download goes through a proxied API endpoint (`GET /attachments/:id/download`) that checks the requester's current membership (room) or DM participation before streaming the file. No direct filesystem URLs are exposed.
- **D-50:** If a user loses room access (kicked/banned) or DM access (user-ban), they immediately lose the ability to download attachments from that conversation (FILE-04). The check happens at download time, not cached.
- **D-51:** Uploaded files remain stored on disk even if the uploader later loses access (FILE-05). Files are only deleted when the room itself is deleted (deferred to Phase 8, ROOM-09).

### Durable delivery (offline reconnect)

- **D-52:** Durable delivery uses watermark-based catch-up, not a separate push queue. When a client reconnects, it sends its last known watermark; the server returns missed messages via the existing history REST endpoint. This leverages the Phase 6 watermark infrastructure (D-26..D-29) directly.
- **D-53:** There is no separate delivery queue or inbox table. Messages persist in the main messages table; "delivery" is simply a history query filtered by watermark. This inherently satisfies MSG-09 (bounded backlog) because there is no secondary queue to grow.
- **D-54:** The reconnect catch-up flow is: client reconnects WebSocket → client calls `GET /messages/:type/:id?after_watermark=N` → server returns messages with watermark > N → client merges into timeline.
- **D-55:** OPS-03 (filesystem persistence across restarts) is satisfied by storing uploads on a Docker volume-mounted directory that survives container recreation.

### Claude's Discretion

- Exact Multer configuration and middleware placement in the NestJS module hierarchy.
- Whether attachment upload requires a pre-existing conversation or can be "orphaned" temporarily before message send.
- Exact thumbnail/preview generation for images (if any — not required by spec).
- Whether to add an `after_watermark` query parameter to existing history endpoints or create a separate catch-up endpoint.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` — Phase 7: Attachments and Durable Delivery
- `.planning/REQUIREMENTS.md` — `MSG-06`, `MSG-09`, `FILE-01`, `FILE-02`, `FILE-03`, `FILE-04`, `FILE-05`, `FILE-06`, `OPS-03`
- `requirements/requirements_raw.md` — attachment and delivery requirements

### Prior phase dependencies
- `.planning/phases/06-messaging-core/06-CONTEXT.md` — message model, watermark infrastructure, REST/WS split
- `apps/api/src/messages/messages.types.ts` — Message, MessageView, SendMessageInput types that need attachment extension
- `apps/api/src/messages/messages.service.ts` — send/edit/history service to extend with attachment binding
- `apps/api/src/messages/messages.repository.ts` — repository patterns for SQL
- `apps/api/src/messages/messages.controller.ts` — REST endpoints to extend
- `apps/api/src/messages/messages.gateway.ts` — WebSocket fanout (attachment data in message events)

### Infrastructure
- `apps/api/src/queue/queue.module.ts` — existing BullMQ setup (may be used for async processing)
- `packages/shared/src/queue.ts` — QUEUE_NAMES registry, redisConnectionOptions
- `apps/api/src/db/migrations/` — migration numbering (next: 0006)

### Access control references
- `apps/api/src/rooms/rooms.repository.ts` — room membership checks
- `apps/api/src/contacts/contacts.repository.ts` — DM participation and ban checks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MessagesRepository` + `MessagesService`: Established repository/service pattern for message CRUD
- `MessagesGateway` (`/messages` namespace): Fanout infrastructure for message-created/edited events — extend for attachment metadata
- `QueueModule` + BullMQ: Worker infrastructure available if async processing is needed (e.g., post-upload validation)
- `validateMessageContent` / `validateReplyTarget` helpers: Pattern for input validation helpers
- Watermark infrastructure (D-26..D-29): Conversation-scoped monotonic watermarks already working

### Established Patterns
- NestJS module/controller/service/repository layered architecture
- Session-cookie authentication on both REST and WebSocket
- SQL migrations in `apps/api/src/db/migrations/` with sequential numbering
- Shared types in domain `.types.ts` files
- Domain helpers in `.helpers.ts` files

### Integration Points
- `SendMessageInput` type needs optional `attachment_ids` field
- `MessageView` type needs `attachments[]` array
- `MessagesController` needs new upload/download routes (or a new AttachmentsController)
- `MessagesGateway` fanout events need to include attachment metadata
- Frontend `useMessages` hook and chat views need file upload UI + attachment rendering
- Docker Compose needs a volume mount for the uploads directory

</code_context>

<specifics>
## Specific Ideas

- Reuse the DM eligibility and room membership checks from Phase 5/4 repositories for download ACL.
- Extend `MessageView` with an `attachments` array rather than creating a separate fetch — keeps the history endpoint as the single source of truth.
- The `after_watermark` parameter for catch-up can be added to the existing history endpoint rather than creating a new one — it's the natural complement to `before_watermark` for backward pagination.
- Upload directory structure: `./uploads/{conversation_type}/{conversation_id}/{uuid}.{ext}` for easy cleanup when rooms are deleted in Phase 8.

</specifics>

<deferred>
## Deferred Ideas

- Image thumbnails / preview generation — not required by spec, can be added in Phase 9 frontend polish
- Message deletion cascading to attachment file deletion — Phase 8 (MSG-05, ROOM-09)
- Virus/malware scanning of uploads — not in v1 requirements
- CDN or S3-compatible storage — v1 is local filesystem only

</deferred>

---

*Phase: 07-attachments-and-durable-delivery*
*Context gathered: 2026-04-19*
