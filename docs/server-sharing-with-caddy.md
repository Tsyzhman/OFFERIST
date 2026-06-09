# Публикация PRISMA через Caddy

PRISMA не требует отдельных Caddy-правил для каждой клиентской ссылки. Все адреса вида `/p/[shareSlug]` обрабатывает Next.js, а Caddy только проксирует домен в приложение.

## Базовая схема

```text
Клиент открывает https://doplist.tsyzhman.ru/p/secure-share-slug
        ↓
Caddy принимает HTTPS-запрос
        ↓
Caddy проксирует запрос в Next.js на 127.0.0.1:3005
        ↓
Next.js ищет КП по shareSlug в Supabase
        ↓
Клиент видит опубликованную read-only страницу КП
```

## Пример Caddyfile

```caddyfile
doplist.tsyzhman.ru {
  encode zstd gzip

  @public path /p/* /api/public-events /api/public/* /api/proposal-media/*
  @admin not path /p/* /api/public-events /api/public/* /api/proposal-media/*

  # Временный рубеж до полного выката app-level auth; можно оставить вторым рубежом.
  basic_auth @admin {
    admin <bcrypt-hash>
  }

  header @public X-Robots-Tag "noindex, nofollow"

  header {
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
  }

  reverse_proxy 127.0.0.1:3005
}
```

Публичные страницы также имеют meta `robots: noindex, nofollow` внутри Next.js. Caddy-заголовок выше добавлен как дополнительная защита от индексации клиентских КП.

Хеш для `basic_auth` генерируется на сервере:

```bash
caddy hash-password
```

## Production-запуск Next.js

```bash
npm install
npm run build
npm run start
```

По умолчанию `npm run start` поднимает Next.js на `127.0.0.1:3000` или `0.0.0.0:3000` в зависимости от окружения. Для сервера удобно запускать приложение за process manager или systemd, а Caddy оставлять публичной HTTPS-точкой входа.

## Переменные окружения

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PROPOSAL_ACCESS_SECRET=
PROPOSAL_ADMIN_SECRET=
```

`PROPOSAL_ACCESS_SECRET` нужен для подписанных cookie доступа к КП с паролем. В production его нужно задать длинной случайной строкой.
`PROPOSAL_ADMIN_SECRET` нужен для входа в админку и подписания cookie `prisma_admin`; в production он обязателен.

## Почему не нужны правила под каждую ссылку

Публичная ссылка содержит сложный `shareSlug`, например:

```text
https://doplist.tsyzhman.ru/p/cb3QyFDvt4d2jb
```

Caddy не должен знать, существует ли такой slug. Он передает запрос приложению, а PRISMA уже проверяет:

- КП найдено или нет;
- опубликовано ли оно;
- не истек ли `expiresAt`;
- нужен ли пароль;
- можно ли показать read-only версию клиенту.
