# Prototype Reference

The original browser wireframe prototype lives at `requirements/desing_v1/index.html`.

It is preserved as **design reference material only** and is not part of the runtime
application. Do not import it into application source code.

## Why it is not the runtime app

The prototype:

- Loads React, ReactDOM, and Babel from `unpkg.com` CDN at browser time
- Loads fonts from `fonts.googleapis.com`
- Has no backend, no persistence, no package manifests, and no test suite
- Violates the project's offline operation requirement (OPS-02)

## What replaced it

`apps/web/` contains the real application:

- Built with Vite and TypeScript from locally installed packages
- All JavaScript, CSS, and assets are bundled at build time
- No runtime CDN fetches or internet dependencies
- Served from static build output by the `web` container in Compose

## Using the prototype as design input

Study `requirements/desing_v1/index.html` for:
- Visual layout and component structure
- Color scheme and typography choices
- Chat UX patterns (room list, message area, composer, member panel)

Do not copy its CDN script tags, runtime Babel transforms, or global React
variable assumptions into `apps/web/src/`.
