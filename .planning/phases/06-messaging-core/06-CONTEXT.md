# Phase 6: Messaging Core - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the first real message engine shared by rooms and direct dialogs. Phase 6 owns message persistence, send/edit/reply behavior, chronological history loading, realtime fanout, and per-conversation watermark integrity primitives. It does not implement attachments, offline durable delivery queues, destructive deletion flows, unread counters, or infinite scroll product polish.

</domain>

<decisions>
## Implementation Decisions

### Shared message model

- **D-21:** Room chats and DM chats use the same core message domain model and API semantics, differing only by conversation target (`room` vs `dm`).
- **D-22:** Messages are plain UTF-8 text up to 3 KB after trimming and validation; multiline content is allowed.
- **D-23:** Reply is modeled as an optional reference to another message in the same conversation; the API returns enough preview data for the client to render a reply chip.
- **D-24:** Users can edit only their own messages in Phase 6. Message deletion is explicitly deferred to Phase 8.
- **D-25:** Edited messages render an `edited` marker in the UI and preserve chronological position.

### Ordering and integrity

- **D-26:** Each conversation maintains an incremental conversation-scoped watermark so the client can detect missing ranges safely.
- **D-27:** History endpoints return messages in chronological order plus range metadata (`firstWatermark`, `lastWatermark`, `hasMoreBefore` or equivalent).
- **D-28:** Message creation assigns the next watermark atomically at persistence time; clients must never invent watermarks locally.
- **D-29:** Watermark integrity is a backend contract first and a UI recovery primitive second; Phase 6 must expose enough metadata for Phase 9 infinite scroll without implementing that full UX yet.

### Access control

- **D-30:** Sending or reading room messages requires current room membership and no active room ban.
- **D-31:** Sending or reading DM messages requires the existing Phase 5 DM eligibility rules and must honor frozen conversations created by bans.
- **D-32:** If a DM conversation is frozen, the conversation remains visible but send/edit operations are rejected server-side and the UI stays read-only.

### Transport and UI shape

- **D-33:** REST owns initial history load, send/edit mutations, and watermark range recovery.
- **D-34:** WebSocket owns realtime fanout for newly created and edited messages to connected participants.
- **D-35:** Phase 6 replaces the DM stub with a real DM conversation surface and adds a real room-chat surface inside the existing authenticated shell.
- **D-36:** Attachments, unread counters, infinite upward scrolling, and advanced member/context panels remain deferred to later phases.

### Codex's Discretion

- Exact route naming inside the messages module, as long as room and DM contracts are parallel and explicit.
- Whether realtime fanout extends the existing `AppGateway` or uses a dedicated messaging gateway/module.
- Exact UI affordance for reply/edit mode, as long as both actions are clearly reversible before submit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` - Phase 6: Messaging Core
- `.planning/REQUIREMENTS.md` - `MSG-01`, `MSG-02`, `MSG-03`, `MSG-04`, `MSG-08`
- `requirements/requirements_raw.md` - messaging requirements and classic chat UX constraints

### Prior phase dependencies
- `.planning/phases/04-rooms-and-membership/04-CONTEXT.md` - room membership, room bans, and manage-room patterns
- `.planning/phases/05-contacts-and-dm-policy/05-CONTEXT.md` - DM eligibility, frozen DM behavior, and contacts shell entry points
- `.planning/phases/05-contacts-and-dm-policy/05-02-SUMMARY.md` - `dm_conversations` contract and contacts service/repository patterns
- `.planning/phases/05-contacts-and-dm-policy/05-05-SUMMARY.md` - `App.tsx` contacts and DM shell wiring

### Existing code anchors
- `apps/api/src/ws/app.gateway.ts` - authenticated socket pattern already in production
- `apps/api/src/contacts/contacts.service.ts` - current DM eligibility and frozen conversation policy
- `apps/api/src/rooms/rooms.repository.ts` - repository style and authorization-adjacent SQL patterns
- `apps/web/src/App.tsx` - current shell tabs and DM entry points
- `apps/web/src/features/contacts/DmScreenStub.tsx` - placeholder DM surface to replace
- `apps/web/src/features/rooms/PublicRoomsView.tsx` and `apps/web/src/features/rooms/PrivateRoomsView.tsx` - room entry points the messaging surface must hook into

</canonical_refs>

<specifics>
## Specific Ideas

- Reuse `dm_conversations` from Phase 5 as the stable DM conversation identity rather than inventing a second DM table.
- Keep the first room-chat experience simple: open the selected room as the active conversation and show chronological message history with composer, reply, and edit.
- Watermark metadata should be explicit in DTOs so Phase 9 can build gap detection and infinite scroll on top of the same contract.

</specifics>

<deferred>
## Deferred Ideas

- Attachments and offline durable delivery queues - Phase 7
- Message deletion and room/account destructive side effects - Phase 8
- Infinite scroll, unread indicators, and polished classic chat layout - Phase 9

</deferred>

---

*Phase: 06-messaging-core*
*Context gathered: 2026-04-19*
