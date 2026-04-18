# Online Chat Server

## What This Is

This project is a production-like classic web chat application delivered as a single-server web stack with one browser client. It must implement the full primary scope from `requirements/requirements_raw.md` for v1, while treating `requirements/wireframes.md` and `requirements/desing_v1/` as starting UI references rather than the source of truth. The final result must be runnable by an external QA engineer from a public repository via `git clone && docker compose up`, without requiring internet access beyond already preloaded Docker base images.

## Core Value

A fresh clone must start a fully functional classic chat system locally, offline, and in a way that matches the written requirements more strictly than any existing prototype.

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
- Internet-hosted dependencies during QA startup — forbidden by the acceptance criteria for offline operation.

## Context

The repository currently contains product requirements and frontend design artifacts, not an implemented chat server. The authoritative product rules live in `requirements/requirements_raw.md`; the original screen sketches live in `requirements/wireframes.md`; and the current visual prototype lives in `requirements/desing_v1/`.

The existing codebase map in `.planning/codebase/` confirms that `requirements/desing_v1/index.html` is a browser-loaded React wireframe prototype using CDN scripts and runtime Babel, with no backend, package manifests, test suite, Docker setup, or deployment entrypoints. That existing material is useful as domain and UI input, but it does not count as shipped product capability.

The target system is closer to production than a hackathon demo. It must support persistent history, room moderation, attachment access control, multi-tab presence semantics, and enough operational discipline that an external QA engineer can clone the repository and start the stack deterministically through Docker Compose.

## Constraints

- **Scope**: Full primary specification in v1 — the whole non-advanced requirement set must be implemented, even if delivered incrementally through milestones.
- **Delivery**: `git clone && docker compose up` must work — external QA cannot rely on undocumented local setup.
- **Offline Runtime**: No internet access during startup or use — assume required Docker images already exist locally, but application dependencies must not be fetched online during QA execution.
- **Topology**: Single server for v1 — no multi-server federation is required before v2.
- **Product Truth**: `requirements/requirements_raw.md` wins over prototype visuals — design can move, split, or change to satisfy the written behavior.
- **Storage**: Attachments must live on the local filesystem — this is an explicit non-functional requirement, not an implementation preference.
- **UX Direction**: Classic web chat, not a social network or collaboration suite — the interface should feel utilitarian and chat-centric.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat `requirements/requirements_raw.md` as the source of truth | The user explicitly prioritized strict requirement compliance over the current design prototype | — Pending |
| Scope Jabber/federation as v2 | The source requirements mark it as advanced follow-on work and the user confirmed it should not block v1 | — Pending |
| Target a single-server Docker Compose deployment for v1 | QA acceptance is based on one local stack started from a fresh clone | — Pending |
| Require offline-capable startup | The user defined offline operation as part of "done", so packaging and dependency strategy must account for it from the beginning | — Pending |
| Use the existing wireframes and `desing_v1` only as design input | The prototype is valuable reference material but cannot override the spec or constrain architecture decisions prematurely | — Pending |

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
