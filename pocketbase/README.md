# Бэкенд на PocketBase (совместимо с 152-ФЗ)

PocketBase — это один исполняемый файл: база (SQLite), авторизация, REST API,
файловое хранилище и админ-панель. Его можно поднять на **российском VPS**
(Selectel, Timeweb Cloud, Reg.ru, VK Cloud…), поэтому персональные данные
хранятся на территории РФ.

> ⚠️ Не юридическое заключение. Для боевого запуска: зарегистрируйтесь
> оператором ПД в Роскомнадзоре и сверьтесь со специалистом по 152-ФЗ.

## 1. Поднять PocketBase на сервере

```bash
# на РФ-VPS (Ubuntu)
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.21/pocketbase_0.22.21_linux_amd64.zip
unzip pocketbase_*.zip
./pocketbase serve --http=0.0.0.0:8090
```

Открой `http://СЕРВЕР:8090/_/`, создай аккаунт администратора. Для продакшна
поставь за nginx с HTTPS (или `./pocketbase serve --https=домен:443`).

## 2. Создать коллекции

В админке (Collections → New collection) заведи:

**users** — это встроенная auth-коллекция, добавь к ней поля:
- `handle` (text)
- `name` (text)

**posts** (base):
- `author` (relation → users, single, nullable)
- `author_handle` (text, required)
- `kind` (text)  — branch | vote | discuss | post
- `text` (text, required)
- `tags` (json)
- `ref` (json)
- `community` (text)
- `repost_of` (relation → posts, single, nullable)
- `like_count`, `save_count`, `comment_count`, `repost_count` (number, default 0)

**likes** (base):
- `post` (relation → posts), `user` (relation → users), `kind` (text)
- индекс UNIQUE по (`post`,`user`,`kind`)

**comments** (base):
- `post` (relation → posts), `author` (relation → users, nullable)
- `author_handle` (text), `text` (text, required)

**communities** (base):
- `name` (text, required), `blurb` (text), `tags` (json), `hue` (number)
- `owner` (text), `owner_id` (relation → users, nullable), `stories` (json)
- `member_count` (number, default 1)

**memberships** (base):
- `community` (text), `user` (relation → users)
- индекс UNIQUE по (`community`,`user`)

## 3. Правила доступа (API Rules)

Для каждой коллекции в админке (вкладка **API Rules**):

- **Чтение (List/View)** у `posts`, `comments`, `communities`, `likes`,
  `memberships` — оставь публичным (пустое правило = всем).
- **Создание (Create)** — только авторизованным: правило `@request.auth.id != ""`.
- **Изменение/Удаление (Update/Delete)** — только владельцу, например для `posts`:
  `@request.auth.id != "" && author = @request.auth.id`
  (для `likes`/`memberships` — `user = @request.auth.id`,
  для `comments` — `author = @request.auth.id`).

## 4. Подключить фронтенд

```bash
cp .env.example .env
# впиши адрес сервера:
# VITE_PB_URL=https://твой-домен
npm run dev
```

Приложение само переключится с localStorage на PocketBase. Если `VITE_PB_URL`
пуст — остаётся демо-режим на localStorage (полезно для разработки).

## Альтернатива без смены кода

Можно поднять **self-hosted Supabase** на РФ-VPS (Docker) — тогда вернуть слой
`store.js` на Supabase-клиент. PocketBase выбран как более лёгкий: один бинарник
вместо стека контейнеров.
