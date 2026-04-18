# Phase 5: Contacts and DM Policy - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the friendship lifecycle (send request → accept/decline → remove), user-to-user ban mechanics with DM history freezing, and DM eligibility enforcement. Phase 5 also delivers the contacts sidebar section and a DM screen stub so the UI surface is wired up even though real messaging is Phase 6. It does not implement the message engine, chat history, or attachment flows.

</domain>

<decisions>
## Implementation Decisions

### Pending friend requests — surface

- **D-01:** Incoming friend requests surface as a notification icon with an unread badge in the top navigation bar.
- **D-02:** Clicking the icon opens a dropdown panel listing pending incoming requests with "Accept" and "Decline" actions per row.
- **D-03:** Outgoing (sent) requests are not shown in the dropdown. Instead, the sender sees a "Request sent" status on the target user's profile/card, with a cancel option.

### Friend request entry points

- **D-04:** A user can send a friend request via `+ Add contact` in the sidebar — this opens a modal with a username field and a "Send request" button.
- **D-05:** A user can also send a request from an existing user list surface (e.g., room member list) — the action appears inline on the user row/card.
- **D-06:** The friend request may include optional text per FRND-01; the modal and any inline form should expose this optional field.

### Ban behavior

- **D-07:** Banning requires a confirmation modal: "Are you sure? This will block the user and remove the friendship."
- **D-08:** After a ban: the banned user sees an explicit message indicating the other user has restricted contact (e.g., "This user has restricted contact with you").
- **D-09:** A ban can be reversed — the banning user has a "Blocked users" list in account settings where they can unblock.
- **D-10:** When a ban is applied: the friendship is immediately terminated, and any existing DM conversation becomes read-only/frozen per FRND-05.
- **D-11:** Blocking is one-directional (A bans B). Either side can independently ban the other.

### DM initiation and eligibility gating

- **D-12:** Phase 5 includes a "Message" / "Write" button on user cards/profiles and in the contacts list. In Phase 5 this opens a DM screen stub (empty state); the real message engine arrives in Phase 6.
- **D-13:** When DM is not eligible (users are not friends, or a ban exists on either side), the button is rendered as disabled with a tooltip: "Add as friend to message" (or equivalent for the ban case).
- **D-14:** DM eligibility is enforced backend-side: the API must reject DM initiation if the friendship/ban constraint is not met, regardless of frontend state.

### Contacts sidebar section

- **D-15:** The main chat sidebar has a `CONTACTS` section below the `ROOMS` section (matching the provided design reference).
- **D-16:** Each contact row shows a colored presence dot (green = online, amber = AFK, gray = offline) consistent with the Phase 3 compact-presence pattern.
- **D-17:** The sidebar includes `+ Add contact` at the bottom, which opens the username-entry modal (D-04).
- **D-18:** The sidebar design reference (screenshot provided during discussion) is the layout contract: "ROOMS & CONTACTS" header, collapsible Public/Private room subsections, then CONTACTS list, then action buttons.

### Friendship removal

- **D-19:** Removing a friend (without banning) is a separate action from banning — it terminates the friendship but does not freeze DM history or block future requests.
- **D-20:** After removal, DM eligibility is lost (since friendship is required), but the conversation history is preserved and accessible.

### Claude's Discretion

- Exact visual style of the notification badge and dropdown panel, as long as it matches the sidebar reference direction.
- Exact tooltip copy for the disabled DM button.
- Whether "Blocked users" lives as a subsection of account settings or a standalone settings page.
- Exact layout of the username-entry modal.
- Whether friend removal requires a confirmation step (small destructive action — agent may decide).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 5: Contacts and DM Policy — phase goal and success criteria
- `.planning/REQUIREMENTS.md` — `FRND-01`, `FRND-02`, `FRND-03`, `FRND-04`, `FRND-05`, `FRND-06`
- `requirements/requirements_raw.md` §2.3 Contacts / Friends — canonical friendship rules, ban effects, and personal messaging eligibility

### Prior phase context
- `.planning/phases/03-sessions-and-presence/03-CONTEXT.md` — compact presence dot pattern (D-10 through D-13) that the contacts list must reuse
- `.planning/phases/04-rooms-and-membership/04-CONTEXT.md` — room member list patterns that Phase 5 friend-request entry point hooks into

### Design direction
- Sidebar screenshot (discussed 2026-04-18): "ROOMS & CONTACTS" layout with ROOMS (Public/Private) then CONTACTS section, presence dots, `+ Add contact` and `+ Create room` buttons at bottom — this is the layout contract for the sidebar
- `requirements/desing_v1/components/contacts.jsx` — contacts flow reference patterns
- `requirements/wireframes.md` — contacts and personal messaging wireframe direction

### Project-wide constraints
- `.planning/PROJECT.md` — PostgreSQL required, mixed REST/WebSocket, offline startup, classic chat UX

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/auth/` — authenticated-user and session patterns; friend/ban endpoints should use the same auth guard
- `apps/api/src/rooms/rooms.repository.ts` — pattern for a domain repository; `contacts.repository.ts` should follow the same structure
- `apps/api/src/rooms/rooms.types.ts` — pattern for domain type definitions
- `apps/web/src/features/rooms/` — established feature module layout (controller views + sub-components); `contacts/` feature should follow the same structure
- `apps/web/src/features/presence/` — presence dot primitives already built; contacts list reuses these directly

### Established Patterns
- Backend domain module: `{domain}.controller.ts`, `{domain}.service.ts`, `{domain}.repository.ts`, `{domain}.module.ts`, `{domain}.types.ts`
- Frontend feature: `apps/web/src/features/{domain}/` with named view components
- Presence rendering: colored dot only in compact lists (no text label) — reuse existing presence primitives, do not redefine
- Room member list already renders per-user rows; Phase 5 friend-request action should be added as an additional action on those rows

### Integration Points
- Friend/ban state will be read by Phase 6 (messaging) to gate DM access — the schema and service API must be designed with this consumer in mind
- The contacts sidebar section integrates into `apps/web/src/App.tsx` alongside the existing rooms sidebar
- Notification badge in the top nav connects to the existing nav bar component

</code_context>

<specifics>
## Specific Ideas

- Sidebar layout is locked by the provided design screenshot: ROOMS (collapsible Public/Private) then CONTACTS (with presence dots), then `+ Create room` / `+ Add contact` buttons at the bottom.
- The notification dropdown for friend requests should feel lightweight — not a full page navigation.
- DM button stub in Phase 5 should open a placeholder screen that Phase 6 can fill in without restructuring.

</specifics>

<deferred>
## Deferred Ideas

- Real message engine and DM chat history — Phase 6
- Unread indicators on contact rows — Phase 9 (NOTF-01, NOTF-02)
- Any search/filter within the contacts list beyond what's already in the sidebar search field

</deferred>

---

*Phase: 05-contacts-and-dm-policy*
*Context gathered: 2026-04-18*
