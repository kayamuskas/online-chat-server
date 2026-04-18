# Research: Architecture

**Date:** 2026-04-18
**Project:** Online Chat Server

## Recommended System Shape

For v1, build a single deployable application stack with these runtime services:

- `web`: React SPA served from a container
- `api`: NestJS application exposing HTTP endpoints and Socket.IO websocket transport
- `db`: PostgreSQL as the durable system of record
- `redis`: presence, pub/sub fanout, and short-lived coordination state

This is a single-server product topology from the user's perspective even though Compose will run several containers locally.

## Suggested Backend Modules

- `auth`: registration, login, password reset, password change, account deletion
- `sessions`: browser/session inventory, revocation, remember-me behavior
- `presence`: heartbeat, AFK state calculation, multi-tab aggregation
- `queues`: background processing for deferred fanout, cleanup, mail mocks, and bounded async jobs
- `users`: profile summaries needed by contacts and room membership views
- `contacts`: friend requests, friendships, user-to-user bans
- `rooms`: create, update, join, leave, catalog, invites, bans, admin roles
- `dialogs`: direct-message conversation identity for exactly two participants
- `messages`: send/edit/delete/reply/history for rooms and dialogs
- `attachments`: upload, metadata, ACL checks, file serving, file cleanup hooks
- `notifications`: unread counters and read markers
- `admin-ui-support`: modal-driven admin actions surfaced to frontend

## Data Flow

1. Browser authenticates over HTTP and receives a durable session.
2. Browser opens websocket connection authenticated against that session.
3. User actions with durable effects write to PostgreSQL.
4. Presence and fanout state flows through Redis for low-latency updates.
5. Attachment binaries are written to the local filesystem; metadata and ACL references live in PostgreSQL.
6. History, room state, and unread markers are queried from PostgreSQL and incrementally updated over websocket events.

## Storage Boundaries

- PostgreSQL: users, credentials metadata, sessions, IP audit data, rooms, memberships, bans, invites, dialogs, messages, attachment metadata, unread markers, persistent `last_seen`, and chat watermarks
- Redis: presence heartbeats, transient room membership projections for push, websocket fanout coordination, and short-lived queue coordination data where needed
- Filesystem volume: uploaded file bytes and image bytes

## Build Order Implications

Recommended order:

1. Repository and offline packaging foundation
2. Database schema, migrations, and shared domain model
3. Auth and sessions
4. Presence and websocket identity
5. Queue infrastructure and bounded background jobs
6. Rooms and moderation primitives
7. Direct dialogs and friendships
8. Messaging, watermarks, and history integrity
9. Attachments and ACL enforcement
10. Frontend shell and flows
11. QA hardening, load/performance checks, offline startup validation

## Major Architectural Risks

- If websocket identity is separated from session identity incorrectly, presence and authorization will drift.
- If inactive/hibernated tabs are modeled incorrectly, users will remain falsely online or AFK transitions will be noisy.
- If attachment ACLs are modeled only in the frontend, users will still be able to fetch revoked files directly.
- If unread state is inferred only from current socket state, reconnects and offline delivery will be inconsistent.
- If queue retention is unbounded for absent users, memory or broker state will grow without limit.
- If message ordering has no watermark/gap-detection model, missing ranges in long histories will be hard to detect and recover.
- If offline packaging is postponed, the final acceptance criterion can fail even after the app works functionally.
