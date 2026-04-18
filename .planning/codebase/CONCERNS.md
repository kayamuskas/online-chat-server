# Codebase Concerns

**Analysis Date:** 2026-04-18

## Tech Debt

**Repository Scope Mismatch:**
- Issue: The repository is named and described as an online chat server, but the tracked artifacts are product notes and wireframes rather than an implemented service.
- Files: `notes.md`, `requirements/requirements_raw.md`, `requirements/wireframes.md`, `requirements/desing_v1/index.html`
- Impact: Delivery risk is understated. Planning, estimation, and review can assume a backend exists when there is no runtime, API surface, persistence layer, or deployment definition to validate.
- Fix approach: Add an executable application skeleton before feature work. At minimum introduce a server entry point, package/runtime manifest, environment contract, persistence strategy, and a README that distinguishes prototype assets from production code.

**No Buildable Application Baseline:**
- Issue: No `package.json`, lockfile, `src/`, `server/`, `app/`, `tests/`, container definition, or CI workflow is present in the repository root.
- Files: `requirements/`, `.planning/codebase/`
- Impact: There is no reproducible way to install dependencies, run a server, run tests, or verify that future implementation work matches the requirements.
- Fix approach: Establish a minimal buildable baseline first. Add package management, scripts, runtime configuration, and a smoke-test path before implementing chat features.

**Prototype Mixed With Source-Like Assets:**
- Issue: `requirements/desing_v1/` contains JSX component files and a browser-loaded React page, but it functions as a design artifact rather than a product codebase.
- Files: `requirements/desing_v1/index.html`, `requirements/desing_v1/components/auth.jsx`, `requirements/desing_v1/components/main_chat.jsx`, `requirements/desing_v1/components/manage.jsx`
- Impact: Future contributors can mistake wireframe code for production foundations, leading to copy-forward of static assumptions, missing validation, and architecture drift.
- Fix approach: Either move the prototype under a clearly named design sandbox such as `prototypes/` or add explicit documentation that `requirements/desing_v1/` is non-production reference material.

**Requirements Complexity Without Architectural Decisions:**
- Issue: The spec requires cross-tab presence, per-browser sessions, private rooms, room moderation, DMs restricted by friendship rules, attachment ACLs, and deletion cascades, but there is no system design artifact mapping those rules to storage and transport behavior.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/index.html`
- Impact: Teams can start building incompatible slices of the system, especially around presence, access control, and data retention, which are hard to retrofit.
- Fix approach: Produce an architecture decision record set covering auth/session model, real-time transport, storage schema, file access model, and moderation semantics before implementation starts.

## Known Bugs

**Implemented Server Is Not Present:**
- Symptoms: The repository cannot run as an online chat server because no server executable, API handlers, or data layer exist.
- Files: `notes.md`, `requirements/requirements_raw.md`, `requirements/desing_v1/index.html`
- Trigger: Attempting to follow the repository name and requirements as if the system were implemented.
- Workaround: Treat the repository strictly as requirements and design input until a runnable application is added.

**Frontend Prototype Depends On External CDN Runtime:**
- Symptoms: The wireframe page only works when external React, ReactDOM, Babel, and Google Fonts resources are reachable.
- Files: `requirements/desing_v1/index.html`
- Trigger: Opening `requirements/desing_v1/index.html` offline or in a restricted environment.
- Workaround: Use it only as a connected design preview, or vendor the assets into a proper frontend build if the prototype must remain runnable.

**Viewport Is Fixed For Desktop Mockup Only:**
- Symptoms: The prototype sets a fixed viewport width rather than responsive sizing.
- Files: `requirements/desing_v1/index.html`
- Trigger: Opening the prototype on mobile or narrow screens.
- Workaround: None in the current repo. This is a wireframe limitation, not a production-ready layout.

## Security Considerations

**Authentication Policy Leaves High-Risk Gaps Unspecified:**
- Risk: The requirements explicitly omit email verification and require persistent login plus per-browser sessions, but the repo contains no compensating controls for account recovery abuse, session theft, or brute-force protection.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/components/auth.jsx`, `requirements/desing_v1/components/account.jsx`
- Current mitigation: None detected in code or configuration.
- Recommendations: Define password hashing algorithm, session rotation rules, reset-token expiry, rate limiting, CSRF strategy, secure-cookie settings, and suspicious-login handling before implementation.

**Attachment Handling Is Security-Critical But Undesigned:**
- Risk: The spec allows arbitrary file types up to 20 MB and stores files on the local filesystem, but no content validation, malware scanning, path isolation, or signed-download approach is defined.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/components/account.jsx`, `requirements/desing_v1/components/main_chat.jsx`
- Current mitigation: UI copy mentions file size only.
- Recommendations: Specify MIME/type validation, quarantine/scanning policy, storage root isolation outside the web root, filename normalization, authorization checks on every download, and deletion behavior for room membership changes.

**Moderation And Access-Control Rules Are Easy To Get Wrong:**
- Risk: The rules for bans, room membership removal, DM eligibility, and post-removal file access are nuanced and create several authorization edges.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/components/manage.jsx`, `requirements/desing_v1/components/contacts.jsx`, `requirements/desing_v1/components/personal.jsx`
- Current mitigation: Static explanatory labels in the prototype.
- Recommendations: Treat authorization as a first-class domain layer with policy tests for friendship, ban state, room membership, room ownership, and attachment access after membership changes.

**Third-Party Script Execution In Prototype:**
- Risk: The wireframe page executes `@babel/standalone` and React from public CDNs in the browser.
- Files: `requirements/desing_v1/index.html`
- Current mitigation: Integrity attributes are present for the script tags in `requirements/desing_v1/index.html`.
- Recommendations: Keep this isolated from any production deployment path. Do not evolve this page into a shipped app surface; move to a build pipeline with pinned dependencies instead.

## Performance Bottlenecks

**No Real-Time Architecture For 300 Concurrent Users:**
- Problem: The requirements claim support for up to 300 simultaneous users, but no transport, fan-out, presence, or backpressure design exists.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/index.html`
- Cause: Scale targets are listed in requirements and prototype copy, but there is no implementation or benchmark harness.
- Improvement path: Choose the real-time stack early, define connection/session lifecycle, and add load-test scenarios before feature breadth expands further.

**Message History Requirements Imply Expensive Queries:**
- Problem: The system requires persistent history, older-message pagination, unread markers, reply chains, edits, and deletions, but no storage/indexing plan exists.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/components/main_chat.jsx`
- Cause: The prototype shows infinite scroll and rich message metadata without any pagination, indexing, or retention design.
- Improvement path: Define message schema, cursor strategy, indexes, and archival boundaries before writing API handlers.

**Filesystem Attachments Can Become Operational Hotspots:**
- Problem: Local filesystem storage for attachments can become slow and hard to manage as room history grows and deletion cascades increase.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/components/account.jsx`, `requirements/desing_v1/components/manage.jsx`
- Cause: The requirements choose local storage but do not define directory sharding, cleanup jobs, or storage quotas beyond per-file size.
- Improvement path: Specify storage layout, background cleanup, quota monitoring, and migration path to object storage if the product scope grows.

## Fragile Areas

**Spec-Driven Domain Rules:**
- Files: `requirements/requirements_raw.md`
- Why fragile: Many business rules interact: bans affect friendships, friendships gate DMs, room ownership affects deletion, and account deletion cascades into rooms and files. Small implementation mistakes will create inconsistent user-visible behavior.
- Safe modification: Convert each rule cluster into executable policy tests before building controllers or UI flows.
- Test coverage: No automated tests exist in the repository.

**Wireframe Components Encode Behavior Informally:**
- Files: `requirements/desing_v1/components/auth.jsx`, `requirements/desing_v1/components/main_chat.jsx`, `requirements/desing_v1/components/manage.jsx`, `requirements/desing_v1/components/account.jsx`
- Why fragile: The JSX files present polished states and labels that look implementation-ready, but they are static examples with hard-coded values and no state model. Reusing them directly would spread placeholder assumptions into production.
- Safe modification: Treat them as visual references only. Rebuild product code from explicit contracts and testable view models.
- Test coverage: No component tests or snapshot tests exist.

**Documentation-Only Repository State:**
- Files: `notes.md`, `requirements/requirements_raw.md`, `requirements/wireframes.md`
- Why fragile: Product intent is concentrated in prose and mockups, so every new implementation decision depends on human interpretation instead of executable contracts.
- Safe modification: Add living technical artifacts early: API contracts, schema definitions, event models, and acceptance tests derived from the requirements.
- Test coverage: No acceptance harness or traceability matrix exists.

## Scaling Limits

**Current Capacity: Zero Application Throughput**
- Current capacity: No request handling, websocket handling, persistence, or background processing is implemented.
- Limit: The repository cannot serve even a single authenticated chat session in its current state.
- Scaling path: Build a minimal end-to-end slice first: auth, one room, message persistence, and one real-time channel with instrumentation.

**Operational Readiness: Not Established**
- Current capacity: No deployment manifest, health checks, observability, backups, or environment contract detected.
- Limit: Even if code were added quickly, production readiness would stall on infrastructure and operations basics.
- Scaling path: Add deployment definitions, environment documentation, structured logging, metrics, and backup/restore procedures alongside the first backend milestone.

## Dependencies at Risk

**Browser CDN Dependencies In Design Prototype:**
- Risk: The design sandbox depends on external versions of React, ReactDOM, Babel, and Google Fonts resolved at runtime.
- Impact: The prototype can break due to network restrictions, asset removal, or CDN changes unrelated to repository commits.
- Migration plan: Move the prototype into a managed frontend toolchain with pinned dependencies if it needs continued maintenance.

## Missing Critical Features

**Backend Application Skeleton:**
- Problem: There is no server implementation, API surface, data model, or persistence layer.
- Blocks: Authentication, rooms, messaging, moderation, attachment handling, and session management cannot be developed or verified end to end.

**Security And Operations Baseline:**
- Problem: No environment configuration contract, secret handling policy, deployment setup, logging, or recovery flow is documented in executable form.
- Blocks: Safe implementation of auth, file storage, and production deployment.

**Automated Verification:**
- Problem: No unit, integration, end-to-end, or load tests exist.
- Blocks: High-risk rules in `requirements/requirements_raw.md` cannot be validated against regressions as implementation begins.

## Test Coverage Gaps

**Entire Product Surface Is Untested:**
- What's not tested: All functional requirements, because there is no application code or test harness.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/`, `notes.md`
- Risk: The project can appear active while having no executable proof that the specified chat behaviors work.
- Priority: High

**Authorization Edge Cases Are Untested:**
- What's not tested: Ban rules, friend-only DMs, session revocation, room ownership constraints, and attachment access revocation.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/components/manage.jsx`, `requirements/desing_v1/components/account.jsx`
- Risk: These are the most likely areas to produce security and data-leak regressions once implementation starts.
- Priority: High

**Scalability Claims Are Untested:**
- What's not tested: The stated support target of 300 simultaneously connected users and the history/attachment workloads implied by the requirements.
- Files: `requirements/requirements_raw.md`, `requirements/desing_v1/index.html`
- Risk: Performance promises can be carried into planning and delivery without any evidence that the eventual architecture can satisfy them.
- Priority: Medium

---

*Concerns audit: 2026-04-18*
