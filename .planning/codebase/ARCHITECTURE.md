# Architecture

**Analysis Date:** 2026-04-18

## Pattern Overview

**Overall:** Requirements-first documentation repository with a browser-rendered React wireframe prototype

**Key Characteristics:**
- Use `requirements/requirements_raw.md` and `requirements/wireframes.md` as the primary source of product behavior and screen scope.
- Treat `requirements/desing_v1/` as a standalone prototype that runs directly in the browser from `index.html` without a package manager, bundler, router, or API client.
- Do not assume application layers that are not present. No backend server, database access layer, auth service, websocket transport, or deployment entry point exists in this repository.

## Layers

**Requirements Layer:**
- Purpose: Define the product scope, rules, and target behaviors for a future chat system.
- Location: `requirements/requirements_raw.md`, `requirements/wireframes.md`
- Contains: Functional requirements, scale targets, wireframe appendix, role and moderation rules.
- Depends on: No code dependencies.
- Used by: The prototype in `requirements/desing_v1/` and any future implementation planning.

**Prototype Shell Layer:**
- Purpose: Bootstrap the wireframe page and compose all screen flows into one long document.
- Location: `requirements/desing_v1/index.html`
- Contains: HTML shell, external CDN script tags for React/ReactDOM/Babel, the root `App` component, tweak state, and final `ReactDOM.createRoot(...)` render call.
- Depends on: `requirements/desing_v1/styles.css` and all files under `requirements/desing_v1/components/`.
- Used by: Browser users opening `requirements/desing_v1/index.html` directly.

**Prototype Primitive Layer:**
- Purpose: Provide shared presentation building blocks reused across flows.
- Location: `requirements/desing_v1/components/primitives.jsx`
- Contains: `WFFrame`, `Flow`, `Variant`, `Field`, `Btn`, `Badge`, `Dot`, `PresenceLabel`, and other UI helpers.
- Depends on: Global `React` from CDN and CSS classes from `requirements/desing_v1/styles.css`.
- Used by: Every flow module in `requirements/desing_v1/components/*.jsx`.

**Prototype Flow Modules Layer:**
- Purpose: Represent major product areas as static React components grouped by user flow.
- Location: `requirements/desing_v1/components/auth.jsx`, `main_chat.jsx`, `personal.jsx`, `rooms.jsx`, `contacts.jsx`, `manage.jsx`, `account.jsx`
- Contains: Flow-specific screen variants such as `AuthFlow`, `MainChatFlow`, `RoomsFlow`, `ManageFlow`, and `AccountFlow`.
- Depends on: Shared primitives assigned on `window` in `requirements/desing_v1/components/primitives.jsx`.
- Used by: The root `App` component in `requirements/desing_v1/index.html`.

**Prototype Runtime Tweaks Layer:**
- Purpose: Apply presentation tweaks while the page is open and integrate with an external design editor via `postMessage`.
- Location: `requirements/desing_v1/components/tweaks.jsx`, `requirements/desing_v1/index.html`
- Contains: `TWEAK_DEFAULTS`, `applyTweaks`, `Tweaks`, message handlers, and mutable CSS variable updates.
- Depends on: Browser DOM APIs and the prototype root state in `requirements/desing_v1/index.html`.
- Used by: The `App` component and any parent frame sending `__activate_edit_mode` or `__deactivate_edit_mode` messages.

**Static Asset Layer:**
- Purpose: Store supporting reference material for the prototype and requirements.
- Location: `requirements/desing_v1/uploads/2026_04_18_AI_herders_jam_-_requirements_v3.pdf`
- Contains: A PDF requirements artifact loaded outside the prototype runtime.
- Depends on: None.
- Used by: Humans reviewing design and requirements context.

## Data Flow

**Requirements to Prototype Flow:**

1. Product behaviors are written in `requirements/requirements_raw.md`.
2. Screen intent is mirrored in `requirements/wireframes.md`.
3. The prototype encodes those behaviors as static JSX flow components in `requirements/desing_v1/components/*.jsx`.
4. `requirements/desing_v1/index.html` renders every flow sequentially on one page for review.

**Prototype Render Flow:**

1. Browser opens `requirements/desing_v1/index.html`.
2. The page loads React, ReactDOM, and Babel from CDN script tags in `requirements/desing_v1/index.html`.
3. Babel evaluates each component file in the order declared in `requirements/desing_v1/index.html`, relying on globals attached through `Object.assign(window, ...)`.
4. `App` composes `AuthFlow`, `MainChatFlow`, `PersonalFlow`, `RoomsFlow`, `ContactsFlow`, `ManageFlow`, `AccountFlow`, and `AttachFlow`, then mounts into `#root`.

**Tweak Flow:**

1. `App` initializes `tweaks` state from `window.TWEAK_DEFAULTS` in `requirements/desing_v1/components/tweaks.jsx`.
2. `useEffect` in `requirements/desing_v1/index.html` calls `window.applyTweaks(tweaks)` and subscribes to browser `message` events.
3. `Tweaks` mutates local state and CSS custom properties through `applyTweaks`.
4. Optional parent-frame edit mode messages open or close the tweak panel; no persistence beyond the loaded page is implemented.

**State Management:**
- Keep state local to the browser session. The only interactive state present is React `useState` in `requirements/desing_v1/index.html` plus ephemeral component-local update helpers in `requirements/desing_v1/components/tweaks.jsx`.
- There is no shared client store, URL-driven state, server state, or persistence mechanism in the repository.

## Key Abstractions

**Flow Components:**
- Purpose: Group screens by business domain so one file maps to one feature area.
- Examples: `requirements/desing_v1/components/auth.jsx`, `requirements/desing_v1/components/rooms.jsx`, `requirements/desing_v1/components/manage.jsx`
- Pattern: Export by attaching named components to `window`, then compose them from `App`.

**Wireframe Frame:**
- Purpose: Make each screen variant look like an isolated browser window.
- Examples: `WFFrame` in `requirements/desing_v1/components/primitives.jsx`, used throughout `requirements/desing_v1/components/*.jsx`
- Pattern: Wrap feature markup in a consistent shell with fake browser chrome and a URL label.

**Variant/Flow Taxonomy:**
- Purpose: Document alternatives and sub-scenarios inside one long prototype.
- Examples: `Flow` and `Variant` in `requirements/desing_v1/components/primitives.jsx`; `MainChatFlow` in `requirements/desing_v1/components/main_chat.jsx`
- Pattern: Arrange multiple wireframe variants under a titled flow section rather than routing between pages.

**Global Window Registry:**
- Purpose: Share JSX components across plain script files without ES modules.
- Examples: `Object.assign(window, { AuthFlow })` in `requirements/desing_v1/components/auth.jsx`, similar assignments across all component files
- Pattern: Use browser globals as the composition boundary. Maintain script load order carefully in `requirements/desing_v1/index.html`.

## Entry Points

**Prototype Entry Point:**
- Location: `requirements/desing_v1/index.html`
- Triggers: Opening the HTML file in a browser.
- Responsibilities: Load external libraries, register component scripts, own top-level tweak state, and mount the full prototype.

**Requirements Entry Points:**
- Location: `requirements/requirements_raw.md`, `requirements/wireframes.md`
- Triggers: Human review and planning work.
- Responsibilities: Describe functional rules and the target UI structure that the prototype visualizes.

**Non-Entry Areas Not Present:**
- Location: Not detected under the repository root.
- Triggers: Not applicable.
- Responsibilities: No `src/`, `app/`, `server/`, API routes, background workers, or deployment bootstrap files exist.

## Error Handling

**Strategy:** Minimal browser-only defensive handling suitable for a prototype

**Patterns:**
- Swallow optional cross-frame messaging failures with `try/catch` in `requirements/desing_v1/index.html` and `requirements/desing_v1/components/tweaks.jsx`.
- Avoid runtime branching beyond simple guards such as checking `e.data.type` in `requirements/desing_v1/index.html`.
- Do not expect network, validation, or domain error handling because no production workflows are implemented.

## Cross-Cutting Concerns

**Logging:** Not implemented. No structured logging or console instrumentation is present in `requirements/desing_v1/`.

**Validation:** Represented only as copy and visual hints inside the wireframes, such as username uniqueness messaging in `requirements/desing_v1/components/auth.jsx` and owner warnings in `requirements/desing_v1/components/rooms.jsx`.

**Authentication:** Documented conceptually in `requirements/requirements_raw.md` and visualized in `requirements/desing_v1/components/auth.jsx`, but no real auth layer or session management code exists.

**Styling:** Centralized in `requirements/desing_v1/styles.css` with CSS variables and shared utility classes consumed by all prototype components.

**External Dependencies:** Limited to browser-loaded CDN assets declared in `requirements/desing_v1/index.html`. No local dependency manifest is present.

---

*Architecture analysis: 2026-04-18*
