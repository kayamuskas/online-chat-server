---
status: complete
phase: 06-messaging-core
source:
  - 06-01-SUMMARY.md
  - 06-02-SUMMARY.md
  - 06-03-SUMMARY.md
  - 06-04-SUMMARY.md
  - 06-05-SUMMARY.md
started: 2026-04-19T08:45:00Z
updated: 2026-04-19T09:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Run `docker compose up` (or `pnpm dev`) from repo root. The API boots without errors, the messages migration (0005_messages_core.sql) applies cleanly, and the web app loads at http://localhost:5173 without a crash page.
result: pass

### 2. Send a Room Message
expected: Open or join a public room so the room-chat view appears. Type a message and press Enter. The message appears immediately in the timeline with your username and timestamp. Pressing Shift+Enter creates a newline without sending.
result: pass

### 3. Reply to a Message
expected: Click the Reply button on any message in a room chat. A reply preview chip appears above the composer showing the author and a content snippet. Submit the reply. It appears in the timeline with a reply chip referencing the original message.
result: issue
reported: "reply chip в composer работает, но после отправки в таймлайне ссылка на оригинальное сообщение не видна"
severity: major

### 4. Edit Own Message
expected: Click the Edit button on one of your own messages. An inline editor appears pre-filled with the current content. Edit the text and save. The message updates in-place and shows an "edited" marker. The Edit button is NOT visible on other users' messages.
result: pass

### 5. Load Older Messages
expected: In a room or DM with more than one page of history, a "Load older messages" button appears at the top of the timeline. Clicking it loads earlier messages above the current view without losing scroll position on newer messages.
result: pass

### 6. Open a DM Conversation
expected: Click Msg for an eligible friend in the contacts sidebar. The DM chat view opens with a message timeline and a composer. You can type and send messages. The conversation persists across tab switches.
result: issue
reported: "DM открывается, но показывает 'This conversation is read-only.' — написать нельзя даже для обычного друга без банов"
severity: major

### 7. Frozen DM Read-Only State
expected: Open a DM where one party has been blocked/banned (or simulate via the ban flow). The DM history still loads and is visible, but the composer shows a "read-only" / frozen banner and the Reply and Edit buttons are hidden.
result: issue
reported: "вместо read-only истории с frozen баннером показывает 'DM not allowed: not_friends' — история не видна, ошибка не отражает ban-состояние"
severity: major

### 8. Room Chat After Public Room Join
expected: From the public rooms list, join a room you're not yet a member of. After joining, the UI navigates directly to the room-chat view for that room (no manual navigation required).
result: pass

### 9. Private Room "Open Chat" Button
expected: Open the private rooms list. Each room row now has an "Open chat" button alongside Manage / Leave. Clicking it opens the room-chat view for that private room.
result: pass

### 10. Message History After Reload
expected: Send a few messages in a room or DM, then reload the page. Navigate back to that conversation. The messages reappear in chronological order (oldest at top, newest at bottom) matching what was visible before reload.
result: pass

## Summary

total: 10
passed: 7
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Reply message appears in timeline with a reply chip referencing the original message"
  status: failed
  reason: "User reported: reply chip в composer работает, но после отправки в таймлайне ссылка на оригинальное сообщение не видна"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "DM conversation with eligible friend opens with a writable composer"
  status: failed
  reason: "User reported: DM открывается, но показывает 'This conversation is read-only.' — написать нельзя даже для обычного друга без банов"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Banned/blocked DM shows history as read-only with frozen banner; does not show error page"
  status: failed
  reason: "User reported: вместо read-only истории с frozen баннером показывает 'DM not allowed: not_friends' — история не видна, ошибка не отражает ban-состояние"
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
