# Research: Features

**Date:** 2026-04-18
**Project:** Online Chat Server

## Table Stakes

These are required either explicitly by `requirements/requirements_raw.md` or because users expect them in a classic chat system:

### Identity and Sessions

- Email/password registration
- Unique immutable username
- Login persistence across browser restart
- Password reset and password change
- Multi-session view and targeted session revocation

### Social and Access

- Friend requests with confirmation
- Friend removal
- User-to-user block / ban
- Public room discovery and search
- Private room invites

### Core Chat

- Realtime room chat
- Realtime personal dialogs
- UTF-8 multiline messages
- Replies / quoted context
- Edit own message
- Delete own message
- Offline delivery after reconnect
- Chronological history with infinite scroll

### Moderation

- Room owner/admin roles
- Remove member
- Ban/unban member
- Room-level admin management
- Delete room messages
- Delete room and cascade its data

### Attachments

- Upload files and images
- Paste-upload support
- Preserve original filename
- Optional comment per attachment
- Membership-aware download authorization

### UX

- Classic web chat layout
- Presence states: online / AFK / offline
- Unread indicators for rooms and DMs
- Smart autoscroll behavior
- Modal-driven admin operations

## Differentiators To Ignore For v1

These are common in modern products but not necessary for this assignment:

- Push notifications
- Mobile apps
- Typing indicators
- Read receipts
- Rich media previews
- Search across full message history
- Threaded conversations beyond single-message reply context
- Voice/video
- AI assistance or summaries

## Anti-Features

Deliberately avoid these in v1:

- Social-feed behavior replacing the classic chat layout
- Third-party hosted auth or attachment storage that breaks offline operation
- CDN runtime dependencies
- Federation scope mixed into the first delivery

## Complexity Notes

- Presence is deceptively hard because the spec defines online, AFK, and offline across multiple browser tabs.
- Attachment ACLs are not just UI checks; they must be enforced when downloading from the backend.
- "Delete account" and "delete room" both imply cascade rules that must be encoded carefully in storage and file cleanup.
- Unread tracking and offline delivery are easier if message events and read markers are modeled explicitly from the start.

## Phase Pressure

The highest-risk feature groups are:

1. Sessions and presence
2. Room membership and moderation
3. Attachment authorization and cleanup
4. Offline packaging for QA startup

These should be addressed in the roadmap as first-class phases, not left as endgame polish.
