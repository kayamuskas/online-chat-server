# Technology Stack

**Analysis Date:** 2026-04-18

## Languages

**Primary:**
- HTML5 - static prototype entrypoint in `requirements/desing_v1/index.html`
- CSS3 - wireframe styling in `requirements/desing_v1/styles.css`
- JavaScript with JSX syntax - browser-global React components in `requirements/desing_v1/components/*.jsx`, transpiled at runtime by Babel Standalone

**Secondary:**
- Markdown - product and system requirements in `requirements/requirements_raw.md` and `requirements/wireframes.md`
- PDF - design/reference artifact in `requirements/desing_v1/uploads/2026_04_18_AI_herders_jam_-_requirements_v3.pdf`

## Runtime

**Environment:**
- Browser runtime only - `requirements/desing_v1/index.html` mounts React into `#root` and loads every component via `<script type="text/babel">`
- No server runtime detected - no `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, Dockerfile, or application entrypoint exists in the repository root

**Package Manager:**
- Not detected
- Lockfile: missing

## Frameworks

**Core:**
- React 18.3.1 UMD - UI composition and state via CDN script tags in `requirements/desing_v1/index.html`
- ReactDOM 18.3.1 UMD - client-side render root in `requirements/desing_v1/index.html`
- `@babel/standalone` 7.29.0 - in-browser JSX transpilation for `requirements/desing_v1/components/*.jsx`

**Testing:**
- Not detected

**Build/Dev:**
- Static-file workflow - open `requirements/desing_v1/index.html` directly in a browser
- No bundler or dev server detected - no Vite, Webpack, Parcel, Next.js, Create React App, or TypeScript config files are present

## Key Dependencies

**Critical:**
- `https://unpkg.com/react@18.3.1/umd/react.development.js` - provides `React` globals used by `requirements/desing_v1/index.html` and `requirements/desing_v1/components/primitives.jsx`
- `https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js` - provides `ReactDOM.createRoot(...)` in `requirements/desing_v1/index.html`
- `https://unpkg.com/@babel/standalone@7.29.0/babel.min.js` - transpiles JSX scripts loaded from `requirements/desing_v1/components/*.jsx`
- Google Fonts CSS endpoint in `requirements/desing_v1/index.html` - supplies typography used by `requirements/desing_v1/styles.css`

**Infrastructure:**
- Browser `window.postMessage` API - edit-mode messaging between the prototype and a parent frame in `requirements/desing_v1/index.html` and `requirements/desing_v1/components/tweaks.jsx`
- DOM/CSS custom properties - theme tweaks applied via `document.documentElement.style.setProperty(...)` in `requirements/desing_v1/components/tweaks.jsx`

## Configuration

**Environment:**
- No `.env` files or runtime environment variable usage detected
- No secret management, deployment configuration, or server-side config files detected

**Build:**
- No build pipeline config detected
- Component load order is hard-coded in `requirements/desing_v1/index.html`
- UI defaults are embedded in `requirements/desing_v1/components/tweaks.jsx` as `TWEAK_DEFAULTS`

## Platform Requirements

**Development:**
- A modern web browser with network access to `unpkg.com`, `fonts.googleapis.com`, and `fonts.gstatic.com` is required to render `requirements/desing_v1/index.html`
- The repository currently functions as a design/prototype workspace, not an installable application

**Production:**
- Production target is not implemented in code
- Intended future target is described in `requirements/requirements_raw.md` as a classic web chat server that must be runnable via `docker compose up`, but no Docker or server implementation exists yet

---

*Stack analysis: 2026-04-18*
