# Phase 5: Contacts and DM Policy - Research

**Researched:** 2026-04-18
**Domain:** Friendship lifecycle, user-to-user ban mechanics, DM eligibility enforcement, contacts sidebar UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Incoming friend requests surface as a notification icon with an unread badge in the top navigation bar.
**D-02:** Clicking the icon opens a dropdown panel listing pending incoming requests with "Accept" and "Decline" actions per row.
**D-03:** Outgoing (sent) requests are not shown in the dropdown. Instead, the sender sees a "Request sent" status on the target user's profile/card, with a cancel option.
**D-04:** A user can send a friend request via `+ Add contact` in the sidebar — this opens a modal with a username field and a "Send request" button.
**D-05:** A user can also send a request from an existing user list surface (e.g., room member list) — the action appears inline on the user row/card.
**D-06:** The friend request may include optional text per FRND-01; the modal and any inline form should expose this optional field.
**D-07:** Banning requires a confirmation modal: "Are you sure? This will block the user and remove the friendship."
**D-08:** After a ban: the banned user sees an explicit message indicating the other user has restricted contact (e.g., "This user has restricted contact with you").
**D-09:** A ban can be reversed — the banning user has a "Blocked users" list in account settings where they can unblock.
**D-10:** When a ban is applied: the friendship is immediately terminated, and any existing DM conversation becomes read-only/frozen per FRND-05.
**D-11:** Blocking is one-directional (A bans B). Either side can independently ban the other.
**D-12:** Phase 5 includes a "Message" / "Write" button on user cards/profiles and in the contacts list. In Phase 5 this opens a DM screen stub (empty state); the real message engine arrives in Phase 6.
**D-13:** When DM is not eligible (users are not friends, or a ban exists on either side), the button is rendered as disabled with a tooltip.
**D-14:** DM eligibility is enforced backend-side: the API must reject DM initiation if the friendship/ban constraint is not met, regardless of frontend state.
**D-15:** The main chat sidebar has a `CONTACTS` section below the `ROOMS` section.
**D-16:** Each contact row shows a colored presence dot (green = online, amber = AFK, gray = offline) consistent with Phase 3 compact-presence pattern.
**D-17:** The sidebar includes `+ Add contact` at the bottom, which opens the username-entry modal (D-04).
**D-18:** The sidebar design reference (screenshot) is the layout contract: "ROOMS & CONTACTS" header, collapsible Public/Private room subsections, then CONTACTS list, then action buttons.
**D-19:** Removing a friend (without banning) is a separate action from banning — it terminates the friendship but does not freeze DM history or block future requests.
**D-20:** After removal, DM eligibility is lost (since friendship is required), but the conversation history is preserved and accessible.

### Claude's Discretion

- Exact visual style of the notification badge and dropdown panel, as long as it matches the sidebar reference direction.
- Exact tooltip copy for the disabled DM button.
- Whether "Blocked users" lives as a subsection of account settings or a standalone settings page.
- Exact layout of the username-entry modal.
- Whether friend removal requires a confirmation step (small destructive action — agent may decide).

### Deferred Ideas (OUT OF SCOPE)

- Real message engine and DM chat history — Phase 6
- Unread indicators on contact rows — Phase 9 (NOTF-01, NOTF-02)
- Any search/filter within the contacts list beyond what's already in the sidebar search field
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FRND-01 | User can send a friend request by username or from a room member list, with optional text | Two entry points (modal + inline), optional_message field in DB; `+ Add contact` modal and RoomMembersTable action button |
| FRND-02 | Friendship exists only after recipient confirmation | `friend_requests` table with `pending`/`accepted`/`declined` lifecycle; service prevents premature DM access |
| FRND-03 | User can remove a friend | `DELETE /api/v1/contacts/friends/:userId` removes friendship row; DM history preserved but eligibility lost |
| FRND-04 | User can ban another user so they can no longer contact them | `user_bans` table (directional, not symmetric); ban terminates friendship and freezes DM per D-10 |
| FRND-05 | Existing DM history remains visible but becomes read-only after a user-to-user ban | `dm_conversations.frozen` flag toggled by ban event; Phase 6 message engine reads this flag |
| FRND-06 | Personal messaging is allowed only when users are friends and neither side has banned the other | `ContactsService.checkDmEligibility()` called at DM initiation; returns boolean + reason; backend enforces regardless of frontend |
</phase_requirements>

---

## Summary

Phase 5 implements the friendship lifecycle and user-to-user ban domain on top of the existing Phase 1–4 NestJS + PostgreSQL + React stack. The domain is a **symmetric relationship** (friendship) managed through an **asymmetric event** (ban). The core schema is three tables: `friend_requests`, `friendships`, and `user_bans`. A DM eligibility check service combines these tables into a single query to enforce FRND-06.

The frontend adds three surfaces: (1) a notification badge + dropdown for incoming requests in the top nav, (2) a `CONTACTS` sidebar section with presence dots and `+ Add contact` button, and (3) a DM screen stub. The existing `RoomMembersTable` component gets an additional "Send friend request" inline action. All patterns follow the established rooms domain module structure exactly.

The critical design tension in this phase is the **ban → DM freeze** interaction: a user ban must immediately transition any existing DM conversation to read-only. Since Phase 6 owns the real message engine, Phase 5 must create a `dm_conversations` table stub (at minimum a row per pair + `frozen` boolean) that Phase 6 can fill out. This allows the ban service to flip `frozen = true` without restructuring in Phase 6.

**Primary recommendation:** Build contacts as a standalone NestJS module (`ContactsModule`) with four HTTP REST endpoints, following the rooms module pattern. No WebSocket events are needed in Phase 5 (real-time friend request notifications are a Phase 9 concern). DM conversation stub rows must exist to support the FRND-05 freeze requirement.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Friend request send / accept / decline / cancel | API / Backend | — | Mutation with policy enforcement; frontend is thin UI over REST |
| Friendship state query (contacts list) | API / Backend | Frontend cache | Contacts list is fetched on load; no polling needed at this phase |
| User-to-user ban (create / remove) | API / Backend | — | Policy enforcement; ban terminates friendship atomically |
| DM eligibility check | API / Backend | — | Must be enforced server-side per D-14; frontend reads result but does not decide |
| DM conversation stub creation | API / Backend | — | Needs to exist so FRND-05 freeze can be set; Phase 6 extends rows |
| DM screen stub | Frontend Server (React) | — | Empty state screen; no backend data needed beyond eligibility |
| Contacts sidebar section | Frontend | — | Reads contacts list from API; renders PresenceDot from existing primitives |
| Incoming request notification badge | Frontend (top nav) | — | Badge count from API; dropdown renders pending requests list |
| Presence dots in contacts list | Frontend | — | Reuses existing `PresenceDot` primitive from `features/presence/` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | Already installed (Phase 1) | Backend HTTP module | Project standard; all prior phases use it |
| PostgreSQL | Already running | Relational store for friendships and bans | Project requirement; all phases use it |
| Vitest | Already installed | Unit tests for new service | Project standard test runner (`npm test` in apps/api) |
| React | Already installed | Frontend feature module | Project standard frontend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` (randomUUID) | Built-in | UUID generation for new rows | Already used in rooms.repository.ts — no additional install |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate `friendships` + `friend_requests` tables | Single `contacts` table with status column | Separation is cleaner; avoids status-flag collapse (same pitfall avoided in rooms domain for bans) |
| WebSocket push for friend request arrival | Poll or load on page open | WebSocket push is Phase 9; polling is not needed — badge reloads on page focus are sufficient for Phase 5 |

**Installation:** No new npm packages required. Phase 5 uses only the libraries already present.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (React)
    │
    │  REST (credentials: include)
    ▼
ContactsController  (/api/v1/contacts)
    │
    ├── GET  /requests          → incoming pending requests for current user
    ├── POST /requests          → send friend request (by username + optional msg)
    ├── POST /requests/:id/accept
    ├── POST /requests/:id/decline
    ├── DELETE /requests/:id    → cancel outgoing request (sender only)
    │
    ├── GET  /friends           → current user's confirmed friends (with presence hint)
    ├── DELETE /friends/:userId → remove a friend
    │
    ├── POST /bans              → ban a user (body: { targetUserId })
    ├── GET  /bans              → list of users current user has banned
    ├── DELETE /bans/:userId    → unban
    │
    └── POST /dm/:userId        → initiate DM (returns stub conversation; eligibility enforced)
         └── ContactsService.checkDmEligibility(callerId, targetId)
              ├── no friendship row?  → 403
              ├── ban by caller?      → 403
              └── ban by target?      → 403

ContactsService (policy layer)
    │
    ├── ContactsRepository (SQL)
    │     ├── friend_requests table
    │     ├── friendships table
    │     ├── user_bans table
    │     └── dm_conversations table (stub — frozen flag only)
    │
    └── UserRepository (re-used from AuthModule — username lookup)
```

### Recommended Project Structure

```
apps/api/src/contacts/
├── contacts.controller.ts   # HTTP endpoints
├── contacts.service.ts      # Policy layer — eligibility checks, mutation rules
├── contacts.repository.ts   # All SQL for contacts domain
├── contacts.module.ts       # NestJS module wiring
└── contacts.types.ts        # Domain type definitions

apps/api/src/db/migrations/
└── 0004_contacts_core.sql   # New migration

apps/web/src/features/contacts/
├── ContactsSidebar.tsx      # CONTACTS section in the left nav
├── ContactsView.tsx         # Full contacts page (requests + friends + banned)
├── AddContactModal.tsx      # + Add contact modal (D-04)
├── FriendRequestDropdown.tsx # Top nav notification dropdown (D-01, D-02)
├── DmScreenStub.tsx         # Empty-state DM screen for Phase 6 to fill
└── BanConfirmModal.tsx      # Confirmation dialog (D-07)
```

### Pattern 1: Domain Module (following rooms pattern)

Every domain in this project follows the same module structure. The contacts module must mirror rooms exactly.

**What:** Four-file backend module — controller, service, repository, module.
**When to use:** Any new HTTP-facing domain.

```typescript
// Source: apps/api/src/rooms/rooms.module.ts (VERIFIED: codebase read)
// contacts.module.ts follows the same pattern:
@Module({
  imports: [DbModule, AuthModule],
  controllers: [ContactsController],
  providers: [ContactsRepository, ContactsService, UserRepository],
  exports: [ContactsService],  // exported for Phase 6 DM eligibility checks
})
export class ContactsModule {}
```

### Pattern 2: CurrentUserGuard (established auth pattern)

**What:** All endpoints attach `@UseGuards(CurrentUserGuard)` at the controller level and extract the caller via `@CurrentUser()`.
**When to use:** Every new authenticated endpoint.

```typescript
// Source: apps/api/src/rooms/rooms.controller.ts (VERIFIED: codebase read)
@Controller('api/v1/contacts')
@UseGuards(CurrentUserGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get('friends')
  async getMyFriends(@CurrentUser() auth: AuthContext) {
    return this.contactsService.getFriends(auth.user.id);
  }
}
```

### Pattern 3: Repository SQL isolation

**What:** All SQL lives in `{domain}.repository.ts`. Service and controller never issue SQL directly.

```typescript
// Source: apps/api/src/rooms/rooms.repository.ts (VERIFIED: codebase read)
// Pattern for contacts.repository.ts:
@Injectable()
export class ContactsRepository {
  constructor(private readonly db: PostgresService) {}

  async findFriendship(userAId: string, userBId: string): Promise<Friendship | null> {
    const result = await this.db.query<Friendship>(
      `SELECT * FROM friendships
       WHERE (user_a_id = $1 AND user_b_id = $2)
          OR (user_a_id = $2 AND user_b_id = $1)
       LIMIT 1`,
      [userAId, userBId],
    );
    return result.rows[0] ?? null;
  }
}
```

### Pattern 4: Vitest unit tests with plain object stubs

**What:** Tests use `vi.fn()` stubs for repository methods; no NestJS testing module needed.
**When to use:** All service-layer logic tests.

```typescript
// Source: apps/api/src/__tests__/rooms/rooms-domain.spec.ts (VERIFIED: codebase read)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContactsService } from '../../contacts/contacts.service.js';

describe('ContactsService', () => {
  let mockRepo: { findFriendship: ReturnType<typeof vi.fn> };
  let svc: ContactsService;

  beforeEach(async () => {
    mockRepo = { findFriendship: vi.fn() };
    const { ContactsService } = await import('../../contacts/contacts.service.js');
    svc = new ContactsService(mockRepo as any, {} as any);
  });

  it('checkDmEligibility returns false when no friendship exists', async () => {
    mockRepo.findFriendship.mockResolvedValue(null);
    const result = await svc.checkDmEligibility('user-a', 'user-b');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_friends');
  });
});
```

### Pattern 5: PresenceDot reuse (no reinvention)

**What:** Contacts list rows use the existing `PresenceDot` primitive from `features/presence/`.
**When to use:** Any compact list showing users.

```tsx
// Source: apps/web/src/features/rooms/RoomMembersTable.tsx (VERIFIED: codebase read)
import { PresenceDot, type PresenceStatus } from "../presence/PresenceDot";

// In ContactsSidebar.tsx — same pattern:
<span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
  <PresenceDot status={contact.presenceStatus ?? "offline"} />
  <span>{contact.username}</span>
</span>
```

### Anti-Patterns to Avoid

- **Status-flag collapse:** Do not use a single `contacts` table with a `status` column that tries to encode `pending/accepted/friend/banned` in one field. Separate tables for `friend_requests`, `friendships`, and `user_bans` keep the domain clean and survive concurrent state transitions (same lesson learned in rooms domain with bans).
- **Symmetric ban storage:** Do not store bans as a symmetric (A,B) pair. A bans B is one row; B banning A is a separate independent row. The eligibility check queries both directions.
- **Frontend-only DM gating:** The DM button's disabled state is informational. The backend must enforce the eligibility rule and return 403 if called with ineligible users (D-14).
- **Skipping the dm_conversations stub:** Phase 6 must not have to restructure the schema. The FRND-05 freeze requirement means `dm_conversations` rows must exist in Phase 5 so the ban service can flip `frozen = true`. Phase 6 adds message rows to that same table.
- **Reinventing presence rendering:** Do not create new CSS classes or new React components for presence dots in the contacts list. Use `PresenceDot` from `features/presence/` directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID scheme | `randomUUID()` from `node:crypto` | Already used in every repository; consistent with existing rows |
| Auth guard | Custom session cookie parsing in contacts endpoints | `CurrentUserGuard` + `@CurrentUser()` decorator from `apps/api/src/auth/` | Established pattern; guards session lifecycle correctly |
| Presence dot rendering | New colored-dot CSS or component | `PresenceDot` from `apps/web/src/features/presence/PresenceDot.tsx` | Already implements the Phase 3 locked color contract |
| Username lookup (for friend request by username) | New user search endpoint | `UserRepository.findByUsername()` from `apps/api/src/auth/user.repository.ts` | Already exists; re-use via AuthModule import in ContactsModule |

**Key insight:** The contacts domain is structurally similar to rooms (separate relational tables for each state concept, repository isolation, service policy layer). The existing rooms module is the complete implementation template — follow it exactly.

---

## Common Pitfalls

### Pitfall 1: Forgetting the dm_conversations stub table

**What goes wrong:** Phase 5 ships without a `dm_conversations` table. Phase 6 creates it. When a ban is applied, the `frozen` flag is not set because the row does not exist yet. DM history is not actually frozen.
**Why it happens:** Phase 5 focuses on the friendship/ban logic and defers "messaging stuff" to Phase 6.
**How to avoid:** Include `dm_conversations` in `0004_contacts_core.sql` — even with just `(id, user_a_id, user_b_id, frozen, created_at)` columns. The ban service must be able to call `SET frozen = true WHERE (user_a_id = $1 AND user_b_id = $2) OR ...`
**Warning signs:** If Phase 5 plan contains no `dm_conversations` table, reject it.

### Pitfall 2: Symmetric ban storage

**What goes wrong:** `user_bans` is designed with a UNIQUE constraint on `(user_a_id, user_b_id)` ordered consistently (min/max trick). Independent bans from each side cannot be stored separately.
**Why it happens:** Thinking of bans as "mutual block" rather than "directed action."
**How to avoid:** UNIQUE constraint is `(banner_user_id, banned_user_id)`. A banning B and B banning A are two separate rows. The DM eligibility check queries both:
```sql
SELECT COUNT(*) FROM user_bans
WHERE (banner_user_id = $1 AND banned_user_id = $2)
   OR (banner_user_id = $2 AND banned_user_id = $1)
```
**Warning signs:** Any schema that normalizes `(min_id, max_id)` for bans.

### Pitfall 3: Missing transactional atomicity on ban

**What goes wrong:** Ban is applied in two separate queries — delete the friendship, then insert the ban row. Between those two queries, a concurrent DM eligibility check succeeds (friendship exists, no ban yet). DM message is sent. Then ban lands. FRND-06 is violated.
**Why it happens:** Simple sequential queries without transaction.
**How to avoid:** Wrap the ban operation in a PostgreSQL transaction: delete friendship + insert ban + upsert dm_conversations.frozen in one `db.transaction(async tx => { ... })` call. The existing `PostgresService` supports `db.query()` with a transaction client pattern (see `session.repository.ts` for the `executor` pattern used in `updatePasswordHash`).
**Warning signs:** Repository ban method uses three separate `await db.query(...)` calls without a transaction wrapper.

### Pitfall 4: Duplicate pending friend request

**What goes wrong:** User A sends a request to B. While pending, A sends another. Second request succeeds and creates a duplicate row. Accept/decline logic breaks because two rows exist.
**Why it happens:** No UNIQUE constraint on `(requester_id, target_id)` in `friend_requests`.
**How to avoid:** Add `CONSTRAINT friend_requests_pending_unique UNIQUE (requester_id, target_id)`. Service-layer pre-check with friendly error message ("You already have a pending request to this user") mirrors the rooms pattern (`rooms_name_unique` + `ConflictException`).
**Warning signs:** `friend_requests` table created without a unique constraint.

### Pitfall 5: Notification badge count becoming stale

**What goes wrong:** User accepts one request from the dropdown, but the badge count still shows the old total. User sees stale badge for the rest of the session.
**Why it happens:** Badge count stored in local React state, not re-fetched after accept/decline.
**How to avoid:** After every accept/decline mutation, refetch the pending requests list (or the count endpoint). The same pattern used in App.tsx for `loadPrivateRoomData()` after `acceptRoomInvite()` applies here.
**Warning signs:** Badge count is set once at page load and never updated.

### Pitfall 6: Ban targeting the current user's own account

**What goes wrong:** Frontend bug or API call passes `targetUserId === currentUserId`. Ban row is inserted for self-ban. DM eligibility query returns 0 valid DM partners.
**Why it happens:** No server-side guard against self-ban.
**How to avoid:** `ContactsService.banUser()` throws `BadRequestException('Cannot ban yourself')` when `callerId === targetUserId`. Mirror the pattern in `RoomsService` where the owner cannot be removed from their own room.
**Warning signs:** No self-ban guard in service tests.

---

## Code Examples

Verified patterns from the existing codebase:

### Migration file structure (0004_contacts_core.sql)

```sql
-- Source: apps/api/src/db/migrations/0003_rooms_core.sql (VERIFIED: codebase read)

-- friend_requests table
CREATE TABLE IF NOT EXISTS friend_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message         TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate pending requests
  CONSTRAINT friend_requests_pair_unique UNIQUE (requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_target    ON friend_requests (target_id);

-- friendships table (only created after accept)
CREATE TABLE IF NOT EXISTS friendships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_b_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Normalize ordering so (A,B) and (B,A) cannot coexist
  CONSTRAINT friendships_unique UNIQUE (user_a_id, user_b_id),
  CONSTRAINT friendships_no_self CHECK (user_a_id <> user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON friendships (user_a_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships (user_b_id);

-- user_bans table (directional: A banning B is independent of B banning A)
CREATE TABLE IF NOT EXISTS user_bans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_user_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  banned_user_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_bans_unique UNIQUE (banner_user_id, banned_user_id),
  CONSTRAINT user_bans_no_self CHECK (banner_user_id <> banned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bans_banner ON user_bans (banner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_banned ON user_bans (banned_user_id);

-- dm_conversations stub (Phase 6 extends with message rows)
-- frozen = true after either party bans the other (FRND-05)
CREATE TABLE IF NOT EXISTS dm_conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_b_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  frozen      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Normalize (A,B): always stored with user_a_id < user_b_id (lexicographic UUID)
  CONSTRAINT dm_conversations_unique UNIQUE (user_a_id, user_b_id),
  CONSTRAINT dm_conversations_no_self CHECK (user_a_id <> user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_conversations_user_a ON dm_conversations (user_a_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_user_b ON dm_conversations (user_b_id);
```

### DM eligibility check service method

```typescript
// Source: derived from rooms.service.ts + rooms.repository.ts patterns (VERIFIED: codebase read)
// contacts.service.ts

async checkDmEligibility(
  callerId: string,
  targetId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  const friendship = await this.repo.findFriendship(callerId, targetId);
  if (!friendship) {
    return { eligible: false, reason: 'not_friends' };
  }

  const ban = await this.repo.findBanBetween(callerId, targetId);
  if (ban) {
    return { eligible: false, reason: 'ban_exists' };
  }

  return { eligible: true };
}
```

### Friendship normalized ordering

```typescript
// Source: ASSUMED pattern based on dm_conversations schema above
// The friendships table uses normalized (user_a_id, user_b_id) order to enforce uniqueness.
// Repository must always canonicalize before querying:
private normalizeUserPair(
  idA: string,
  idB: string,
): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

async findFriendship(userAId: string, userBId: string): Promise<Friendship | null> {
  const [a, b] = this.normalizeUserPair(userAId, userBId);
  const result = await this.db.query<Friendship>(
    'SELECT * FROM friendships WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1',
    [a, b],
  );
  return result.rows[0] ?? null;
}
```

### Ban with transactional friendship termination

```typescript
// Source: auth.service.ts transaction pattern (VERIFIED: codebase pattern review)
// contacts.service.ts

async banUser(callerId: string, targetId: string): Promise<void> {
  if (callerId === targetId) {
    throw new BadRequestException('Cannot ban yourself');
  }

  await this.db.transaction(async (tx) => {
    // 1. Remove friendship (if any)
    await this.repo.deleteFriendship(callerId, targetId, tx);

    // 2. Insert ban row
    await this.repo.createBan({ banner_user_id: callerId, banned_user_id: targetId }, tx);

    // 3. Freeze DM conversation (if any)
    await this.repo.freezeDmConversation(callerId, targetId, tx);
  });
}
```

### Frontend: RoomMembersTable friend request action addition

```tsx
// Source: apps/web/src/features/rooms/RoomMembersTable.tsx (VERIFIED: codebase read)
// Add inline "Add friend" button to existing member rows
// (Only shown if not already friends and not current user)

{!isCurrentUser && !isFriend && onSendFriendRequest && (
  <button
    type="button"
    className="btn btn--soft btn--xs"
    onClick={() => onSendFriendRequest(m.userId, m.username)}
    disabled={busy}
  >
    {busy ? "…" : "Add friend"}
  </button>
)}
```

### Frontend: disabled DM button with tooltip (D-13)

```tsx
// Source: ASSUMED based on existing button patterns in rooms views (VERIFIED: pattern)
<button
  type="button"
  className="btn btn--soft btn--xs"
  disabled={!dmEligible}
  title={!dmEligible ? "Add as friend to message" : undefined}
  onClick={dmEligible ? onOpenDm : undefined}
>
  Message
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Friendship as a `contacts` table with `status` enum | Separate `friend_requests` + `friendships` + `user_bans` tables | Phase 5 design | Cleaner state machine; no rule-collapse pitfalls; exactly follows Phase 4 rooms pattern |
| Real-time push for friend request notifications | Load-on-demand badge count via REST | Phase 5 scope | WebSocket push for social notifications is a Phase 9 concern; REST polling on page load is sufficient |

**Deprecated/outdated for this project:**
- CDN React/Babel usage: forbidden (offline requirement, Phase 1 replaced this)
- Polling presence for contacts list: forbidden; presence dots reuse Phase 3 runtime engine

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PostgresService` supports a transaction wrapper (e.g., `db.transaction(async tx => ...)`) as used in the ban atomicity pattern | Code Examples | If the PostgresService only exposes `db.query()`, the ban operation requires manual `BEGIN/COMMIT/ROLLBACK` SQL calls instead; still achievable, just different implementation |
| A2 | Friendship rows use normalized (min, max) UUID ordering to enforce the UNIQUE constraint | Architecture Patterns | If ordering is not enforced, two rows could exist for the same pair — the UNIQUE constraint must reflect whichever ordering strategy is chosen consistently |
| A3 | The `UserRepository.findByUsername` method in `apps/api/src/auth/user.repository.ts` is sufficient for the friend-request-by-username lookup (no additional user search endpoint needed) | Don't Hand-Roll | If the method returns a `User` with `password_hash`, the contacts service must project only public fields before returning to client |

---

## Open Questions (RESOLVED)

1. **Does `PostgresService` have a transaction wrapper method?** *(RESOLVED)*
   - **Resolution:** No `.transaction()` wrapper exists. Plans 05-02 Task 2 uses manual `BEGIN/COMMIT/ROLLBACK` via `db.getClient()` — the same `SqlExecutor` injection pattern from `UserRepository.updatePasswordHash`.
   - What we know: `UserRepository.updatePasswordHash` accepts a `SqlExecutor` parameter for transaction support — callers can pass a transaction client. The service itself does not appear to have a dedicated `.transaction()` helper in the reviewed code.

2. **Presence data source for contacts list** *(RESOLVED)*
   - **Resolution:** Phase 5 ContactsSidebar defaults all contacts to `'offline'` presence. A lightweight `GET /api/v1/presence?userIds=a,b,c` REST endpoint is added in Phase 5 (Plan 05-03) and called on contacts load. Real-time WebSocket presence push is deferred to Phase 9.
   - What we know: Phase 3 presence is in-memory (`PresenceService`) and exposed via WebSocket `getPresence` events; there is no REST endpoint for presence.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 has no new external tool dependencies. All required services (PostgreSQL, Redis, Node.js, React/Vite) are already provisioned from Phases 1–4 and running in Docker Compose.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (already installed) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && npm test -- --reporter=verbose` |
| Full suite command | `cd apps/api && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FRND-01 | `sendFriendRequest()` creates pending request; duplicate rejected | unit | `npm test -- src/__tests__/contacts/` | ❌ Wave 0 |
| FRND-02 | `acceptRequest()` creates friendship row; `declineRequest()` does not | unit | `npm test -- src/__tests__/contacts/` | ❌ Wave 0 |
| FRND-03 | `removeFriend()` removes friendship; DM conversation remains, eligibility lost | unit | `npm test -- src/__tests__/contacts/` | ❌ Wave 0 |
| FRND-04 | `banUser()` creates ban, terminates friendship atomically, no self-ban | unit | `npm test -- src/__tests__/contacts/` | ❌ Wave 0 |
| FRND-05 | `banUser()` sets `dm_conversations.frozen = true` | unit | `npm test -- src/__tests__/contacts/` | ❌ Wave 0 |
| FRND-06 | `checkDmEligibility()` returns false for no-friendship, either-side-ban | unit | `npm test -- src/__tests__/contacts/` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/api && npm test -- src/__tests__/contacts/ --reporter=verbose`
- **Per wave merge:** `cd apps/api && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/__tests__/contacts/contacts-domain.spec.ts` — covers FRND-01 through FRND-06
- [ ] `apps/api/src/__tests__/contacts/contacts-eligibility.spec.ts` — focused DM eligibility matrix tests

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `CurrentUserGuard` — all contacts endpoints require authenticated session |
| V3 Session Management | no | Session lifecycle owned by Phase 2/3 |
| V4 Access Control | yes | Actor-vs-target checks in service layer: only the requester can cancel their own request; only the friendship participant can remove; only the banner can unban |
| V5 Input Validation | yes | Manual validation in controller (same pattern as `parseCreateRoomBody`) — validate `targetUserId` is a non-empty string; reject self-targeting at service layer |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Actor sends friend request as another user | Spoofing | `callerId` always taken from `@CurrentUser()` in the guard, never from request body |
| Actor accepts/declines someone else's request | Elevation of Privilege | Service checks `request.target_id === callerId` before accept/decline; 403 otherwise |
| Actor unbans a user they did not ban | Elevation of Privilege | Service checks `ban.banner_user_id === callerId` before delete; 403 otherwise |
| Self-ban / self-friendship request | Tampering | Service-layer `callerId === targetId` guard → `BadRequestException` |
| Accessing DM stub for ineligible pair | Elevation of Privilege | `checkDmEligibility()` enforced server-side per D-14; frontend disabled state is cosmetic only |

---

## Sources

### Primary (HIGH confidence)
- `apps/api/src/rooms/` (entire module) — VERIFIED by direct codebase read — canonical domain module template
- `apps/api/src/auth/current-user.guard.ts` — VERIFIED — auth guard pattern
- `apps/api/src/auth/user.repository.ts` — VERIFIED — `findByUsername` availability
- `apps/api/src/db/migrations/0001_auth_core.sql` through `0003_rooms_core.sql` — VERIFIED — schema patterns and constraints
- `apps/api/vitest.config.ts` — VERIFIED — test runner configuration
- `apps/web/src/features/presence/PresenceDot.tsx` — VERIFIED — presence dot component contract
- `apps/web/src/features/rooms/RoomMembersTable.tsx` — VERIFIED — inline member action pattern
- `apps/web/src/App.tsx` — VERIFIED — current sidebar structure and AppTab type
- `requirements/desing_v1/components/contacts.jsx` — VERIFIED — design reference for contacts page layout
- `requirements/requirements_raw.md §2.3` — VERIFIED — canonical friendship/ban/DM eligibility rules
- `requirements/wireframes.md` — VERIFIED — sidebar layout contract (ROOMS then CONTACTS)
- `.planning/phases/05-contacts-and-dm-policy/05-CONTEXT.md` — VERIFIED — locked user decisions

### Secondary (MEDIUM confidence)
- `apps/api/src/rooms/rooms.service.ts` — VERIFIED partial read — policy layer patterns (ConflictException, ForbiddenException, BadRequestException)

### Tertiary (LOW confidence)
- Transaction wrapper pattern (A1) — ASSUMED based on `updatePasswordHash` executor injection; PostgresService internals not fully read

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; project stack fully known from prior phases
- Architecture: HIGH — derived directly from existing codebase patterns
- Schema design: HIGH — follows established migration + type pattern; constraint choices verified against rooms domain
- DM stub design: MEDIUM — derived from requirement analysis; exact column set will need Phase 6 buy-in
- Transaction wrapper availability: LOW — assumption A1 unverified; requires implementer to read `postgres.service.ts`
- Pitfalls: HIGH — all six pitfalls are traceable to either domain logic errors or established code patterns

**Research date:** 2026-04-18
**Valid until:** 2026-06-01 (stable stack; no fast-moving dependencies)
