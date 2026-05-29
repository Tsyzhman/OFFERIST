# Публикация OFFERIST через Caddy

OFFERIST не требует отдельных Caddy-правил для каждой клиентской ссылки. Все адреса вида `/p/[shareSlug]` обрабатывает Next.js, а Caddy только проксирует домен в приложение.

## Базовая схема

```text
Клиент открывает https://offers.example.ru/p/secure-share-slug
        ↓
Caddy принимает HTTPS-запрос
        ↓
Caddy проксирует запрос в Next.js на 127.0.0.1:3000
        ↓
Next.js ищет КП по shareSlug в Supabase
        ↓
Клиент видит опубликованную read-only страницу КП
```

## Пример Caddyfile

```caddyfile
offers.example.ru {
  encode zstd gzip

  @publicProposal path /p/*
  header @publicProposal X-Robots-Tag "noindex, nofollow"

  header {
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
  }

  reverse_proxy 127.0.0.1:3000
}
```

Публичные страницы также имеют meta `robots: noindex, nofollow` внутри Next.js. Caddy-заголовок выше добавлен как дополнительная защита от индексации клиентских КП.

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
```

`PROPOSAL_ACCESS_SECRET` нужен для подписанных cookie доступа к КП с паролем. В production его нужно задать длинной случайной строкой.

## Почему не нужны правила под каждую ссылку

Публичная ссылка содержит сложный `shareSlug`, например:

```text
https://offers.example.ru/p/cb3QyFDvt4d2jb
```

Caddy не должен знать, существует ли такой slug. Он передает запрос приложению, а OFFERIST уже проверяет:

- КП найдено или нет;
- опубликовано ли оно;
- не истек ли `expiresAt`;
- нужен ли пароль;
- можно ли показать read-only версию клиенту.

