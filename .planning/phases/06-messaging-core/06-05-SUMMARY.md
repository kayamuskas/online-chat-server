---
phase: 06-messaging-core
plan: "05"
subsystem: messages
tags: [messages, frontend, react, dm-chat, room-chat, integration, shell-wiring]
dependency_graph:
  requires:
    - 06-04  # MessageTimeline, MessageComposer, ReplyPreview, MessageEditor primitives
    - 06-03  # REST endpoints: /messages/rooms/:id/history, /messages/dm/:id/history, etc.
    - 05-05  # App.tsx shell, DM entry points, contacts sidebar
  provides:
    - apps/web/src/features/messages/DmChatView.tsx
    - apps/web/src/features/messages/RoomChatView.tsx
    - apps/web/src/App.tsx (room-chat tab, room-chat navigation, DmChatView wiring)
    - apps/web/src/features/rooms/PrivateRoomsView.tsx (onOpenChat prop + button)
  affects:
    - apps/web/src/App.tsx
tech_stack:
  added: []
  patterns:
    - Conversation-agnostic: DmChatView and RoomChatView both consume MessageTimeline + MessageComposer
    - Controlled reply/edit state owned by each view parent (not primitives)
    - initiateDm auto-called on DM open to retrieve/create dm_conversations row
    - onJoined callback in PublicRoomsView now navigates to room-chat directly
    - onOpenChat prop added to PrivateRoomsView for explicit room open action
key_files:
  created:
    - apps/web/src/features/messages/DmChatView.tsx
    - apps/web/src/features/messages/RoomChatView.tsx
  modified:
    - apps/web/src/App.tsx
    - apps/web/src/features/rooms/PrivateRoomsView.tsx
decisions:
  - "DmChatView calls initiateDm on mount when no conversationId is passed — avoids requiring App.tsx to pre-fetch conversation ID before navigation (D-31)"
  - "Frozen DM: history still loads read-only; composer shows 'read-only' banner; reply/edit buttons hidden (D-32)"
  - "RoomChatView Back button returns to public-rooms — simple default; private-room back is handled by navigating to private-rooms from context (D-35)"
  - "PrivateRoomsView onOpenChat prop is optional for backward compatibility — all existing call sites unaffected"
  - "PublicRoomsView onJoined now goes to room-chat — join action immediately opens the conversation (D-35)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 06 Plan 05: Shell Integration — DM and Room Chat Views Summary

**One-liner:** DmChatView and RoomChatView wire the Phase 6 message engine into the authenticated shell — rooms open as real chat conversations after join or explicit open, and the Phase 5 DM stub is replaced with a live send/reply/edit surface.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace DM stub with real DmChatView | a19edcd | DmChatView.tsx, App.tsx |
| 2 | Add room-chat navigation and wire shell state | 26d56dd | RoomChatView.tsx, App.tsx, PrivateRoomsView.tsx |

## What Was Built

### DmChatView.tsx

Real DM conversation surface replacing Phase 5 DmScreenStub:

- Auto-opens dm_conversations row via `initiateDm(partnerId)` on mount (D-31)
- Frozen conversation: history loads read-only, composer shows frozen banner, reply/edit hidden (D-32)
- Ineligible states (not_friends, ban_exists) render appropriate Phase 5 error messages
- Full send / reply / edit / load-older flow using MessageTimeline + MessageComposer (MSG-01..04, MSG-08)
- Scroll-to-bottom on new messages via `bottomRef`

### RoomChatView.tsx

Real room conversation surface:

- Loads history via `getRoomHistory` on mount and on roomId change (D-33)
- Send / reply / edit / load-older using the same MessageTimeline + MessageComposer (D-21, D-35)
- Back button returns to public-rooms list
- Resets all local state when roomId prop changes

### App.tsx changes

- Added `room-chat` to `AppTab` union
- Added `activeRoom: { id, name } | null` state
- `handleRoomJoined` now sets `activeRoom` and navigates to `room-chat` (public rooms join flow)
- `PrivateRoomsView` receives `onOpenChat` callback for explicit open from the private-rooms list
- `DmScreenStub` import replaced by `DmChatView`; `dm` tab renders `DmChatView` with `partnerId` and `currentUserId`

### PrivateRoomsView.tsx changes

- New optional `onOpenChat?: (room: RoomCatalogRow) => void` prop
- "Open chat" button added per room row (renders before Manage / Leave)

## Build Verification

```
pnpm --filter @chat/web build
vite v7.3.2 — 65 modules transformed
dist/assets/index-CcJUa2ox.js  261.77 kB | gzip: 75.83 kB
built in 556ms
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components implement real API calls. History, send, edit, and reply all hit live Phase 6 endpoints. No hardcoded placeholder data.

## Threat Flags

None — no new network endpoints or auth paths introduced. DmChatView and RoomChatView are purely client-side React views that call the existing authenticated helpers in api.ts (session cookies forwarded on every request).

## Checkpoint: Task 3 — Human Browser Verification Required

Task 3 is `type="checkpoint:human-verify"` and requires manual browser verification:

1. Open a room chat and send a multiline message.
2. Reply to that message and confirm the reply reference chip is visible.
3. Edit your own message and confirm the "edited" marker appears.
4. Open an eligible DM conversation and confirm the same send/reply/edit behaviors exist.
5. Reload the page and confirm recent history comes back in chronological order.

**To start the server:** `docker compose up` from repo root (or `pnpm dev` if services are already running).
**Web URL:** http://localhost:5173/account

## Self-Check: PASSED

- [x] `apps/web/src/features/messages/DmChatView.tsx` exists (commit a19edcd)
- [x] `apps/web/src/features/messages/RoomChatView.tsx` exists (commit 26d56dd)
- [x] `apps/web/src/App.tsx` modified — DmChatView wired, room-chat tab added (commits a19edcd, 26d56dd)
- [x] `apps/web/src/features/rooms/PrivateRoomsView.tsx` modified — onOpenChat prop (commit 26d56dd)
- [x] `pnpm --filter @chat/web build` — clean (65 modules)
- [x] All commits verified: a19edcd, 26d56dd
