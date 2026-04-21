---
quick_id: 260421-jld
status: complete
date: 2026-04-21
---

# Summary: Reply button should focus message input field

## What changed
- Added `useEffect` import and hook in `MessageComposer.tsx` that auto-focuses the textarea when `replyTo` prop transitions to non-null
- Both DmChatView and RoomChatView benefit since they share the same MessageComposer component

## Files modified
- `apps/web/src/features/messages/MessageComposer.tsx` — added `useEffect` for reply focus
