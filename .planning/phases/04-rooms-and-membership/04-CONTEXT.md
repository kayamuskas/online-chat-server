# Phase 4: Rooms and Membership - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement room creation, public-room catalog/search, private-room invitation flows, join/leave behavior, globally unique room names, and the base room role model. This phase defines how users create, discover, join, invite into, and leave rooms. It does not cover the later moderation-heavy room admin flows, message deletion, or room deletion cascades beyond the owner-cannot-leave rule already scoped here.

</domain>

<decisions>
## Implementation Decisions

### Room creation contract
- **D-01:** Creating a room requires only `name`.
- **D-02:** `visibility` defaults to `public` when the user does not change it explicitly.
- **D-03:** `description` is optional at creation time.

### Public room catalog
- **D-04:** The public-room catalog must show `name`, `description`, and `member count`.
- **D-05:** Public-room search must match both room name and description.

### Private room invitations
- **D-06:** Private-room invites must work both by direct `username` entry and from existing UI user lists when such a list is available in the surface.
- **D-07:** Invitation targets remain constrained to already registered users, per project-wide decisions.

### Membership behavior
- **D-08:** Ordinary members can leave a room immediately without a confirmation step.
- **D-09:** Room owners cannot leave their own room.
- **D-10:** When an owner attempts to leave, the product must show a clear refusal explaining that the owner must delete the room instead.

### Roles and management scope
- **D-11:** Phase 4 should ship the full `owner / admin / member` model, not just owner/member.
- **D-12:** Phase 4 should include the UI and behavior needed for full role management and ban-list operations, rather than deferring those surfaces to a later moderation-only pass.

### the agent's Discretion
- Exact layout of the room-creation form, as long as the required/default field contract above is preserved.
- Exact presentation pattern for the public-room catalog (`table`, `list`, or `cards`) as long as name, description, member count, and search behavior are preserved.
- Exact invite-surface composition when both direct username entry and existing user-list actions are available.

</decisions>

<specifics>
## Specific Ideas

- The room-creation flow should feel lightweight: a user can create a room with just a name and accept the default public visibility.
- Public-room discovery should feel like a real browse/search surface, not a bare join endpoint hidden behind raw identifiers.
- Private-room invites should not force a single interaction style; typing a username and using existing user lists are both valid entry points.
- Owner restrictions should be explicit in the UX rather than failing silently.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 4: Rooms and Membership — phase goal and success criteria.
- `.planning/REQUIREMENTS.md` — `ROOM-01`, `ROOM-02`, `ROOM-03`, `ROOM-04`, `ROOM-05`, `ROOM-06`, `ROOM-10`, `ROOM-11`.
- `requirements/requirements_raw.md` — canonical room rules, visibility constraints, membership behavior, and invitation requirements.

### Project-wide constraints
- `.planning/PROJECT.md` — global uniqueness, offline/local-stack constraints, and classic chat UX direction.
- `.planning/phases/03-sessions-and-presence/03-CONTEXT.md` — presence presentation and session/account UI decisions that future room/member surfaces should stay compatible with.

### Design direction
- `requirements/wireframes.md` — room and main-chat reference direction.
- `requirements/desing_v1/components/rooms.jsx` — room list, creation, and owner-warning reference patterns.
- `requirements/desing_v1/components/main_chat.jsx` — classic chat shell and room/member panel context.
- `requirements/desing_v1/components/manage.jsx` — admin/member management interaction reference.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/auth/*` — authenticated-user and session patterns that room/member endpoints should reuse for ownership and membership operations.
- `apps/api/src/db/postgres.service.ts` — current migration/bootstrap pattern for extending the schema with new room and membership tables.
- `apps/web/src/App.tsx` — existing authenticated shell that can host room catalog, room creation, and room-management entry points.
- `apps/web/src/features/presence/*` — reusable member-status primitives for future room member lists.

### Established Patterns
- Backend capability is added as explicit domain modules plus PostgreSQL-backed persistence, then surfaced through thin controllers/gateways.
- Frontend account/session work already uses compact local UI state machines instead of heavy routing; Phase 4 should preserve that bias unless planning finds a strong reason to expand it.
- Presence/status rendering has already been split into compact vs detailed primitives; room/member surfaces should reuse that contract rather than redefine presence semantics.

### Integration Points
- Room creation, catalog, join/leave, invite, role, and ban-list behavior will connect to the authenticated API surface and PostgreSQL domain model.
- Public-room catalog and membership state will become foundational inputs for later messaging, moderation, unread, and member-panel phases.
- Private-room invite flows will need user lookup against the existing registered-user domain, not ad hoc freeform invitations.

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope, though later planning may still split the work across multiple Phase 4 plans.

</deferred>

---

*Phase: 04-rooms-and-membership*
*Context gathered: 2026-04-18*
