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

---

# Запустить «по-настоящему» — пошагово

Сайт на GitHub Pages работает по HTTPS, поэтому адрес PocketBase тоже должен быть
**https://** (иначе браузер заблокирует запросы). Нужен публичный адрес с TLS.

## Шаг 1. Где взять адрес PocketBase

**Вариант А — быстрый тест за 2 минуты (хостинг за рубежом, НЕ для боевых ПД):**
1. Зарегистрируйся на https://pockethost.io (есть бесплатный тариф).
2. Создай инстанс → получишь адрес вида `https://твоё-имя.pockethost.io`.
3. Зайди в его админку `/_/` и создай суперпользователя.

**Вариант Б — боевой, 152-ФЗ (РФ-VPS + свой домен):**
На сервере (Selectel/Timeweb/Reg.ru), указав свой домен в DNS на IP сервера:
```bash
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.21/pocketbase_0.22.21_linux_amd64.zip
unzip pocketbase_*.zip
# авто-TLS (Let's Encrypt) на твоём домене:
sudo ./pocketbase serve --https=wyrm.твойдомен.ру
```
Адрес будет `https://wyrm.твойдомен.ру`. (Для постоянной работы оформи systemd-сервис.)

## Шаг 2. Создай админа и коллекции
1. Открой `https://<адрес>/_/` → создай **суперпользователя** (это и есть доступ ко
   всему: полное управление всеми данными платформы).
2. Заведи коллекции по разделу «2. Создать коллекции» выше и правила из раздела «3».

## Шаг 3. Подключи к живому сайту
1. В GitHub: репозиторий **wyrm → Settings → Secrets and variables → Actions →
   вкладка Variables → New repository variable**.
   - Name: `VITE_PB_URL`
   - Value: `https://<твой адрес PocketBase>`
2. Запусти пересборку: **Actions → Deploy to GitHub Pages → Run workflow**
   (или просто сделай любой коммит). После деплоя сайт переключится с демо на
   реальную базу: регистрация и данные станут общими для всех.

## Кто «админ с доступом ко всему»
- **Суперпользователь PocketBase** (`/_/`) — полный доступ ко всем данным (правка,
  удаление, экспорт). Это административный уровень платформы.
- Обычные пользователи регистрируются в самом приложении. Если нужна **роль
  админа внутри приложения** (модерация: удалять чужие посты, управлять
  сообществами, закреплять истории) — это отдельная фича, её можно добавить.
