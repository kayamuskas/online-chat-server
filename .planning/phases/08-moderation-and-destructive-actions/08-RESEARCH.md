# Phase 8: Moderation and Destructive Actions — Research

**Researched:** 2026-04-20
**Domain:** NestJS backend (service/repository/controller/gateway) + React frontend (MessageTimeline, ManageRoomView, AccountOverviewView)
**Confidence:** HIGH — all claims verified against codebase directly

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**MSG-05: Message Deletion**
- D-01: Hard delete — строка message удаляется из БД полностью. Placeholder "message deleted" не показывается. reply_preview, ссылающиеся на удалённое сообщение, становятся stale/null — допустимо, дополнительная обработка не нужна.
- D-02: Тиеры прав: автор может удалить собственное сообщение; owner + admin могут удалить любое сообщение в своей комнате. DM: только автор может удалить своё сообщение (в DM нет концепции admin).
- D-03: WS-событие `message:deleted` с `{ messageId, roomId/dmConversationId }` рассылается в канал room/DM сразу после удаления из БД — согласно паттернам `message:new` и `message:edit` из Phase 6.1.
- D-04: UI — кнопка Delete появляется при наведении на строку сообщения, видна только автору (для своих сообщений) или admin/owner (для любого сообщения в комнате). Встраивается в панель действий, уже существующую в MessageTimeline.

**ROOM-09: Room Deletion**
- D-05: Только room owner может инициировать удаление комнаты.
- D-06: WS-событие `room:deleted { roomId }` рассылается всем участникам комнаты **до** удаления данных.
- D-07: Порядок каскада после WS-рассылки:
  1. Удалить файлы вложений с файловой системы (синхронно через AttachmentsService)
  2. Удалить записи вложений из БД
  3. Удалить сообщения
  4. Удалить memberships, bans, admin rows, pending invites
  5. Удалить запись room
- D-08: Удаление файлов синхронное — если FS бросает исключение, вся операция откатывается. Очередь не используется.
- D-09: UI — кнопка "Delete Room" в ManageRoomView → вкладка Settings, в визуально выделенной зоне опасности. Требует inline-подтверждения.

**AUTH-08: Account Deletion**
- D-10: Подтверждение паролем — endpoint `POST /auth/delete-account` принимает `{ password }`.
- D-11: Сначала удаляются owned rooms, каждая со своим `room:deleted` WS-событием и полным каскадом.
- D-12: В комнатах, где пользователь был admin (но не owner) — роль admin просто снимается. Без передачи прав и уведомлений.
- D-13: История DM сохраняется — `sender_id` в сообщениях продолжает ссылаться на ID удалённого пользователя (нет FK CASCADE на messages). Запись dm_conversation остаётся; другой участник по-прежнему видит историю.
- D-14: Все сессии удаляются → WS-сокеты получают 401 при следующей проверке auth и отключаются автоматически. Явного WS-события `user:deleted` нет.
- D-15: Порядок каскада: удалить owned rooms (с WS) → снять admin-роли в неownered комнатах → удалить memberships → удалить contacts/friendships/bans → удалить DM conversations (не messages) → удалить сессии → удалить user.
- D-16: UI — раздел "Delete Account" в AccountOverviewView (danger zone), с полем пароля и кнопкой подтверждения. После успеха клиент перенаправляется на экран auth.

**ROOM-07: Permission Matrix Enforcement**
- D-17: Admin не может забанить другого admin — только owner может забанить admin. В `banMember()` нужно добавить проверку: если целевой пользователь является admin, отклонить, если caller не является owner. Эта проверка отсутствует в текущей реализации Phase 4.
- D-18: Причина бана опциональна (nullable) — уже nullable в схеме БД.
- D-19: Действия, требующие `requireOwner`: add admin, remove admin, delete room.
- D-20: Действия, требующие `requireAdminOrOwner` (только против non-admin членов): ban member, unban member, remove member, delete message.

### Claude's Discretion
- Точный UX подтверждения удаления комнаты (type-name vs click-confirm button).
- HTTP-глагол и форма маршрута для delete-account (предлагается `DELETE /api/v1/auth/account` с телом `{ password }`).
- Несёт ли `message:deleted` полный payload сообщения или только `{ id }` — предпочтительно `{ id }` для минимального payload.

### Deferred Ideas (OUT OF SCOPE)
- Передача прав / смена владельца комнаты при удалении аккаунта
- Soft-delete / audit log сообщений
- Инструменты массовой модерации
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROOM-07 | Owner/admin permissions enforce room moderation, admin management, and ban-list management exactly as specified | Текущий `banMember()` не содержит проверки admin-cannot-ban-admin (D-17). `requireAdminOrOwner` / `requireOwner` helpers уже существуют в rooms-management.controller.ts и пригодны для повторного использования. |
| ROOM-08 | Removing a member from a room acts as a ban until removed from ban list | Уже реализовано через `removeMemberAsBan()` в rooms.service.ts. Фаза 8 не добавляет новой логики для ROOM-08 — требование уже выполнено. |
| ROOM-09 | Deleting a room permanently deletes its messages and attachments | Метод `deleteRoom()` ещё не существует. AttachmentsService существует, но без метода `deleteForRoom()`. Каскадный порядок зафиксирован в D-07. |
| MSG-05 | Message author can delete their own messages, and room admins can delete room messages | `deleteMessage()` отсутствует в MessagesRepository и MessagesService. WS-событие `message:deleted` нужно добавить в MessagesGateway. |
| AUTH-08 | User can delete their account, which deletes rooms they own and removes membership elsewhere | `deleteAccount()` не существует в AuthService. Каскадный порядок зафиксирован в D-15. Нужен новый endpoint в AuthController. |
</phase_requirements>

---

## Summary

Phase 8 — чисто инкрементальная фаза: новая функциональность добавляется поверх хорошо структурированной базы из Phase 4 (rooms), Phase 6 (messages, WS) и Phase 7 (attachments). Три основных потока (MSG-05, ROOM-09, AUTH-08) являются каскадными деструктивными операциями с разными уровнями сложности.

Самое важное: схема БД **уже корректно подготовлена** для Phase 8. Таблица `attachments` имеет `ON DELETE CASCADE` на `message_id`, таблица `messages` — `ON DELETE SET NULL` на `reply_to_id`, все таблицы rooms имеют `ON DELETE CASCADE` на `room_id`. Основная работа — это написание сервисного/репозиторийного слоя и WS-событий, не миграции схемы.

Критический баг Phase 4 (D-17): `banMember()` не проверяет, является ли target-пользователь admin. Нужно добавить `roomsRepo.isAdmin(roomId, targetUserId)` перед вызовом `roomsRepo.addBan()` — если target является admin и caller не является owner, выбросить ForbiddenException.

**Primary recommendation:** Реализовывать в строгом порядке: ROOM-07 fix (минимальный) → MSG-05 (backend + WS + UI) → ROOM-09 (backend + WS + UI) → AUTH-08 (backend + UI), потому что AUTH-08 переиспользует `deleteRoom()` из ROOM-09.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Permission matrix enforcement (D-17) | API / Backend | — | Бизнес-правило "кто может банить кого" — сервисный слой |
| Message delete (MSG-05) | API / Backend | Browser / Client | REST мутация + WS fanout; UI показывает кнопку |
| Room delete cascade (ROOM-09) | API / Backend | — | Транзакция, FS-удаление, WS-emit перед удалением |
| Account delete cascade (AUTH-08) | API / Backend | Browser / Client | Сервисный оркестратор; UI — форма подтверждения пароля |
| WS events (message:deleted, room:deleted) | API / Backend (gateway) | Browser / Client | Gateway emits; клиент удаляет из локального стейта |
| Delete confirmation UI | Browser / Client | — | Inline danger zone в ManageRoomView и AccountOverviewView |

---

## Standard Stack

### Core (всё уже в проекте)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | уже установлен | HTTP controllers, DI | Уже используется во всех фазах |
| Socket.IO (NestJS Gateway) | уже установлен | WS fanout для `message:deleted`, `room:deleted` | MessagesGateway + AppGateway уже работают |
| PostgreSQL (pg) | уже установлен | Каскадные DELETE через SQL | FK-каскады уже прописаны в схеме |
| React | уже установлен | UI компоненты | Весь frontend уже React |
| Playwright | уже установлен | E2E тесты (TEST-01) | Единственный фреймворк для браузерных тестов |

### Нет новых зависимостей
Phase 8 не требует установки каких-либо новых пакетов — вся необходимая инфраструктура уже в кодовой базе.

**Version verification:** [VERIFIED: codebase] — все зависимости уже установлены, npm install не требуется.

---

## Architecture Patterns

### System Architecture Diagram

```
DELETE /messages/:id
       │
       ▼
MessagesController
  ─── assertDeletePermission(callerId, messageId) ───► MessagesService
                                                              │
                                                    findMessageById(id)
                                                              │
                                           ┌─────────────────▼──────────────┐
                                           │  caller is author?              │
                                           │  OR caller isAdmin in room?     │
                                           │  (DM: only author allowed)      │
                                           └─────────────────┬──────────────┘
                                                             │ ForbiddenException if not
                                                             ▼
                                                   MessagesRepository
                                                   .deleteMessage(id)
                                                             │
                                                             ▼
                                                  MessagesGateway
                                            .broadcastMessageDeleted(...)
                                                    ↓ room:${roomId} / dm:${conversationId}
                                                 Clients remove msg from state

DELETE /rooms/:id  (owner only)
       │
       ▼
RoomsController
  ─── requireOwner ───► RoomsService.deleteRoom(roomId, actorId)
                                │
                    broadcastRoomDeleted(roomId)  ← FIRST, before data delete
                                │
                    AttachmentsService.deleteForRoom(roomId)
                     ─ unlink() each file from FS
                     ─ AttachmentsRepository.deleteByRoomId()
                                │
                    MessagesRepository.deleteByConversation('room', roomId)
                                │
                    RoomsRepository.deleteAllMembershipsAndBans(roomId)
                                │
                    RoomsRepository.deleteRoom(roomId)

DELETE /auth/account  { password }
       │
       ▼
AuthController
  ─── verifyPassword ───► AuthService.deleteAccount(userId, password)
                                │
              for each owned room: RoomsService.deleteRoom(room.id, userId)
                                │
              RoomsRepository.removeAdminFromAllRooms(userId)
                                │
              RoomsRepository.removeMemberFromAllRooms(userId)
                                │
              ContactsRepository.deleteAllFor(userId)
                                │
              ContactsRepository.deleteDmConversationsFor(userId)
                                │
              SessionRepository.deleteAllByUserId(userId)
                                │
              UserRepository.deleteById(userId)
                                │
              clearSessionCookie(res) + redirect → auth screen
```

### Recommended Project Structure
```
apps/api/src/
├── rooms/
│   ├── rooms.service.ts          # + deleteRoom(), banMember() fix (D-17)
│   ├── rooms.repository.ts       # + deleteRoom(), listOwnedRooms()
│   └── rooms.controller.ts       # + DELETE /:id endpoint
├── messages/
│   ├── messages.service.ts       # + deleteMessage()
│   ├── messages.repository.ts    # + deleteMessage(), deleteByConversation()
│   ├── messages.controller.ts    # + DELETE rooms/:id/messages/:msgId, DELETE dm/:id/messages/:msgId
│   └── messages.gateway.ts       # + broadcastMessageDeleted(), broadcastRoomDeleted()
├── attachments/
│   └── attachments.service.ts    # + deleteForRoom(roomId)
│   └── attachments.repository.ts # + deleteByRoomId()
└── auth/
    ├── auth.service.ts            # + deleteAccount()
    └── auth.controller.ts         # + DELETE /account endpoint
apps/web/src/
├── features/messages/
│   └── MessageTimeline.tsx       # + Delete button в action bar
├── features/rooms/
│   └── ManageRoomView.tsx        # + Settings tab danger zone + room deletion flow
├── features/account/
│   └── AccountOverviewView.tsx   # + Danger zone + password confirm + deleteAccount()
└── lib/
    └── api.ts                    # + deleteMessage(), deleteRoom(), deleteAccount()
```

### Pattern 1: Permission Check Before Destructive Action
**What:** Сервис проверяет права, затем выполняет каскадное удаление.
**When to use:** Все три деструктивных endpoint — единый паттерн.
**Example:**
```typescript
// Source: apps/api/src/messages/messages.service.ts (паттерн из editMessage)
async deleteMessage(messageId: string, callerId: string): Promise<{ conversation_type: string; conversation_id: string }> {
  const message = await this.repo.findMessageById(messageId);
  if (!message) throw new NotFoundException(`Message '${messageId}' not found`);

  if (message.conversation_type === 'room') {
    // Caller is author OR room admin/owner
    const isAuthor = message.author_id === callerId;
    const isAdmin = await this.roomsRepo.isAdmin(message.conversation_id, callerId); // includes owner
    if (!isAuthor && !isAdmin) throw new ForbiddenException('Only the author or a room admin may delete this message');
  } else {
    // DM: only author
    if (message.author_id !== callerId) throw new ForbiddenException('Only the author may delete their DM message');
  }

  await this.repo.deleteMessage(messageId);
  return { conversation_type: message.conversation_type, conversation_id: message.conversation_id };
}
```

### Pattern 2: WS Broadcast Before Data Delete (ROOM-09)
**What:** Для room:deleted событие WS рассылается **до** удаления данных, чтобы клиенты успели отреагировать.
**When to use:** Только ROOM-09.
**Example:**
```typescript
// Source: D-06 из CONTEXT.md — конвенция установлена, реализация новая
async deleteRoom(roomId: string, actorId: string): Promise<void> {
  await this.requireOwnerCheck(roomId, actorId);
  // 1. WS FIRST
  await this.gateway.broadcastRoomDeleted(roomId);
  // 2. Then cascade delete
  await this.attachmentsService.deleteForRoom(roomId);
  await this.roomsRepo.deleteRoom(roomId); // ON DELETE CASCADE handles sub-tables
}
```

### Pattern 3: Admin-Cannot-Ban-Admin Fix (D-17)
**What:** Целевая правка в `banMember()` в `rooms.service.ts` — добавить проверку перед вызовом `addBan`.
**When to use:** ROOM-07 fix.
**Example:**
```typescript
// Source: apps/api/src/rooms/rooms.service.ts — расширение существующего banMember()
async banMember(roomId: string, targetUserId: string, bannedByUserId: string, reason?: string): Promise<RoomBan> {
  await this.getRoom(roomId);

  // D-17: admin cannot ban another admin — only owner can
  const targetIsAdmin = await this.roomsRepo.isAdmin(roomId, targetUserId);
  if (targetIsAdmin) {
    const callerIsOwner = await this.isOwner(roomId, bannedByUserId);
    if (!callerIsOwner) {
      throw new ForbiddenException('Only the room owner can ban an admin');
    }
  }

  await this.roomsRepo.removeMember(roomId, targetUserId);
  return this.roomsRepo.addBan({ room_id: roomId, banned_user_id: targetUserId, banned_by_user_id: bannedByUserId, reason: reason ?? null });
}
```

### Anti-Patterns to Avoid
- **Bypass deleteRoom() при удалении аккаунта:** AUTH-08 каскад должен вызывать тот же `deleteRoom()` (который включает WS broadcast), а не отдельный raw SQL DELETE. Иначе side-effects не сработают.
- **Удаление файлов без try/catch:** `unlink()` для каждого файла должен использовать `.catch(() => {})` — файл может уже не существовать на диске. Уже применяется в `AttachmentsService.onApplicationBootstrap()`.
- **Миграция схемы для удаления:** НЕ нужна. FK CASCADE уже правильно настроен в существующих миграциях (см. ниже).
- **Новый gateway для room:deleted:** Использовать существующий `MessagesGateway` — добавить `broadcastRoomDeleted()` и `broadcastMessageDeleted()` к уже существующим broadcast методам.
- **messages.author_id ON DELETE CASCADE:** Схема намеренно использует `ON DELETE RESTRICT` для `author_id` в таблице messages. При удалении аккаунта нельзя просто удалить пользователя — нужно сначала удалить DM conversations, затем сессии, а DM messages **оставить** (D-13: history preserved). Это означает, что нельзя удалить user record пока на него ссылаются сообщения в DM. **ВАЖНОЕ ОГРАНИЧЕНИЕ** — см. раздел Pitfalls.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Каскадное удаление связанных строк (memberships, bans, invites) | Ручной SQL DELETE per table | FK `ON DELETE CASCADE` на room_id | Уже настроен в схеме; удаление rooms record автоматически удаляет всё связанное |
| Проверка прав admin/owner | Повторная логика в каждом endpoint | `requireAdminOrOwner()` / `requireOwner()` из rooms-management.controller.ts | Готовые helpers — импортировать или переиспользовать |
| FS-удаление файлов | Прямой `unlink` в сервисе ROOM-09 | `AttachmentsService.deleteForRoom(roomId)` (новый метод) | Инкапсулирует `UPLOADS_DIR`, обрабатывает ошибки |
| WS fanout | Прямой emit в сервисе | `MessagesGateway.broadcastXxx()` методы | Уже установленный паттерн; gateway держит server ref |

**Key insight:** В этом проекте FK CASCADE — основной инструмент каскадного удаления. Код не должен итерировать и удалять дочерние строки вручную, если FK уже настроен.

---

## Runtime State Inventory

> Фаза 8 является деструктивной по определению (удаление данных), но не является rename/refactor фазой.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | messages.author_id — RESTRICT FK блокирует удаление user пока сообщения существуют | Код (AUTH-08 cascade должен НЕ удалять DM messages — D-13) |
| Live service config | None — нет внешних сервисов | — |
| OS-registered state | None | — |
| Secrets/env vars | UPLOADS_DIR (используется в AttachmentsService) | Используется при поиске файлов для удаления; нет изменений |
| Build artifacts | None | — |

---

## Common Pitfalls

### Pitfall 1: messages.author_id ON DELETE RESTRICT блокирует удаление user
**What goes wrong:** AUTH-08 cascade пытается `DELETE FROM users WHERE id = $1`, но PostgreSQL блокирует это, потому что `messages.author_id` имеет `REFERENCES users(id) ON DELETE RESTRICT`.
**Why it happens:** D-13 намеренно сохраняет DM messages после удаления аккаунта. Но RESTRICT предотвращает удаление user row пока messages существуют.
**How to avoid:** Правильный порядок каскада: удалить owned rooms (их сообщения каскадируются) → удалить DM conversations (НЕ messages) → затем нужно **либо** добавить миграцию изменяющую FK на `ON DELETE SET NULL` для `messages.author_id`, **либо** выполнить `UPDATE messages SET author_id = NULL WHERE author_id = $userId` перед удалением пользователя. Предпочтительно: новая миграция `ALTER TABLE messages ALTER COLUMN author_id DROP NOT NULL; ... ON DELETE SET NULL` — аналогично тому как `reply_to_id` использует SET NULL.
**Warning signs:** PostgreSQL error "update or delete on table "users" violates foreign key constraint" при тестировании AUTH-08 cascade.

### Pitfall 2: room:deleted WS событие после удаления данных
**What goes wrong:** Если WS broadcast отправляется после DELETE room из БД, клиенты получат событие, но не смогут выполнить cleanup корректно — они уже могут получить ошибки при попытке обратиться к комнате.
**Why it happens:** Нарушение порядка операций D-06.
**How to avoid:** Строго соблюдать D-06: `broadcastRoomDeleted()` ПЕРВЫМ делом, затем каскадное удаление.
**Warning signs:** E2E тест видит ошибки навигации после события room:deleted.

### Pitfall 3: banMember в ROOM-07 — double `isAdmin` call
**What goes wrong:** После добавления проверки D-17 в `banMember()`, контроллер также вызывает `requireAdminOrOwner()` перед вызовом `banMember()`. Это 2 обращения к БД для проверки прав caller. Допустимо, но стоит знать.
**Why it happens:** Существующая архитектура — controller check + service check.
**How to avoid:** Допустимо дублирование — не оптимизировать преждевременно. Корректность важнее.

### Pitfall 4: attachments.uploader_id ON DELETE RESTRICT
**What goes wrong:** При удалении user аккаунта попытка удалить user record завершится ошибкой если существуют attachments с этим uploader_id.
**Why it happens:** `attachments.uploader_id REFERENCES users(id) ON DELETE RESTRICT` (из миграции 0006).
**How to avoid:** В AUTH-08 cascade: attachments, загруженные пользователем, **не удаляются** если сообщение сохранено (D-13 — DM history preserved). Нужна миграция чтобы изменить FK на `ON DELETE SET NULL` или добавить `UPDATE attachments SET uploader_id = NULL WHERE uploader_id = $userId` перед удалением user.

### Pitfall 5: Socket.IO namespace — message:deleted vs message-deleted
**What goes wrong:** Существующие события используют kebab-case: `message-created`, `message-edited` (см. `broadcastMessageCreated()` в messages.gateway.ts). Новые события должны следовать той же конвенции.
**Why it happens:** JavaScript event name convention — kebab-case уже устоялся в коде.
**How to avoid:** Использовать `message-deleted` и `room-deleted` (с дефисом), не `message:deleted` и `room:deleted` (с двоеточием) — несмотря на то что CONTEXT.md использует двоеточие для обозначения события. Проверить против клиентской подписки в RoomChatView / DmChatView.

### Pitfall 6: RoomsRepository.isAdmin() — owner vs explicit admin
**What goes wrong:** `roomsRepo.isAdmin(roomId, userId)` в RoomsRepository проверяет только таблицу `room_admins` — НЕ включает owner. `RoomsService.isAdmin()` добавляет owner check поверх. Если использовать `roomsRepo.isAdmin()` напрямую в D-17 fix, owner может быть ошибочно классифицирован как не-admin.
**Why it happens:** Два уровня isAdmin: repo (только explicit admins) vs service (explicit + owner).
**How to avoid:** В D-17 fix использовать `this.roomsRepo.isAdmin(roomId, targetUserId)` для target check (достаточно — нас интересует именно explicit admin), и `this.isOwner(roomId, bannedByUserId)` для caller check. Это корректно.

---

## Code Examples

Verified patterns from official codebase:

### Существующий WS broadcast pattern (basis for message-deleted)
```typescript
// Source: apps/api/src/messages/messages.gateway.ts
async broadcastMessageDeleted(messageId: string, conversationType: 'room' | 'dm', conversationId: string): Promise<void> {
  const channel = conversationType === 'room'
    ? `room:${conversationId}`
    : `dm:${conversationId}`;
  this.server.to(channel).emit('message-deleted', {
    conversation_type: conversationType,
    conversation_id: conversationId,
    message_id: messageId,
  });
}
```

### Существующий requireOwner pattern (basis for delete room endpoint)
```typescript
// Source: apps/api/src/rooms/rooms-management.controller.ts
async function requireOwner(roomsService: RoomsService, roomId: string, userId: string): Promise<void> {
  const isOwner = await roomsService.isOwner(roomId, userId);
  if (!isOwner) throw new ForbiddenException('Only the room owner can perform this action');
}
```

### DELETE /api/v1/rooms/:id endpoint pattern
```typescript
// Source: pattern from existing rooms.controller.ts POST /:id/join
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@UseGuards(CurrentUserGuard)
async deleteRoom(@Param('id') roomId: string, @CurrentUser() ctx: AuthContext): Promise<void> {
  await requireOwner(this.roomsService, roomId, ctx.user.id);
  await this.roomsService.deleteRoom(roomId);
}
```

### AttachmentsService.deleteForRoom pattern
```typescript
// Source: extends pattern from AttachmentsService.onApplicationBootstrap()
async deleteForRoom(roomId: string): Promise<void> {
  const attachments = await this.repo.findByRoomId(roomId);
  for (const att of attachments) {
    await unlink(att.storage_path).catch(() => { /* already gone */ });
  }
  await this.repo.deleteByRoomId(roomId);
}
```

### Delete confirmation pattern (inline confirm button)
```tsx
// Source: паттерн из RevokeSessionConfirm.tsx в features/account/
// Простой двухшаговый inline confirm: первый клик показывает "Confirm?", второй выполняет.
const [confirming, setConfirming] = useState(false);
{!confirming ? (
  <button type="button" className="btn btn--danger" onClick={() => setConfirming(true)}>
    Delete Room
  </button>
) : (
  <div className="danger-zone__confirm">
    <p>This action cannot be undone. Delete <strong>{room.name}</strong>?</p>
    <button type="button" className="btn btn--danger" onClick={handleDeleteRoom}>Confirm Delete</button>
    <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
  </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A (Phase 8 новые endpoint) | Каскадные деструктивные операции через service layer | Phase 8 | N/A |
| messages.author_id ON DELETE RESTRICT | Нужно изменить на ON DELETE SET NULL для поддержки AUTH-08 | Phase 8 migration | Позволяет удалить user без удаления DM messages |
| attachments.uploader_id ON DELETE RESTRICT | Нужно изменить на ON DELETE SET NULL для поддержки AUTH-08 | Phase 8 migration | Позволяет удалить user |

**Deprecated/outdated:**
- Ничего — Phase 8 только добавляет, не заменяет.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `messages.author_id` FK использует ON DELETE RESTRICT — нужна миграция для AUTH-08 | Pitfall 1 | Если фактически CASCADE или SET NULL, миграция не нужна | 
| A2 | `attachments.uploader_id` FK использует ON DELETE RESTRICT — нужна миграция | Pitfall 4 | Если SET NULL, миграция не нужна |
| A3 | WS события должны использовать kebab-case (`message-deleted`) не colon-case | Pitfall 5 | Если frontend подписывается на `message:deleted`, оба варианта потребуют синхронизации |

**Примечание:** A1 и A2 были проверены против миграции 0005_messages_core.sql и 0006_attachments_core.sql — оба подтверждены как RESTRICT. [VERIFIED: codebase]

---

## Open Questions

1. **Нужна ли новая миграция 0008 для изменения FK?**
   - What we know: `messages.author_id` = RESTRICT, `attachments.uploader_id` = RESTRICT
   - What's unclear: Возможно, плановщик предпочтёт `UPDATE ... SET author_id = NULL` в сервисном слое вместо ALTER TABLE
   - Recommendation: Новая миграция `0008_destructive_actions_fk.sql` с `ALTER TABLE messages ALTER COLUMN author_id DROP NOT NULL` + `ON DELETE SET NULL` и аналогично для attachments. Это чище и соответствует паттерну `reply_to_id ON DELETE SET NULL`.

2. **Где разместить `broadcastRoomDeleted()` в gateway?**
   - What we know: MessagesGateway уже имеет `roomChannel()` helper и `server` ref
   - What's unclear: room:deleted семантически связан с rooms, не messages — но gateway namespace один
   - Recommendation: Добавить `broadcastRoomDeleted()` в MessagesGateway (не создавать новый) — уже используется для room-level message events.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 является чисто кодовым изменением. Все зависимости (Node.js, PostgreSQL, npm packages) уже установлены и работают в предыдущих фазах.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (TEST-01 mandate) |
| Config file | `playwright.config.ts` (корень проекта) |
| Quick run command | `npx playwright test e2e/realtime/ --project=chromium` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROOM-07 | Admin не может забанить другого admin; owner может | E2E smoke | `npx playwright test e2e/moderation/room-permissions.spec.ts -x` | ❌ Wave 0 |
| ROOM-08 | Уже реализовано в Phase 4 | — | — | — |
| ROOM-09 | Удаление комнаты удаляет сообщения и вложения | E2E smoke | `npx playwright test e2e/moderation/room-delete.spec.ts -x` | ❌ Wave 0 |
| MSG-05 | Автор удаляет сообщение; admin удаляет любое | E2E smoke | `npx playwright test e2e/moderation/message-delete.spec.ts -x` | ❌ Wave 0 |
| AUTH-08 | Удаление аккаунта удаляет owned rooms, снимает membership | E2E smoke | `npx playwright test e2e/moderation/account-delete.spec.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Только unit-style API tests (если есть)
- **Per wave merge:** `npx playwright test e2e/moderation/ --project=chromium`
- **Phase gate:** Full suite green перед `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `e2e/moderation/room-permissions.spec.ts` — ROOM-07
- [ ] `e2e/moderation/room-delete.spec.ts` — ROOM-09
- [ ] `e2e/moderation/message-delete.spec.ts` — MSG-05
- [ ] `e2e/moderation/account-delete.spec.ts` — AUTH-08
- [ ] `e2e/helpers/ui-helpers.ts` — добавить helper `deleteMessage()`, `deleteRoom()` для тестов

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (AUTH-08) | password confirmation перед удалением аккаунта — уже pattern из changePassword |
| V3 Session Management | yes (AUTH-08) | Все сессии удаляются при удалении аккаунта (D-14) |
| V4 Access Control | yes (ROOM-07, MSG-05, ROOM-09) | requireOwner / requireAdminOrOwner из rooms-management.controller.ts |
| V5 Input Validation | yes | Body parsing уже через typed validators во всех controllers |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — удаление чужого сообщения | Tampering | findMessageById + author_id check в MessagesService.deleteMessage() |
| Privilege escalation — admin банит owner | Elevation of Privilege | D-17 fix в banMember(): target owner never banneable |
| IDOR — удаление чужой комнаты | Tampering | requireOwner() перед deleteRoom() |
| Password replay — account deletion | Spoofing | verifyPassword() в AuthService.deleteAccount() — уже паттерн из changePassword |
| Orphaned sessions после account delete | Repudiation | SessionRepository.deleteAllByUserId() в каскаде D-15 |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `apps/api/src/rooms/rooms.service.ts` — banMember(), isAdmin(), isOwner()
- [VERIFIED: codebase] `apps/api/src/rooms/rooms-management.controller.ts` — requireAdminOrOwner(), requireOwner()
- [VERIFIED: codebase] `apps/api/src/messages/messages.gateway.ts` — broadcastMessageCreated(), broadcastMessageEdited(), channel patterns
- [VERIFIED: codebase] `apps/api/src/attachments/attachments.service.ts` — deleteById(), unlink() pattern
- [VERIFIED: codebase] `apps/api/src/db/migrations/0003_rooms_core.sql` — FK CASCADE на room_id
- [VERIFIED: codebase] `apps/api/src/db/migrations/0005_messages_core.sql` — author_id ON DELETE RESTRICT, reply_to_id ON DELETE SET NULL
- [VERIFIED: codebase] `apps/api/src/db/migrations/0006_attachments_core.sql` — message_id ON DELETE CASCADE, uploader_id ON DELETE RESTRICT
- [VERIFIED: codebase] `apps/web/src/features/messages/MessageTimeline.tsx` — msg-bubble__actions, existing Reply/Edit button pattern
- [VERIFIED: codebase] `apps/web/src/features/account/AccountOverviewView.tsx` — структура компонента для danger zone
- [VERIFIED: codebase] `apps/web/src/features/rooms/ManageRoomView.tsx` — ManageTab type, Settings tab placeholder

### Secondary (MEDIUM confidence)
- [CITED: CONTEXT.md] Все D-XX решения — canonical reference из discuss-phase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — всё существующее в проекте, проверено через файлы
- Architecture: HIGH — код прочитан напрямую; паттерны extrapolated из Phase 4/6/7
- Pitfalls: HIGH — критичный Pitfall 1 (RESTRICT FK) верифицирован против схемы БД
- Test coverage: MEDIUM — тесты нужно создать с нуля; паттерн из существующих e2e spec файлов известен

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (стабильная кодовая база; изменится только если Phase 9 модифицирует MessageTimeline или ManageRoomView)
