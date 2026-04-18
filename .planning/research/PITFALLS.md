# Research: Pitfalls

**Date:** 2026-04-18
**Project:** Online Chat Server

## Pitfall 1: Treating the Prototype as Production Foundation

- Warning signs: Team starts copying `requirements/desing_v1/` runtime patterns such as CDN React, browser Babel, and global-window components.
- Why it fails: Those patterns break the offline requirement and do not scale into a maintainable production app.
- Prevention: Freeze the prototype as reference only and rebuild the shipped frontend with local dependencies and a real build pipeline.
- Phase pressure: Foundation and frontend phases

## Pitfall 2: Underestimating Presence Semantics

- Warning signs: Presence is stored as a single boolean on the user record or derived from only one socket connection.
- Why it fails: The specification defines online/AFK/offline across multiple tabs with a one-minute inactivity rule.
- Prevention: Model per-tab or per-connection heartbeat state plus an aggregation layer.
- Phase pressure: Sessions/presence phase

## Pitfall 3: Weak Authorization on Attachments

- Warning signs: File URLs are stable and downloadable without checking current room membership or DM participation.
- Why it fails: The spec requires access revocation when a user loses room access, even if the file remains stored.
- Prevention: Store attachment metadata separately from bytes and authorize every download request server-side.
- Phase pressure: Attachments phase

## Pitfall 4: Mixing Room and DM Rules Incorrectly

- Warning signs: Personal dialogs inherit room admin controls or room membership logic.
- Why it fails: DMs share message features with rooms, but they do not have admins and are allowed only for friends without user-to-user bans.
- Prevention: Share the messaging engine but keep policy modules separate.
- Phase pressure: Dialogs/messaging phases

## Pitfall 5: Delaying Offline Packaging Until the End

- Warning signs: CI or local dev uses online package installs and nobody tests startup without network.
- Why it fails: The user's definition of done is operational, not just functional.
- Prevention: Make offline startup a tracked requirement and acceptance test from the first milestone.
- Phase pressure: Foundation and final hardening phases

## Pitfall 6: Deletion Cascades Without File Cleanup Discipline

- Warning signs: Room or account deletion removes database rows but leaves orphaned files on disk.
- Why it fails: The spec requires permanent deletion of room files when the room is deleted.
- Prevention: Model explicit cleanup jobs or transactional delete workflows with reconciliation checks.
- Phase pressure: Rooms, account management, and attachments phases

## Pitfall 7: Treating Presence as a Normal Database Field

- Warning signs: `online` / `afk` / `offline` is persisted as the primary live source in PostgreSQL and queried frequently by the app.
- Why it fails: Presence is hot, transient state and the user explicitly wants to avoid unnecessary database traffic; browser hibernation also makes client-side inactivity reporting unreliable.
- Prevention: Keep durable `last seen` in PostgreSQL, but compute live presence from connection/runtime state with expiry-based aggregation.
- Phase pressure: Sessions/presence phase

## Pitfall 8: Unbounded Message or Fanout Queues

- Warning signs: Per-user backlog queues grow forever while users remain absent for months.
- Why it fails: The project explicitly calls out year-long absence as a realistic case; transient delivery queues must not become the long-term message store.
- Prevention: Treat PostgreSQL history as the durable source, keep queues bounded and transient, and recover missed data by querying history.
- Phase pressure: Messaging, delivery, and performance phases

## Pitfall 9: Missing History Integrity Checks

- Warning signs: Client assumes consecutive live events always arrive and never verifies gaps in chat history.
- Why it fails: With long-lived rooms and reconnects, missing message ranges can silently corrupt user-visible history.
- Prevention: Introduce per-chat incremental watermarks and require gap detection with fallback history fetch.
- Phase pressure: Messaging/history phase
