# Phase 3: Sessions and Presence - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement multi-session management, IP tracking, last-seen persistence, and correct multi-tab presence semantics. This phase adds active-session inventory, targeted session revocation, `sign out all other sessions`, browser/IP visibility, and live `online / AFK / offline` behavior. It does not add rooms, contacts management, or broader chat product features beyond the presence/session rules already scoped in Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Session inventory UX
- **D-01:** The active-sessions UI should match the provided reference closely: a table/list with `Device / Browser`, `IP`, and `Last active` columns, per-row `Sign out` actions, and a visible `This browser` badge on the current session.
- **D-02:** The session inventory includes a global `Sign out all other sessions` action in this phase, visible on the same screen as the session list.
- **D-03:** The current session is revocable from the same list. If the user signs out `This browser`, the current tab should immediately return to the sign-in screen.
- **D-04:** Session revocation should feel fast. A confirmation step is acceptable as either a modal or a compact popover; exact choice is left to implementation discretion.
- **D-05:** `Last active` should use humanized labels like `now`, `2h ago`, and `yesterday`, matching the reference. Exact timestamp may appear as secondary microtext or on hover.

### Session metadata and IP visibility
- **D-06:** Active-session rows should show device/browser labeling in the style of the reference, e.g. `Chrome · macOS`, `Firefox · Windows`, `Safari · iPhone`.
- **D-07:** IP addresses should be shown in full, not masked.
- **D-08:** Phase 3 should support `X-Forwarded-For` handling in addition to direct request IP extraction so the session/IP model remains compatible with proxied deployments later.

### Presence semantics and presentation
- **D-09:** Presence statuses remain exactly `online`, `AFK`, and `offline`.
- **D-10:** In compact lists such as contacts and chat lists, presence is shown like the design reference: colored indicator only, without explicit status text.
- **D-11:** In detail surfaces such as room/member info, explicit status text is shown, e.g. `Carol (AFK)`.
- **D-12:** Presence colors follow the reference direction: `online` green, `AFK` muted yellow/amber, `offline` gray.
- **D-13:** When a user is `offline`, the UI should also show textual `last seen` information.

### Multi-tab activity model
- **D-14:** Presence activity should consider mouse activity, keyboard activity, browser focus, and tab visibility.
- **D-15:** The system should use non-aggressive practical semantics for hibernation/offload and resume handling. It should behave like common chat apps rather than flipping status too eagerly on minor transient changes.
- **D-16:** Existing raw-spec rules stay locked: if at least one tab is active, the user is `online`; `AFK` applies only when all tabs are inactive for more than one minute; `offline` applies only when all tabs are closed or offloaded.

### the agent's Discretion
- Exact confirm component choice for revoke actions: modal vs popover.
- Exact heuristics/timers that make the multi-signal activity model feel stable, as long as they preserve the locked one-minute AFK boundary and avoid aggressive status flapping.
- Exact placement of secondary absolute timestamps (`hover`, microtext, or equivalent) as long as the main list stays visually close to the reference.

</decisions>

<specifics>
## Specific Ideas

- Session inventory should look like the provided `Active sessions` mock: strong section title, explanatory subcopy, three-column table/list, `This browser` badge, and a red-emphasis `Sign out all other sessions` action.
- Compact presence surfaces should look like the contacts/chat-list reference: colored status dots only.
- Detailed member/info surfaces should look like the room-info reference: explicit inline status text such as `(AFK)`.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 3: Sessions and Presence — phase goal and success criteria.
- `.planning/REQUIREMENTS.md` — `SESS-01` through `SESS-07`.
- `requirements/requirements_raw.md` §2.2 User Presence and Sessions — canonical `online / AFK / offline` and multi-tab rules.
- `requirements/requirements_raw.md` near the end-state bullet list — locks `offline only when no open tabs`, `most active tab` semantics, and current-session-only sign-out compatibility.

### Design direction
- `requirements/desing_v1/` — visual reference for compact presence indicators and detailed member/info rendering.
- User-provided Phase 3 reference images from discussion — canonical for the active-session table layout and presence display split between compact vs detailed contexts.

### Project-wide constraints
- `.planning/PROJECT.md` — runtime-state presence direction, browser-tab hibernation constraint, and targeted session/IP expectations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/auth/session.repository.ts` — already stores one durable row per browser session, supports token lookup, targeted delete, and `touchLastSeen`.
- `apps/api/src/auth/auth.service.ts` — already resolves current user from opaque session token and invalidates only the presented current session.
- `apps/api/src/auth/session-policy.ts` — already centralizes transient vs persistent session TTL rules from Phase 2.
- `apps/api/src/db/postgres.service.ts` and `apps/api/src/db/migrations/0001_auth_core.sql` — already create the `sessions` table with `expires_at`, `last_seen_at`, and a durable per-session record model.
- `apps/web/src/App.tsx` — already has `/account` as the authenticated route and can be extended into the Phase 3 session-management surface.
- `apps/web/src/features/account/SessionActionsView.tsx` — current minimal session UI; likely the closest starting point for a richer inventory screen.

### Established Patterns
- Opaque server-side sessions in PostgreSQL are already the committed auth model; Phase 3 should extend that model rather than replace it.
- Current-session sign-out is already deliberately targeted; broader session revocation must preserve that per-session granularity.
- The web app currently uses lightweight local route handling instead of a full router; planning should decide whether Phase 3 continues that pattern or introduces only the minimum extra route state needed.

### Integration Points
- API-side session inventory and revoke endpoints will extend the existing auth/session module.
- IP capture likely connects at request extraction / sign-in time and must remain compatible with existing rate-limit IP handling.
- Presence runtime state will need to connect to the existing Nest WebSocket layer and Redis-based ephemeral coordination direction established in project research.

</code_context>

<deferred>
## Deferred Ideas

- Rooms, contacts workflows, and broader chat-shell navigation stay in later phases even though Phase 3 presence will eventually surface inside those views.
- Geo/IP enrichment beyond raw IP display is not part of this phase discussion.

</deferred>

---

*Phase: 03-sessions-and-presence*
*Context gathered: 2026-04-18*
