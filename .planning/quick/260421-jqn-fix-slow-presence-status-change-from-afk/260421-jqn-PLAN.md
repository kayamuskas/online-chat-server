---
quick_id: 260421-jqn
description: Fix slow presence status change from afk/offline to online
date: 2026-04-21
status: complete
---

# Quick Task: Fix slow presence status change from afk/offline to online

## Root Cause
The frontend never emits `activity` WebSocket events. The backend `handleActivity` handler exists but is never called. The AFK timer (60s) never resets during normal use, so users stay AFK until they refresh (F5), which creates a new connection with a fresh timestamp.

## Task 1: Add activity tracking to SocketProvider

**Files:** `apps/web/src/features/socket/SocketProvider.tsx`
**Action:** Add a useEffect that listens to mousemove, keydown, click, touchstart, and visibilitychange events. Throttle `socket.emit("activity")` to once every 10s. On tab re-focus (visibilitychange → visible), emit immediately.
**Verify:** Open app, wait >60s for AFK, move mouse → status should flip to online within seconds (next getPresence poll).
**Done:** Activity events flow from frontend to backend, AFK timer resets on user interaction.
