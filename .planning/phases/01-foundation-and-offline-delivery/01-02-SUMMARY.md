---
phase: 01-foundation-and-offline-delivery
plan: "02"
subsystem: web
tags: [vite, react, typescript, offline, healthz, static-assets, frontend-shell]

requires:
  - "01-01 (pnpm workspace, @chat/shared SERVICE_PORTS contract)"

provides:
  - "apps/web/vite.config.ts: buildable Vite config, no CDN references"
  - "apps/web/index.html: SPA entry with no runtime CDN/babel/font dependencies"
  - "apps/web/tsconfig.json: extends tsconfig.base.json, browser DOM + react-jsx"
  - "apps/web/src/main.tsx: React 19 createRoot bootstrap"
  - "apps/web/src/App.tsx: Phase 1 status shell displaying REST and WebSocket endpoints from SERVICE_PORTS"
  - "apps/web/src/styles.css: local-only styles, system font stack, no @import to hosted assets"
  - "apps/web/public/healthz: static readiness endpoint for web container healthcheck"
  - "apps/web/public/assets/prototype-reference/README.md: explains prototype is design-reference-only"

affects:
  - "01-03 and later plans: web container is now a real buildable Vite app"
  - "infra/compose: web service healthcheck can target /healthz"
  - "all later frontend plans build on apps/web/"

tech-stack:
  added:
    - "Vite 7.x (frontend build tool, local asset bundling)"
    - "@vitejs/plugin-react 5.x (React integration for Vite)"
    - "react 19.x + react-dom 19.x (already in package.json, now wired into src/)"
  patterns:
    - "apps/web/public/ as publicDir — static files served at root, including /healthz"
    - "React createRoot bootstrap in main.tsx — standard React 19 entry pattern"
    - "SERVICE_PORTS from @chat/shared imported by frontend — single source of truth for endpoint addresses"

key-files:
  created:
    - "apps/web/index.html (SPA shell, no CDN/babel/fonts references)"
    - "apps/web/vite.config.ts (defineConfig, react plugin, publicDir=public)"
    - "apps/web/tsconfig.json (extends tsconfig.base.json, DOM lib, react-jsx, Bundler resolution)"
    - "apps/web/src/main.tsx (React 19 createRoot entry point)"
    - "apps/web/src/App.tsx (Phase 1 status page with SERVICE_PORTS endpoints and offline delivery proof)"
    - "apps/web/src/styles.css (local-only dark theme, system font stack, no @import)"
    - "apps/web/public/healthz (static readiness file: content 'ok')"
    - "apps/web/public/assets/prototype-reference/README.md (notes prototype is design reference only)"
  modified: []

key-decisions:
  - "Used Bundler moduleResolution in tsconfig.json (not NodeNext) — Vite is the bundler and handles module resolution, not Node"
  - "healthz as a plain text static file in public/ — zero server logic, served by any static file server including Vite's preview server and nginx"
  - "Phase 1 UI limited to status/transport display only — T-01-05 mitigated by containing all behavior to endpoint display with no product functionality"
  - "system-ui font stack instead of Google Fonts — satisfies OPS-02/T-01-04, no internet dependency at runtime"

requirements-completed:
  - OPS-02
  - ARCH-02

duration: ~3min
completed: 2026-04-18
---

# Phase 1 Plan 02: Local Web Build Pipeline and Offline Shell Summary

**Vite + React 19 frontend shell with no CDN dependencies, bundled local assets, SERVICE_PORTS endpoint display, and a static /healthz readiness target**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-18T12:05:07Z
- **Completed:** 2026-04-18T12:08:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Created the full `apps/web` Vite build scaffolding: `index.html` with no CDN/unpkg/Babel/Google Fonts references, `vite.config.ts` with `defineConfig` and the React plugin, and `tsconfig.json` extending the root `tsconfig.base.json` with browser-appropriate settings (`DOM` lib, `react-jsx`, `Bundler` resolution)
- Implemented the Phase 1 frontend shell: `App.tsx` renders a status page that imports `SERVICE_PORTS` from `@chat/shared` and displays the REST API and WebSocket endpoint addresses, confirming both transport boundaries are declared in the frontend before any service code exists
- Added `apps/web/src/styles.css` with a complete local dark-theme stylesheet; uses the `system-ui` font stack with no `@import` or remote font references
- Created `apps/web/public/healthz` as a plain-text static file; Vite's `publicDir` config ensures it is served at `/healthz` during both dev and production preview, giving the Compose `web` service a deterministic readiness target
- Added `apps/web/public/assets/prototype-reference/README.md` to document that `requirements/desing_v1/index.html` is design-reference-only and must not be imported into runtime code

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold the local web build pipeline** - `dab3757` (chore)
2. **Task 2: Build a minimal offline web shell and health target** - `6250ef4` (feat)

## Files Created/Modified

- `apps/web/index.html` - SPA entry point with module script, no CDN/runtime Babel/fonts
- `apps/web/vite.config.ts` - Vite config with defineConfig, react plugin, publicDir=public, port 4173
- `apps/web/tsconfig.json` - TypeScript config extending tsconfig.base.json, DOM lib, react-jsx, Bundler resolution
- `apps/web/src/main.tsx` - React 19 createRoot bootstrap, StrictMode wrapper
- `apps/web/src/App.tsx` - Phase 1 status shell: imports SERVICE_PORTS, displays REST + WebSocket endpoints, offline delivery confirmation
- `apps/web/src/styles.css` - Local dark-theme CSS, system font stack, no @import or hosted asset references
- `apps/web/public/healthz` - Static readiness file (content: "ok\n") for container healthcheck
- `apps/web/public/assets/prototype-reference/README.md` - Design-reference-only notice for requirements/desing_v1/

## Decisions Made

- Used `moduleResolution: "Bundler"` in `apps/web/tsconfig.json` — Vite owns module resolution for the frontend, and `NodeNext` would impose Node-specific constraints (`.js` extension requirements) incompatible with JSX/TSX imports
- `healthz` is a plain static text file with no server logic — any static file server (Vite preview, nginx, serve) will serve it correctly without route registration
- The Phase 1 shell renders endpoint URLs but makes no actual HTTP or WebSocket connections — T-01-05 mitigation: only endpoint/status display, no unauthenticated product behavior
- Used `system-ui` font stack — eliminates Google Fonts dependency while providing good native typography on every OS

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Coverage

All three threat register entries for this plan were mitigated:

| Threat ID | Disposition | How Mitigated |
|-----------|-------------|---------------|
| T-01-04 | mitigate | `index.html` has zero CDN script tags, no runtime Babel, no Google Fonts. Vite bundles all assets at build time. |
| T-01-05 | mitigate | `App.tsx` contains only endpoint display and a build-status statement. No auth forms, room state, message UI, or unauthenticated data access. |
| T-01-06 | mitigate | `apps/web/public/healthz` exists and is served as a static file at `/healthz` via Vite's `publicDir`. |

## Known Stubs

None — the Phase 1 shell is intentionally minimal and its purpose (proving offline asset delivery and transport boundary declaration) is fully achieved. No product data is expected to be wired in this phase.

## Self-Check

- `apps/web/index.html`: FOUND
- `apps/web/vite.config.ts`: FOUND
- `apps/web/tsconfig.json`: FOUND
- `apps/web/src/main.tsx`: FOUND
- `apps/web/src/App.tsx`: FOUND
- `apps/web/src/styles.css`: FOUND
- `apps/web/public/healthz`: FOUND
- `apps/web/public/assets/prototype-reference/README.md`: FOUND
- Task 1 commit `dab3757`: FOUND
- Task 2 commit `6250ef4`: FOUND

## Self-Check: PASSED
