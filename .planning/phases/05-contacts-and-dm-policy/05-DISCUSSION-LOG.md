# Phase 5: Contacts and DM Policy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 05-contacts-and-dm-policy
**Areas discussed:** Pending requests surface, Ban behavior details, DM initiation & gating, Contacts sidebar placement

---

## Pending Requests Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Уведомление в шапке | Иконка с бейджем, по клику — список | ✓ |
| Секция в сайдбаре | Отдельный раздел "Запросы" в панели контактов | |

**Подтверждение/отклонение:**

| Option | Description | Selected |
|--------|-------------|----------|
| Всплывающий список (dropdown) | Под иконкой, кнопки в каждой строке | ✓ |
| Отдельная страница | Переход на /requests | |

**Исходящие запросы:**

| Option | Description | Selected |
|--------|-------------|----------|
| В дропдауне (отдельная вкладка) | Входящие/Исходящие внутри попапа | |
| На профиле пользователя | Статус "Запрос отправлен" + кнопка отмены | ✓ |
| Нигде отдельно | Только смена состояния кнопки | |

---

## Ban Behavior Details

**Знает ли забаненный?**

| Option | Description | Selected |
|--------|-------------|----------|
| Нет | Молчаливая блокировка | |
| Да | Явное сообщение об ограничении контакта | ✓ |

**Можно ли снять бан?**

| Option | Description | Selected |
|--------|-------------|----------|
| Да | Список заблокированных в настройках | ✓ |
| Нет | Постоянный бан | |

**Подтверждение перед баном?**

| Option | Description | Selected |
|--------|-------------|----------|
| Да, модальное окно | "Вы уверены? Удалит дружбу и заблокирует" | ✓ |
| Нет | Немедленное действие | |

---

## DM Initiation & Gating

**Есть ли кнопка "Написать" в Phase 5?**

| Option | Description | Selected |
|--------|-------------|----------|
| Да, заглушка | Кнопка есть, открывает пустой DM-экран | ✓ |
| Нет | Кнопка появится в Phase 6 | |

**Что видит пользователь, если DM недоступен?**

| Option | Description | Selected |
|--------|-------------|----------|
| Кнопка disabled с тултипом | Серая, не кликается, поясняет причину | ✓ |
| Кнопки нет | Скрывается полностью | |
| Ошибка при клике | Сообщение об ошибке | |

---

## Contacts Sidebar Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Секция в сайдбаре | Под списком комнат, с присутствием | ✓ |
| Отдельная вкладка | Переключатель Комнаты/Контакты | |

**Дополнительно:** Пользователь предоставил скриншот с точным дизайном сайдбара — "ROOMS & CONTACTS" заголовок, Public/Private комнаты, затем CONTACTS с presence-точками, кнопки "+ Create room" / "+ Add contact" внизу.

**"+ Add contact" действие:**

| Option | Description | Selected |
|--------|-------------|----------|
| Модальное окно | Поле username, кнопка "Отправить запрос" | ✓ |
| Inline поле | Разворачивается в сайдбаре | |

---

## Claude's Discretion

- Точный стиль notification badge и dropdown
- Текст тултипа на disabled DM кнопке
- Расположение "Blocked users" в настройках
- Нужно ли подтверждение при удалении из друзей (без бана)

## Deferred Ideas

- Реальный мессенджер — Phase 6
- Unread-индикаторы на контактах — Phase 9
