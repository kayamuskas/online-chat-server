---
phase: 09-frontend-productization
plan: "03"
subsystem: unread-navigation
tags: [web, notifications, unread, dm, rooms]
key_files:
  modified:
    - apps/web/src/App.tsx
    - apps/web/src/features/contacts/ContactsSidebar.tsx
    - apps/web/src/features/messages/DmChatView.tsx
    - apps/web/src/styles.css
metrics:
  completed_date: "2026-04-20T10:30:00Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 9 Plan 03 Summary

**One-liner:** Added the first shipped unread model for known room threads and DM contacts.

## What Was Built

The shell now tracks lightweight client-side unread counts from WebSocket `message-created` events. Known room rows in the sidebar and DM contact rows in `ContactsSidebar` show unread badges, and opening the corresponding room or DM clears the badge immediately.

This stays intentionally lightweight: it satisfies the UI contract without inventing a durable backend read-state system.

## Verification

- [x] `pnpm --filter @chat/web build`

## Deviations from Plan

Unread behavior currently covers known/tracked rooms and known DM conversations, not arbitrary unseen conversations the shell has never opened before.
