# Phase 5: Contacts and DM Policy - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 14 new/modified files
**Analogs found:** 13 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/api/src/contacts/contacts.controller.ts` | controller | request-response | `apps/api/src/rooms/rooms.controller.ts` | exact |
| `apps/api/src/contacts/contacts.service.ts` | service | CRUD | `apps/api/src/rooms/rooms.service.ts` | exact |
| `apps/api/src/contacts/contacts.repository.ts` | repository | CRUD | `apps/api/src/rooms/rooms.repository.ts` | exact |
| `apps/api/src/contacts/contacts.module.ts` | config | — | `apps/api/src/rooms/rooms.module.ts` | exact |
| `apps/api/src/contacts/contacts.types.ts` | model | — | `apps/api/src/rooms/rooms.types.ts` | exact |
| `apps/api/src/db/migrations/0004_contacts_core.sql` | migration | — | `apps/api/src/db/migrations/0003_rooms_core.sql` | exact |
| `apps/api/src/__tests__/contacts/contacts-domain.spec.ts` | test | — | `apps/api/src/__tests__/rooms/rooms-domain.spec.ts` | exact |
| `apps/api/src/__tests__/contacts/contacts-eligibility.spec.ts` | test | — | `apps/api/src/__tests__/rooms/rooms-domain.spec.ts` | role-match |
| `apps/web/src/features/contacts/ContactsSidebar.tsx` | component | request-response | `apps/web/src/features/rooms/RoomMembersTable.tsx` | role-match |
| `apps/web/src/features/contacts/ContactsView.tsx` | component | request-response | `apps/web/src/features/rooms/PublicRoomsView.tsx` | role-match |
| `apps/web/src/features/contacts/AddContactModal.tsx` | component | request-response | `apps/web/src/features/rooms/CreateRoomView.tsx` | role-match |
| `apps/web/src/features/contacts/FriendRequestDropdown.tsx` | component | request-response | `apps/web/src/features/rooms/PrivateRoomsView.tsx` | role-match |
| `apps/web/src/features/contacts/BanConfirmModal.tsx` | component | request-response | `apps/web/src/features/rooms/ManageRoomView.tsx` | partial |
| `apps/web/src/features/contacts/DmScreenStub.tsx` | component | request-response | `apps/web/src/features/rooms/PublicRoomsView.tsx` | partial |
| `apps/web/src/App.tsx` (modified) | component | request-response | self | — |
| `apps/web/src/lib/api.ts` (modified) | utility | request-response | self | — |

---

## Pattern Assignments

### `apps/api/src/contacts/contacts.controller.ts` (controller, request-response)

**Analog:** `apps/api/src/rooms/rooms.controller.ts`

**Imports pattern** (lines 14-31):
```typescript
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ContactsService } from './contacts.service.js';
import { CurrentUserGuard } from '../auth/current-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/current-user.guard.js';
```

**Auth/Guard pattern** (lines 71-74 of rooms.controller.ts):
```typescript
@Controller('api/v1/contacts')
@UseGuards(CurrentUserGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}
```

**Core CRUD pattern** — GET + POST at controller level (lines 86-100 of rooms.controller.ts):
```typescript
@Post('requests')
@HttpCode(HttpStatus.CREATED)
async sendFriendRequest(
  @Body() body: unknown,
  @CurrentUser() ctx: AuthContext,
) {
  const input = parseSendRequestBody(body);
  const request = await this.contactsService.sendFriendRequest(ctx.user.id, input);
  return { request };
}

@Get('requests')
async getIncomingRequests(@CurrentUser() ctx: AuthContext) {
  const requests = await this.contactsService.getIncomingRequests(ctx.user.id);
  return { requests };
}
```

**No-content DELETE pattern** (lines 165-172 of rooms.controller.ts):
```typescript
@Delete('friends/:userId')
@HttpCode(HttpStatus.NO_CONTENT)
async removeFriend(
  @Param('userId') targetUserId: string,
  @CurrentUser() ctx: AuthContext,
): Promise<void> {
  await this.contactsService.removeFriend(ctx.user.id, targetUserId);
}
```

**Validation helper pattern** (lines 42-67 of rooms.controller.ts):
```typescript
// Plain function — no class-validator, no decorators
function parseSendRequestBody(body: unknown): { targetUsername: string; message?: string } {
  const b = (body ?? {}) as { targetUsername?: unknown; message?: unknown };
  if (typeof b.targetUsername !== 'string' || b.targetUsername.trim().length === 0) {
    throw new BadRequestException('targetUsername is required');
  }
  return {
    targetUsername: b.targetUsername.trim(),
    message: typeof b.message === 'string' ? b.message.trim() || undefined : undefined,
  };
}
```

**Authorization helper pattern** (lines 54-76 of rooms-management.controller.ts):
```typescript
// For endpoints that need actor-target policy (accept/decline/cancel/ban/unban)
// callerId is ALWAYS taken from @CurrentUser(), never from request body
async function requireOwnerOfRequest(...): Promise<void> {
  const isOwner = await contactsService.isRequestOwner(requestId, callerId);
  if (!isOwner) {
    throw new ForbiddenException('You cannot perform this action on another user\'s request');
  }
}
```

---

### `apps/api/src/contacts/contacts.service.ts` (service, CRUD)

**Analog:** `apps/api/src/rooms/rooms.service.ts`

**Imports pattern** (lines 16-32 of rooms.service.ts):
```typescript
import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository.js';
import { UserRepository } from '../auth/user.repository.js';
import type {
  FriendRequest,
  Friendship,
  UserBan,
  DmConversation,
  // ...input types
} from './contacts.types.js';
```

**Service class structure** (lines 34-38 of rooms.service.ts):
```typescript
@Injectable()
export class ContactsService {
  constructor(
    private readonly repo: ContactsRepository,
    private readonly userRepo: UserRepository,
  ) {}
```

**Pre-check + ConflictException pattern** (lines 53-57 of rooms.service.ts):
```typescript
async sendFriendRequest(callerId: string, input: SendRequestInput): Promise<FriendRequest> {
  const targetUser = await this.userRepo.findByUsername(input.targetUsername);
  if (!targetUser) {
    throw new NotFoundException(`User '${input.targetUsername}' is not registered`);
  }
  if (callerId === targetUser.id) {
    throw new BadRequestException('Cannot send a friend request to yourself');
  }
  const existing = await this.repo.findFriendRequest(callerId, targetUser.id);
  if (existing) {
    throw new ConflictException('You already have a pending request to this user');
  }
  // ...
}
```

**ForbiddenException for actor-target checks** (lines 277-285 of rooms.service.ts):
```typescript
async acceptRequest(requestId: string, callerId: string): Promise<Friendship> {
  const req = await this.repo.findRequestById(requestId);
  if (!req) {
    throw new NotFoundException('Friend request not found');
  }
  if (req.target_id !== callerId) {
    throw new ForbiddenException('Only the request recipient can accept it');
  }
  // ...
}
```

**Self-ban guard pattern** (mirrored from owner-cannot-be-removed in rooms.service.ts lines 341-345):
```typescript
async banUser(callerId: string, targetId: string): Promise<void> {
  if (callerId === targetId) {
    throw new BadRequestException('Cannot ban yourself');
  }
  // wrapped in transaction — see Pitfall 3 in RESEARCH.md
}
```

**DM eligibility check** (derived from research):
```typescript
async checkDmEligibility(
  callerId: string,
  targetId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  const friendship = await this.repo.findFriendship(callerId, targetId);
  if (!friendship) return { eligible: false, reason: 'not_friends' };
  const ban = await this.repo.findBanBetween(callerId, targetId);
  if (ban) return { eligible: false, reason: 'ban_exists' };
  return { eligible: true };
}
```

---

### `apps/api/src/contacts/contacts.repository.ts` (repository, CRUD)

**Analog:** `apps/api/src/rooms/rooms.repository.ts`

**Imports pattern** (lines 14-30 of rooms.repository.ts):
```typescript
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../db/postgres.service.js';
import type {
  FriendRequest,
  Friendship,
  UserBan,
  DmConversation,
  // ...input types
} from './contacts.types.js';
```

**Repository class structure** (lines 33-35 of rooms.repository.ts):
```typescript
@Injectable()
export class ContactsRepository {
  constructor(private readonly db: PostgresService) {}
```

**INSERT with RETURNING pattern** (lines 39-49 of rooms.repository.ts):
```typescript
async createFriendRequest(input: CreateFriendRequestInput): Promise<FriendRequest> {
  const id = randomUUID();
  const result = await this.db.query<FriendRequest>(
    `INSERT INTO friend_requests (id, requester_id, target_id, message, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
     RETURNING id, requester_id, target_id, message, status, created_at, updated_at`,
    [id, input.requester_id, input.target_id, input.message ?? null],
  );
  return result.rows[0];
}
```

**SELECT with null-coalescing pattern** (lines 52-59 of rooms.repository.ts):
```typescript
async findFriendship(userAId: string, userBId: string): Promise<Friendship | null> {
  const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
  const result = await this.db.query<Friendship>(
    `SELECT * FROM friendships WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1`,
    [a, b],
  );
  return result.rows[0] ?? null;
}
```

**DELETE returning boolean** (lines 129-134 of rooms.repository.ts):
```typescript
async deleteFriendship(userAId: string, userBId: string): Promise<boolean> {
  const result = await this.db.query(
    `DELETE FROM friendships WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
    [userAId, userBId],
  );
  return (result.rowCount ?? 0) > 0;
}
```

**EXISTS check pattern** (lines 335-341 of rooms.repository.ts):
```typescript
async findBanBetween(userAId: string, userBId: string): Promise<UserBan | null> {
  const result = await this.db.query<UserBan>(
    `SELECT * FROM user_bans
     WHERE (banner_user_id = $1 AND banned_user_id = $2)
        OR (banner_user_id = $2 AND banned_user_id = $1)
     LIMIT 1`,
    [userAId, userBId],
  );
  return result.rows[0] ?? null;
}
```

**ON CONFLICT upsert pattern** (lines 310-321 of rooms.repository.ts):
```typescript
// For freezeDmConversation — upsert so it works whether or not a DM row exists yet
async freezeDmConversation(userAId: string, userBId: string): Promise<void> {
  const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
  const id = randomUUID();
  await this.db.query(
    `INSERT INTO dm_conversations (id, user_a_id, user_b_id, frozen, created_at)
     VALUES ($1, $2, $3, TRUE, NOW())
     ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET frozen = TRUE`,
    [id, a, b],
  );
}
```

---

### `apps/api/src/contacts/contacts.module.ts` (config)

**Analog:** `apps/api/src/rooms/rooms.module.ts`

**Full pattern** (lines 29-35 of rooms.module.ts):
```typescript
import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ContactsRepository } from './contacts.repository.js';
import { ContactsService } from './contacts.service.js';
import { ContactsController } from './contacts.controller.js';
import { UserRepository } from '../auth/user.repository.js';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [ContactsController],
  providers: [ContactsRepository, ContactsService, UserRepository],
  exports: [ContactsService],  // exported for Phase 6 DM eligibility checks
})
export class ContactsModule {}
```

Note: `ContactsModule` is registered in `apps/api/src/app.module.ts` following the same pattern as `RoomsModule`.

---

### `apps/api/src/contacts/contacts.types.ts` (model)

**Analog:** `apps/api/src/rooms/rooms.types.ts`

**String-union type pattern** (lines 17-23 of rooms.types.ts):
```typescript
export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
```

**Core domain interface pattern** (lines 33-42 of rooms.types.ts):
```typescript
export interface FriendRequest {
  id: string;
  requester_id: string;
  target_id: string;
  message: string | null;
  status: FriendRequestStatus;
  created_at: Date;
  updated_at: Date;
}

export interface Friendship {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: Date;
}

export interface UserBan {
  id: string;
  banner_user_id: string;
  banned_user_id: string;
  created_at: Date;
}

export interface DmConversation {
  id: string;
  user_a_id: string;  // normalized: always user_a_id < user_b_id
  user_b_id: string;
  frozen: boolean;
  created_at: Date;
}
```

**Projection / view type pattern** (lines 112-120 of rooms.types.ts):
```typescript
// Friend with presence hint (for contacts list)
export interface FriendWithPresence {
  userId: string;
  username: string;
  presenceStatus?: 'online' | 'afk' | 'offline';
}

// Pending request enriched with requester username
export interface IncomingFriendRequestView {
  request: FriendRequest;
  requester_username: string;
}
```

**Input types pattern** (lines 166-200 of rooms.types.ts):
```typescript
export interface SendFriendRequestInput {
  requester_id: string;
  target_id: string;
  message?: string | null;
}

export interface CreateBanInput {
  banner_user_id: string;
  banned_user_id: string;
}
```

---

### `apps/api/src/db/migrations/0004_contacts_core.sql` (migration)

**Analog:** `apps/api/src/db/migrations/0003_rooms_core.sql`

**Migration file header pattern** (lines 1-6 of 0003_rooms_core.sql):
```sql
-- Migration: 0004_contacts_core
-- Purpose: friendship lifecycle, user-to-user ban mechanics, and DM conversation stub
-- Creates friend_requests, friendships, user_bans, and dm_conversations
-- Design: separate tables per state concept; ban is directional; DM conversation
--         stub exists so FRND-05 freeze can be applied before Phase 6 ships
```

**Table with CHECK + UNIQUE constraint pattern** (lines 10-22 of 0003_rooms_core.sql):
```sql
CREATE TABLE IF NOT EXISTS friend_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message         TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friend_requests_pair_unique UNIQUE (requester_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_target    ON friend_requests (target_id);
```

**Normalized-pair UNIQUE constraint pattern** (lines 32-41 of 0003_rooms_core.sql — room_memberships analog):
```sql
-- friendships: symmetric relation stored with normalized ordering
CREATE TABLE IF NOT EXISTS friendships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_b_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friendships_unique UNIQUE (user_a_id, user_b_id),
  CONSTRAINT friendships_no_self CHECK (user_a_id <> user_b_id)
);
```

**Ban table with directional constraint** (lines 85-94 of 0003_rooms_core.sql):
```sql
-- user_bans: directional; A banning B and B banning A are independent rows
CREATE TABLE IF NOT EXISTS user_bans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_user_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  banned_user_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_bans_unique UNIQUE (banner_user_id, banned_user_id),
  CONSTRAINT user_bans_no_self CHECK (banner_user_id <> banned_user_id)
);
```

---

### `apps/api/src/__tests__/contacts/contacts-domain.spec.ts` (test)

**Analog:** `apps/api/src/__tests__/rooms/rooms-domain.spec.ts`

**Test file header and imports pattern** (lines 1-23 of rooms-domain.spec.ts):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContactsRepository } from '../../contacts/contacts.repository.js';
import type { ContactsService } from '../../contacts/contacts.service.js';
import type {
  FriendRequest,
  Friendship,
  UserBan,
  FriendRequestStatus,
} from '../../contacts/contacts.types.js';
import type { UserRepository } from '../../auth/user.repository.js';
```

**Plain object repository stub pattern** (lines 107-129 of rooms-domain.spec.ts):
```typescript
function makeContactsRepository(): ContactsRepository {
  return {
    createFriendRequest: vi.fn(),
    findRequestById: vi.fn(),
    findFriendRequest: vi.fn(),
    findFriendship: vi.fn(),
    createFriendship: vi.fn(),
    deleteFriendship: vi.fn(),
    listFriends: vi.fn(),
    createBan: vi.fn(),
    removeBan: vi.fn(),
    findBanBetween: vi.fn(),
    listBans: vi.fn(),
    freezeDmConversation: vi.fn(),
  } as unknown as ContactsRepository;
}
```

**Real service implementation test pattern** (lines 297-327 of rooms-domain.spec.ts):
```typescript
describe('ContactsService real implementation', () => {
  it('checkDmEligibility returns false when no friendship exists', async () => {
    const { ContactsService } = await import('../../contacts/contacts.service.js');
    const mockRepo = makeContactsRepository();
    const mockUserRepo = makeUserRepository();

    vi.mocked(mockRepo.findFriendship).mockResolvedValue(null);

    const svc = new ContactsService(mockRepo, mockUserRepo);
    const result = await svc.checkDmEligibility('user-a', 'user-b');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_friends');
  });

  it('banUser throws BadRequestException for self-ban', async () => {
    const { ContactsService } = await import('../../contacts/contacts.service.js');
    const mockRepo = makeContactsRepository();
    const mockUserRepo = makeUserRepository();
    const svc = new ContactsService(mockRepo, mockUserRepo);
    await expect(svc.banUser('user-a', 'user-a')).rejects.toThrow();
  });
});
```

---

### `apps/web/src/features/contacts/ContactsSidebar.tsx` (component, request-response)

**Analog:** `apps/web/src/features/rooms/RoomMembersTable.tsx`

**Imports pattern — PresenceDot reuse** (lines 15-16 of RoomMembersTable.tsx):
```tsx
import { PresenceDot, type PresenceStatus } from "../presence/PresenceDot";
```

**Contact row pattern with presence dot** (lines 75-82 of RoomMembersTable.tsx):
```tsx
<span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
  <PresenceDot status={contact.presenceStatus ?? "offline"} />
  <span>{contact.username}</span>
</span>
```

**Inline action button pattern** (lines 102-131 of RoomMembersTable.tsx):
```tsx
{!isCurrentUser && (
  <button
    type="button"
    className="btn btn--soft btn--xs"
    onClick={() => onOpenDm?.(contact.userId)}
    disabled={!dmEligible}
    title={!dmEligible ? "Add as friend to message" : undefined}
  >
    Message
  </button>
)}
```

**Props interface pattern** (lines 26-40 of RoomMembersTable.tsx):
```tsx
interface ContactsSidebarProps {
  contacts: ContactRow[];
  currentUserId: string;
  onAddContact?: () => void;
  onOpenDm?: (userId: string) => void;
}

export interface ContactRow {
  userId: string;
  username: string;
  presenceStatus?: PresenceStatus;
  dmEligible: boolean;
}
```

**Sidebar section label pattern** (from App.tsx lines 251-252):
```tsx
<div className="app-account__nav-label">CONTACTS</div>
```

---

### `apps/web/src/features/contacts/ContactsView.tsx` (component, request-response)

**Analog:** `apps/web/src/features/rooms/PublicRoomsView.tsx`

**Loading/error/data state pattern** (lines 25-44 of PublicRoomsView.tsx):
```tsx
const [contacts, setContacts] = useState<ContactRow[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [actionBusy, setActionBusy] = useState<string | null>(null);
const [actionError, setActionError] = useState<string | null>(null);
```

**useEffect fetch pattern** (lines 33-52 of PublicRoomsView.tsx):
```tsx
const fetchContacts = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await getMyFriends();
    setContacts(result.friends);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Failed to load contacts");
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  void fetchContacts();
}, [fetchContacts]);
```

**Action handler with refetch pattern** (lines 165-178 of App.tsx):
```tsx
async function handleAcceptRequest(requestId: string) {
  setActionBusy(requestId);
  try {
    await acceptFriendRequest(requestId);
    await fetchContacts();  // refetch after mutation — same pattern as loadPrivateRoomData
  } catch (e) {
    setActionError(e instanceof Error ? e.message : "Failed to accept request");
  } finally {
    setActionBusy(null);
  }
}
```

**Section headers + list rendering** (lines 95-128 of PublicRoomsView.tsx):
```tsx
{!loading && !error && requests.length === 0 && (
  <p className="rooms-empty">No pending friend requests.</p>
)}
{!loading && !error && requests.length > 0 && (
  <ul className="rooms-list" aria-label="Incoming friend requests">
    {requests.map((req) => (
      <li key={req.request.id} className="rooms-list__item">
        {/* ... */}
      </li>
    ))}
  </ul>
)}
```

---

### `apps/web/src/features/contacts/AddContactModal.tsx` (component, request-response)

**Analog:** `apps/web/src/features/rooms/CreateRoomView.tsx`

**Controlled form input pattern:**
```tsx
const [username, setUsername] = useState("");
const [message, setMessage] = useState("");
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState<string | null>(null);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitting(true);
  setError(null);
  try {
    await sendFriendRequest({ targetUsername: username.trim(), message: message.trim() || undefined });
    setSuccess("Request sent!");
    setUsername("");
    setMessage("");
    onClose?.();
  } catch (e) {
    setError(e instanceof Error ? e.message : "Failed to send request");
  } finally {
    setSubmitting(false);
  }
}
```

**Field pattern** (from rooms create view pattern):
```tsx
<div className="field">
  <label className="field__label" htmlFor="contact-username">Username</label>
  <input
    id="contact-username"
    className="field__input"
    type="text"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    placeholder="e.g. alice"
    required
    autoFocus
  />
</div>
<div className="field">
  <label className="field__label" htmlFor="contact-message">Message (optional)</label>
  <input
    id="contact-message"
    className="field__input"
    type="text"
    value={message}
    onChange={(e) => setMessage(e.target.value)}
    placeholder="Say hello…"
  />
</div>
```

**Submit button with busy state** (pattern from PublicRoomsView.tsx):
```tsx
<button type="submit" className="btn" disabled={submitting || !username.trim()}>
  {submitting ? "Sending…" : "Send request"}
</button>
```

---

### `apps/web/src/features/contacts/FriendRequestDropdown.tsx` (component, request-response)

**Analog:** `apps/web/src/features/rooms/PrivateRoomsView.tsx`

**Invite row accept/decline pattern** (from PrivateRoomsView.tsx lines 41-52):
```tsx
interface FriendRequestDropdownProps {
  requests: IncomingRequestRow[];
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  actionBusy?: string | null;
  onClose?: () => void;
}
```

**Accept/Decline action pair** (from PrivateRoomsView accept/decline pattern):
```tsx
{requests.map((req) => (
  <div key={req.id} className="contact-row">
    <span>{req.requester_username}</span>
    {req.message && <span className="sub">{req.message}</span>}
    <div className="actions">
      <button
        type="button"
        className="btn btn--soft btn--xs"
        onClick={() => onDecline?.(req.id)}
        disabled={actionBusy === req.id}
      >
        {actionBusy === req.id ? "…" : "Decline"}
      </button>
      <button
        type="button"
        className="btn btn--xs"
        onClick={() => onAccept?.(req.id)}
        disabled={actionBusy === req.id}
      >
        {actionBusy === req.id ? "…" : "Accept"}
      </button>
    </div>
  </div>
))}
```

**Badge count in top nav** — add to App.tsx top bar (from App.tsx lines 245-247):
```tsx
<header className="app-topbar">
  <div className="app-topbar__logo">&#9675; chatsrv</div>
  {/* Phase 5: notification badge */}
  <button type="button" className="app-topbar__notif" onClick={toggleRequestDropdown}>
    &#128276;
    {pendingRequestCount > 0 && (
      <span className="notif-badge">{pendingRequestCount}</span>
    )}
  </button>
  <span className="app-topbar__user">{user.username}</span>
</header>
```

---

### `apps/web/src/features/contacts/BanConfirmModal.tsx` (component, request-response)

**Analog:** `apps/web/src/features/rooms/ManageRoomView.tsx` (confirmation action pattern)

**Confirmation pattern** (from ManageRoomView action button + error display):
```tsx
interface BanConfirmModalProps {
  targetUsername: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}

export function BanConfirmModal({ targetUsername, onConfirm, onCancel, busy }: BanConfirmModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h3>Block {targetUsername}?</h3>
        <p>This will block the user and remove the friendship. This action can be reversed from your account settings.</p>
        <div className="modal__actions">
          <button type="button" className="btn btn--soft" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Blocking…" : "Block"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### `apps/web/src/features/contacts/DmScreenStub.tsx` (component, request-response)

**Analog:** `apps/web/src/features/rooms/PublicRoomsView.tsx` (empty state pattern)

**Empty state pattern** (lines 96-100 of PublicRoomsView.tsx):
```tsx
interface DmScreenStubProps {
  partnerUsername: string;
  /** Set to true when DM is frozen due to a ban. */
  frozen?: boolean;
  /** Set when DM is ineligible (used to show informational message). */
  ineligibleReason?: 'not_friends' | 'ban_exists';
}

export function DmScreenStub({ partnerUsername, frozen, ineligibleReason }: DmScreenStubProps) {
  return (
    <div className="rooms-view">
      <div className="rooms-view__header">
        <h2>{partnerUsername}</h2>
      </div>
      {frozen && (
        <p className="error-msg">This conversation is read-only.</p>
      )}
      {ineligibleReason === 'ban_exists' && (
        <p className="rooms-empty">This user has restricted contact with you.</p>
      )}
      {!frozen && !ineligibleReason && (
        <p className="rooms-empty">Messages will appear here. (Coming in Phase 6)</p>
      )}
    </div>
  );
}
```

---

### `apps/web/src/App.tsx` (modified)

**Analog:** self — extend existing pattern

**AppTab union extension** (lines 43-50 of App.tsx):
```tsx
type AppTab =
  | "password"
  | "sessions"
  | "presence"
  | "public-rooms"
  | "private-rooms"
  | "create-room"
  | "manage-room"
  | "contacts"       // Phase 5: new
  | "dm";            // Phase 5: new (stub)
```

**State for pending request badge** (lines 70-78 of App.tsx — extend same block):
```tsx
const [pendingRequestCount, setPendingRequestCount] = useState(0);
const [requestDropdownOpen, setRequestDropdownOpen] = useState(false);
const [dmPartnerId, setDmPartnerId] = useState<string | null>(null);
```

**Sidebar section** — add below ROOMS section (lines 251-270 of App.tsx):
```tsx
<div className="app-account__nav-label" style={{ marginTop: "1rem" }}>CONTACTS</div>
{contacts.map((c) => (
  <button
    key={c.userId}
    type="button"
    className="app-account__nav-item"
    onClick={() => { setDmPartnerId(c.userId); setTab("dm"); }}
  >
    <PresenceDot status={c.presenceStatus ?? "offline"} />
    {c.username}
  </button>
))}
<button type="button" className="app-account__nav-item" onClick={() => setAddContactOpen(true)}>
  + Add contact
</button>
```

---

### `apps/web/src/lib/api.ts` (modified)

**Analog:** self — extend existing REST client pattern

**Fetch helper reuse** (lines 66-92 of api.ts):
```typescript
// All new contacts endpoints follow the existing post/get/del helpers:

export async function sendFriendRequest(body: { targetUsername: string; message?: string }) {
  return post<{ request: FriendRequest }>('/contacts/requests', body);
}

export async function getIncomingRequests() {
  return get<{ requests: IncomingFriendRequestView[] }>('/contacts/requests');
}

export async function acceptFriendRequest(requestId: string) {
  return post<{ friendship: Friendship }>(`/contacts/requests/${requestId}/accept`);
}

export async function declineFriendRequest(requestId: string) {
  return post<void>(`/contacts/requests/${requestId}/decline`);
}

export async function cancelFriendRequest(requestId: string) {
  return del<void>(`/contacts/requests/${requestId}`);
}

export async function getMyFriends() {
  return get<{ friends: FriendWithPresence[] }>('/contacts/friends');
}

export async function removeFriend(userId: string) {
  return del<void>(`/contacts/friends/${userId}`);
}

export async function banUser(targetUserId: string) {
  return post<void>('/contacts/bans', { targetUserId });
}

export async function getMyBans() {
  return get<{ bans: UserBan[] }>('/contacts/bans');
}

export async function unbanUser(userId: string) {
  return del<void>(`/contacts/bans/${userId}`);
}

export async function initiateDm(userId: string) {
  return post<{ conversation: DmConversation; eligible: boolean }>(`/contacts/dm/${userId}`);
}
```

---

## Shared Patterns

### Authentication Guard
**Source:** `apps/api/src/auth/current-user.guard.ts` + `apps/api/src/auth/current-user.decorator.ts`
**Apply to:** All ContactsController endpoints
```typescript
// Class-level guard applies to every handler in the controller
@Controller('api/v1/contacts')
@UseGuards(CurrentUserGuard)
export class ContactsController {
  // callerId is ALWAYS ctx.user.id, never from request body
  @Get('friends')
  async getMyFriends(@CurrentUser() ctx: AuthContext) {
    return this.contactsService.getFriends(ctx.user.id);
  }
}
```

### Error Handling in Services
**Source:** `apps/api/src/rooms/rooms.service.ts` (lines 16, 53-57, 278-283)
**Apply to:** `contacts.service.ts`
```typescript
// Import set — use same NestJS exceptions, no custom error classes
import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

// Pattern: pre-check throws domain-specific exception before mutation
if (!targetUser) throw new NotFoundException(`User '${username}' is not registered`);
if (callerId === targetId) throw new BadRequestException('Cannot target yourself');
if (existing) throw new ConflictException('A pending request already exists');
if (req.target_id !== callerId) throw new ForbiddenException('Insufficient authority');
```

### UUID Generation
**Source:** `apps/api/src/rooms/rooms.repository.ts` (line 15)
**Apply to:** `contacts.repository.ts` — every INSERT that needs a new row ID
```typescript
import { randomUUID } from 'node:crypto';
// In each create method:
const id = randomUUID();
```

### PresenceDot Reuse
**Source:** `apps/web/src/features/presence/PresenceDot.tsx` (lines 16, 30-40)
**Apply to:** `ContactsSidebar.tsx`, `ContactsView.tsx`
```tsx
import { PresenceDot, type PresenceStatus } from "../presence/PresenceDot";
// Render: dot only, no text label
<PresenceDot status={contact.presenceStatus ?? "offline"} />
```

### Frontend Fetch + Refetch Pattern
**Source:** `apps/web/src/App.tsx` (lines 132-149, 165-178)
**Apply to:** All contacts feature components that perform mutations
```tsx
// After every accept/decline/remove/ban mutation, refetch the relevant list
async function handleAccept(requestId: string) {
  setActionBusy(requestId);
  try {
    await acceptFriendRequest(requestId);
    await fetchPendingRequests();  // refetch to keep badge count fresh (Pitfall 5)
  } catch (e) {
    setActionError(e instanceof Error ? e.message : "Failed");
  } finally {
    setActionBusy(null);
  }
}
```

### Transactional Ban (backend)
**Source:** RESEARCH.md Code Examples §Ban with transactional friendship termination
**Apply to:** `contacts.service.ts` `banUser()` method
```typescript
// Read apps/api/src/db/postgres.service.ts first to verify transaction API
// If no .transaction() wrapper exists, use SqlExecutor injection pattern
// from apps/api/src/auth/user.repository.ts updatePasswordHash()
await this.db.transaction(async (tx) => {
  await this.repo.deleteFriendship(callerId, targetId, tx);
  await this.repo.createBan({ banner_user_id: callerId, banned_user_id: targetId }, tx);
  await this.repo.freezeDmConversation(callerId, targetId, tx);
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| None | — | — | All files have close analogs in the existing rooms domain |

---

## Metadata

**Analog search scope:** `apps/api/src/rooms/`, `apps/api/src/auth/`, `apps/api/src/__tests__/rooms/`, `apps/web/src/features/rooms/`, `apps/web/src/features/presence/`, `apps/web/src/App.tsx`, `apps/web/src/lib/api.ts`, `apps/api/src/db/migrations/`
**Files scanned:** 18
**Pattern extraction date:** 2026-04-18

### Critical Implementation Notes

1. **Transaction wrapper:** Read `apps/api/src/db/postgres.service.ts` before coding `banUser()`. If no `.transaction()` method exists, use the `SqlExecutor` injection pattern from `apps/api/src/auth/user.repository.ts` `updatePasswordHash()`.

2. **Friendship normalization:** The `friendships` table uses `user_a_id < user_b_id` (lexicographic UUID) ordering enforced by the UNIQUE constraint. The repository must canonicalize before every INSERT and SELECT on `friendships` and `dm_conversations`.

3. **`dm_conversations` stub is mandatory:** Do not defer this table to Phase 6. The ban service must set `frozen = TRUE` in Phase 5. Use the ON CONFLICT upsert pattern so `freezeDmConversation()` is idempotent whether or not a DM row already exists.

4. **Badge count freshness:** After every accept/decline in `FriendRequestDropdown.tsx`, refetch the pending requests list so the badge count updates. This is the same pattern used in App.tsx `loadPrivateRoomData()` after invite actions.
