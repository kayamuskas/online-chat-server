# Phase 4: Rooms and Membership - Research

**Researched:** 2026-04-18  
**Domain:** room domain modeling, catalog/search, invitation flows, membership lifecycle, owner/admin permissions, room ban state, classic chat room-management UI  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Creating a room requires only `name`.
- `visibility` defaults to `public` when the user does not change it explicitly.
- `description` is optional at creation time.
- The public-room catalog must show `name`, `description`, and `member count`.
- Public-room search must match both room name and description.
- Private-room invites must work both by direct `username` entry and from existing UI user lists when such a list is available in the surface.
- Invitation targets remain constrained to already registered users.
- Ordinary members can leave a room immediately without a confirmation step.
- Room owners cannot leave their own room.
- When an owner attempts to leave, the product must show a clear refusal explaining that the owner must delete the room instead.
- Phase 4 should ship the full `owner / admin / member` model, not just owner/member.
- Phase 4 should include the UI and behavior needed for full role management and ban-list operations, rather than deferring those surfaces to a later moderation-only pass.

### the agent's Discretion
- Exact layout of the room-creation form, as long as the required/default field contract above is preserved.
- Exact presentation pattern for the public-room catalog (`table`, `list`, or `cards`) as long as name, description, member count, and search behavior are preserved.
- Exact invite-surface composition when both direct username entry and existing user-list actions are available.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope, though planning may still split execution across multiple Phase 4 plans.

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Room identity and uniqueness | Database/Storage | API/Backend | Global uniqueness and ownership rules must be enforced durably. |
| Room creation/update/join/leave/invite/ban logic | API/Backend | Database/Storage | These are domain-policy operations, not frontend-only state transitions. |
| Public-room catalog and search | API/Backend | Database/Storage | Catalog results need filtered, queryable room data with member counts. |
| Room-management UI | Browser/Client | API/Backend | User workflows for create, join, manage, invite, and ban need explicit product surfaces over backend truth. |
| Presence rendering inside member lists | Browser/Client | API/Backend | Presence truth is already computed elsewhere; Phase 4 just consumes the shared rendering contract. |
| Membership-derived access control foundation | API/Backend | Database/Storage | Later messages/files depend on room membership and ban state being authoritative here. |

</architectural_responsibility_map>

<research_summary>
## Summary

Phase 4 is the point where the product stops being “auth + account + presence” and starts needing a real collaborative domain model. The requirements are not just CRUD for rooms: they define **room identity**, **visibility boundaries**, **membership transitions**, **invite constraints**, and **role-based authority** that later phases will depend on for messaging, moderation, attachments, and unread state. The standard implementation approach in this codebase is clear from earlier phases: PostgreSQL-backed domain tables plus thin authenticated controllers/services on the backend, with the React shell consuming focused REST surfaces rather than inventing local-only room state.

The strongest planning implication is that Phase 4 should establish the **room domain foundation before the UI tries to become rich**. That means starting with schema and backend policies for rooms, memberships, invites, admins, and bans, then layering the public-catalog and join/leave surfaces, then the owner/admin management actions, and only after that shipping the room-management UI. This keeps the phase vertically useful while protecting later phases from needing to revisit core authorization rules. [INFERRED from prior phase patterns and project architecture docs]

There is one explicit override relative to the original roadmap: the locked context pulls owner/admin management and ban-list operations into Phase 4, even though the original roadmap deferred full moderation capabilities to Phase 8. Planning should treat this as an intentional scope pull-forward rather than an accident. The execution consequence is that Phase 4 must build the **room authority model now**, while Phase 8 can later focus on heavier destructive/moderation cascades (message deletion, room deletion side effects, broader account deletion interactions) instead of first introducing basic role/ban mechanics.

**Primary recommendation:** break Phase 4 into four plans: room schema/domain foundation, public catalog and membership flows, private invites plus owner/admin/ban management API, and a final room UI plan that exposes catalog/create/manage/member flows using the already-approved classic chat shell direction.

</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS modules/controllers/services | existing repo stack | Room domain API and policy orchestration | Matches established backend structure from auth and presence phases. |
| PostgreSQL + SQL migrations | existing repo stack | Durable room, membership, invite, and ban state | Required for global uniqueness, relational integrity, and later history/file ACLs. |
| React 19 + existing app shell | existing repo stack | Public catalog, create-room, private-room, and manage-room UI | Reuses the shipped authenticated shell instead of introducing a second frontend pattern. |
| Shared `@chat/shared` env/constants contract | existing repo stack | API/web coordination and stable app-level constants | Already used across backend/frontend packages. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing presence UI primitives | existing repo code | Member-list status rendering | When member/admin tables or invite surfaces show user status. |
| Existing auth/session guard pattern | existing repo code | Scope room actions to the authenticated user | For all create/join/leave/invite/manage endpoints. |
| Existing smoke/validation script style | existing repo code | End-to-end room flow verification later in execution | When Phase 4 needs deterministic QA coverage. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL-first room domain | in-memory mock room store | Faster initial UI spike, but useless for uniqueness, membership rules, and later messaging integration. |
| Thin REST endpoints over authoritative DB rules | heavy frontend-managed room state | Faster demo UX, but breaks policy consistency and makes later messaging/ACL phases fragile. |
| Separate moderation module later for all admin/ban behavior | pull base admin/ban authority into Phase 4 now | Later-only approach matches the original roadmap better, but conflicts with the locked context and would force duplicate UI/domain work. |

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Room Domain As Relational Core
**What:** Model rooms, memberships, invitations, and room bans as separate PostgreSQL-backed relations with explicit ownership/admin/member state instead of embedding room state into JSON blobs or frontend-only caches.
**When to use:** Room creation, uniqueness checks, member counts, invite flow, admin changes, room ban enforcement.
**Why this fits:** Later phases for messages, attachments, unread indicators, and moderation all depend on room membership being authoritative and queryable.

### Pattern 2: Policy-First Service Layer
**What:** Controllers stay thin; services enforce owner/admin/member authority and translate actions like `leave`, `invite`, `make admin`, `remove admin`, `ban`, and `unban` into explicit domain operations.
**When to use:** Any room mutation that has actor-vs-target semantics.
**Why this fits:** The codebase already centralizes auth/session behavior in services, and Phase 4 introduces many cross-user policy checks that should not leak into controllers.

### Pattern 3: Catalog Query + Projection
**What:** Expose the public room catalog as a query projection that already includes `name`, `description`, `visibility`, and `member count`, rather than assembling it from multiple client calls.
**When to use:** Public-room browse/search screens and future left-side room list hydration.
**Why this fits:** The locked UI contract requires room discovery to feel like a real catalog, not a chain of low-level requests.

### Pattern 4: Membership Removal As Authority Event
**What:** Treat leave/remove/ban as distinct domain events with explicit behavior:
- member leave = voluntary removal
- owner leave = forbidden
- remove member by admin = ban semantics if the product rule says so
- unban = explicit reversal through the ban list
**When to use:** All membership and moderation-adjacent transitions.
**Why this fits:** The raw spec explicitly ties removal-by-admin to ban semantics, and later ACL phases depend on that meaning staying stable.

### Pattern 5: Classic Chat Shell Extension, Not New Navigation
**What:** Add room catalog/create/manage/member surfaces into the existing web shell and modal/panel conventions from the wireframes and prototype references, instead of inventing an unrelated dashboard.
**When to use:** Public catalog, private invites, manage-room, and owner/admin UI.
**Why this fits:** The project-level UX direction is explicitly “classic web chat,” and the design references already show how room management belongs in that shell.

### Anti-Patterns to Avoid
- **Room authority only in UI:** If owner/admin checks live primarily in the client, later message/file ACLs will drift immediately.
- **Private room visibility leaks:** Returning private rooms in catalog queries, or allowing fuzzy search to hit them, breaks the phase’s visibility contract.
- **Invite-by-string without registered-user validation:** The requirements explicitly restrict room invites to already registered users.
- **Treating “remove member” as simple leave:** The spec says admin removal acts as a ban; collapsing the two loses a core product rule.

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Global room uniqueness | frontend-only name availability checks | PostgreSQL unique constraint + API error handling | Only durable constraints prevent race conditions. |
| Member counts in catalog | client-side counting from room/member fetches | server-side query projection | The catalog needs real counts and search in one request. |
| Role/ban truth | ad hoc booleans scattered across components | explicit role + ban relations in backend domain model | Later moderation and ACL phases need a single source of truth. |

**Key insight:** Phase 4 is foundational domain work; shortcuts that are acceptable in a mock UI will create expensive rewrites once messaging and file access start depending on room authority.

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Visibility and membership rules get blended
**What goes wrong:** Public/private visibility, joinability, invitation state, and active membership are stored in a way that makes them hard to query independently.
**Why it happens:** Teams often model “room access” as one coarse boolean instead of separating visibility, invite state, membership, and ban state.
**How to avoid:** Keep room visibility on the room itself, membership in a dedicated relation, invites in their own relation, and bans explicit.
**Warning signs:** Private rooms start showing in browse/search results, or invite handling requires checking multiple ambiguous flags on the room row.

### Pitfall 2: Owner/admin semantics are under-modeled
**What goes wrong:** Owner/admin/member distinctions become ad hoc checks instead of explicit domain state, making “owner cannot leave” and “owner cannot lose admin” buggy.
**Why it happens:** Early room models often store “owner_id” but no real admin relation or policy boundary.
**How to avoid:** Represent owner and admins deliberately and encode policy checks in the service layer with tests around actor/target combinations.
**Warning signs:** API handlers compare raw IDs inline, or UI labels imply admin state the backend cannot prove.

### Pitfall 3: Ban semantics are introduced too late
**What goes wrong:** Remove-member flows ship first, then later moderation retrofits a ban list that is inconsistent with earlier membership behavior.
**Why it happens:** Teams treat ban state as “future moderation” even though the room lifecycle already depends on it.
**How to avoid:** Because the locked context pulled ban-list operations into this phase, build room ban state now alongside membership management.
**Warning signs:** Remove-member only deletes a membership row, with no durable reason the user cannot immediately rejoin.

</common_pitfalls>

<open_questions>
## Open Questions

1. **How much of ROOM-07/ROOM-08 should be considered formally pulled into Phase 4?**
   - What we know: The locked context explicitly requires full owner/admin/member management UI and ban-list operations in Phase 4.
   - What's unclear: The roadmap still assigns `ROOM-07` and `ROOM-08` to Phase 8.
   - Recommendation: Plan Phase 4 as the intentional source of base room authority and ban-list operations; later roadmap maintenance should reflect that pull-forward to avoid duplicate planning.

2. **Should public room filtering include additional sort/filter controls now?**
   - What we know: The locked context requires name/description/member-count and search by name + description.
   - What's unclear: Whether extra filters/sorting are desired now.
   - Recommendation: Keep Phase 4 to search plus a straightforward catalog presentation; avoid speculative filter scope.

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `.planning/phases/04-rooms-and-membership/04-CONTEXT.md` — locked Phase 4 product decisions.
- `.planning/ROADMAP.md` — phase goal and original requirement mapping.
- `.planning/REQUIREMENTS.md` — room requirement identifiers and traceability.
- `requirements/requirements_raw.md` — canonical room, invite, membership, role, and ban behavior.

### Secondary (MEDIUM confidence)
- `requirements/wireframes.md` — room/member/manage reference direction.
- `requirements/desing_v1/components/rooms.jsx` — public/private room and create-room reference behaviors.
- `requirements/desing_v1/components/manage.jsx` — owner/admin/member/ban-list interaction references.
- `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md` — project-level domain and risk guidance.

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: PostgreSQL-backed room domain + NestJS API + React room-management UI
- Ecosystem: existing repo stack only
- Patterns: relational room modeling, policy-first services, catalog projection, role/ban authority
- Pitfalls: visibility leaks, owner/admin drift, late ban modeling

**Confidence breakdown:**
- Standard stack: HIGH — follows existing repo stack and project constraints
- Architecture: MEDIUM — room authority is clear, but context intentionally overrides original roadmap boundaries
- Pitfalls: HIGH — strongly supported by source requirements and project concerns docs
- Code examples: LOW — no external docs or official library examples needed because this is phase/domain planning over the existing stack

**Research date:** 2026-04-18
**Valid until:** 2026-05-18

</metadata>

---

*Phase: 04-rooms-and-membership*
*Research completed: 2026-04-18*
*Ready for planning: yes*
