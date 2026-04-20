# Online Chat Server

## What This Is

This project is a production-like classic web chat application delivered as a single-server web stack with one browser client. It must implement the full primary scope from `requirements/requirements_raw.md` for v1, while treating `requirements/wireframes.md` and `requirements/desing_v1/` as starting UI references rather than the source of truth. The final result must be runnable by an external QA engineer from a public repository via `git clone && docker compose up`, with application dependencies resolved during Docker image builds from the committed lockfile.

## Core Value

A fresh clone must start a fully functional classic chat system locally and in a way that matches the written requirements more strictly than any existing prototype.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Deliver the full v1 scope from `requirements/requirements_raw.md`, excluding only the explicitly advanced Jabber/federation section.
- [ ] Build a production-like backend, frontend, persistence, and realtime layer that work together under one local Docker Compose stack.
- [ ] Preserve the current wireframe and `requirements/desing_v1/` prototype as design input, but allow structural and visual changes wherever the requirements demand it.
- [ ] Make the repository operable by a third-party QA engineer with no hidden setup and no dependency downloads at runtime.
- [ ] Preserve classic web chat UX: rooms and contacts on the side, messages centered, composer at the bottom, members/context on the right.

### Out of Scope

- Jabber/XMPP client support in v1 — explicitly deferred to v2 because the source requirements mark it as advanced follow-on work.
- Federation between multiple servers in v1 — deferred with Jabber because v1 is scoped to a single local server and ordinary web client.
- Native mobile applications — not required by the specification and would dilute delivery of the web product.
- Hidden or undocumented setup steps during QA startup.

## Context

The repository currently contains product requirements and frontend design artifacts, not an implemented chat server. The authoritative product rules live in `requirements/requirements_raw.md`; the original screen sketches live in `requirements/wireframes.md`; and the current visual prototype lives in `requirements/desing_v1/`.

The existing codebase map in `.planning/codebase/` confirms that `requirements/desing_v1/index.html` is a browser-loaded React wireframe prototype using CDN scripts and runtime Babel, with no backend, package manifests, test suite, Docker setup, or deployment entrypoints. That existing material is useful as domain and UI input, but it does not count as shipped product capability.

The target system is closer to production than a hackathon demo. It must support persistent history, room moderation, attachment access control, multi-tab presence semantics, and enough operational discipline that an external QA engineer can clone the repository and start the stack deterministically through Docker Compose.

Additional implementation hints already agreed for future planning:

- PostgreSQL is the required primary database.
- Queue-based processing is mandatory where asynchronous work exists.
- Presence state should stay out of the primary relational database except for persistent `last seen` data; online/offline/AFK should be served from fast runtime state to avoid unnecessary database reads.
- Track user IPs and simultaneous active sessions, with targeted logout / kill-session support.
- SMTP is not a real dependency for this project; mail flows can use mocks.
- Room names must be globally unique across both public and private rooms.
- Private-room invitations can target only already registered users.
- Message delivery/backlog mechanisms must not grow unbounded for users who disappear for a year or more.
- Chat history integrity should use incremental chat watermarks so gaps can be detected and history can be requeried safely.
- The system should use a pragmatic mix of REST and WebSockets: not polling-only, and not websocket-only for every data shape.
- Browser tab hibernation must be treated as a real runtime condition when designing presence semantics.
- Very old rooms may reach 100,000+ messages and still require progressive scroll with explicit test coverage.

## Constraints

- **Scope**: Full primary specification in v1 — the whole non-advanced requirement set must be implemented, even if delivered incrementally through milestones.
- **Delivery**: `git clone && docker compose up` must work — external QA cannot rely on undocumented local setup.
- **Startup Model**: `docker compose up` from a fresh clone must work using the committed manifests and lockfile, with dependency downloads allowed at Docker build time but not at container runtime.
- **Topology**: Single server for v1 — no multi-server federation is required before v2.
- **Product Truth**: `requirements/requirements_raw.md` wins over prototype visuals — design can move, split, or change to satisfy the written behavior.
- **Storage**: Attachments must live on the local filesystem — this is an explicit non-functional requirement, not an implementation preference.
- **UX Direction**: Classic web chat, not a social network or collaboration suite — the interface should feel utilitarian and chat-centric.
- **Database**: PostgreSQL is required — this is a project constraint, not an open choice.
- **Async Work**: Queues are mandatory — background and deferred work must be modeled explicitly.
- **Presence Model**: Online/offline/AFK should not be read from PostgreSQL on every check — runtime state plus durable `last seen` is the intended direction.
- **Mail**: Real SMTP is unnecessary in v1 — mocked or local mail flows are acceptable.
- **Identity of Rooms**: Room names must be unique across the entire system, including private rooms.
- **Invite Policy**: Invitations can be sent only to already registered users.
- **History Scale**: History may reach 100,000+ messages in old rooms and still must support progressive loading.
- **E2E Testing**: Playwright is the mandatory browser automation framework for all E2E and UAT tests — Cypress, Selenium, and other browser automation tools are out of scope.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat `requirements/requirements_raw.md` as the source of truth | The user explicitly prioritized strict requirement compliance over the current design prototype | — Pending |
| Scope Jabber/federation as v2 | The source requirements mark it as advanced follow-on work and the user confirmed it should not block v1 | — Pending |
| Target a single-server Docker Compose deployment for v1 | QA acceptance is based on one local stack started from a fresh clone | — Pending |
| Require fresh-clone Docker startup | The user defined `git clone && docker compose up` as part of "done", so packaging and dependency strategy must support lockfile-backed image builds without extra vendored caches | — Pending |
| Use the existing wireframes and `desing_v1` only as design input | The prototype is valuable reference material but cannot override the spec or constrain architecture decisions prematurely | — Pending |
| Use PostgreSQL as the system of record | The user explicitly fixed the database choice | — Pending |
| Require queues for asynchronous processing | The user explicitly marked queues as mandatory, which affects architecture from phase 1 onward | — Pending |
| Keep transient presence outside the main database and persist only `last seen` | This reduces unnecessary database queries and matches the intended runtime model | — Pending |
| Use mocked/local mail flows instead of real SMTP | Password-reset and similar flows need determinism, not external mail infrastructure | — Pending |
| Use a mixed REST + WebSocket architecture | High-frequency updates cannot rely on REST only, but websocket-only data access would overcomplicate the app | — Pending |
| Add chat watermarks for history integrity checks | The user wants explicit detection of missing message ranges in long-lived chats | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -> still the right priority?
3. Audit Out of Scope -> reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-18 after initialization*
