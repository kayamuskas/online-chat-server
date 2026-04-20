---
phase: 07-attachments-and-durable-delivery
plan: 02
subsystem: messages
tags: [watermark, catch-up, durable-delivery, reconnect]
dependency_graph:
  requires: []
  provides: [after_watermark_query, catch_up_delivery]
  affects: [messages.types, messages.repository, messages.controller]
tech_stack:
  added: []
  patterns: [cursor-based-pagination, asc-sort-branch]
key_files:
  created: []
  modified:
    - apps/api/src/messages/messages.types.ts
    - apps/api/src/messages/messages.repository.ts
    - apps/api/src/messages/messages.controller.ts
decisions:
  - "after_watermark uses >= 0 guard (allows watermark 0 as valid cursor)"
  - "after_watermark takes precedence over before_watermark when both supplied (D-52)"
  - "ASC sort applied directly in SQL when after_watermark set, avoiding in-memory reverse"
metrics:
  duration: 127s
  completed: 2026-04-20T06:21:44Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 07 Plan 02: Watermark Catch-Up Delivery Summary

Watermark-based durable delivery catch-up via after_watermark query parameter -- clients reconnecting after offline send last known watermark and receive only missed messages in ASC order without reverse.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add after_watermark to MessageHistoryQuery type | 780e208 | Added optional after_watermark field with D-52..D-54 JSDoc |
| 2 | Extend listHistory repository and parseHistoryQuery controller | 66b5fb7 | afterWatermarkClause, sortAsc branch, controller parsing, mutual exclusion |

## Implementation Details

### Type Layer (messages.types.ts)
- Added `after_watermark?: number` to `MessageHistoryQuery` interface
- JSDoc references D-52..D-54 catch-up after reconnect pattern

### Repository Layer (messages.repository.ts)
- Added `afterWatermarkClause` building `AND m.conversation_watermark > $N`
- Added `sortAsc` flag: when `after_watermark` is set, SQL sorts ASC directly
- Conditional reverse: only reverse rows when sorting DESC (before_watermark / default)
- SQL template includes both `${watermarkClause}` and `${afterWatermarkClause}`

### Controller Layer (messages.controller.ts)
- `parseHistoryQuery` return type extended with `after_watermark`
- Parses `after_watermark` query param with `parseInt` + `>= 0` guard
- Mutual exclusion: `after_watermark` deletes `before_watermark` when both present (D-52)
- Both room and DM history handlers pass `after_watermark` through to service

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- messages.types.ts: contains after_watermark field
- messages.repository.ts: contains afterWatermarkClause and sortAsc
- messages.controller.ts: contains after_watermark parsing and mutual exclusion
- Commit 780e208: verified in git log
- Commit 66b5fb7: verified in git log
