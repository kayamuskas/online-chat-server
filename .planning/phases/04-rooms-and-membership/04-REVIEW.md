---
phase: 04-rooms-and-membership
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - apps/api/src/__tests__/rooms/rooms-catalog.spec.ts
  - apps/api/src/__tests__/rooms/rooms-domain.spec.ts
  - apps/api/src/__tests__/rooms/rooms-management.spec.ts
  - apps/api/src/app.module.ts
  - apps/api/src/db/migrations/0003_rooms_core.sql
  - apps/api/src/db/postgres.service.ts
  - apps/api/src/rooms/rooms-management.controller.ts
  - apps/api/src/rooms/rooms.controller.ts
  - apps/api/src/rooms/rooms.module.ts
  - apps/api/src/rooms/rooms.repository.ts
  - apps/api/src/rooms/rooms.service.ts
  - apps/api/src/rooms/rooms.types.ts
  - apps/web/src/App.tsx
  - apps/web/src/features/rooms/CreateRoomView.tsx
  - apps/web/src/features/rooms/ManageRoomView.tsx
  - apps/web/src/features/rooms/PrivateRoomsView.tsx
  - apps/web/src/features/rooms/PublicRoomsView.tsx
  - apps/web/src/features/rooms/RoomBanListView.tsx
  - apps/web/src/features/rooms/RoomMembersTable.tsx
  - apps/web/src/lib/api.ts
  - apps/web/src/styles.css
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 4 introduces the rooms domain: creation, public catalog, join/leave, invites, admin promotion/demotion, member removal (modeled as ban), and a ban-list surface. The architecture is clean — domain invariants live in the service, the repository is a thin SQL boundary, and controllers stay thin. Type coverage is thorough.

Six warnings and four info items were found. The most actionable issues are: (1) two service methods bypass room-existence checks, making them silently tolerate invalid room IDs; (2) the `postgres.service.ts` bootstrap SQL diverges from the migration by omitting the GIN full-text index, causing a dev/prod inconsistency; (3) a hardcoded `currentUserIsAdmin = true` in the management UI exposes admin controls to all users (access is still enforced server-side, so this is UI accuracy only); and (4) the Private Rooms tab always renders with an empty list because room data is never fetched.

---

## Warnings

### WR-01: `unbanMember` silently succeeds for non-existent rooms

**File:** `apps/api/src/rooms/rooms.service.ts:235-237`
**Issue:** `unbanMember` calls `removeBan` directly without first verifying the room exists. When `roomId` is invalid the DELETE affects zero rows and the method returns normally. The controller responds with 204, implying success for a logically impossible operation.

**Fix:**
```typescript
async unbanMember(roomId: string, targetUserId: string): Promise<void> {
  await this.getRoom(roomId); // throws NotFoundException if room does not exist
  await this.roomsRepo.removeBan(roomId, targetUserId);
}
```

---

### WR-02: `listBanned` silently returns empty array for non-existent rooms

**File:** `apps/api/src/rooms/rooms.service.ts:290-292`
**Issue:** `listBanned` calls `roomsRepo.listBanned` without verifying the room exists. An invalid `roomId` returns `[]` with HTTP 200, masking the invalid room and making it indistinguishable from a valid room with no bans.

**Fix:**
```typescript
async listBanned(roomId: string): Promise<RoomBan[]> {
  await this.getRoom(roomId); // throws NotFoundException if room does not exist
  return this.roomsRepo.listBanned(roomId);
}
```

---

### WR-03: `postgres.service.ts` bootstrap SQL omits the GIN full-text index present in the migration

**File:** `apps/api/src/db/postgres.service.ts:88-90` (rooms table block)
**Issue:** The migration `0003_rooms_core.sql` (line 27) creates a GIN full-text index used for catalog search:
```sql
CREATE INDEX IF NOT EXISTS idx_rooms_name_text ON rooms USING gin (to_tsvector('english', name));
```
This index is absent from the inline bootstrap SQL in `PostgresService`. Environments that boot via the bootstrap path (typical in development) will not have this index. Catalog search via `listPublic` falls back to `ILIKE` rather than the GIN index, so queries are functionally correct but missing the intended index.

**Fix:** Add the missing index to the bootstrap SQL in `postgres.service.ts` after the `idx_rooms_visibility` index:
```sql
CREATE INDEX IF NOT EXISTS idx_rooms_name_text ON rooms USING gin (to_tsvector('english', name));
```

---

### WR-04: `isOwner` returns `false` (not 404) for non-existent rooms — authorization guard gives misleading error

**File:** `apps/api/src/rooms/rooms.service.ts:297-300`
**Issue:** `isOwner` calls `roomsRepo.findById` directly. If the room does not exist it returns `false`, so `requireOwner` throws `ForbiddenException` ("Only the room owner can perform this action") instead of `NotFoundException`. A client making a request for a deleted or mis-typed room ID receives 403 Forbidden rather than 404 Not Found, which is misleading.

**Fix:**
```typescript
async isOwner(roomId: string, userId: string): Promise<boolean> {
  const room = await this.roomsRepo.findById(roomId);
  if (!room) {
    throw new NotFoundException(`Room '${roomId}' not found`);
  }
  return room.owner_id === userId;
}
```
Alternatively, keep `isOwner` returning `false` for unknown rooms and add an explicit room existence check at the start of each management endpoint.

---

### WR-05: Hardcoded `currentUserIsAdmin = true` renders admin controls for all users in `ManageRoomView`

**File:** `apps/web/src/features/rooms/ManageRoomView.tsx:66`
**Issue:** `const currentUserIsAdmin = true;` is hardcoded. This constant is passed to `RoomMembersTable` as `currentUserIsAdmin`, which controls whether the "Actions" column (Make admin / Remove admin / Ban) is visible. All users who reach `ManageRoomView` will see the admin action column regardless of their actual role. Server-side access control prevents unauthorized actions from succeeding, but the UI accuracy is wrong and could confuse non-admin members.

**Fix:** Derive the flag from the room and current user. Since `PrivateRoomsView` already computes `isAdminOrOwner` from the membership role, pass it down:
```typescript
// In ManageRoomView props:
interface ManageRoomViewProps {
  room: RoomCatalogRow;
  currentUserId: string;
  currentUserRole?: RoomRole; // 'owner' | 'admin' | 'member'
  onBack?: () => void;
}

// Derive in component:
const currentUserIsAdmin =
  currentUserRole === "owner" || currentUserRole === "admin";
```

---

### WR-06: Private rooms tab always renders with empty data — no fetch

**File:** `apps/web/src/App.tsx:211-214`
**Issue:** `PrivateRoomsView` is always rendered with `rooms={[]}`:
```tsx
<PrivateRoomsView
  rooms={[]}          // ← never populated
  onManage={handleManageRoom}
  onCreateRoom={() => setTab("create-room")}
/>
```
There is no `useEffect` or API call to fetch the user's private room memberships. The tab always shows "You have no private rooms yet" regardless of what rooms the user belongs to.

**Fix:** Add a fetch for private memberships when the tab is activated, e.g., expose a `listPrivateRooms` API call (or filter the catalog by membership) and populate the `rooms` state.

---

## Info

### IN-01: Duplicate room-loading round trips on owner-guarded management endpoints

**File:** `apps/api/src/rooms/rooms-management.controller.ts:67-76`
**Issue:** `requireOwner` calls `isOwner` → `findById` (one DB query), then the service method called immediately after (e.g., `makeAdmin`, `removeAdmin`) calls `getRoom` → `findById` again. Two sequential round trips load the same room row. This also introduces a brief TOCTOU window: a room deleted between the guard call and the service call will pass the guard but throw 404 in the service.

**Fix (preferred):** Pass the loaded room from the guard into the service method, or have the service own the complete authorization check and eliminate the pre-flight guard round trip. For now, the risk is negligible in practice.

---

### IN-02: `addAdmin` and `addBan` silently upsert on conflict without logging

**File:** `apps/api/src/rooms/rooms.repository.ts:162-165, 238-244`
**Issue:** Both `addAdmin` and `addBan` use `ON CONFLICT ... DO UPDATE` without any indication to the caller that an update (rather than an insert) occurred. A caller that promotes an already-admin user receives a success response indistinguishable from a new grant, and a second call to ban an already-banned user silently changes the `banned_by_user_id` and `reason`. This is by design but undocumented at the call site and could cause unexpected audit-trail gaps.

**Fix:** Add a JSDoc comment on both methods noting the upsert behavior, or return a discriminant (e.g., `{ created: boolean }`) so callers can react accordingly if needed.

---

### IN-03: `getMemberCount` uses redundant `parseInt` on a SQL-cast `::INT` column

**File:** `apps/api/src/rooms/rooms.repository.ts:150-152`
**Issue:** The SQL already casts the result to `::INT` (`COUNT(*)::INT AS count`), so the `pg` driver returns a JavaScript `number`. Wrapping it in `parseInt(result.rows[0]?.count ?? '0', 10)` is unnecessary and implies the value is a string, which could mislead future maintainers.

**Fix:**
```typescript
async getMemberCount(room_id: string): Promise<number> {
  const result = await this.db.query<{ count: number }>(
    `SELECT COUNT(*)::INT AS count FROM room_memberships WHERE room_id = $1`,
    [room_id],
  );
  return result.rows[0]?.count ?? 0;
}
```

---

### IN-04: `rooms-management.spec.ts` stubs `makeRoomsRepository` without `getMemberCount`, but `rooms-catalog.spec.ts` stub includes it

**File:** `apps/api/src/__tests__/rooms/rooms-domain.spec.ts:107-130` vs `apps/api/src/__tests__/rooms/rooms-catalog.spec.ts:46-68`
**Issue:** `makeRoomsRepository` in `rooms-domain.spec.ts` includes `getMemberCount` in the stub. The equivalent stub `makeRepo` in `rooms-catalog.spec.ts` also includes it. However, the `makeRepo` stub in `rooms-management.spec.ts` (line 92-115) also includes it. This is consistent, but the stub in `rooms-management.spec.ts` additionally includes `listBanned` which the others do not — leading to slightly inconsistent stubs across the three test files. If a new method is added to `RoomsRepository`, only one of the three stubs may be updated, causing a test to fail with a harder-to-diagnose missing-method error.

**Fix:** Extract a shared `makeRoomsRepository` factory into a `__tests__/rooms/helpers.ts` test helper so all three spec files share a single authoritative stub.

---

_Reviewed: 2026-04-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
