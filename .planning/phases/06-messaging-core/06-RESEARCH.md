# Phase 6: Messaging Core - Research

**Date:** 2026-04-19
**Domain:** Shared room/DM messaging engine with watermark integrity primitives

## Requirement Mapping

| Requirement | Meaning in Phase 6 |
|-------------|--------------------|
| `MSG-01` | Room chats and DM chats share one core message domain and comparable UI behavior |
| `MSG-02` | UTF-8 multiline text messages up to 3 KB can be sent and rendered |
| `MSG-03` | Reply/reference flow exists in both rooms and DMs |
| `MSG-04` | Author can edit own messages and the UI renders an edited marker |
| `MSG-08` | Each conversation exposes incremental watermarks so clients can detect missing history ranges |

## Existing Constraints

- Phase 4 already owns room membership, private invites, and room-ban enforcement.
- Phase 5 already owns friendship, DM eligibility, and frozen DM conversations through `dm_conversations.frozen`.
- The project already has an authenticated WebSocket transport in `apps/api/src/ws/app.gateway.ts`; messaging should reuse the same auth posture rather than invent a second auth model.
- The current web shell has room list entry points and a DM tab, but no real message timeline yet.

## Recommended Slice

### Plan 06-01 - Message schema, types, and RED/GREEN test scaffold

Create the durable message contract first:
- migration for messages and reply linkage
- shared message DTO/types
- tests for ordering, edit, reply, and watermark invariants

### Plan 06-02 - Repository and service layer

Implement the shared domain logic:
- atomic send with next watermark assignment
- history list by room or DM conversation
- author-only edit semantics
- room and DM access checks using Phase 4/5 services or repositories

### Plan 06-03 - HTTP and realtime transport

Add the backend delivery surface:
- history/send/edit endpoints for rooms and DMs
- realtime message-created and message-edited fanout
- module wiring into the existing Nest app

### Plan 06-04 - Web client messaging components

Add reusable frontend primitives:
- typed API helpers for room and DM messaging
- timeline component
- composer with multiline, reply, and edit modes
- lightweight watermark/gap state contract in client models

### Plan 06-05 - App shell integration

Replace the DM stub and add room-chat navigation:
- active room conversation tab/view
- real DM screen using the shared chat primitives
- chronological render plus send/edit/reply flows in the authenticated shell

## Key Technical Decisions

1. **Shared message table, typed by conversation target.**
   One message domain is simpler than parallel room-message and dm-message stacks; room vs DM differences belong in authorization and routing, not in two diverging schemas.

2. **Server-assigned conversation watermarks.**
   Watermarks must be persisted and monotonic per conversation to support range recovery later. Do not derive them from timestamps on the client.

3. **REST + WebSocket split.**
   REST should remain the authoritative path for history, mutations, and recovery. WebSocket should be limited to push fanout so reconnect recovery remains deterministic.

4. **Frozen DM is read-only at the same backend boundary as send/edit.**
   Phase 5 already established `dm_conversations.frozen`; Phase 6 must apply it to message writes rather than only to UI state.

## Pitfalls To Avoid

### Pitfall 1: Global watermark instead of per-conversation watermark

This makes range recovery noisy and couples unrelated rooms and DMs together. Watermarks must be scoped to a single room or DM conversation.

### Pitfall 2: Room authorization only on send, not on history read

If history endpoints skip the same membership/ban checks, ex-members can still read room content after losing access.

### Pitfall 3: Reply references allowed across conversations

Reply targets must be validated to belong to the same room or DM conversation as the new message, otherwise the UI can leak cross-conversation references.

### Pitfall 4: Edit path mutates chronology metadata

Editing should mark `edited_at` and update content, but not change the original watermark or chronological position.

### Pitfall 5: Frontend invents recovery logic without backend metadata

If history endpoints do not return watermark metadata now, Phase 9 will need a contract rewrite. Return explicit range values in Phase 6 even if the UI uses them only lightly at first.

## Suggested Verification

- Unit tests for watermark assignment, reply validation, author-only edit, room access, and frozen DM denial
- Transport tests for endpoint authorization and DTO shapes
- Web build plus API build
- Human UAT for room send, DM send, reply, edit marker, and reconnect/history continuity

## Planning Outcome

Phase 6 should be planned as **5 execution plans**:
- `06-01` schema/types/tests scaffold
- `06-02` repository/service domain logic
- `06-03` controller/module/realtime transport
- `06-04` web API client and reusable messaging components
- `06-05` shell integration for room chat and DM chat

This split matches the existing project pattern from Phases 4 and 5 and keeps the risky domain work ahead of transport and UI wiring.
