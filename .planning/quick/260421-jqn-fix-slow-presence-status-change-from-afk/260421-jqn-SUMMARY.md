---
quick_id: 260421-jqn
status: complete
date: 2026-04-21
---

# Summary: Fix slow presence status change from afk/offline to online

## Root cause
Frontend never sent `activity` WebSocket events. Backend handler existed (`handleActivity` in app.gateway.ts) but was never triggered, so the 60s AFK timer never reset during normal use.

## What changed
- Added activity tracking useEffect in `SocketProvider.tsx`
- Listens to mousemove, keydown, click, touchstart, and visibilitychange events
- Throttled to emit at most once every 10s to avoid flooding
- On tab re-focus (visibilitychange → visible), forces immediate emit

## Files modified
- `apps/web/src/features/socket/SocketProvider.tsx` — added activity event listeners and throttled socket.emit("activity")
