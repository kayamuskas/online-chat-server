# Phase 9: Frontend Productization - Research

**Researched:** 2026-04-20
**Domain:** frontend shell composition, unread UX, infinite history UX, modal/menu interaction model
**Confidence:** HIGH

## Summary

Phase 9 can start immediately without waiting for Phase 7 or Phase 8.

The main enabling fact is that the backend and frontend foundations for this phase already exist:
- Phase 4 already shipped the room authority model and core room-management UI.
- Phase 5 already shipped contacts and friend-request surfaces.
- Phase 6 and 6.1 already shipped message timelines, realtime fanout, and smart autoscroll.

That means Phase 9 is primarily a composition and UX-integration phase, not a backend-blocked phase.

## What Is Ready Now

### Ready from completed phases
- Room list and room entry flows
- Contacts list and DM entry flows
- Realtime message timeline with smart autoscroll
- Session and password/account settings surfaces
- Watermark/range metadata for history pagination

### Explicitly deferred into Phase 9 by prior phases
- Real room-members/context-panel polish
- Unread indicators on contacts and rooms
- Infinite upward scroll UX
- Final classic chat shell and navigation polish

## What Is Not A Blocker

### Phase 7
- Attachments are not required to start the Phase 9 shell.
- Existing attachment rendering, if present, can be treated as a bonus integration path rather than a phase dependency.

### Phase 8
- Message deletion, room deletion, and account deletion side effects are backend/domain work, not prerequisites for shipping the Phase 9 shell.
- UI can expose only currently implemented admin affordances and defer destructive actions cleanly.

## Recommended Plan Shape

Phase 9 should be split into five plans:

1. **09-01 Shell and layout contract**
   Build the real three-column shell and compact room navigation behavior.

2. **09-02 Unread indicators**
   Add unread state and clearing behavior for room and contact navigation rows.

3. **09-03 Infinite history UX**
   Add upward infinite scroll on top of existing watermark/range metadata.

4. **09-04 Menus and modal admin UX**
   Normalize management actions into menus/modals without blocking on Phase 8 destructive work.

5. **09-05 Settings/session integration**
   Fold session/account views into the final shell in a user-facing way.

## Key Risks

- `App.tsx` may currently own too much state and require decomposition before Phase 9 can move cleanly.
- Unread semantics can sprawl if implemented ad hoc across rooms and contacts; Phase 9 should define one lightweight model first.
- Infinite scroll can fight with the already-shipped smart autoscroll unless scroll ownership stays centralized in the timeline layer.

## Planning Recommendation

Do not reopen Phase 7 or Phase 8 as blockers.

Proceed directly with:
- `09-CONTEXT.md`
- `09-01-PLAN.md` first, focused only on shell/layout and structural decomposition

That keeps the first execution wave narrow and reduces the risk of mixing shell refactor, unread logic, and infinite-scroll logic into one patch.

---

*Phase: 09-frontend-productization*
*Research date: 2026-04-20*
