---
quick_id: 260421-jld
description: Reply button should focus message input field
date: 2026-04-21
status: complete
---

# Quick Task: Reply button should focus message input field

## Task 1: Add useEffect to auto-focus textarea on reply

**Files:** `apps/web/src/features/messages/MessageComposer.tsx`
**Action:** Add `useEffect` that watches `replyTo` prop — when it becomes non-null, focus the textarea via `textareaRef.current?.focus()`. Import `useEffect` from React.
**Verify:** Click Reply on any message → textarea receives focus automatically.
**Done:** Textarea is focused when user clicks Reply button.
