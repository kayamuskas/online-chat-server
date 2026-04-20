# Research Summary

**Date:** 2026-04-18
**Project:** Online Chat Server

## Stack

Recommended implementation path:

- React 19 + Vite 7 frontend
- NestJS + Socket.IO backend on Node.js 22
- PostgreSQL 18 for durable state
- Redis 8.x for presence and websocket coordination
- Docker Compose v2 with explicit fresh-clone packaging

## Table Stakes

The mandatory baseline is exactly aligned with the source spec: auth, sessions, friends, rooms, DMs, realtime messaging, persistent history, attachments, moderation, presence, unread indicators, and classic chat UX.

## Watch Out For

- Multi-tab presence is a core domain problem, not a small UI detail.
- Attachment authorization must be enforced in the backend on every download.
- The current `requirements/desing_v1/` prototype cannot ship as-is because it depends on internet CDNs.
- Fresh-clone startup must be designed into the repo structure early, not patched in at the end.
