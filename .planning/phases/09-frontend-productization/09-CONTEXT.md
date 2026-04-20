# Phase 9: Frontend Productization - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Mode:** Auto-resolved

<domain>
## Phase Boundary

Replace the current implementation-shaped frontend shell with the real product UI aligned to the classic chat requirements. Phase 9 owns the shipped navigation shell, room/contact unread indicators, infinite upward history loading, session/account surfaces inside the real shell, and modal/menu admin UX.

Phase 9 does NOT own attachment backend work, room/account destructive cascades, message deletion backend rules, or attachment cleanup. Those remain deferred with Phase 7 and Phase 8.
</domain>

<decisions>
## Implementation Decisions

### Shell and layout

- **D-90:** The shipped app must present the classic three-column chat layout: left navigation/sidebar, center conversation view, right context/member panel.
- **D-91:** The current authenticated shell in `App.tsx` is implementation scaffolding, not the final product contract. Phase 9 may restructure it aggressively.
- **D-92:** Room navigation should compact when a conversation is active, matching `UI-02` and the previously locked room/contact sidebar direction.
- **D-101:** `requirements/desing_v1/` is the visual and interaction baseline for Phase 9. The app does not need pixel-perfect reproduction, but it must move toward its warm light palette, serif+mono typography hierarchy, top navigation, accordion room navigation, and modal-driven management patterns rather than away from them.

### Unread indicators

- **D-93:** Unread indicators are primarily a frontend state and API-integration phase concern here; exact durable unread semantics may stay lightweight as long as `NOTF-01` and `NOTF-02` are satisfied for the shipped UI.
- **D-94:** Contact and room rows both need visible unread affordances in the main navigation surfaces.

### History UX

- **D-95:** Smart autoscroll from Phase 6.1 is retained. Phase 9 adds the missing upward infinite-scroll product flow on top of the existing watermark/range contracts.
- **D-96:** Infinite scroll should reuse the explicit range metadata already prepared in Phase 6 rather than inventing a second pagination model.

### Admin and settings surfaces

- **D-97:** Admin and management actions should be available through menus and modal dialogs even if some destructive backend actions remain deferred to Phase 8.
- **D-98:** Session-management and account settings surfaces already built in earlier phases must be surfaced cleanly inside the final shell, not left as isolated utility screens.

### Phase override constraints

- **D-99:** Because Phase 7 is temporarily deferred, Phase 9 must not block on attachment polish. Existing attachment UI, if present, can remain functional but is not a planning dependency for this phase.
- **D-100:** Because Phase 8 is temporarily deferred, Phase 9 should only wire admin UI to capabilities that already exist or can degrade gracefully when a backend action is not yet implemented.
- **D-102:** Structural refactors are allowed, but each visible shell/layout decision in Phase 9 should be explainable against `requirements/desing_v1/` or `requirements/wireframes.md`.
</decisions>

<canonical_refs>
## Canonical References

### Phase requirements
- `.planning/ROADMAP.md` — Phase 9 goal and success criteria
- `.planning/REQUIREMENTS.md` — `MSG-07`, `NOTF-01`, `NOTF-02`, `UI-01`, `UI-02`, `UI-03`
- `requirements/requirements_raw.md` — classic chat UX expectations
- `requirements/wireframes.md` — explicit three-column classic layout and manage-room/admin interaction expectations
- `requirements/desing_v1/index.html` and `requirements/desing_v1/components/*.jsx` — concrete visual/interaction baseline for Phase 9
- `requirements/desing_v1/styles.css` — warm light palette, typography hierarchy, and shell patterns to reuse conceptually

### Upstream phase outputs
- `.planning/phases/04-rooms-and-membership/04-VERIFICATION.md` — deferred room-members UI gap now addressed in Phase 9
- `.planning/phases/05-contacts-and-dm-policy/05-CONTEXT.md` — contacts sidebar, pending friend-request, and DM-entry decisions
- `.planning/phases/06-messaging-core/06-CONTEXT.md` — watermark and history contracts intended for Phase 9 infinite scroll
- `.planning/phases/06.1-websocket-realtime-client/06.1-03-PLAN.md` — existing smart-autoscroll behavior that Phase 9 must preserve

### Existing code anchors
- `apps/web/src/App.tsx` — current authenticated shell and top-level navigation state
- `apps/web/src/features/messages/` — timeline and chat surfaces
- `apps/web/src/features/rooms/` — room list, room management, and room-entry surfaces
- `apps/web/src/features/contacts/` — contacts list, notification badge, and DM entry points
- `apps/web/src/features/account/` — session/password/account surfaces to fold into the product shell
- `apps/web/src/styles.css` — current shared styling baseline
</canonical_refs>

<code_context>
## Existing Code Insights

### Already available
- Realtime message updates and smart autoscroll are already implemented in Phase 6.1.
- Contacts sidebar and DM entry points exist, but unread/product polish is deferred.
- Active sessions and password/account settings views already exist, but are not integrated into a final product shell.
- Room-management UI exists, but some room-member/context rendering is still intentionally deferred to Phase 9.

### Known gaps that Phase 9 should close
- The app shell is still a transitional implementation container rather than a final classic chat product layout.
- Infinite upward history loading remains deferred even though message range metadata exists.
- Room/contact unread affordances are not implemented as shipped UI behavior.
- Admin actions are scattered across feature surfaces instead of being normalized into menu/modal UX.
</code_context>

<specifics>
## Specific Ideas

- Start Phase 9 by stabilizing one coherent shell in `App.tsx` plus a small number of child layout components instead of incrementally adding more state to the current top-level file.
- Treat room members/context panel as part of the right rail, not as ad hoc inline content inside each feature view.
- Keep attachment-related rendering opportunistic: support it where already wired, but do not let it drive the Phase 9 structure.
- Use `desing_v1` as a design grammar:
  - warm paper-like backgrounds instead of the current dark utility shell
  - serif headlines/logo and mono metadata labels
  - top navigation that exposes the main product areas directly
  - accordion-style room rail once the user is inside a conversation
  - modal-driven room management rather than treating every admin view as a standalone page
</specifics>

<deferred>
## Deferred Ideas

- Attachment polish and preview generation — still deferred with Phase 7
- Message deletion and destructive moderation/account cascades — still deferred with Phase 8
- Final performance tuning and release QA hardening — Phase 10
</deferred>

---

*Phase: 09-frontend-productization*
*Context gathered: 2026-04-20*
