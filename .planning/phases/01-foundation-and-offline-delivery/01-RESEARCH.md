# Phase 1: Foundation and Offline Delivery - Research

**Researched:** 2026-04-18  
**Domain:** Monorepo foundation, offline Docker Compose delivery, queue bootstrap, REST/WebSocket runtime boundary  
**Confidence:** MEDIUM

## User Constraints

`CONTEXT.md` is not present for this phase, so the planner should treat the following as the active locked constraints taken from the phase prompt and project planning docs. [VERIFIED: .planning/PROJECT.md/.planning/REQUIREMENTS.md/.planning/ROADMAP.md]

- PostgreSQL is required. [VERIFIED: .planning/PROJECT.md/.planning/REQUIREMENTS.md]
- Queues are mandatory. [VERIFIED: .planning/PROJECT.md/.planning/REQUIREMENTS.md]
- Runtime must work offline after `git clone && docker compose up`, assuming base images are already present locally. [VERIFIED: .planning/PROJECT.md/.planning/REQUIREMENTS.md]
- No CDN or runtime internet dependencies are allowed. [VERIFIED: .planning/PROJECT.md/.planning/REQUIREMENTS.md]
- Mixed REST + WebSocket architecture is required. [VERIFIED: .planning/PROJECT.md/.planning/REQUIREMENTS.md]
- The current repository contains requirements and a prototype, not production code. [VERIFIED: repo inventory]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | Fresh clone can be started by QA with `docker compose up`. [VERIFIED: .planning/REQUIREMENTS.md] | Use a Compose-defined 4-service baseline, health-gated startup, and a repo-committed offline dependency strategy. [CITED: https://docs.docker.com/reference/compose-file/services/] [CITED: https://pnpm.io/cli/fetch] |
| OPS-02 | Application runs without internet access during startup and usage, assuming required Docker base images already exist locally. [VERIFIED: .planning/REQUIREMENTS.md] | Replace CDN assets, set Compose `pull_policy: never`, and install app deps from an offline store already inside the repo/build context. [VERIFIED: repo grep] [CITED: https://docs.docker.com/reference/compose-file/services/] [CITED: https://pnpm.io/cli/install] |
| ARCH-01 | System uses queues for asynchronous processing where deferred work exists. [VERIFIED: .planning/REQUIREMENTS.md] | Establish Redis + BullMQ queue plumbing now, with one shared connection factory and one worker process. [CITED: https://www.npmjs.com/package/bullmq] [CITED: https://www.npmjs.com/package/%40nestjs/bullmq] [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] |
| ARCH-02 | System uses a mixed REST and WebSocket model. [VERIFIED: .planning/REQUIREMENTS.md] | Start the API as a hybrid HTTP + Socket.IO server now, even if only health/meta and a handshake test exist in this phase. [CITED: https://docs.nestjs.com/websockets/gateways] [CITED: https://docs.nestjs.com/websockets/adapter] |

## Summary

This phase should not try to implement chat behavior. It should create the irreversible operational foundation that later phases depend on: a real monorepo, a Compose topology that starts deterministically, a local-only asset and dependency path, a queue substrate, and a hybrid REST/WebSocket server boundary. The repo evidence is clear that none of this exists yet: there is no `package.json`, no lockfile, no Dockerfile, no Compose file, no test suite, and the prototype still loads React, ReactDOM, Babel, and fonts from the internet. [VERIFIED: repo inventory] [VERIFIED: repo grep]

The most important planning insight is that `pnpm fetch` and `pnpm install --offline` are documented for Docker builds, but those commands only remain offline if the store is already populated. Because Phase 1 requires a fresh clone to build and run without internet access, Phase 1 cannot rely on registry access during image build. The planner should therefore treat a repo-committed offline package store, or an equivalent repo-local vendored dependency cache consumed by Docker, as a Phase 1 deliverable rather than an implementation detail to postpone. [CITED: https://pnpm.io/cli/fetch] [CITED: https://pnpm.io/cli/install]

**Primary recommendation:** Build Phase 1 around a `pnpm` workspace monorepo with `apps/api`, `apps/web`, `packages/shared`, `infra/`, `vendor/`, and a Compose stack of `web`, `api`, `worker`, `postgres`, and `redis`; use Redis-backed BullMQ for the first queue foundation; and make offline dependency vendoring part of the phase gate, not a later hardening task. [CITED: https://pnpm.io/docker] [CITED: https://docs.docker.com/reference/compose-file/services/] [CITED: https://context7.com/taskforcesh/bullmq/llms.txt]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Docker Compose startup and readiness | Frontend Server / API + Infra | Database / Storage | Compose owns lifecycle ordering, but readiness depends on API, Postgres, and Redis health checks. [CITED: https://docs.docker.com/reference/compose-file/services/] |
| Offline frontend asset delivery | Frontend Server / Static container | Browser / Client | The browser should consume already-built local assets; no runtime CDN fetches are acceptable. [VERIFIED: repo grep] |
| REST API baseline | API / Backend | Database / Storage | HTTP health, config, and later domain APIs belong in the backend process. [CITED: https://docs.nestjs.com/] |
| WebSocket baseline | API / Backend | Redis | Nest gateways live in the backend; Redis is the standard secondary tier when Socket.IO fanout coordination is needed. [CITED: https://docs.nestjs.com/websockets/gateways] [CITED: https://docs.nestjs.com/websockets/adapter] |
| Queue execution | API / Backend worker | Redis | BullMQ queue state and blocking worker operations are Redis-backed; the application owns job semantics. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] |
| Persistent system state | Database / Storage | API / Backend | PostgreSQL is the required system of record, even though later phases will add Redis-backed live state. [VERIFIED: .planning/PROJECT.md/.planning/REQUIREMENTS.md] |
| Attachment persistence foundation | Database / Storage + filesystem volume | API / Backend | Metadata belongs in durable storage later, but the filesystem volume contract must be established now because local disk persistence is a core constraint. [VERIFIED: .planning/PROJECT.md] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pnpm` | `10.x` [CITED: https://pnpm.io/cli/install] | Workspace package manager and offline-capable install workflow | `pnpm` officially documents Docker workflows using `fetch` and `install --offline`, including monorepo scenarios. [CITED: https://pnpm.io/cli/fetch] [CITED: https://pnpm.io/docker] |
| `TypeScript` | `5.9.2` published about 1 month ago [VERIFIED: npm package page https://www.npmjs.com/package/typescript?activeTab=versions] | Shared language across backend, frontend, and workspace tooling | One language reduces Phase 1 surface area while the repo is still empty. [ASSUMED] |
| `@nestjs/core` | `11.1.6` published about 1 month ago [VERIFIED: npm package page https://www.npmjs.com/package/%40nestjs/core?activeTab=versions] | Backend application framework | Nest has official hybrid HTTP/WebSocket support and a strong module boundary for later phases. [CITED: https://docs.nestjs.com/websockets/gateways] |
| `@nestjs/platform-socket.io` + `@nestjs/websockets` | Nest 11-compatible [CITED: https://docs.nestjs.com/websockets/gateways] | WebSocket transport with Socket.IO | Official Nest docs support Socket.IO out of the box, which is the pragmatic match for browser chat clients. [CITED: https://docs.nestjs.com/websockets/gateways] |
| `react` | `19.2` [CITED: https://react.dev/versions] [CITED: https://react.dev/blog/2025/10/01/react-19-2] | Frontend UI runtime | React is already the language of the prototype, but Phase 1 must package it locally instead of using CDN UMD builds. [VERIFIED: repo grep] [CITED: https://react.dev/versions] |
| `vite` | `7.1.4` published about 4 days ago [VERIFIED: npm package page https://www.npmjs.com/package/vite?activeTab=versions] | Frontend build and dev tooling | Vite is current and keeps static asset bundling simple for offline local delivery. [CITED: https://vite.dev/guide/] |
| `@vitejs/plugin-react` | `5.0.2` published about 9 days ago [VERIFIED: npm package page https://www.npmjs.com/package/%40vitejs/plugin-react?activeTab=versions] | Vite React integration | This is the standard React plugin for Vite projects. [VERIFIED: npm package page https://www.npmjs.com/package/%40vitejs/plugin-react?activeTab=versions] |
| `bullmq` | `5.58.5` published about 2 days ago [VERIFIED: npm package page https://www.npmjs.com/package/bullmq?activeTab=versions] | Redis-backed queue, workers, and queue events | BullMQ provides `Queue`, `Worker`, and `QueueEvents`, which is enough for a minimal but real queue foundation. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] |
| `@nestjs/bullmq` | `11.0.3` published about 1-2 months ago [VERIFIED: npm package page https://www.npmjs.com/package/%40nestjs/bullmq?activeTab=versions] | Nest integration for BullMQ | Keeps queue wiring idiomatic inside Nest modules instead of hand-rolling adapters. [VERIFIED: npm package page https://www.npmjs.com/package/%40nestjs/bullmq] |
| PostgreSQL | `18 / current` as of 2026-04 official docs [CITED: https://www.postgresql.org/docs/] | Durable system of record | PostgreSQL is a locked project constraint and the official docs list 18 as current. [VERIFIED: .planning/PROJECT.md] [CITED: https://www.postgresql.org/docs/] |
| Redis Open Source | `8.x current family` [CITED: https://redis.io/docs/latest/operate/oss_and_stack/] | Queue backend and future realtime coordination state | Redis is already a good fit for BullMQ and later presence/socket coordination, avoiding a second async substrate in Phase 1. [CITED: https://redis.io/docs/latest/get-started/] [CITED: https://docs.nestjs.com/websockets/adapter] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg` | `8.16.0` published about 1 month ago [VERIFIED: npm package page https://www.npmjs.com/package/pg] | Direct PostgreSQL client | Use in the API or migration layer if the ORM choice is deferred beyond Phase 1. [VERIFIED: npm package page https://www.npmjs.com/package/pg] |
| `tsx` | `4.20.5` published about 13 days ago [VERIFIED: npm package page https://www.npmjs.com/package/tsx?activeTab=versions] | TypeScript runner for scripts | Useful for migration, seed, and smoke-check scripts during foundation work. [VERIFIED: npm package page https://www.npmjs.com/package/tsx?activeTab=versions] |
| `docker compose` | `v2.40.3` locally installed [VERIFIED: local command `docker compose version`] | Local orchestration | Required for the QA startup contract and supports health-gated dependency order. [CITED: https://docs.docker.com/reference/compose-file/services/] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pnpm` offline store | Prebuilt app images outside the repo [ASSUMED] | This conflicts with the stated startup contract because the user only assumed base images are preloaded, not app images. [VERIFIED: user prompt/.planning/PROJECT.md] |
| BullMQ on Redis | RabbitMQ plus AMQP client [ASSUMED] | RabbitMQ adds another stateful service in Phase 1 while Redis is already useful for queues and later websocket coordination. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] [CITED: https://docs.nestjs.com/websockets/adapter] |
| BullMQ on Redis | Hand-rolled Redis lists or streams [ASSUMED] | BullMQ already provides workers, retries, and queue events; Phase 1 should not hand-roll queue mechanics. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] |

**Installation:**

```bash
pnpm add -w typescript tsx
pnpm --filter @chat/api add @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/websockets @nestjs/platform-socket.io @nestjs/bullmq bullmq pg
pnpm --filter @chat/web add react react-dom
pnpm --filter @chat/web add -D vite @vitejs/plugin-react
```

**Version verification:** Shell-based `npm view` could not be completed from this environment, so package versions were cross-checked with current npm package pages and official docs instead. [VERIFIED: failed local attempt + npm package pages] [CITED: https://react.dev/versions]

## Architecture Patterns

### System Architecture Diagram

```text
git clone
   |
   v
docker compose up
   |
   +--> postgres (healthcheck) ----+
   |                               |
   +--> redis (healthcheck) -------+----> api (REST + Socket.IO, healthcheck)
   |                                    |            |
   |                                    |            +--> /healthz + /api/v1/meta
   |                                    |            +--> /ws namespace handshake
   |                                    |
   |                                    +--> worker (BullMQ processor, healthcheck)
   |                                                 |
   |                                                 +--> queue connection + noop/system jobs
   |
   +--> web (served local build artifacts, healthcheck)
                |
                +--> browser loads bundled assets only
                +--> REST calls to api
                +--> WebSocket connection to api
```

The key Phase 1 boundary is that HTTP and WebSocket live in the same API deployment, while queues run in a separate worker process backed by the same Redis instance. That keeps later phases simple without collapsing everything into one process. [CITED: https://docs.nestjs.com/websockets/gateways] [CITED: https://context7.com/taskforcesh/bullmq/llms.txt]

### Recommended Project Structure

```text
apps/
├── api/                 # Nest app: REST, WebSocket gateway bootstrap, queue producer wiring
├── worker/              # BullMQ worker process and queue event listeners
└── web/                 # React + Vite frontend, built to local static assets
packages/
├── shared/              # shared TS types, env schema, queue names, app constants
└── config/              # shared ESLint/TSConfig/build config packages if needed
infra/
├── docker/              # Dockerfiles and entrypoints
└── compose/             # compose.yaml, env examples, health scripts
scripts/
└── qa/                  # smoke tests, offline checks, startup verification
vendor/
└── pnpm-store/          # committed offline dependency store for Docker builds
```

This structure is a recommendation for planning, not a discovered existing layout. It is the smallest shape that cleanly separates the future API, worker, and browser app while keeping shared contracts local. [ASSUMED]

### Pattern 1: Health-Gated Compose Topology

**What:** Use long-form `depends_on` with `condition: service_healthy`, explicit `healthcheck` blocks, and `pull_policy: never` for services that must not pull from the network. [CITED: https://docs.docker.com/reference/compose-file/services/]

**When to use:** Immediately in Phase 1, because startup determinism is itself a requirement. [VERIFIED: .planning/REQUIREMENTS.md]

**Example:**

```yaml
services:
  postgres:
    image: postgres:18
    pull_policy: never
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chat -d chat"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 15s

  redis:
    image: redis:8
    pull_policy: never
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: infra/docker/api.Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 10s
      timeout: 5s
      retries: 12
```

### Pattern 2: Repo-Local Offline Dependency Store

**What:** Build app images from source, but copy a repo-local `pnpm` store into the build context so `pnpm install --offline --frozen-lockfile` never hits the registry. [CITED: https://pnpm.io/cli/fetch] [CITED: https://pnpm.io/cli/install]

**When to use:** Phase 1 only if the plan must satisfy the literal `git clone && docker compose up` offline contract. [VERIFIED: user prompt/.planning/PROJECT.md]

**Example:**

```dockerfile
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY vendor/pnpm-store /pnpm/store
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install -r --offline --frozen-lockfile

COPY . .
RUN pnpm -r build
```

The `pnpm` docs prove the offline install mechanics, but using them from a fresh offline clone still requires the store to be present locally; that extra requirement comes from this project's acceptance bar, not from pnpm itself. [CITED: https://pnpm.io/cli/fetch] [CITED: https://pnpm.io/cli/install]

### Pattern 3: Minimal Real Queue Foundation

**What:** Create one BullMQ module with a shared Redis connection factory, one queue namespace registry, one worker process, and one observable queue-events hook. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt]

**When to use:** In Phase 1, but keep business job count minimal. The goal is wiring, not mail, push, or cleanup features yet. [VERIFIED: .planning/ROADMAP.md]

**Example:**

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';

const queue = new Queue('system', { connection: { host: 'redis', port: 6379 } });

const worker = new Worker(
  'system',
  async (job) => ({ ok: true, name: job.name }),
  { connection: { host: 'redis', port: 6379, maxRetriesPerRequest: null } },
);

const queueEvents = new QueueEvents('system', {
  connection: { host: 'redis', port: 6379 },
});
```

### Pattern 4: Hybrid API Bootstrap

**What:** Start REST and WebSocket in the same Nest app so later phases can share auth/session context. [CITED: https://docs.nestjs.com/websockets/gateways]

**When to use:** Phase 1 should prove the transport boundary exists; domain authorization can wait. [VERIFIED: .planning/ROADMAP.md]

**Example:**

```typescript
const app = await NestFactory.create(AppModule);
app.enableCors();
await app.listen(3000);
```

A basic `@WebSocketGateway()` in the same app is enough for this phase; do not defer the transport boundary entirely to a later phase or the planner will under-scope Phase 1. [CITED: https://docs.nestjs.com/websockets/gateways]

### Anti-Patterns to Avoid

- **Shipping the prototype shell:** The current prototype depends on Google Fonts and `unpkg` React/Babel assets, so it directly violates OPS-02. [VERIFIED: repo grep]
- **Using short-form `depends_on` only:** Docker Compose starts dependency containers in order, but short syntax does not wait for health. [CITED: https://docs.docker.com/reference/compose-file/services/]
- **Adding RabbitMQ in Phase 1:** That increases operational scope before the project has even established the first queue-backed workflow. [ASSUMED]
- **Bundling queue logic into the API process only:** A worker process boundary should exist now, even if both services share the same codebase and Redis instance. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt]

## What To Establish Now vs Defer

| Establish in Phase 1 | Defer to Later Phases |
|----------------------|-----------------------|
| Workspace root, lockfiles, package manifests, TS config, lint/format baseline. [ASSUMED] | Full domain schema, auth flows, rooms, contacts, and messaging logic. [VERIFIED: .planning/ROADMAP.md] |
| Compose stack with `web`, `api`, `worker`, `postgres`, `redis`, named volumes, and healthchecks. [CITED: https://docs.docker.com/reference/compose-file/services/] | Real mail behavior, room moderation, message delivery semantics, unread logic, and ACLs. [VERIFIED: .planning/ROADMAP.md] |
| Local-only frontend build pipeline with no CDN fonts or scripts. [VERIFIED: repo grep] | Final product UI polish and full chat UX. [VERIFIED: .planning/ROADMAP.md] |
| Shared env/config schema and startup validation. [ASSUMED] | Attachment lifecycle rules and room/file ACL enforcement. [VERIFIED: .planning/ROADMAP.md] |
| One queue, one worker, one noop/system job, and queue readiness exposure. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] | Real background jobs like mail, cleanup, notifications, or delivery retries. [VERIFIED: .planning/ROADMAP.md] |
| One WebSocket namespace and one REST health/meta endpoint. [CITED: https://docs.nestjs.com/websockets/gateways] | Authenticated socket identity and presence semantics. [VERIFIED: .planning/ROADMAP.md] |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queue execution | Custom Redis list/stream worker loop [ASSUMED] | BullMQ + `@nestjs/bullmq` [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] [VERIFIED: npm package page https://www.npmjs.com/package/%40nestjs/bullmq] | Retries, blocking workers, and queue events already exist; a custom queue layer creates avoidable correctness risk. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] |
| WebSocket transport wiring | Raw `ws` protocol plumbing for browser chat by default [ASSUMED] | Nest gateways on Socket.IO [CITED: https://docs.nestjs.com/websockets/gateways] | Socket.IO is the documented, batteries-included browser path in Nest; raw `ws` is leaner but gives up useful transport ergonomics early. [CITED: https://docs.nestjs.com/websockets/gateways] |
| Offline asset loading | Manually copied browser globals and CDN fallbacks | Vite local bundling [CITED: https://vite.dev/guide/] | The prototype already shows why CDN/global-script delivery is incompatible with the acceptance bar. [VERIFIED: repo grep] |
| Service ordering | Sleep loops in entrypoints [ASSUMED] | Compose healthchecks + `service_healthy` [CITED: https://docs.docker.com/reference/compose-file/services/] | Compose already supports health-gated dependency order; sleep-based startup is nondeterministic. [CITED: https://docs.docker.com/reference/compose-file/services/] |

**Key insight:** The expensive mistakes in this phase are operational, not product-level. Hand-rolled startup sequencing, custom queue plumbing, or “we’ll fix offline later” decisions all create rework that later phases cannot avoid. [CITED: https://docs.docker.com/reference/compose-file/services/] [CITED: https://context7.com/taskforcesh/bullmq/llms.txt]

## Common Pitfalls

### Pitfall 1: Treating `pnpm fetch` Alone as an Offline Strategy

**What goes wrong:** The planner assumes `pnpm fetch` makes Docker builds offline by itself. [CITED: https://pnpm.io/cli/fetch]  
**Why it happens:** The docs show `fetch` + `install --offline`, but that still presumes packages are already present in the store before the offline install step. [CITED: https://pnpm.io/cli/install]  
**How to avoid:** Make the offline store a repo artifact or another repo-local vendored dependency cache that Docker copies before install. [CITED: https://pnpm.io/cli/install]  
**Warning signs:** The Dockerfile still expects first-time registry access during `docker compose up`. [ASSUMED]

### Pitfall 2: Only Verifying Container Start, Not Service Readiness

**What goes wrong:** `api` starts before Postgres or Redis are actually ready and exits or flaps. [CITED: https://docs.docker.com/reference/compose-file/services/]  
**Why it happens:** Short-form `depends_on` orders startup but does not wait for health. [CITED: https://docs.docker.com/reference/compose-file/services/]  
**How to avoid:** Use long-form `depends_on` with `condition: service_healthy` and real healthchecks. [CITED: https://docs.docker.com/reference/compose-file/services/]  
**Warning signs:** Entrypoints contain `sleep 10`, retry storms, or intermittent first-boot failures. [ASSUMED]

### Pitfall 3: Delaying the Worker Boundary

**What goes wrong:** Queue code is embedded in the API app and later has to be split under deadline pressure. [ASSUMED]  
**Why it happens:** The team treats “queue foundation” as a library import instead of a process boundary. [ASSUMED]  
**How to avoid:** Create a dedicated `worker` app in Phase 1 even if it only consumes one noop/system queue. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt]  
**Warning signs:** No separate worker container exists in Compose. [ASSUMED]

### Pitfall 4: Rebuilding the Prototype Instead of Replacing It

**What goes wrong:** The prototype shell survives into the real app and drags in internet dependencies. [VERIFIED: repo grep]  
**Why it happens:** The prototype is visually useful, so teams over-trust its runtime structure. [VERIFIED: .planning/codebase/ARCHITECTURE.md]  
**How to avoid:** Keep `requirements/desing_v1/` as the current design baseline, but rebuild its runtime as local product code instead of carrying over the prototype's CDN/Babel implementation. Future design baselines such as `desing_v2` or `desing_v3` may supersede it later. [VERIFIED: .planning/PROJECT.md]  
**Warning signs:** New code still references browser Babel, UMD globals, or Google Fonts links. [VERIFIED: repo grep]

## Code Examples

Verified patterns from official sources:

### Compose health-gated dependencies

```yaml
depends_on:
  db:
    condition: service_healthy
  redis:
    condition: service_started
```

Source: `https://docs.docker.com/reference/compose-file/services/` [CITED: https://docs.docker.com/reference/compose-file/services/]

### `pnpm` offline install in Docker

```bash
pnpm fetch --prod
pnpm install -r --offline --prod
```

Source: `https://pnpm.io/cli/fetch` [CITED: https://pnpm.io/cli/fetch]

### BullMQ worker connection rule

```typescript
new Worker('queue', processor, {
  connection: { host: 'redis', port: 6379, maxRetriesPerRequest: null },
});
```

Source: `https://context7.com/taskforcesh/bullmq/llms.txt` [CITED: https://context7.com/taskforcesh/bullmq/llms.txt]

### Nest Socket.IO setup

```bash
npm i --save @nestjs/websockets @nestjs/platform-socket.io
```

Source: `https://docs.nestjs.com/websockets/gateways` [CITED: https://docs.nestjs.com/websockets/gateways]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Browser-loaded React/Babel from CDN in a static HTML file | Local build pipeline with bundled assets | Current repo already proves the old approach is only a prototype path, not a shippable runtime. [VERIFIED: repo grep] | Phase 1 must preserve `desing_v1` as the current UI baseline while replacing its runtime implementation with local bundled app code. [VERIFIED: .planning/PROJECT.md] |
| Compose startup order only | Health-gated startup with `service_healthy` and first-class `healthcheck` | Supported in current Compose spec/docs. [CITED: https://docs.docker.com/reference/compose-file/services/] | This removes most “works on second boot” failures from the baseline. [ASSUMED] |
| Ad-hoc queue loops on Redis primitives | BullMQ with Queue, Worker, and QueueEvents | Current BullMQ docs/npm package. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] [VERIFIED: npm package page https://www.npmjs.com/package/bullmq] | Phase 1 can get a real queue substrate without inventing queue semantics. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] |

**Deprecated/outdated:**

- CDN React/ReactDOM/Babel runtime for the shipped app. [VERIFIED: repo grep]
- Google-hosted fonts for the shipped app. [VERIFIED: repo grep]
- Sleep-based dependency ordering when Compose health checks are available. [CITED: https://docs.docker.com/reference/compose-file/services/]

## Concrete Phase 1 Deliverables

1. Root workspace files: `package.json`, `pnpm-workspace.yaml`, lockfile, TS base config, ignore files, and shared scripts. [ASSUMED]
2. `apps/api`, `apps/worker`, and `apps/web` skeletons with bootable processes. [ASSUMED]
3. `infra/compose/compose.yaml` with named volumes, explicit healthchecks, `pull_policy: never`, and deterministic dependency order. [CITED: https://docs.docker.com/reference/compose-file/services/]
4. Repo-local offline dependency cache consumed by Docker builds. [CITED: https://pnpm.io/cli/install]
5. Web app that serves only bundled local assets and proves the prototype CDN path is gone. [VERIFIED: repo grep]
6. API app with `/healthz`, `/api/v1/meta`, and one Socket.IO namespace or gateway stub. [CITED: https://docs.nestjs.com/websockets/gateways]
7. Worker app with one queue, one processor, one queue-events hook, and graceful shutdown. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt]
8. QA smoke script that proves startup from a clean checkout and from offline mode. [ASSUMED]
9. Phase-level documentation that tells later phases exactly where REST endpoints, gateways, queues, volumes, and shared contracts live. [ASSUMED]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `apps/` + `packages/` is the best repo shape for this project | Architecture Patterns | Low; another monorepo layout can work if boundaries stay equivalent |
| A2 | Node `22-slim` should be the container base | Architecture Patterns | Low; Node 20 or 24 could also work if library compatibility is validated |
| A3 | A dedicated `worker` process should exist in Phase 1 instead of Phase 2 | Common Pitfalls / Deliverables | Medium; if deferred, later queue adoption becomes a refactor rather than additive work |
| A4 | Committing a repo-local `pnpm` store is the most practical offline strategy under the stated startup contract | Summary / Deliverables | Medium; if repo size is unacceptable, the planner must design an alternative repo-local vendoring mechanism |
| A5 | Sleep-based startup remains common enough to call out as a pitfall | Common Pitfalls | Low |

## Open Questions (RESOLVED)

1. **How much repo growth is acceptable for the offline dependency cache?**
   - Resolved decision: Phase 1 optimizes for the literal `git clone && docker compose up` offline contract first, even if the vendored dependency cache increases repository size. [VERIFIED: .planning/PROJECT.md]
   - Execution implication: The phase plans should deliver a repo-local offline dependency path plus a documented refresh-and-verify procedure tied to `pnpm-lock.yaml`; repository size can be measured after implementation and optimized in a later phase if needed. [RESOLVED]

2. **Should Phase 1 include an ORM decision or keep DB access minimal?**
   - Resolved decision: Keep Phase 1 at PostgreSQL connectivity, readiness, and container bootstrap only; do not force an ORM or domain schema decision in this phase. [VERIFIED: .planning/REQUIREMENTS.md]
   - Execution implication: Plan tasks should limit database work to Compose/Postgres wiring and health checks, leaving schema modeling, migrations, and ORM choice to later domain phases. [RESOLVED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker CLI | `docker compose up` contract | ✓ | `28.5.2` [VERIFIED: local command `docker --version`] | — |
| Docker Compose | Phase startup and smoke validation | ✓ | `v2.40.3` [VERIFIED: local command `docker compose version`] | — |
| Docker daemon | Actually building/running services locally | ✗ currently not reachable [VERIFIED: local command `docker image ls` failed with daemon unavailable] | — | Start Docker/OrbStack before validation |
| Node.js | Local maintainer scripts and workspace tooling | ✓ | `v25.9.0` [VERIFIED: local command `node --version`] | Containerized Node runtime |
| npm | Package metadata / local scripting | ✓ | `11.12.1` [VERIFIED: local command `npm --version`] | Containerized package manager |
| pnpm | Recommended workspace package manager | ✗ | — [VERIFIED: local command `command -v pnpm`] | Use Corepack inside containers or install locally later |
| PostgreSQL CLI | Optional local debugging | ✗ | — [VERIFIED: local command `psql --version`] | Use container healthcheck / `docker compose exec postgres psql` |
| Redis CLI | Optional local debugging | ✗ | — [VERIFIED: local command `redis-server --version`] | Use container healthcheck / `docker compose exec redis redis-cli` |

**Missing dependencies with no fallback:**

- Running containers locally is currently blocked until the Docker daemon is started. [VERIFIED: local command `docker image ls` failed with daemon unavailable]

**Missing dependencies with fallback:**

- `pnpm`, `psql`, and Redis CLI are absent locally, but Phase 1 can still execute through containerized tooling. [VERIFIED: local commands]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected yet; Phase 1 should add a Compose smoke harness plus lightweight API/web checks. [VERIFIED: repo inventory] |
| Config file | none — Wave 0 [VERIFIED: file scan] |
| Quick run command | `docker compose up --build --wait` [CITED: https://context7.com/docker/compose/llms.txt] |
| Full suite command | `scripts/qa/phase1-smoke.sh` after Compose startup, including offline and restart checks. [ASSUMED] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | Fresh clone starts with `docker compose up` | smoke | `docker compose up --build --wait` | ❌ Wave 0 |
| OPS-02 | Startup and usage avoid internet dependencies | smoke/manual hybrid | `scripts/qa/phase1-offline-check.sh` with network disabled or pull-blocked conditions | ❌ Wave 0 |
| ARCH-01 | Queue substrate boots and worker consumes a trivial job | integration | `scripts/qa/phase1-queue-check.sh` | ❌ Wave 0 |
| ARCH-02 | REST and WebSocket entrypoints both exist | integration | `scripts/qa/phase1-transport-check.sh` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `docker compose config` plus targeted smoke script once created. [ASSUMED]
- **Per wave merge:** `docker compose up --build --wait` plus queue and transport checks. [CITED: https://context7.com/docker/compose/llms.txt]
- **Phase gate:** Full offline startup smoke green before `/gsd-verify-work`. [VERIFIED: .planning/ROADMAP.md]

### Wave 0 Gaps

- [ ] `infra/compose/compose.yaml` — startup contract under test
- [ ] `scripts/qa/phase1-smoke.sh` — covers OPS-01
- [ ] `scripts/qa/phase1-offline-check.sh` — covers OPS-02
- [ ] `scripts/qa/phase1-queue-check.sh` — covers ARCH-01
- [ ] `scripts/qa/phase1-transport-check.sh` — covers ARCH-02
- [ ] Health endpoints in `apps/api` and `apps/web`
- [ ] Worker readiness/reporting endpoint or equivalent observable signal

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no for Phase 1 scope | Defer to Phase 2; only transport scaffolding exists here. [VERIFIED: .planning/ROADMAP.md] |
| V3 Session Management | no for Phase 1 scope | Defer to Phase 2 and 3. [VERIFIED: .planning/ROADMAP.md] |
| V4 Access Control | partial | Keep all Phase 1 endpoints non-sensitive and avoid attachment/file serving in this phase. [ASSUMED] |
| V5 Input Validation | yes | Add env/config schema validation in shared config code. [ASSUMED] |
| V6 Cryptography | no for shipped Phase 1 behavior | Do not introduce placeholder crypto; wait for auth phase. [VERIFIED: .planning/ROADMAP.md] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hidden runtime internet dependency | Denial of Service | Remove CDN assets, vendor packages locally, and set Compose `pull_policy: never` where appropriate. [VERIFIED: repo grep] [CITED: https://docs.docker.com/reference/compose-file/services/] |
| Queue worker stuck on bad Redis connection policy | Denial of Service | Follow BullMQ worker connection rules, including `maxRetriesPerRequest: null` for workers. [CITED: https://context7.com/taskforcesh/bullmq/llms.txt] |
| Unnecessary writable container filesystems | Tampering | Keep only data volumes writable; app containers should prefer immutable artifacts outside explicit data dirs. [ASSUMED] |
| Overexposed unauthenticated WebSocket surface | Spoofing / DoS | Keep the Phase 1 gateway minimal and prepare origin/auth guards before business events are added. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- `https://docs.docker.com/reference/compose-file/services/` - `depends_on`, `service_healthy`, `healthcheck`, `pull_policy`
- `https://pnpm.io/cli/fetch` - Docker-oriented `pnpm fetch` and offline install flow
- `https://pnpm.io/cli/install` - `--offline` semantics
- `https://pnpm.io/docker` - monorepo and Docker build guidance
- `https://docs.nestjs.com/websockets/gateways` - Nest gateway and Socket.IO support
- `https://docs.nestjs.com/websockets/adapter` - Redis adapter pattern for Socket.IO scaling
- `https://context7.com/taskforcesh/bullmq/llms.txt` - BullMQ queue/worker/QueueEvents usage and connection rules
- `https://www.postgresql.org/docs/` - PostgreSQL current manual branch
- `https://react.dev/versions` - current React docs version

### Secondary (MEDIUM confidence)

- `https://www.npmjs.com/package/%40nestjs/core?activeTab=versions` - current Nest package version
- `https://www.npmjs.com/package/bullmq?activeTab=versions` - current BullMQ version
- `https://www.npmjs.com/package/vite?activeTab=versions` - current Vite version
- `https://www.npmjs.com/package/%40vitejs/plugin-react?activeTab=versions` - current Vite React plugin version
- `https://www.npmjs.com/package/typescript?activeTab=versions` - current TypeScript version
- `https://www.npmjs.com/package/pg` - current `pg` version

### Tertiary (LOW confidence)

- None. All ecosystem claims above were either verified against official docs/package pages or marked `[ASSUMED]`.

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM - Most tool and library claims are verified, but the exact offline vendoring mechanism is still a design recommendation constrained by the project's startup rule.
- Architecture: MEDIUM - The Compose, queue, and hybrid transport guidance is well supported, but the exact monorepo folder shape is still a recommendation.
- Pitfalls: HIGH - The biggest failure modes are directly supported by repo evidence and official Compose/pnpm/BullMQ docs.

**Research date:** 2026-04-18  
**Valid until:** 2026-05-18
