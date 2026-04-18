# Coding Conventions

**Analysis Date:** 2026-04-18

## Naming Patterns

**Files:**
- Use lowercase snake_case for JSX component files under `requirements/desing_v1/components/`: `requirements/desing_v1/components/main_chat.jsx`, `requirements/desing_v1/components/personal.jsx`, `requirements/desing_v1/components/tweaks.jsx`.
- Use simple lowercase names for top-level static assets: `requirements/desing_v1/index.html`, `requirements/desing_v1/styles.css`.

**Functions:**
- Use PascalCase for React component functions and component-like constants: `AuthFlow`, `MainChatFlow`, `ProfilePage`, `ManageModal` in `requirements/desing_v1/components/*.jsx`.
- Use camelCase for non-component helpers and local callbacks: `applyTweaks`, `accentMap`, `accentSoftMap`, `upd` in `requirements/desing_v1/components/tweaks.jsx`.
- Use short camelCase prop names for layout helpers when the component is purely presentational: `num`, `id`, `desc`, `tag`, `w`, `h` in `requirements/desing_v1/components/primitives.jsx`.

**Variables:**
- Use camelCase for state and local variables: `tweaks`, `setTweaks`, `tweaksOpen`, `setTweaksOpen`, `handler` in `requirements/desing_v1/index.html`.
- Use ALL_CAPS only for static global configuration constants intended to be shared through `window`: `TWEAK_DEFAULTS` in `requirements/desing_v1/components/tweaks.jsx`.
- Use short inline iterator variables inside `.map(...)` when rendering mock data: `r`, `c`, `a`, `t` in `requirements/desing_v1/components/rooms.jsx`, `requirements/desing_v1/components/contacts.jsx`, `requirements/desing_v1/components/manage.jsx`, and `requirements/desing_v1/components/tweaks.jsx`.

**Types:**
- No TypeScript types, PropTypes, JSDoc typedefs, or runtime schema definitions are present in `requirements/desing_v1/`.
- Treat props as informal structural contracts inferred from call sites, for example `Variant`, `Flow`, `Field`, and `Btn` in `requirements/desing_v1/components/primitives.jsx`.

## Code Style

**Formatting:**
- No formatter configuration is detected. There is no `package.json`, `.prettierrc*`, `prettier.config.*`, or `biome.json` at the repository root.
- Match the existing hand-formatted style in `requirements/desing_v1/index.html` and `requirements/desing_v1/components/*.jsx`.
- Use 2-space indentation in HTML and JSX blocks.
- Prefer double quotes for JavaScript strings and JSX props throughout `requirements/desing_v1/index.html` and `requirements/desing_v1/components/*.jsx`.
- Terminate JavaScript statements with semicolons in JSX files such as `requirements/desing_v1/components/primitives.jsx` and `requirements/desing_v1/components/tweaks.jsx`.

**Linting:**
- No linter configuration is detected. There is no `.eslintrc*` or `eslint.config.*`.
- Follow the existing conventions manually because there is no automated enforcement layer.
- Preserve the current browser-first assumptions: global `React`, `ReactDOM`, and `window` usage are intentional in `requirements/desing_v1/index.html` and `requirements/desing_v1/components/*.jsx`.

## Import Organization

**Order:**
1. Not applicable. The prototype does not use ES module `import` statements.
2. Dependencies are loaded by ordered `<script type="text/babel" src="...">` tags in `requirements/desing_v1/index.html`.
3. Shared primitives load first, feature flows load after, and the inline `App` bootstrap script runs last in `requirements/desing_v1/index.html`.

**Path Aliases:**
- Not detected.
- Use relative file references from `requirements/desing_v1/index.html` such as `components/primitives.jsx` and `components/auth.jsx`.

## Error Handling

**Patterns:**
- Error handling is minimal and only used around cross-window messaging integration. Both `requirements/desing_v1/index.html` and `requirements/desing_v1/components/tweaks.jsx` wrap `window.parent.postMessage(...)` in `try { ... } catch (e) {}` and intentionally ignore failures.
- Guard clauses are used for optional browser event payloads: `if (!e.data || !e.data.type) return;` in `requirements/desing_v1/index.html`.
- There are no explicit UI error states, thrown exceptions, validation utilities, or logging branches in the prototype files under `requirements/desing_v1/components/`.

## Logging

**Framework:** None detected

**Patterns:**
- `console.*` calls are not present in `requirements/desing_v1/index.html`, `requirements/desing_v1/styles.css`, or `requirements/desing_v1/components/*.jsx`.
- Communicate state visually in the mock UI instead of logging. Examples include freeze banners, badges, and warning panels in `requirements/desing_v1/components/personal.jsx`, `requirements/desing_v1/components/manage.jsx`, and `requirements/desing_v1/components/account.jsx`.

## Comments

**When to Comment:**
- Use short section headers at the top of each component file to describe the flow or screen represented, for example `// Main chat layout — ...` in `requirements/desing_v1/components/main_chat.jsx` and `// Profile, password change, ...` in `requirements/desing_v1/components/account.jsx`.
- Use inline comments sparingly to label variant intent or spec interpretation, for example `// Variation A`, `// Accordion sidebar`, and `// Message action menu` in `requirements/desing_v1/components/auth.jsx`, `requirements/desing_v1/components/main_chat.jsx`, and `requirements/desing_v1/components/personal.jsx`.

**JSDoc/TSDoc:**
- Not used in `requirements/desing_v1/`.

## Function Design

**Size:** 
- Keep shared primitives small and composable, as in `WFFrame`, `Variant`, `Flow`, `Field`, `Btn`, and `PresenceLabel` in `requirements/desing_v1/components/primitives.jsx`.
- Feature files may contain large presentational components and several sibling variants in one file, as shown by `requirements/desing_v1/components/main_chat.jsx` and `requirements/desing_v1/components/account.jsx`.

**Parameters:**
- Prefer props objects with defaults for presentational switches: `AppNav({ active = "rooms", unread = {} })`, `Sidebar({ compact = false, showContacts = true })`, `ManageModal({ tab = "Members" })`.
- Use boolean flags to toggle wireframe state instead of derived abstractions: `showReply`, `banned`, `open`, `block`, `multiline`.

**Return Values:**
- Components return JSX fragments directly using concise arrow functions where practical.
- Non-component helpers mutate browser state directly and return nothing, for example `applyTweaks` in `requirements/desing_v1/components/tweaks.jsx`.

## Module Design

**Exports:**
- Do not use `export` or `import`. Share components through `Object.assign(window, { ... })` at the end of each JSX file, as seen in `requirements/desing_v1/components/primitives.jsx`, `requirements/desing_v1/components/auth.jsx`, and every other file in `requirements/desing_v1/components/`.
- Consume shared modules as globals from later-loaded scripts. `requirements/desing_v1/index.html` relies on that loading order when rendering `AuthFlow`, `MainChatFlow`, `PersonalFlow`, `RoomsFlow`, `ContactsFlow`, `ManageFlow`, `AccountFlow`, and `AttachFlow`.

**Barrel Files:**
- Not used.
- `requirements/desing_v1/index.html` acts as the composition root and script manifest instead of a JavaScript barrel file.

## Additional Observed Patterns

- Centralize reusable visual tokens in CSS custom properties in `requirements/desing_v1/styles.css`; use `var(--token)` from both class rules and inline styles.
- Use inline style objects heavily for one-off layout and spacing decisions inside JSX, while leaving reusable component chrome in `requirements/desing_v1/styles.css`.
- Keep the prototype static. Mock data is embedded directly in render functions as local arrays and literals in `requirements/desing_v1/components/rooms.jsx`, `requirements/desing_v1/components/contacts.jsx`, and `requirements/desing_v1/components/manage.jsx`.
- Preserve the current naming typo in the path `requirements/desing_v1/` when adding related files, because all existing references use that directory name.

---

*Convention analysis: 2026-04-18*
