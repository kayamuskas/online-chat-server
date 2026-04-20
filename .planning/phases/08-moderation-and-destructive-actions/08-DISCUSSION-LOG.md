# Phase 8: Moderation and Destructive Actions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 08-moderation-and-destructive-actions
**Areas discussed:** Message Deletion (MSG-05), Room Deletion (ROOM-09), Account Deletion (AUTH-08), Permission Matrix (ROOM-07)

---

## Message Deletion (MSG-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Мягкое удаление — заглушка | Сообщение остаётся с текстом «сообщение удалено», replies продолжают работать | |
| Жёсткое удаление — исчезает | Запись стирается из БД полностью. Replies теряют источник (reply_preview = null/stale). Меньше усложнения схемы | ✓ |
| Зависит от роли | Автор видит «вы удалили это», остальным — ничего (полная очистка из view) | |

**User's choice:** Жёсткое удаление — исчезает

---

| Option | Description | Selected |
|--------|-------------|----------|
| Owner + Admin (Recommended) | Соответствует уже реализованному requireAdminOrOwner guard — консистентно с Phase 4 | ✓ |
| Только Owner | Более строгая политика — admins не могут удалять сообщения участников | |
| Owner + Admin + любой участник | Любой может удалять любое — нет, это явно не по требованиям | |

**User's choice:** Owner + Admin

---

| Option | Description | Selected |
|--------|-------------|----------|
| Да — message:deleted ивент в комнату (Recommended) | Как message:new и message:edit — клиент убирает/заглушает строку без перезагрузки истории. Консистентно с Phase 6.1 | ✓ |
| Нет — клиент перезагружает историю | Проще серверная часть, но неприятный скачок UI при удалении | |

**User's choice:** Да — message:deleted ивент в комнату

---

| Option | Description | Selected |
|--------|-------------|----------|
| Да — кнопка при ховер на сообщение (Recommended) | context menu / кнопка Delete появляется при hover — только для автора и admin/owner | ✓ |
| Только API, без UI | Удаление только через прямой API-запрос | |

**User's choice:** Да — кнопка при ховер на сообщение

---

## Room Deletion (ROOM-09)

| Option | Description | Selected |
|--------|-------------|----------|
| room:deleted → затем чистка (Recommended) | Сначала разослать room:deleted всем участникам, потом удалять данные. Клиент навигирует на главный экран | ✓ |
| HTTPS 200 → затем чистка | Только HTTP-ответ, без WS-пуша. Остальные участники узнают об удалении при попытке отправить сообщение (404) | |

**User's choice:** room:deleted → затем чистка

---

| Option | Description | Selected |
|--------|-------------|----------|
| Удалять файлы синхронно (Recommended) | AttachmentsService удаляет файлы в той же транзакции. Ошибки файловой системы откатывают весь каскад | ✓ |
| Оставить файлы, удалить записи из БД | Файлы остаются на диске (осиротели), но недоступны — ACL блокирует запросы. Хаотично, но проще реализовать | |
| Фоновое удаление через очередь | BullMQ job удаляет файлы асинхронно. Избыточно для такого проекта | |

**User's choice:** Удалять файлы синхронно

---

| Option | Description | Selected |
|--------|-------------|----------|
| ManageRoomView → Settings вкладка (Recommended) | Phase 9 уже построил ManageRoomView с Settings вкладкой — логично добавить туда danger-зону с кнопкой | ✓ |
| Отдельный modal | Новый modal специально для удаления комнаты. Избыточно — Phase 9 уже есть ManageRoomView | |

**User's choice:** ManageRoomView → Settings вкладка

---

## Account Deletion (AUTH-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Удалить все DM сообщения пользователя | Вся переписка удалённого исчезает, собеседник видит пустой чат | |
| Оставить DM историю, удалить пользователя (Recommended) | Сообщения остаются (sender_id = удалённый user_id), собеседник видит историю. Проще и не теряем чужие данные | ✓ |

**User's choice:** Оставить DM историю, удалить пользователя

---

| Option | Description | Selected |
|--------|-------------|----------|
| Просто снять админ-роль (Recommended) | Комната остаётся с существующим owner, админская роль удалённого чистится | ✓ |
| Передать админ-роль другому участнику | Сложно: нужен кандидат, пользователь должен согласиться. Избыточно для такого проекта | |

**User's choice:** Просто снять админ-роль

---

| Option | Description | Selected |
|--------|-------------|----------|
| Удалить сессии → socket разъединится сам (Recommended) | Удалить все session записи — WS-сокет получает 401 при следующем запросе и разъединяется. Без доп оркестрации | ✓ |
| WS user:deleted → затем чистка | Доп сообщает сокету о факте, потом чистит. Избыточно — socket всё равно отпадёт после 401 | |

**User's choice:** Удалить сессии → socket разъединится сам

---

| Option | Description | Selected |
|--------|-------------|----------|
| Да — ввести пароль (Recommended) | Защита от случайного нажатия. POST /auth/delete-account принимает { password }. Консистентно с реальными сервисами | ✓ |
| Нет — одного HTTP DELETE достаточно | Проще. Человек и так авторизован | |

**User's choice:** Да — ввести пароль

---

| Option | Description | Selected |
|--------|-------------|----------|
| AccountOverviewView → danger-зона (Recommended) | Phase 9 уже есть AccountOverviewView — добавить туда секцию «Удалить аккаунт» с вводом пароля | ✓ |
| Отдельная страница/modal | Новый экран или modal | |

**User's choice:** AccountOverviewView → danger-зона

---

## Permission Matrix (ROOM-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Нет — только owner может банить admin (Recommended) | Admins не могут воевать между собой. banMember добавляем проверку: если target = admin, нужен owner | ✓ |
| Да — admin может банить любого | requireAdminOrOwner уже работает так — нет дополнительных проверок | |

**User's choice:** Нет — только owner может банить admin

---

| Option | Description | Selected |
|--------|-------------|----------|
| Нет — reason необязательный (Recommended) | reason nullable — уже в схеме. Админ может указать причину при желании, но это не обязательно | ✓ |
| Да — reason обязателен | NOT NULL на поле reason. Усложняет UI — добавить форму с полем | |

**User's choice:** Нет — reason необязательный

---

## Claude's Discretion

- Exact confirmation UX for room deletion (type-name vs click-confirm button)
- HTTP verb and route for delete-account endpoint
- Whether `message:deleted` carries full payload or just `{ id }`

## Deferred Ideas

- Admin transfer / room ownership handoff on account deletion
- Soft-delete / message audit log
- Bulk message moderation tools
