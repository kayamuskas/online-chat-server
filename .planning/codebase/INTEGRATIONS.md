# External Integrations

**Analysis Date:** 2026-04-18

## APIs & External Services

**Frontend CDN assets:**
- UNPKG - serves React, ReactDOM, and Babel Standalone to `requirements/desing_v1/index.html`
  - SDK/Client: direct `<script src="https://unpkg.com/...">` tags
  - Auth: none
- Google Fonts - serves `Iowan Old Style`, `JetBrains Mono`, and `Caveat` to `requirements/desing_v1/index.html`
  - SDK/Client: direct `<link href="https://fonts.googleapis.com/...">`
  - Auth: none

**Embedded design host messaging:**
- Parent frame integration - the prototype emits edit-mode events with `window.parent.postMessage(...)` in `requirements/desing_v1/index.html` and `requirements/desing_v1/components/tweaks.jsx`
  - SDK/Client: browser `postMessage` API
  - Auth: none

**Planned but not implemented services:**
- Email/password reset flow - required by `requirements/requirements_raw.md` and mocked in `requirements/desing_v1/components/auth.jsx`, but no mail provider or backend endpoint exists in code
  - SDK/Client: Not detected
  - Auth: Not detected
- Jabber/XMPP and federation - listed as advanced requirements in `requirements/requirements_raw.md`, and explicitly marked "deferred per request" in `requirements/desing_v1/index.html`
  - SDK/Client: Not detected
  - Auth: Not detected

## Data Storage

**Databases:**
- No database integration is implemented
  - Connection: Not detected
  - Client: Not detected
- Future persistence requirements call for long-lived message history in `requirements/requirements_raw.md`, but no schema, ORM, migration tooling, or database config exists

**File Storage:**
- Current repo stores only static design assets and docs on the local filesystem under `requirements/`
- Future application requirement specifies local filesystem attachment storage in `requirements/requirements_raw.md`

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Custom auth is implied by the requirements and wireframes in `requirements/requirements_raw.md` and `requirements/desing_v1/components/auth.jsx`
  - Implementation: planned email + password + username flow only; no auth service, OAuth provider, session store, cookie handling, or token implementation exists in code

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- None detected in implementation
- The only runtime signaling is UI edit-mode messaging via `postMessage` in `requirements/desing_v1/index.html` and `requirements/desing_v1/components/tweaks.jsx`

## CI/CD & Deployment

**Hosting:**
- Not detected
- The current artifact can only be served as static files; no deployment manifests are present

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- None detected in current codebase
- Future backend will likely need configuration for auth, persistence, and email delivery based on `requirements/requirements_raw.md`, but variable names are not defined anywhere

**Secrets location:**
- Not detected

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected
- Browser-to-parent callbacks via `window.parent.postMessage(...)` are used only for prototype editing, not as network webhooks, in `requirements/desing_v1/index.html` and `requirements/desing_v1/components/tweaks.jsx`

---

*Integration audit: 2026-04-18*
