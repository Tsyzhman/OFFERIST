# Optimization tasks — CPU / RAM / disk

Документ для исполнителя (агента или человека). Все задачи независимы, но имеют рекомендуемый порядок. Каждая задача = один PR/коммит, чтобы можно было откатить точечно.

Правила для исполнителя:

- Перед началом каждой задачи прочитай весь раздел задачи целиком (контекст, изменения, критерий приёмки, downside).
- Не сливай несколько задач в один коммит, кроме случаев, прямо указанных в задаче (например, T01 и T11 связаны Dockerfile-стадиями).
- После каждой задачи: `npm run build` локально должен пройти зелёным, `npm run lint` — без новых ошибок.
- Если задача меняет Docker / Compose / Supabase schema / cron / retention / build output / production env — обнови **Resource profile** в [docs/deploy-docker-caddy.md](deploy-docker-caddy.md) в **том же** коммите (требование `AGENTS.md`).
- Сегодняшняя дата для меток в коде/доке: см. `# currentDate` в `AGENTS.md` на момент выполнения.
- Все ссылки на строки в этом документе валидны на момент написания (commit `b2601ab`). Если файл сдвинулся — ищи по сигнатуре, не по номеру строки.

Приоритет:

| Группа | Задачи | Когда делать |
|---|---|---|
| P0 — большие выигрыши, низкий риск | T01, T02, T04 | сразу |
| P1 — средние выигрыши, низкий риск | T03, T05, T09, T10, T12, T13 | вторым подходом |
| P2 — средние выигрыши, средний риск | T06, T08, T11 | после P0/P1 |
| P3 — опциональные | T07, T14 | по необходимости |

---

## T01 — Включить Next.js `output: "standalone"` и переписать Dockerfile

**Категория:** диск (-200…-300 MB образ), RAM (-50…-100 MB RSS).
**Файлы:** `next.config.ts`, `Dockerfile`, `docker-compose.example.yml`, `docs/deploy-docker-caddy.md`.

### Контекст
Сейчас `next.config.ts` пустой. `Dockerfile` стадия `runner` копирует `--from=prod-deps /app/node_modules` (≈ 200–300 MB) и запускает `npm run start`. В standalone-режиме Next пакует только реально используемые модули в `.next/standalone/` и кладёт рядом готовый `server.js`. Это даёт самый большой выигрыш по диску и RAM.

### Изменения

1. **`next.config.ts`** — заменить содержимое на:

   ```ts
   import type { NextConfig } from "next";

   const nextConfig: NextConfig = {
     output: "standalone",
     experimental: {
       optimizePackageImports: ["lucide-react"], // см. T03
     },
   };

   export default nextConfig;
   ```

   Если T03 ещё не сделана — `experimental` блок добавится в ней. На этой задаче можно оставить только `output: "standalone"`.

2. **`Dockerfile`** — заменить целиком. Финальная стадия должна копировать только `.next/standalone`, `.next/static` и `public`. Не должно быть `npm ci --omit=dev` и копирования `node_modules`:

   ```dockerfile
   # syntax=docker/dockerfile:1

   ARG NODE_IMAGE=node:24.16.0-alpine3.23

   FROM ${NODE_IMAGE} AS deps
   WORKDIR /app
   ENV NEXT_TELEMETRY_DISABLED=1
   COPY package.json package-lock.json ./
   RUN npm ci --prefer-offline --no-audit --no-fund

   FROM ${NODE_IMAGE} AS builder
   WORKDIR /app
   ENV NEXT_TELEMETRY_DISABLED=1
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build

   FROM ${NODE_IMAGE} AS runner
   WORKDIR /app

   ENV NODE_ENV=production
   ENV NEXT_TELEMETRY_DISABLED=1
   ENV HOSTNAME=0.0.0.0
   ENV PORT=3000

   RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
   COPY --from=builder /app/public ./public

   RUN mkdir -p /app/.data && chown -R nextjs:nodejs /app/.data

   USER nextjs
   EXPOSE 3000

   HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
     CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

   CMD ["node", "server.js"]
   ```

   Удалена стадия `prod-deps` целиком (она больше не нужна).

3. **`docker-compose.example.yml`** — поменять имя сервиса с `web` на `prisma`, чтобы соответствовать инструкции `docs/deploy-docker-caddy.md` (там в командах `docker compose logs prisma`):

   Проверить блок `services:` — если сервис называется `web`, переименовать в `prisma`. **Внимание:** имя сервиса используется в `docker compose logs <name>`, в инструкции и в `container_name`. Привести всё к одному имени `prisma` (container_name уже `kp-builder-web`, его можно оставить).

4. **`docs/deploy-docker-caddy.md`**:
   - Обновить раздел **Resource profile**: указать новый ориентир по образу — `~150–200 MB` (было ~500 MB) и RAM `0.4–0.8 GB`.
   - Указать в разделе обновлений, что `npm run start` больше не используется, runtime — `node server.js`.

### Проверка

```bash
docker compose build
docker compose up -d
docker compose ps               # status running
curl -I http://127.0.0.1:3005   # 200/307 OK
docker image ls | grep prisma   # сравнить размер с предыдущим
docker compose logs --tail=50 prisma
```

Ожидаемо: образ < 250 MB, контейнер поднимается, healthcheck зелёный.

### Downside / откат

- Если используется любой `require()` из `node_modules` через **динамический путь, не виденный статическому анализу Next**, такой модуль не попадёт в `.next/standalone`. У нас таких мест нет (`@supabase/supabase-js`, `bcryptjs`, `lz-string`, `lucide-react` — все статические). Если что-то ломается на старте — добавить пакет через `experimental.outputFileTracingIncludes` в `next.config.ts`.
- Откат: вернуть прежний `Dockerfile` и убрать `output` из `next.config.ts`.

---

## T02 — Компактный JSON-сторадж и обрезка событий

**Категория:** диск (рост `.data/proposals.json` останавливается), CPU (-O(n) на каждый view).
**Файлы:** `src/lib/server/proposal-store.ts`.

### Контекст
Каждый просмотр публичной ссылки вызывает `recordProposalEvent` → `database.events.unshift(event)` → `JSON.stringify(database, null, 2)` и **полная** запись файла. Файл растёт без ограничения; запись pretty-print тратит ~30–50% лишнего объёма; на 10k событий каждая запись становится десятки мс.

Файл со сторонами:
- запись: [src/lib/server/proposal-store.ts:887-890](../src/lib/server/proposal-store.ts) (`writeLocalDatabase`).
- вставка событий: [src/lib/server/proposal-store.ts:601-617](../src/lib/server/proposal-store.ts) (`recordProposalEvent`, локальная ветка).
- архивные джобы пишутся туда же.

### Изменения

1. **Убрать pretty-print** в `writeLocalDatabase` — заменить `JSON.stringify(database, null, 2)` на `JSON.stringify(database)`.

2. **Ограничить хвост `events`**. Добавить константу в начале файла:

   ```ts
   const MAX_EVENTS_PER_PROPOSAL = 200;
   const MAX_EVENTS_TOTAL = 5000;
   ```

   В `recordProposalEvent` (локальная ветка, после `database.events.unshift(event)`) добавить нормализацию:

   ```ts
   database.events = trimEvents(database.events);
   ```

   Создать вспомогательную функцию в этом же файле:

   ```ts
   function trimEvents(events: ProposalEvent[]): ProposalEvent[] {
     const perProposal = new Map<string, number>();
     const kept: ProposalEvent[] = [];
     for (const event of events) {
       const count = perProposal.get(event.proposalId) ?? 0;
       if (count >= MAX_EVENTS_PER_PROPOSAL) continue;
       perProposal.set(event.proposalId, count + 1);
       kept.push(event);
       if (kept.length >= MAX_EVENTS_TOTAL) break;
     }
     return kept;
   }
   ```

   Порядок: т.к. свежие события через `unshift` идут в начало массива, цикл "сверху вниз" сохраняет последние N. Никакого изменения порядка.

3. **Атомарная запись.** Текущий `fs.writeFile(localDatabasePath, ...)` — не атомарен. При `kill -9` посередине файл может стать невалидным JSON. Заменить на write-then-rename:

   ```ts
   async function writeLocalDatabase(database: LocalDatabase) {
     await fs.mkdir(path.dirname(localDatabasePath), { recursive: true });
     const tmpPath = `${localDatabasePath}.tmp`;
     await fs.writeFile(tmpPath, JSON.stringify(database), "utf8");
     await fs.rename(tmpPath, localDatabasePath);
   }
   ```

4. **Совместимость со старым файлом.** `readLocalDatabase` уже умеет читать любой валидный JSON через `JSON.parse` — менять там ничего не нужно. Pretty-print → compact обратной несовместимости не создаёт.

### Проверка

- `npm run build` ОК.
- В dev-режиме открыть `/p/<slug>` 250 раз подряд, убедиться, что в `.data/proposals.json` секция `events` не растёт выше 200 для этого proposalId.
- Файл `.data/proposals.json` после ~100 событий ощутимо меньше прежнего pretty-print варианта.

### Downside / откат

- `MAX_EVENTS_PER_PROPOSAL = 200` означает потерю самых старых событий по достижении лимита. Для аналитики это ок (последние 200 view-событий — более чем достаточно), для аудита — нет. Если нужен полный аудит — переключиться на Supabase.
- Атомарная запись через `rename` на Windows может конфликтовать с антивирусом / индексатором; в Linux работает штатно.
- Откат: вернуть `, null, 2` и убрать `trimEvents`/atomic rename.

---

## T03 — `optimizePackageImports` для `lucide-react`

**Категория:** RAM (dev/HMR), client bundle.
**Файлы:** `next.config.ts`.

### Контекст
`lucide-react` весит 28.8 MB на диске и экспортирует ~1500 иконок. В проекте используется ~20 иконок (см. `grep -rn "lucide-react" src/`). Next 16 умеет точечный импорт через `experimental.optimizePackageImports`.

### Изменения

В `next.config.ts` добавить (или подтвердить, если уже добавлено в T01):

```ts
experimental: {
  optimizePackageImports: ["lucide-react"],
},
```

Импорты в коде менять **не нужно** — флаг работает прозрачно с barrel-импортами.

### Проверка

- `npm run build` ОК.
- В выводе `Route (app)` страница `/proposal/[id]/edit` должна показать меньший `First Load JS`, чем до правки. Зафиксировать дельту в PR-описании.

### Downside / откат

- Флаг помечен как `experimental`; в редких случаях ломает sourcemap. Откат — удалить ключ из конфига.

---

## T04 — Ротация Docker-логов

**Категория:** диск (предотвращение неограниченного роста `/var/lib/docker/containers/<id>/*.log`).
**Файлы:** `docker-compose.example.yml`, `docs/deploy-docker-caddy.md`.

### Контекст
Драйвер логов по умолчанию `json-file` без лимитов. На прод-сервере логи могут вырасти на десятки GB до первого перезапуска.

### Изменения

В `docker-compose.example.yml` в блок сервиса добавить:

```yaml
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

(итого 30 MB cap на контейнер).

В `docs/deploy-docker-caddy.md` в разделе **Resource profile** добавить пункт: "Docker logs capped at 30 MB per service (`json-file`, 10m × 3)."

### Проверка

```bash
docker inspect kp-builder-web --format '{{.HostConfig.LogConfig}}'
```

должно показать `{json-file map[max-file:3 max-size:10m]}`.

### Downside / откат

- Старые логи теряются по достижении лимита. Для долгого аудита — внешний логгер (Loki/Promtail). Откат: убрать блок `logging`.

---

## T05 — Убрать лишний запрос proposal при записи view-события

**Категория:** CPU (−1 SELECT при каждом просмотре `/p/[slug]`), latency.
**Файлы:** `src/lib/server/proposal-store.ts`, `src/app/p/[shareSlug]/page.tsx`.

### Контекст
В `src/app/p/[shareSlug]/page.tsx:32` proposal уже загружен. Затем строка 71 вызывает `recordProposalEvent({ proposalId: proposal.id, eventType: "view", ... })`. Внутри `recordProposalEvent` для Supabase-ветки идёт ещё один `await getSupabaseProposalById(supabase, input.proposalId)` ради `proposal.viewsCount + 1` ([src/lib/server/proposal-store.ts:580-589](../src/lib/server/proposal-store.ts)). Это лишний полный select с гидрацией.

### Изменения

1. **Перевести `views_count` инкремент на atomic update.** Заменить блок:

   ```ts
   if (input.eventType === "view") {
     const proposal = await getSupabaseProposalById(supabase, input.proposalId);
     await supabase
       .from("proposals")
       .update({
         views_count: (proposal?.viewsCount ?? 0) + 1,
         last_viewed_at: event.createdAt,
       })
       .eq("id", input.proposalId);
   }
   ```

   на вызов Postgres RPC (предпочтительно) или, если RPC заводить не хочется, на чистый UPDATE с приходящим значением. Рекомендуемый путь — RPC, чтобы избежать гонок:

   В `supabase/schema.sql` добавить функцию:

   ```sql
   create or replace function increment_proposal_view(p_id uuid, p_viewed_at timestamptz)
   returns void
   language sql
   as $$
     update proposals
     set views_count = views_count + 1,
         last_viewed_at = p_viewed_at
     where id = p_id;
   $$;
   ```

   И в TS:

   ```ts
   if (input.eventType === "view") {
     await supabase.rpc("increment_proposal_view", {
       p_id: input.proposalId,
       p_viewed_at: event.createdAt,
     });
   }
   ```

2. **Тип ID.** Если в проекте id — `text`/`varchar`, поменять `uuid` в SQL на тот же тип; свериться с существующими определениями в `supabase/schema.sql`.

3. **Локальная ветка** — без изменений: там инкремент идёт по in-memory объекту, лишних чтений нет.

### Проверка

- На запущенной Supabase: открыть `/p/<slug>` дважды, проверить, что `views_count` увеличился на 2.
- `npm run build` ОК.
- В логах Supabase должно быть **на один SELECT меньше** на каждый view (можно посчитать через `EXPLAIN`/`pg_stat_statements`).

### Downside / откат

- Требуется применить миграцию в Supabase. Если есть пайплайн миграций — добавить в него; если миграции применяются вручную — указать команду в PR-описании.
- Откат: удалить RPC, вернуть прежний код.

---

## T06 — Пагинация списка предложений в дашборде

**Категория:** RAM, CPU (на больших базах).
**Файлы:** `src/lib/server/proposal-store.ts`, `src/app/page.tsx` (или где рендерится дашборд), `src/components/admin/DashboardClient.tsx`.

### Контекст
`listSupabaseProposals` ([src/lib/server/proposal-store.ts:662-673](../src/lib/server/proposal-store.ts)) тянет **все** строки `proposals` без `limit`, затем `hydrateSupabaseProposals` подтягивает все `deliverables/packages/process_steps/proof_items`. На 1000 КП — это десятки тысяч строк за один запрос дашборда.

### Изменения

1. **Сигнатура.** Заменить:

   ```ts
   export async function listProposals()
   ```

   на:

   ```ts
   export async function listProposals(options?: { limit?: number; offset?: number; filter?: ProposalListFilter })
   ```

   - дефолтные значения: `limit = 50`, `offset = 0`.
   - `filter` использует тип из `src/lib/types.ts` (`ProposalListFilter`).
   - Для Supabase: `supabase.from("proposals").select("*", { count: "exact" }).range(offset, offset + limit - 1)` + optional `.eq("status", filter)`.
   - Возвращать `{ items: Proposal[]; total: number }` вместо голого массива.

2. **Лёгкая гидратация для списка.** В дашборде показываются только summary-поля: `title`, `clientCompany`, `status`, `updatedAt`, `viewsCount`, рекомендуемый пакет. Создать второй метод `listProposalSummaries`, который **не** делает `fetchRows` по `deliverables`/`packages`/`process_steps`/`proof_items`, а возвращает только данные из таблицы `proposals` + (если нужно) только `packages` для `getRecommendedPackage`. Если в дашборде `getRecommendedPackage` действительно используется — отдельно подтянуть только `packages` пачкой по списку id, остальное не трогать.

3. **Клиент.** В `DashboardClient.tsx` добавить пагинацию (кнопки "← Назад / Далее →" или infinite scroll). Если не хочется большой UI-работы в этом PR — минимум: показать первые 50 + бэйдж "показано 50 из N" + ссылку "Показать все" с явным `?limit=500` cap.

### Проверка

- В Supabase создать > 60 черновых КП (через duplicate API), убедиться, что дашборд рендерится мгновенно и тянет только 50 строк (проверить вкладкой Network в браузере / Supabase logs).
- Никаких регрессий на маленьких базах (1–10 КП).

### Downside / откат

- UX-работа на клиенте. Если бюджет ограничен — сделать только серверную часть и захардкодить `limit: 100` без UI пагинации; собственно объём списка в текущем демо не критичен.
- Откат: вернуть прежнюю сигнатуру `listProposals()` и сплошной select.

---

## T07 — Заменить `bcryptjs` на native `bcrypt` или `argon2`

**Категория:** CPU (login throughput x3–x5).
**Файлы:** `package.json`, `src/lib/server/proposal-store.ts`, `Dockerfile`.

### Контекст
`bcryptjs` — pure-JS реализация. На rounds=10 (текущее значение в [src/lib/server/proposal-store.ts:263](../src/lib/server/proposal-store.ts)) хеш занимает 200–400 мс в Node. Native `bcrypt` или `argon2` дают тот же уровень безопасности при ~50–80 мс.

**Рекомендация:** `argon2` (winner of PHC, лучше противодействует GPU). Запасной вариант — `bcrypt`.

### Изменения

1. **`package.json`**: убрать `bcryptjs`, добавить `argon2`. `pnpm`-style `overrides`/`resolutions` не нужны.

2. **`Dockerfile`**, стадия `deps`: добавить build-tools для нативной сборки, потому что `argon2` собирается через `node-gyp`:

   ```dockerfile
   RUN apk add --no-cache --virtual .build-deps python3 make g++ \
       && npm ci --prefer-offline --no-audit --no-fund \
       && apk del .build-deps
   ```

   Альтернатива — использовать `argon2`'s prebuilt binaries (если они есть для node 24/alpine 3.23 на момент применения; см. https://github.com/ranisalt/node-argon2/releases — на момент написания обычно есть prebuilds).

3. **`src/lib/server/proposal-store.ts`**:

   ```ts
   import argon2 from "argon2";

   // hash
   proposal.passwordHash = await argon2.hash(payload.password.trim(), {
     type: argon2.argon2id,
   });

   // verify
   const ok = await argon2.verify(proposal.passwordHash, password);
   ```

   **Внимание:** старые хеши, созданные через `bcryptjs`, **не совместимы** с argon2. Нужен путь миграции:
   - Простой вариант: при ближайшем успешном входе через старый bcrypt-хеш — перевычислить и сохранить новый argon2-хеш. Для этого временно держать обе библиотеки и распознавать формат хеша по префиксу (`$2a$`/`$2b$` → bcryptjs; `$argon2id$` → argon2).
   - Радикальный вариант: считать, что старые password-protected КП требуют переустановки пароля (для демо это приемлемо).

### Проверка

- Залогиниться в КП с паролем, выставленным ДО миграции → проверить, что либо работает старый хеш (через переходный путь), либо пользователь видит понятную ошибку с инструкцией.
- Поставить новый пароль, повторно войти — должно работать через argon2.
- Бенчмарк: измерить `console.time` на hash/verify до и после, зафиксировать в PR.

### Downside / откат

- Нативная сборка тянет за собой build-deps в Docker (timeшний build на 30–60 сек). Размер runtime-образа не растёт (build-deps удаляются в той же RUN-строке).
- Не совместим со старыми хешами — нужен переходный путь.
- Откат: вернуть `bcryptjs` и старый код. Хеши, сделанные argon2, останутся в БД нечитаемыми — нужно зачистить вручную.

---

## T08 — Один шрифт вместо двух (или system-ui)

**Категория:** диск (.next/static), сетевой трафик клиента.
**Файлы:** `src/app/layout.tsx`, `src/app/globals.css` (если там есть упоминания `--font-geist-mono`).

### Контекст
`src/app/layout.tsx:10-13` импортирует Geist_Mono. Mono-шрифт в проекте практически не используется (нет блоков кода в UI КП).

### Изменения

1. Удалить из `layout.tsx`:

   ```ts
   const geistMono = Geist_Mono({
     variable: "--font-geist-mono",
     subsets: ["latin"],
   });
   ```

   и убрать `${geistMono.variable}` из className корневого `<html>`.

2. Поискать использования переменной:

   ```bash
   grep -rn "font-geist-mono\|geistMono" src/
   ```

   Если нашлись — заменить на `--font-geist-sans` или удалить.

3. **Опционально (если хочется максимально сэкономить):** убрать и Geist Sans, перейти на `font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;` в `globals.css`. Полностью убирает запрос на Google Fonts и встраивание .woff2 в build.

### Проверка

- `npm run build` ОК.
- Открыть страницы `/`, `/proposal/[id]/edit`, `/p/[slug]` — шрифт читаемый, верстка не съехала.

### Downside / откат

- Косметическая разница в шрифтах для Mono-блоков, если они появятся в будущем.
- Откат: вернуть импорт Geist_Mono.

---

## T09 — Удалить шаблонные SVG из `public/`

**Категория:** диск (косметика, несколько KB).
**Файлы:** `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`.

### Контекст
Артефакты `create-next-app`, в проекте не используются.

### Изменения

1. Проверить, что ни один файл не ссылается на эти svg:

   ```bash
   grep -rn "next.svg\|vercel.svg\|file.svg\|globe.svg\|window.svg" src/ public/
   ```

2. Если grep пуст — удалить пять файлов.

### Проверка

- `npm run build` ОК.
- Дашборд и публичная страница КП открываются без 404 в Network tab.

### Downside / откат

- Нет. `git revert` восстанавливает.

---

## T10 — Расширить `.dockerignore`

**Категория:** диск (build context → быстрее `docker build`, меньше слой builder).
**Файлы:** `.dockerignore`.

### Контекст
Текущий `.dockerignore` уже исключает `.git`, `.next`, `node_modules`, `.data`, `screenshots`, env-файлы. Можно добавить ещё несколько неиспользуемых в runtime артефактов.

### Изменения

В конец `.dockerignore` добавить:

```
# Documentation and dev-only files
docs
*.md
!package.json
supabase
tsconfig.tsbuildinfo
eslint.config.mjs
.github
.vscode
```

**Обоснование по каждому пункту:**
- `docs/` — не нужны runtime'у.
- `*.md` — `README.md`, `AGENTS.md`, `CLAUDE.md` не нужны в образе. Исключение через `!package.json` не нужно, оно только для иллюстрации; на самом деле `.md` уже не матчит `package.json`. Если паттерн `*.md` ломает Next-сборку (некоторые пакеты содержат `README.md` для resolve — крайне редко), удалить эту строку.
- `supabase/schema.sql` — миграции применяются вне контейнера.
- `tsconfig.tsbuildinfo` — артефакт инкрементальной компиляции TS.
- `eslint.config.mjs` — нужен только для `lint`, runtime его не дергает.

### Проверка

```bash
docker build -t kp-builder-test .
docker run --rm kp-builder-test ls -la /app
```

Не должно быть `docs/`, `supabase/`, `*.md` (кроме того, что приехало из node_modules в случае не-standalone — но мы уже в T01 перешли на standalone).

### Downside / откат

- Если кто-то полагается на `README.md` внутри контейнера — отвалится. Никто не полагается.
- Откат: `git revert`.

---

## T11 — Удалить стадию `prod-deps` из Dockerfile (после T01)

**Категория:** диск (build cache), время сборки.
**Файлы:** `Dockerfile`.

### Контекст
В T01 этот шаг уже включён — стадия `prod-deps` удалена, потому что standalone-режим сам копирует только нужные модули в `.next/standalone`. Эта задача — формальная отметка, что после T01 проверено: в `Dockerfile` **не должно** оставаться `FROM ... AS prod-deps` и `COPY --from=prod-deps`.

### Изменения

Если T01 выполнена корректно — изменений нет. Если в репо осталась стадия `prod-deps` — удалить вместе со всем её содержимым.

### Проверка

```bash
grep -n "prod-deps" Dockerfile
```

Должно ничего не вернуть.

### Downside / откат

- Без T01 удалять `prod-deps` нельзя — образ не запустится без `node_modules`. Эта задача делается **только после** T01.

---

## T12 — Зачистить `tsconfig.tsbuildinfo` из репозитория

**Категория:** диск (репо), косметика.
**Файлы:** `tsconfig.tsbuildinfo`, `.gitignore` (проверить).

### Контекст
`.gitignore` уже содержит `*.tsbuildinfo`, но файл лежит в корне (`tsconfig.tsbuildinfo` ≈ 1 MB) — значит, был закоммичен до добавления правила.

### Изменения

```bash
git rm --cached tsconfig.tsbuildinfo
```

Затем убедиться, что `.gitignore` содержит:

```
*.tsbuildinfo
```

(уже есть на строке 50 — проверить).

### Проверка

```bash
git status
git ls-files | grep tsbuildinfo
```

`git ls-files` должен вернуть пусто. `git status` покажет удаление из индекса.

### Downside / откат

- Нет. Файл регенерируется автоматически на `npm run build`.

---

## T13 — `npm ci` с быстрыми флагами

**Категория:** время сборки CI (-2…-10 сек), сеть.
**Файлы:** `Dockerfile`.

### Контекст
Все вызовы `npm ci` в Dockerfile сейчас без флагов. Добавить `--prefer-offline --no-audit --no-fund`. (В T01 это уже включено в новой версии Dockerfile — если T01 выполнена, эта задача автоматически закрыта.)

### Изменения

В Dockerfile все строки `RUN npm ci` заменить на:

```dockerfile
RUN npm ci --prefer-offline --no-audit --no-fund
```

### Проверка

```bash
grep -n "npm ci" Dockerfile
```

Каждая строка должна содержать флаги.

### Downside / откат

- Нет. Флаги не меняют lockfile / поведение.

---

## T14 — keepAlive для Supabase fetch

**Категория:** CPU/latency на сетевых вызовах при высокой нагрузке.
**Файлы:** `src/lib/server/proposal-store.ts`.

### Контекст
`@supabase/supabase-js` использует глобальный `fetch`. По умолчанию каждый запрос — новое TCP-соединение. На Node 20+ можно прокинуть `undici.Agent` с keepAlive, и Supabase будет переиспользовать соединения.

### Изменения

В `getSupabase()` ([src/lib/server/proposal-store.ts:892-917](../src/lib/server/proposal-store.ts)) добавить кастомный `fetch`:

```ts
import { Agent, fetch as undiciFetch } from "undici";

const supabaseAgent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
});

function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...init,
    dispatcher: supabaseAgent,
  } as Parameters<typeof undiciFetch>[1]);
}

// внутри getSupabase():
cachedSupabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: supabaseFetch as unknown as typeof fetch },
});
```

Дополнительно добавить `undici` в `dependencies` (`npm i undici`) — в Node 20/22 он уже встроен, но импортить из `undici` стабильнее, чем полагаться на `globalThis.fetch.dispatcher`.

### Проверка

- Под нагрузкой (`autocannon -d 30 http://127.0.0.1:3005/p/<slug>`) средний RTT по Supabase-запросам должен упасть. Замерить через `pg_stat_activity` или просто на стороне Node.
- `npm run build` ОК.

### Downside / откат

- Лишняя зависимость `undici` (~700 KB), хотя она уже едет с Node.
- Если Supabase rate-limit срабатывает по IP — keepAlive ничего не ухудшает.
- Откат: убрать `global.fetch` из `createClient` и удалить `undici` из deps.

---

## Финальный чек-лист после всех задач

- [ ] `docker image ls` показывает образ < 250 MB.
- [ ] `npm run build` зелёный.
- [ ] `npm run lint` зелёный.
- [ ] `docs/deploy-docker-caddy.md` → **Resource profile** обновлён под новые числа.
- [ ] `docker compose up -d` поднимает контейнер; healthcheck зелёный за 30 сек.
- [ ] `curl -I https://doplist.tsyzhman.ru` → 200.
- [ ] Под нагрузкой 100 RPS на `/p/<slug>` `.data/proposals.json` (если используется local-store) не растёт неограниченно.
- [ ] Логи Docker не превышают 30 MB суммарно.
