# PRISMA

PRISMA — коммерческие предложения по приватной ссылке.

PRISMA помогает собирать коммерческие предложения, публиковать их по приватной клиентской ссылке и фиксировать просмотры/действия без лишних персональных данных.

## Команды

```bash
npm install
npm run dev
npm run build
npm run start
```

## Supabase

Если Supabase env не задан, приложение использует локальное серверное хранилище `.data/proposals.json`. Для production подключите Supabase:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PROPOSAL_ACCESS_SECRET=
```

SQL-схема и русские demo data лежат в [supabase/schema.sql](supabase/schema.sql).

## Caddy

Для Caddy не нужны правила под каждую клиентскую ссылку. Достаточно один раз проксировать домен в Next.js:

```caddyfile
doplist.tsyzhman.ru {
  encode zstd gzip

  @publicProposal path /p/*
  header @publicProposal X-Robots-Tag "noindex, nofollow"

  reverse_proxy 127.0.0.1:3007
}
```

Полный пример: [Caddyfile.example](Caddyfile.example). Пошаговый деплой: [docs/deploy-docker-caddy.md](docs/deploy-docker-caddy.md). Подробности по ссылкам: [docs/server-sharing-with-caddy.md](docs/server-sharing-with-caddy.md).

## Роуты

- `/` - dashboard со списком КП
- `/proposal/new` - создание КП
- `/proposal/[id]/edit` - редактирование КП
- `/proposal/[id]/preview` - внутренний preview
- `/p/[shareSlug]` - публичная клиентская страница
- `/p/[shareSlug]/password` - доступ к КП по паролю

## Цветовая система

Интерфейс использует тёмную B2B-палитру по мотивам `isty.ist`:

- `#020b14` - основной фон
- `#8e44ad` - основной акцент
- `#e67e22` - тёплый акцент
- `#ecf0f1` - светлая поверхность
