# Offline Runtime: Dependency Strategy and Verification Procedure

## Overview

This repository is designed to start from a fresh `git clone` without any internet
access during Docker Compose startup or application usage. All application dependencies
must be resolvable from the repository itself; no package registry or CDN access is
permitted at startup or runtime.

This document defines how offline installs work, what the `vendor/pnpm-store/` directory
is for, and how a maintainer must refresh and verify the vendored store before a release.

## How Offline Installs Work

The application uses `pnpm` as its package manager. `pnpm` supports a Docker-friendly
offline install workflow:

1. **Populate the store:** The maintainer runs `pnpm fetch` with a network connection
   to download all packages specified in `pnpm-lock.yaml` into a local store.
2. **Copy the store into the build context:** The Dockerfile copies `vendor/pnpm-store/`
   into the image so that `pnpm install --offline --frozen-lockfile` can complete without
   any registry access.
3. **Build offline:** `pnpm install -r --offline --frozen-lockfile` installs packages
   from the copied store. If any package is missing from the store, the build fails
   rather than silently fetching from the registry.

This means the `vendor/pnpm-store/` directory MUST be kept in sync with `pnpm-lock.yaml`
at all times. A mismatch will cause Docker builds to fail with offline install errors.

## Repository Guarantees

- **No CDN assets:** The web frontend is built locally with Vite. There are no
  references to CDN-hosted React, Babel, or font files in the production build.
- **No runtime registry access:** Compose services use `pull_policy: never` for
  base images. Application containers do not fetch packages at startup.
- **Offline store path:** `vendor/pnpm-store/` is tracked in git and is the single
  source of truth for all npm packages required at build time.

## Maintainer: Refresh-and-Verify Procedure

Run this procedure **before every release** and whenever `pnpm-lock.yaml` changes
(i.e., after adding, removing, or upgrading dependencies).

### Step 1: Update the lockfile

```bash
# Add or change dependencies using normal pnpm commands, e.g.:
pnpm add some-package
pnpm update --latest
```

This updates `pnpm-lock.yaml`. The lockfile MUST be committed.

### Step 2: Populate the offline store

```bash
# Fetch all packages listed in pnpm-lock.yaml into vendor/pnpm-store/
PNPM_STORE_DIR=./vendor/pnpm-store pnpm fetch --store-dir ./vendor/pnpm-store
```

This downloads all packages from the registry and places them in `vendor/pnpm-store/`.
Run this on a machine with internet access.

### Step 3: Verify the store matches the lockfile

```bash
# Perform a dry-run offline install to confirm the store is complete
pnpm install -r --offline --frozen-lockfile --store-dir ./vendor/pnpm-store
```

If this command succeeds without network access, the store is consistent with
`pnpm-lock.yaml`. If it fails with a "package not found in store" error, go back
to Step 2.

### Step 4: Verify offline Docker build

```bash
# Build the Docker images in isolation (no network for RUN steps)
docker compose -f infra/compose/compose.yaml build --no-cache

# Then verify startup
docker compose -f infra/compose/compose.yaml up --wait
```

If the build completes and all services report healthy, the offline dependency
chain is intact.

### Step 5: Commit updated vendor store

```bash
git add vendor/pnpm-store/ pnpm-lock.yaml
git commit -m "chore: refresh offline pnpm store for <version>"
```

Both `pnpm-lock.yaml` and the vendor store content must be committed together.
A lockfile change without a corresponding store refresh will break offline builds.

## Checksum Integrity

`pnpm-lock.yaml` embeds package checksums. The `--frozen-lockfile` flag causes
`pnpm install` to reject any package whose on-disk content does not match the
checksum recorded in the lockfile. This provides integrity verification at build
time without requiring a network round-trip.

Maintainers should not manually edit `vendor/pnpm-store/` content. Always use
`pnpm fetch` to populate the store so that checksums remain consistent.

## What Is NOT Acceptable

The following patterns violate the offline startup requirement and must not appear
in any Dockerfile or application startup code:

- `npm install` or `pnpm install` without `--offline` inside a Dockerfile `RUN` step
- `curl`, `wget`, or any HTTP fetch from a Dockerfile `RUN` step
- CDN `<script>` or `<link>` tags in any served HTML
- Google Fonts `@import` or `<link rel="stylesheet">` pointing to `fonts.googleapis.com`
- Any `docker pull` inside Compose entrypoints
- Compose service blocks without `pull_policy: never` for images that must not be
  re-pulled during QA

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `ERR_PNPM_NO_OFFLINE_TARBALL` during `docker compose build` | Package missing from `vendor/pnpm-store/` | Run `pnpm fetch --store-dir ./vendor/pnpm-store` and commit the result |
| `ERR_PNPM_OUTDATED_LOCKFILE` | `pnpm-lock.yaml` out of sync with `package.json` | Run `pnpm install` (online) then `pnpm fetch` to update both lockfile and store |
| Docker base image pull error | Image not available locally, Compose `pull_policy: never` blocks fetch | Pre-pull the required base images manually: `docker pull node:22-slim` etc. |
| Build succeeds but app cannot resolve packages at runtime | `node_modules/` not installed from store, or store path wrong | Verify `PNPM_STORE_DIR` in the Dockerfile matches the copy destination |
