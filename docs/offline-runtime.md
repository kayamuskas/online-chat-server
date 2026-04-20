# Runtime Dependency Strategy and Verification Procedure

## Overview

This repository is designed to start from a fresh `git clone` with a plain
`docker compose up`. Application dependencies are installed during Docker image
builds from the public npm registry, while the exact dependency graph is pinned
by `pnpm-lock.yaml`.

This document defines the current install strategy and the verification steps
maintainers should run before a release.

## Repository Guarantees

- **No CDN assets:** The web frontend is built locally with Vite. There are no
  references to CDN-hosted React, Babel, or font files in the production build.
- **No runtime package installs:** Application containers do not fetch packages at
  startup. All installs happen at Docker build time.
- **Lockfile-backed builds:** `pnpm-lock.yaml` is the source of truth for all npm
  packages required at build time.

## Maintainer: Refresh-and-Verify Procedure

Run this procedure before every release and whenever `pnpm-lock.yaml` changes.

### Step 1: Update the manifests

```bash
# Add or change dependencies using normal pnpm commands, e.g.:
pnpm add some-package
pnpm update --latest
```

### Step 2: Refresh the lockfile-backed install

```bash
pnpm install
```

This resolves any new packages and updates the lockfile if needed.

### Step 3: Verify the lockfile matches the workspace manifests

```bash
pnpm install -r --frozen-lockfile
```

If this command fails, `pnpm-lock.yaml` is out of sync with one or more
`package.json` files and must be refreshed before release.

### Step 4: Verify Docker build and startup

```bash
docker compose -f infra/compose/compose.yaml build
docker compose -f infra/compose/compose.yaml up --wait
```

If the build completes and all services report healthy, a fresh clone can fetch
dependencies during image build and start successfully.

### Step 5: Commit the lockfile update

```bash
git add pnpm-lock.yaml package.json apps/*/package.json packages/*/package.json
git commit -m "chore: refresh pnpm lockfile for <version>"
```

Commit the lockfile together with any manifest changes that produced it.

## Checksum Integrity

`pnpm-lock.yaml` embeds package checksums. The `--frozen-lockfile` flag causes
`pnpm install` to reject dependency graphs that do not match the committed
lockfile. This preserves deterministic Docker builds across environments.

## Mock Mail Outbox Volume

The API container runs with a read-only filesystem (`read_only: true` in compose) with one
deliberate exception: a narrow writable bind mount at `/app/mail-outbox`.

This mount supports `MockMailService`, which writes structured JSON artifacts for each
password-reset email instead of sending real SMTP. The artifacts are readable on the host
at `.volumes/mail-outbox/` and are logged at `LOG` level by the API service:

```text
[MockMailService] [mock-mail] artifact written → /app/mail-outbox/password-reset-<uuid>.json
```

**QA inspection:**

```bash
ls .volumes/mail-outbox/
cat .volumes/mail-outbox/password-reset-<uuid>.json
```

The JSON artifact contains: `to`, `subject`, `username`, `resetLink`, and `generatedAt`.
Extract the `resetLink` value and visit it in the browser to complete the reset.

This mount is intentional and documented. It does not weaken the overall container posture
because all other API filesystem paths remain read-only.

## What Is NOT Acceptable

The following patterns violate the startup requirement and must not appear in any
Dockerfile or application startup code:

- `curl` or `wget` fetching application code or packages in Docker `RUN` steps
- CDN `<script>` or `<link>` tags in any served HTML
- Google Fonts `@import` or `<link rel="stylesheet">` pointing to `fonts.googleapis.com`
- Any `docker pull` or package manager install inside container entrypoints
- Runtime-time `npm install` or `pnpm install` in service startup commands

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `ERR_PNPM_OUTDATED_LOCKFILE` | `pnpm-lock.yaml` out of sync with `package.json` | Run `pnpm install`, review the lockfile diff, and commit the update |
| Docker build cannot download packages | Network access to npm is unavailable | Restore connectivity and rerun `docker compose build` |
| Docker base image pull error | Image registry is unavailable or blocked | Restore connectivity to Docker Hub or configure a mirror |
| Build succeeds but app cannot resolve packages at runtime | Production image was built from stale artifacts | Rebuild with `docker compose build --no-cache` |
