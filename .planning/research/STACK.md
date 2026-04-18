# Research: Stack

**Date:** 2026-04-18
**Project:** Online Chat Server

## Recommendation

Use a TypeScript monorepo with:

- Backend: NestJS on Node.js with WebSocket gateways over Socket.IO
- Frontend: React 19 + Vite 7
- Database: PostgreSQL 18
- Realtime/presence cache: Redis Open Source 8.x
- Containers: Docker Compose v2 with named volumes and healthchecks

This is an inference from the product requirements plus current official ecosystem docs, not something already implemented in this repository.

## Why This Stack

- One language across frontend and backend reduces coordination overhead while the project is still greenfield.
- NestJS gives a maintainable module boundary for auth, rooms, DMs, presence, moderation, files, and admin concerns.
- NestJS gateways support WebSockets and provide adapters for `socket.io` and `ws`, which matches the realtime requirement well.
- React is already the visual reference language in `requirements/desing_v1/`, so keeping React avoids throwing away existing UI thinking.
- Vite is the current mainstream React build tool and keeps the frontend straightforward for a classic web app.
- PostgreSQL is a strong fit for relational constraints such as unique usernames, room membership, bans, invites, and session records.
- Redis is a pragmatic fit for low-latency presence fanout, unread counters, websocket node coordination, and ephemeral user activity.

## Suggested Concrete Stack

### Backend

- Node.js 22 LTS
- NestJS 11.x
- `@nestjs/websockets` + `@nestjs/platform-socket.io`
- Prisma ORM 6.x or another type-safe Postgres ORM
- Zod or class-validator at API boundaries
- Argon2id for password hashing

### Frontend

- React 19.2
- TypeScript 5.x
- Vite 7
- React Router 7 or TanStack Router
- TanStack Query for server-state fetching outside websocket flows

### Data and Infra

- PostgreSQL 18 as the system of record
- Redis Open Source 8.x for presence, fanout, and short-lived coordination state
- Local filesystem storage mounted as a Docker volume for attachments
- Docker Compose specification with service healthchecks, named volumes, and explicit startup order

## Offline Delivery Implications

The user-defined acceptance criteria are stricter than a normal dev setup:

- `docker compose up` must work from a fresh clone.
- The stack must not require internet access at startup or during usage.
- App dependencies therefore cannot be fetched from npm or any CDN during QA startup.

This means the implementation plan must include one of these strategies early:

- Prebuilt application images loaded locally and referenced by Compose
- Vendored package stores / cached tarballs committed or staged in-repo
- A reproducible offline dependency mirror consumed by container builds

The current prototype under `requirements/desing_v1/` violates this constraint because it depends on `unpkg.com` and Google Fonts.

## What Not To Use

- CDN-loaded frontend dependencies for shipped runtime
- Browser Babel in production
- A pure in-memory backend with no durable database
- A file service that ignores room membership changes
- A multi-server architecture in v1, because the accepted scope is single-server

## Confidence

- High: React 19.2 is current according to React's official versions page.
- High: Vite 7 is current according to the official Vite guide.
- High: NestJS officially supports WebSocket gateways and Socket.IO adapters.
- High: PostgreSQL 18 is the current manual branch in the official docs.
- Medium: Redis 8.x is the right major family for this workload; exact patch choice can be locked during implementation.
- Medium: Prisma 6.x is a strong ORM option, but an equivalent type-safe Postgres layer could still be chosen if repository constraints change.

## Sources

- React versions: https://react.dev/versions
- Vite guide: https://vite.dev/guide/
- NestJS overview: https://docs.nestjs.com/
- NestJS gateways: https://docs.nestjs.com/websockets/gateways
- Docker Compose: https://docs.docker.com/compose/
- Compose specification: https://docs.docker.com/reference/compose-file/
- PostgreSQL docs: https://www.postgresql.org/docs/
- Redis Open Source docs: https://redis.io/docs/latest/get-started
- Prisma ORM docs: https://www.prisma.io/docs/v6/orm/getting-started
