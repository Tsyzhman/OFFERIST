# Audit tasks — безопасность, надёжность, качество

Документ для исполнителя (агента или человека). Источник — технический аудит проекта PRISMA (`kp-builder`) от 2026-06-09. Цель — закрыть уязвимости доступа, повысить надёжность данных и убрать технический долг.

Документ дополняет [optimization-tasks.md](optimization-tasks.md) (CPU/RAM/диск) и [proposal-system-tasks.md](proposal-system-tasks.md) (конструктор КП), не пересекаясь с ними по содержанию.

Правила для исполнителя:

- Перед началом задачи прочитай раздел целиком (контекст, решение, изменения, критерий приёмки, downside).
- Одна задача = один PR/коммит, кроме явно связанных цепочек (AUD01 → AUD02 → AUD03 идут вместе как «блок доступа»).
- После каждой задачи: `npm run build` зелёный, `npm run lint` без новых ошибок.
- Если задача меняет Supabase schema / storage / env / build output / production env — обнови **Resource profile** и список переменных в [docs/deploy-docker-caddy.md](deploy-docker-caddy.md) и [.env.example](../.env.example) в том же коммите (требование `AGENTS.md`).
- Все ссылки на строки валидны на момент написания. Если файл сдвинулся — искать по сигнатуре.
- **Все архитектурные развилки в этом документе уже решены** (блок «Решение принято»). Не переоткрывать их без явной причины.

## Главный вывод аудита

Приложение спроектировано как «доверенная сеть»: публичные страницы `/p/[shareSlug]` имеют строгую проверку (опубликовано / не истекло / пароль / cookie-токен), но **вся админ-поверхность и mutating-API не имеют аутентификации вообще**, а Caddy проксирует весь домен без `basic_auth`. В текущем виде любой, кто знает домен, читает/меняет/удаляет все КП и читает `password_hash` + `internalNotes` через API. Это — критический блок (AUD01–AUD04), он выполняется первым.

Что нельзя ломать при доработках: приватные ссылки, парольный гейт публичной страницы, трекинг событий, AI-импорт JSON, ретеншн-архив в Telegram, локальный JSON-фоллбэк без Supabase.

Приоритет:

| Группа | Задачи | Когда делать |
|---|---|---|
| P0 — критическая безопасность (блок доступа) | AUD01, AUD02, AUD03, AUD04 | немедленно, цепочкой |
| P1 — безопасность и целостность данных | AUD05, AUD06, AUD07, AUD08, AUD09 | вторым подходом |
| P2 — эксплуатация и устойчивость | AUD10, AUD11, AUD12, AUD13, AUD14 | после P1 |
| P3 — технический долг и документация | AUD15, AUD16, AUD17 | по мере возможности |

---

## AUD01 — Аутентификация админки и mutating-API (middleware)

**Категория:** безопасность. **Серьёзность: критическая.** Фундамент блока доступа.
**Файлы:** новый [src/middleware.ts](../src/middleware.ts), новый `src/lib/server/admin-auth.ts`, новый роут `src/app/api/admin/session/route.ts`, новая страница `src/app/login/page.tsx`, [.env.example](../.env.example), [docs/deploy-docker-caddy.md](deploy-docker-caddy.md).

### Контекст

`middleware.ts` отсутствует. Без авторизации доступны: [src/app/page.tsx](../src/app/page.tsx) (список всех КП), [src/app/proposal/[id]/edit/page.tsx](../src/app/proposal/[id]/edit/page.tsx), `proposal/new`, а также `POST/PUT/DELETE /api/proposals`, `/api/proposals/[id]`, `/api/proposals/[id]/share`, `/api/proposals/[id]/media`.

### Решение принято

Проект — self-hosted, один владелец. Полноценный Supabase Auth / многопользовательность избыточны. Вводим **один админ-секрет** `PROPOSAL_ADMIN_SECRET` + подписанный httpOnly-cookie сессии. Никакой БД-таблицы пользователей. Если позже понадобится мультиюзер — это отдельная инициатива, не здесь.

### Изменения

1. Env: добавить `PROPOSAL_ADMIN_SECRET` (обязателен в проде; см. AUD03 про fail-fast). Cookie-токен подписывать HMAC от этого секрета (по аналогии с [public-access.ts](../src/lib/server/public-access.ts)), имя cookie `prisma_admin`, `httpOnly`, `sameSite: "lax"`, `secure` в проде, срок ~7 дней.
2. `src/lib/server/admin-auth.ts`: `createAdminToken()`, `isValidAdminToken(value)` (сравнение через `crypto.timingSafeEqual`).
3. `src/app/login/page.tsx` + `POST /api/admin/session`: форма ввода секрета → при совпадении ставит cookie сессии и редиректит на `/`. `DELETE` — logout.
4. `src/middleware.ts` с `matcher`, закрывающим **всё, кроме**: `/p/*`, `/api/public-events`, `/api/public/*`, `/api/proposal-media/*`, `/login`, `/api/admin/session`, `/api/maintenance/*` (у maintenance своя авторизация по секрету, см. ниже), статики `_next/*`. Для незалогиненного запроса к защищённому пути: страницы → редирект на `/login`, API → `401 JSON`.
5. **Защита от CSRF** для mutating-API: проверять заголовок `Origin`/`Sec-Fetch-Site` (запросы должны быть same-origin), т.к. cookie `sameSite: lax` сам по себе не закрывает все векторы для не-GET.

### Критерий приёмки

- Анонимный `GET /`, `GET /api/proposals`, `DELETE /api/proposals/<id>` → редирект на `/login` (страница) или `401` (API).
- После логина админ работает как прежде.
- Публичные `/p/<slug>`, `/api/public-events`, `/api/public/<slug>/password`, отдача медиа — **без** изменения поведения.
- `npm run build` ОК. Обновлён `.env.example` и список env в Resource profile.

### Downside / откат

- Появляется обязательный env. Откат — удалить middleware и роут сессии (вернёт прежнюю незащищённость — нежелательно).

---

## AUD02 — Убрать `password_hash` и `internalNotes` из ответов API

**Категория:** безопасность. **Серьёзность: высокая.** Зависит по смыслу от AUD01, делать сразу за ним.
**Файлы:** [src/app/api/proposals/route.ts](../src/app/api/proposals/route.ts), [src/app/api/proposals/[id]/route.ts](../src/app/api/proposals/[id]/route.ts), [src/lib/proposal.ts](../src/lib/proposal.ts).

### Контекст

`sanitizePublicProposal()` ([proposal.ts:673](../src/lib/proposal.ts)) вырезает чувствительные поля только на публичной странице. Админ-API возвращает полный объект: `fromProposalRow`/`normalizeProposal` сохраняют `passwordHash` и `internalNotes`. До AUD01 это открытая утечка; после AUD01 — лишняя экспозиция секретов в браузер админа и в любые логи.

### Решение принято

`passwordHash` **никогда** не покидает серверный слой. `internalNotes` админу нужны (он их редактирует), поэтому остаются в админ-API, но `passwordHash` вырезается всегда.

### Изменения

1. Добавить `stripServerSecrets(proposal)` в `proposal.ts`: возвращает копию без `passwordHash` (и любых будущих серверных секретов).
2. Применить во **всех** ответах админ-API (`GET /api/proposals`, `GET /api/proposals/[id]`, ответы `POST/PUT`, share-роут).
3. Проверить, что клиент ([DashboardClient](../src/components/admin/DashboardClient.tsx), [ProposalEditor](../src/components/proposal/ProposalEditor.tsx)) не зависит от `passwordHash` (факт наличия пароля передавать булевым `isPasswordProtected`, оно уже есть).

### Критерий приёмки

- `grep` по ответам API: ни один не содержит `passwordHash`/`password_hash`.
- Редактор корректно показывает «пароль установлен» через `isPasswordProtected`.
- `npm run build` ОК.

### Downside / откат

- Нет. Чисто сужение проекции ответа.

---

## AUD03 — Fail-fast по обязательным секретам в проде

**Категория:** безопасность. **Серьёзность: высокая.** Завершает блок доступа.
**Файлы:** [src/lib/server/public-access.ts](../src/lib/server/public-access.ts), новый `src/lib/server/env.ts`, [src/lib/server/proposal-store.ts](../src/lib/server/proposal-store.ts).

### Контекст

- [public-access.ts:9](../src/lib/server/public-access.ts): `process.env.PROPOSAL_ACCESS_SECRET || "prisma-dev-secret"` — предсказуемый дефолт. При незаданном env в проде токены доступа к парольным КП становятся подделываемыми (особенно в связке с утечкой `passwordHash` до AUD02).
- `getSupabase()` ([proposal-store.ts:1287](../src/lib/server/proposal-store.ts)) молча подхватывает anon/public ключ как фоллбэк (см. также AUD07).

### Решение принято

Дефолт `"prisma-dev-secret"` допустим **только** при `NODE_ENV !== "production"`. В проде отсутствие `PROPOSAL_ACCESS_SECRET` или `PROPOSAL_ADMIN_SECRET` — фатальная ошибка старта (fail-fast), а не тихий небезопасный режим.

### Изменения

1. `src/lib/server/env.ts`: функция `requireProdSecret(name)` — в проде кидает понятную ошибку при пустом значении, в dev возвращает дев-дефолт.
2. Перевести `createProposalAccessToken` и админ-аутентификацию (AUD01) на `requireProdSecret`.
3. Для Supabase — в проде требовать именно service-role-ключ (продолжение в AUD07): отсутствие → ошибка, а не фоллбэк на anon.

### Критерий приёмки

- В проде без `PROPOSAL_ACCESS_SECRET`/`PROPOSAL_ADMIN_SECRET` приложение не стартует с явным сообщением.
- В dev (`npm run dev`) без env всё работает (локальный JSON-фоллбэк сохраняется).
- `npm run build` ОК.

### Downside / откат

- Возможен «жёсткий» отказ старта в проде при неполном env — это и есть цель. Откат — вернуть мягкие дефолты (небезопасно).

---

## AUD04 — Временная защита домена на уровне Caddy

**Категория:** безопасность (компенсирующий контроль). **Серьёзность: высокая.**
**Файлы:** [docs/deploy-docker-caddy.md](deploy-docker-caddy.md), [docs/server-sharing-with-caddy.md](server-sharing-with-caddy.md).

### Контекст

До выката AUD01 в прод домен открыт. Нужна немедленная компенсирующая мера, не требующая релиза кода.

### Решение принято

Добавить `basic_auth` на всё, **кроме** публичных путей `/p/*`, `/api/public-events`, `/api/public/*`, `/api/proposal-media/*`. После выката AUD01 basic_auth можно снять (или оставить как второй рубеж — на усмотрение оператора).

### Изменения

В Caddyfile-пример добавить (псевдо-схема, маршрутизация путей):

```caddyfile
doplist.tsyzhman.ru {
  encode zstd gzip

  @public path /p/* /api/public-events /api/public/* /api/proposal-media/*
  @admin not path /p/* /api/public-events /api/public/* /api/proposal-media/*

  basic_auth @admin {
    admin <bcrypt-hash>   # caddy hash-password
  }

  header @public X-Robots-Tag "noindex, nofollow"
  header {
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
  }

  reverse_proxy 127.0.0.1:3005
}
```

Документировать генерацию хеша (`caddy hash-password`) и пометку, что это временная мера до AUD01.

### Критерий приёмки

- `curl https://<домен>/` без basic-auth → `401`.
- `curl https://<домен>/p/<slug>` → доступно без basic-auth.

### Downside / откат

- Basic-auth перед SPA не идеален по UX, но приемлем как временный рубеж. Откат — убрать блок `basic_auth`.

---

## AUD05 — Анти-брутфорс на проверке пароля КП

**Категория:** надёжность/безопасность. **Серьёзность: высокая.**
**Файлы:** [src/app/api/public/[shareSlug]/password/route.ts](../src/app/api/public/[shareSlug]/password/route.ts), новый `src/lib/server/rate-limit.ts`.

### Контекст

[password/route.ts](../src/app/api/public/[shareSlug]/password/route.ts) принимает неограниченное число попыток. Argon2id делает verify медленным (частичное смягчение), но нет лимита/локаута → возможен автоматизированный перебор слабых паролей и ресурсное истощение CPU.

### Решение принято

In-memory rate-limiter по ключу `IP + shareSlug` (одна реплика в текущем деплое — этого достаточно). Лимит: **5 неудач → локаут 15 минут**, скользящее окно. Для будущего мульти-реплика-сценария — пометка в коде, что состояние нужно вынести в Supabase/Redis.

### Изменения

1. `src/lib/server/rate-limit.ts`: токен-бакет/счётчик в `Map` с TTL-очисткой.
2. В роуте: до `verifyProposalPassword` проверять лимит; при превышении → `429` с `Retry-After`. Успешный ввод сбрасывает счётчик.
3. IP брать из `x-forwarded-for` (за Caddy) с фоллбэком; не доверять одному заголовку слепо (брать первый hop).

### Критерий приёмки

- 6-я подряд неверная попытка с одного IP по одному slug → `429`.
- Верный пароль до локаута → успех и сброс счётчика.
- `npm run build` ОК.

### Downside / откат

- Состояние не переживёт рестарт/вторую реплику (для текущего деплоя приемлемо). Откат — убрать проверку лимита.

---

## AUD06 — Безопасная загрузка и отдача медиа (SVG / заголовки)

**Категория:** безопасность (stored XSS). **Серьёзность: средняя.**
**Файлы:** [src/lib/server/proposal-store.ts](../src/lib/server/proposal-store.ts) (`saveProposalMediaFile`, `getExtensionForContentType`, `getMediaContentType`), [src/app/api/proposal-media/[...path]/route.ts](../src/app/api/proposal-media/[...path]/route.ts), [supabase/schema.sql](../supabase/schema.sql) (allowed_mime_types бакета).

### Контекст

`saveProposalMediaFile` разрешает `image/svg+xml` ([proposal-store.ts:405](../src/lib/server/proposal-store.ts)), а локальная отдача `/api/proposal-media/...` ставит `Content-Type: image/svg+xml` тем же origin без CSP. Загруженный SVG со скриптом исполняется при прямом открытии → stored XSS (актуально для локального стораджа, особенно вместе с отсутствием auth до AUD01).

### Решение принято

**SVG в загрузках запрещаем полностью.** Для КП достаточно растровых форматов (png/jpeg/webp/gif). Векторные схемы при необходимости вставляются как png/webp. Плюс — защитные заголовки на отдачу медиа.

### Изменения

1. Убрать `image/svg+xml` из allowed-логики: проверка contentType в `saveProposalMediaFile`, маппинги расширений, и `allowed_mime_types` бакета в [schema.sql:183](../supabase/schema.sql).
2. Жёсткий allowlist contentType вместо «начинается с `image/`».
3. Отдача в [proposal-media route](../src/app/api/proposal-media/[...path]/route.ts): добавить `X-Content-Type-Options: nosniff` и `Content-Security-Policy: default-src 'none'; sandbox`. Опционально `Content-Disposition: inline` с явным безопасным типом.

### Критерий приёмки

- Загрузка `.svg` → `400`.
- Ответ отдачи медиа содержит `X-Content-Type-Options: nosniff` и CSP.
- Существующие png/jpeg/webp рендерятся как прежде.
- Обновлён Resource profile (изменены allowed_mime_types бакета).

### Downside / откат

- Теряется поддержка SVG (осознанно). Откат — вернуть svg в allowlist (не рекомендуется без серверной санитизации).

---

## AUD07 — Только service-role на сервере + RLS deny-all в Supabase

**Категория:** безопасность/надёжность. **Серьёзность: средняя.**
**Файлы:** [src/lib/server/proposal-store.ts](../src/lib/server/proposal-store.ts) (`getSupabase`), [supabase/schema.sql](../supabase/schema.sql), [docs/deploy-docker-caddy.md](deploy-docker-caddy.md).

### Контекст

`getSupabase()` ([proposal-store.ts:1287](../src/lib/server/proposal-store.ts)) фоллбэчит на `SUPABASE_ANON_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. RLS в [schema.sql](../supabase/schema.sql) не включён ни на одной таблице. Если сервер случайно поедет на anon-ключе при отключённом RLS — данные открыты через PostgREST; при включённом RLS без политик — записи молча падают.

### Решение принято

Сервер работает **только** под service-role-ключом (он обходит RLS). Параллельно включаем **RLS со «запрещающим по умолчанию» поведением** (RLS enabled, без публичных политик) на всех таблицах — это глубокая защита: даже при утечке anon-ключа данные недоступны через PostgREST.

### Изменения

1. `getSupabase()`: на сервере принимать `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SERVICE_KEY`. Убрать anon-фоллбэк для серверного клиента; в проде отсутствие service-role → ошибка (связка с AUD03).
2. `schema.sql`: `alter table ... enable row level security;` для `proposals`, `deliverables`, `packages`, `process_steps`, `proof_items`, `proposal_events`, `proposal_archive_jobs`. Политики не добавляем (service-role их игнорирует).
3. Документировать в Resource profile: «сервер использует service-role; RLS включён без анонимных политик».

### Критерий приёмки

- С service-role ключом всё работает (CRUD, события, ретеншн).
- Прямой запрос к таблицам с anon-ключом → пусто/запрет.
- `npm run build` ОК. Обновлён Resource profile.

### Downside / откат

- Требует точного указания service-role в проде (это и есть цель). Откат — снять RLS и вернуть фоллбэк (небезопасно).

---

## AUD08 — Атомарность сохранения КП с дочерними сущностями

**Категория:** надёжность (целостность данных). **Серьёзность: средняя.**
**Файлы:** [src/lib/server/proposal-store.ts](../src/lib/server/proposal-store.ts) (`persistSupabaseProposal`, `deleteSupabaseChildren`), [supabase/schema.sql](../supabase/schema.sql), [docs/deploy-docker-caddy.md](deploy-docker-caddy.md).

### Контекст

`persistSupabaseProposal` ([proposal-store.ts:1079](../src/lib/server/proposal-store.ts)): upsert proposal → `deleteSupabaseChildren` → batch insert дочерних. Без транзакции. Сбой на insert после delete оставляет КП без deliverables/packages/process_steps/proof_items — частичная потеря данных, видимая клиенту на публичной странице.

### Решение принято

Перенести «удалить детей + вставить детей» в транзакционную Postgres-функцию (RPC), вызываемую одним `supabase.rpc(...)` с JSON-пейлоадом. Это даёт атомарность и заодно убирает 5 раздельных сетевых вызовов.

### Изменения

1. `schema.sql`: функция `replace_proposal_children(p_id text, p_deliverables jsonb, p_packages jsonb, p_process_steps jsonb, p_proof_items jsonb)` — внутри одной транзакции `delete` по `proposal_id` и `insert` из `jsonb_populate_recordset`.
2. `persistSupabaseProposal`: upsert proposal + один `rpc('replace_proposal_children', ...)` вместо текущей связки delete+4 insert.
3. Сохранить поведение для локального JSON-стораджа (там запись и так атомарна через temp+rename).

### Критерий приёмки

- Сохранение КП с детьми работает; искусственный сбой внутри RPC не оставляет частичного состояния (дети либо все старые, либо все новые).
- `npm run build` ОК. Обновлён Resource profile (новая SQL-функция).

### Downside / откат

- Нужна миграция Supabase. Откат — вернуть прежнюю последовательность вызовов (без атомарности).

---

## AUD09 — Защита retention от конкурентного запуска

**Категория:** надёжность. **Серьёзность: средняя.**
**Файлы:** [src/lib/server/proposal-retention.ts](../src/lib/server/proposal-retention.ts), [src/app/api/maintenance/proposals-retention/route.ts](../src/app/api/maintenance/proposals-retention/route.ts), [src/lib/server/proposal-store.ts](../src/lib/server/proposal-store.ts).

### Контекст

Эндпоинт maintenance можно вызвать конкурентно (два cron-тика/ручной запуск). Оба прохода берут одних кандидатов через `listRetentionCandidateProposals` → возможна двойная отправка в Telegram и гонка на `deleteProposal`/обновление джобы. `proposal_original_id unique` и проверки статуса смягчают, но окно есть.

### Решение принято

Postgres advisory-lock на время прохода retention (`pg_try_advisory_lock` с фиксированным ключом). Если лок занят — второй вызов сразу возвращает `409`/`{ ok:true, skipped:"locked" }` без работы. Дополнительно — выборка кандидатов с `FOR UPDATE SKIP LOCKED` (через RPC), чтобы два прохода физически не пересеклись по строкам.

### Изменения

1. `schema.sql`: RPC `try_lock_retention()` / `unlock_retention()` поверх `pg_try_advisory_lock(<const>)`, либо обернуть весь проход в одну SQL-функцию.
2. `runProposalRetention`: брать лок в начале, освобождать в `finally`; при незахвате — ранний выход.
3. (Опц.) `listRetentionCandidateProposals` для Supabase — через RPC c `for update skip locked`.

### Критерий приёмки

- Два одновременных вызова maintenance: один работает, второй мгновенно выходит без повторной обработки тех же КП.
- Один Telegram-архив на одно КП (проверяется по `proposal_archive_jobs`).
- `npm run build` ОК. Обновлён Resource profile.

### Downside / откат

- Advisory-lock привязан к Supabase. Для локального стораджа достаточно in-process флага «running». Откат — убрать лок (вернуть гонку).

---

## AUD10 — Лёгкий healthcheck и флаг демо-сидинга

**Категория:** DevOps/производительность. **Серьёзность: средняя.**
**Файлы:** новый `src/app/api/health/route.ts`, [Dockerfile](../Dockerfile), [src/lib/server/proposal-store.ts](../src/lib/server/proposal-store.ts) (`ensureSupabaseDemoData`), [.env.example](../.env.example), [docs/deploy-docker-caddy.md](deploy-docker-caddy.md).

### Контекст

- HEALTHCHECK бьёт в `/` ([Dockerfile:39](../Dockerfile)) — это админ-дашборд: полный листинг + `ensureSupabaseDemoData` (count-запрос) каждые 30 секунд. После AUD01 `/` ещё и редиректит на `/login`. Лишняя нагрузка и зависимость healthcheck от БД (БД легла → контейнер рестартует, хотя приложение живо).
- `ensureSupabaseDemoData` ([proposal-store.ts:1129](../src/lib/server/proposal-store.ts)) при пустой таблице **автоматически создаёт демо-КП** — нежелательно в проде.

### Решение принято

Отдельный `/api/health`, отвечающий `200` без обращения к БД (liveness). HEALTHCHECK нацелить на него. Демо-сидинг (и Supabase, и локальный) спрятать за флаг `SEED_DEMO=true`, по умолчанию выключен.

### Изменения

1. `src/app/api/health/route.ts`: `GET` → `{ ok: true }`, `runtime = "nodejs"`, без БД. Добавить в публичные пути middleware (AUD01).
2. `Dockerfile`: `wget -qO- http://127.0.0.1:3000/api/health`.
3. `ensureSupabaseDemoData` и локальный сид (`readLocalDatabase` создаёт demo) — гейтить по `process.env.SEED_DEMO === "true"`. В dev можно оставить дефолт сидинга для удобства, в проде — только по флагу.
4. `.env.example`: добавить `SEED_DEMO=`. Resource profile: healthcheck теперь `/api/health`, демо-сид по флагу.

### Критерий приёмки

- `curl /api/health` → `200` даже при недоступной БД.
- В проде без `SEED_DEMO=true` пустая база остаётся пустой.
- `docker compose ps` показывает healthy. `npm run build` ОК.

### Downside / откат

- Health не проверяет БД (это liveness, не readiness — осознанно). При желании добавить отдельный `/api/health/ready` с пингом БД. Откат — вернуть HEALTHCHECK на `/`.

---

## AUD11 — Структурное логирование серверных ошибок

**Категория:** логирование/наблюдаемость. **Серьёзность: низкая–средняя.**
**Файлы:** новый `src/lib/server/log.ts`, [src/lib/server/proposal-store.ts](../src/lib/server/proposal-store.ts), API-роуты.

### Контекст

В серверном слое нет ни одного `console.error`/логгера: ошибки Supabase оборачиваются в `throw new Error(error.message)` ([proposal-store.ts](../src/lib/server/proposal-store.ts), многократно) — теряется контекст (operation, proposalId) и stack. Диагностика инцидентов на проде затруднена.

### Решение принято

Минимальный логгер без внешних зависимостей: структурированный JSON в `stdout` (`level`, `msg`, `op`, `proposalId`, `err`). Никаких секретов/`passwordHash`/ПД в логах. Docker уже ротирует stdout (см. T04).

### Изменения

1. `src/lib/server/log.ts`: `logError(op, err, ctx?)`, `logWarn`, `logInfo` → `JSON.stringify` в консоль. Явный allowlist полей контекста (никаких целых объектов `proposal`).
2. Логировать в `catch` критичных операций: ретеншн (`archiveAndPurgeProposal`), Telegram-отправка, сохранение/удаление КП, media. Ошибку наверх прокидывать как и раньше, но с залогированным контекстом.
3. Запрет на логирование `password`, `passwordHash`, `internalNotes`, полного тела запроса.

### Критерий приёмки

- При искусственной ошибке Supabase в логах виден JSON с `op` и `proposalId`, **без** секретов.
- `npm run build` / `npm run lint` ОК.

### Downside / откат

- Небольшой рост объёма логов (ограничен ротацией). Откат — удалить вызовы логгера.

---

## AUD12 — Базовое покрытие тестами (Vitest)

**Категория:** тесты. **Серьёзность: средняя.**
**Файлы:** `package.json`, новый `vitest.config.ts`, новый каталог `src/**/__tests__` или `*.test.ts`.

### Контекст

Тестов в проекте нет вовсе. Критичные чистые функции изолированы и легко тестируются, но не покрыты — любой рефакторинг (AUD08/AUD09/AUD15) рискован.

### Решение принято

Раннер — **Vitest** (нативный TS/ESM, быстрый, без отдельной конфигурации Babel). Начинаем с unit-тестов чистых функций; e2e/integration — вне объёма этой задачи.

### Изменения

1. `package.json`: devDep `vitest`, скрипты `"test": "vitest run"`, `"test:watch": "vitest"`.
2. `vitest.config.ts`: алиас `@/` на `src/` (синхронно с `tsconfig.json`).
3. Тесты на:
   - [proposal-ai.ts](../src/lib/proposal-ai.ts): `validateProposalAiInputPayload` (валидные/невалидные кейсы, systemManagedKeys, дубли кодов пакетов, >1 recommended), `createProposalFromAiInput`.
   - [proposal-retention.ts](../src/lib/server/proposal-retention.ts): `subtractUtcMonths`/`getRetentionCutoffIso` (граница месяцев, високосность, конец месяца).
   - [telegram-archive.ts](../src/lib/server/telegram-archive.ts): `chunkTelegramText` (короткий/длинный/гигантская строка), `renderProposalTelegramArchive` (пустые поля отбрасываются).
   - [proposal.ts](../src/lib/proposal.ts): `sanitizeActionUrl` (js:/data: отвергаются, mailto/tel/http(s)/относительные проходят), `getEffectiveStatus` (expired-логика), `slugifyShareSlug`, `normalizeProposal` (дефолты).
   - [public-access.ts](../src/lib/server/public-access.ts): токен детерминирован и зависит от `passwordHash`.

### Критерий приёмки

- `npm test` зелёный, покрыты перечисленные функции.
- `npm run build` ОК (тестовые файлы не попадают в бандл).

### Downside / откат

- DevDep `vitest`. Откат — удалить конфиг/скрипты/тесты.

---

## AUD13 — Быстрые правки: двойной запрос и no-op

**Категория:** производительность/качество. **Серьёзность: низкая.**
**Файлы:** [src/app/api/public-events/route.ts](../src/app/api/public-events/route.ts), [src/lib/server/proposal-store.ts](../src/lib/server/proposal-store.ts).

### Контекст

- [public-events/route.ts:26](../src/app/api/public-events/route.ts) вызывает `getProposalByShareSlug`, затем `recordEventByShareSlug` ([proposal-store.ts:747](../src/lib/server/proposal-store.ts)) запрашивает то же КП повторно — двойной select на каждое публичное событие.
- [proposal-store.ts:816](../src/lib/server/proposal-store.ts): `proposal.updatedAt = proposal.updatedAt;` — мёртвый no-op.

### Решение принято

Передавать `proposalId` напрямую и убрать no-op. Минимальная безопасная правка.

### Изменения

1. В public-events использовать уже загруженный `proposal.id` через `recordProposalEvent({ proposalId, ... })` вместо `recordEventByShareSlug` (который снова грузит КП). Сохранить проверки `published`/`allowPackageSelection`.
2. Удалить строку no-op.

### Критерий приёмки

- На один публичный event — один select КП (а не два).
- `npm run build` ОК.

### Downside / откат

- Нет. Откат — `git revert`.

---

## AUD14 — Дедуп просмотров публичной страницы

**Категория:** надёжность данных (аналитика). **Серьёзность: низкая.**
**Файлы:** [src/app/p/[shareSlug]/page.tsx](../src/app/p/[shareSlug]/page.tsx), [src/lib/server/proposal-store.ts](../src/lib/server/proposal-store.ts).

### Контекст

`view` пишется на каждый серверный рендер ([p/[shareSlug]/page.tsx:71](../src/app/p/[shareSlug]/page.tsx), `force-dynamic`), включая ботов и превью-краулеры мессенджеров (Telegram/WhatsApp разворачивают ссылку). `views_count` завышается.

### Решение принято

Дедуп по cookie с окном **30 минут** + пропуск очевидных ботов по `User-Agent`. Это снимает накрутку от повторных загрузок и линк-превью без сложной серверной аналитики.

### Изменения

1. На публичной странице ставить cookie `prisma_seen_<shareSlug>` (httpOnly, path `/p/<slug>`, maxAge 30 мин). Если cookie уже есть — событие `view` не писать.
2. Список UA-паттернов ботов (telegrambot, whatsapp, facebookexternalhit, slackbot, discordbot, bingbot, googlebot и т.п.) → пропускать запись `view`.
3. Сам рендер страницы остаётся доступным для всех; фильтруется только запись события.

### Критерий приёмки

- Повторная загрузка `/p/<slug>` в пределах 30 минут не увеличивает `views_count`.
- Запрос с UA `TelegramBot` не пишет `view`.
- `npm run build` ОК.

### Downside / откат

- Дедуп грубый (cookie-based), не различает устройства/инкогнито — для демо-аналитики достаточно. Откат — убрать проверку cookie/UA.

---

## AUD15 — Зачистка legacy-кода

**Категория:** качество кода. **Серьёзность: низкая.**
**Файлы:** [src/lib/types.ts](../src/lib/types.ts), [src/lib/proposal.ts](../src/lib/proposal.ts), компоненты `ChangeItem*`, `PricingBreakdown`, `ProjectSettingsForm`, `SummaryCard`, `TimelineImpact`, `ImportExportControls`.

### Контекст

Параллельно новой модели КП тянется старый «builder»-слой: `Category`, `ChangeItem`, `ProposalData`, `ProposalMode` ([types.ts:379-437](../src/lib/types.ts)), `calculate*`, `encodeProposalForShare`/`decodeProposalFromShare`, `createDemoProposalData`, `STORAGE_KEY`, `SHARE_HASH_PREFIX` ([proposal.ts:1084-1238](../src/lib/proposal.ts)). Часть используется компонентами (`ChangeItemList/Form`, `PricingBreakdown`, `SummaryCard`, `TimelineImpact`), часть может быть мёртвой.

### Решение принято

**Сначала аудит использования, потом удаление.** Не удалять вслепую. Удаляем только то, что не имеет ни одной ссылки из `src/app`/реально подключённых компонентов. Если весь builder-слой и его компоненты нигде не маршрутизируются (`src/app` их не импортирует) — удаляем целиком как отдельный коммит.

### Изменения

1. Построить карту использования: `grep -rn "ChangeItem\|ProposalData\|encodeProposalForShare\|createDemoProposalData\|STORAGE_KEY" src/`.
2. Для каждого символа: используется в активном маршруте? — оставить; нет — удалить (символ + компонент + тип).
3. Зафиксировать в PR-описании, что именно удалено и на основании чего (нет ссылок).

### Критерий приёмки

- После удаления `npm run build` и `npm run lint` зелёные, `tsc` без ошибок «unused/undefined».
- В `src/app` нет битых импортов.

### Downside / откат

- Риск удалить используемое — снимается шагом аудита использования. Откат — `git revert`.

---

## AUD16 — Единый источник демо-данных

**Категория:** качество/надёжность. **Серьёзность: низкая.** Связана с AUD10.
**Файлы:** [supabase/schema.sql](../supabase/schema.sql) (блок `do $$ ... insert ...`), [src/lib/proposal.ts](../src/lib/proposal.ts) (`createDemoProposal`).

### Контекст

Демо-КП описано дважды и почти идентично: SQL-seed в [schema.sql:224-345](../supabase/schema.sql) и `createDemoProposal()` ([proposal.ts:789](../src/lib/proposal.ts)). Любая правка демо требует синхронных изменений в двух местах — источник рассинхрона.

### Решение принято

Единственный источник демо — TypeScript `createDemoProposal()` (он уже используется сидингом и фоллбэком). SQL-seed-блок из `schema.sql` удаляем; сидинг выполняется приложением под флагом `SEED_DEMO` (AUD10).

### Изменения

1. Удалить `do $$ ... end $$;` insert-блок демо из [schema.sql](../supabase/schema.sql). Оставить DDL (таблицы, индексы, функции, бакет).
2. Убедиться, что `ensureSupabaseDemoData` (под флагом из AUD10) корректно создаёт демо в пустой БД.
3. Обновить Resource profile: «демо-данные сидятся приложением по `SEED_DEMO`, не из schema.sql».

### Критерий приёмки

- Применение `schema.sql` к пустой БД создаёт схему без демо-КП.
- С `SEED_DEMO=true` приложение создаёт демо при первом запросе.
- `npm run build` ОК. Resource profile обновлён.

### Downside / откат

- Тот, кто применял только SQL и ждал демо, его не увидит без флага (это и есть цель). Откат — вернуть SQL-seed.

---

## AUD17 — Унификация доменов/портов и README

**Категория:** документация/DevOps. **Серьёзность: низкая.**
**Файлы:** [.env.example](../.env.example), [docs/deploy-docker-caddy.md](deploy-docker-caddy.md), [docs/server-sharing-with-caddy.md](server-sharing-with-caddy.md), новый `README.md`, [package.json](../package.json).

### Контекст

Рассинхрон: [.env.example:5](../.env.example) — `PROPOSAL_PUBLIC_ORIGIN=https://kp.tsyzhman.ru`, а деплой-доки используют `doplist.tsyzhman.ru` и разные порты (3005 в одном доке, 3007 — в [server-sharing-with-caddy.md:13](server-sharing-with-caddy.md)). `package.json` name — `"prisma"`, корневого README нет (новые env из AUD01/AUD10 нигде не описаны для оператора).

### Решение принято

Канонический домен — **`doplist.tsyzhman.ru`** (он консистентно используется в обоих деплой-доках), канонический host-порт — **`3005`** (как в `docker-compose.example.yml` и основном деплой-доке). `.env.example`, `server-sharing-with-caddy.md` привести к этим значениям. Добавить корневой README с обязательными env и явным предупреждением про обязательность `PROPOSAL_ADMIN_SECRET`/`PROPOSAL_ACCESS_SECRET`/service-role в проде.

### Изменения

1. `.env.example`: `PROPOSAL_PUBLIC_ORIGIN=https://doplist.tsyzhman.ru`; добавить `PROPOSAL_ADMIN_SECRET=`, `SEED_DEMO=` (из AUD01/AUD10).
2. `server-sharing-with-caddy.md`: порт `3007` → `3005`.
3. `README.md`: краткое назначение, локальный запуск (`npm run dev`, локальный JSON-фоллбэк), список env с пометкой обязательных в проде, ссылки на три task-дока и на деплой-инструкцию, явное предупреждение: «без аутентификации (AUD01) не публиковать в открытый доступ».
4. (Опц.) выровнять `name` в `package.json` (`prisma` → `kp-builder` или `prisma-kp`) — согласовать с именами Docker-сервисов, чтобы не сломать инструкции.

### Критерий приёмки

- Во всех доках и `.env.example` один домен и один порт.
- README перечисляет все обязательные env, включая введённые в AUD01/AUD03/AUD07/AUD10.

### Downside / откат

- Если реальный прод-домен иной — поправить значение в одном месте. Откат — `git revert`.

---

## Финальный чек-лист аудита

- [ ] Админка и mutating-API закрыты аутентификацией; публичные пути работают как прежде (AUD01).
- [ ] `passwordHash` не уходит в ответы API; `internalNotes` только админу (AUD02).
- [ ] В проде нет небезопасных дефолтов секретов — fail-fast (AUD03, AUD07).
- [ ] Перебор пароля КП ограничен (AUD05).
- [ ] SVG-загрузки запрещены, медиа отдаётся с `nosniff`/CSP (AUD06).
- [ ] Сохранение КП и retention атомарны/без гонок (AUD08, AUD09).
- [ ] Healthcheck не ходит в БД; демо-сид по флагу (AUD10).
- [ ] Серверные ошибки логируются с контекстом, без секретов (AUD11).
- [ ] `npm test` зелёный на критичных чистых функциях (AUD12).
- [ ] Legacy-слой проверен и зачищен (AUD15); демо — один источник (AUD16).
- [ ] Доки/env/README консистентны (AUD17).
- [ ] `npm run build` и `npm run lint` зелёные; Resource profile обновлён там, где затронут деплой/schema/env/storage.
