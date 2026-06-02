# Деплой PRISMA на doplist.tsyzhman.ru с Caddy и Docker

Инструкция рассчитана на сервер, где Caddy уже установлен и принимает HTTPS-трафик, а PRISMA запускается отдельным Docker-контейнером. Публичный домен: `doplist.tsyzhman.ru`.

Перед деплоем добавь DNS-запись:

```text
doplist.tsyzhman.ru A <server-ip>
```

## Resource profile

Current Docker shape:

- `prisma`: Next.js standalone app on `KP_BUILDER_HOST_PORT` (`3005` by default).
- `kp-builder-data`: local `.data` volume when Supabase is not configured.
- Supabase `proposals` stores CTA redirect fields `approve_url` and `discuss_url`, plus language/currency enum checks for `ru/en` and `RUB/USD/EUR`; apply `supabase/schema.sql` before deploying code that uses Supabase storage.
- Retention/archive work is triggered through the maintenance API endpoint, not a resident Compose worker.
- Runtime starts with `node server.js` from `.next/standalone`; `npm run start` is not used in the container.
- Docker logs are capped at 30 MB per service (`json-file`, `10m` x `3`).
- Password hashes use native Argon2id; Docker installs temporary build tools only in the dependency stage.

Sizing guidance for a polished demo deployment:

- CPU: `0.5-1 vCPU`.
- RAM: `0.4-0.8 GB`.
- Docker image: roughly `150-200 MB` after standalone output tracing.
- Disk: `5-25 GB`, depending on local `.data` use, proposal history, and backups.

If Supabase is used for storage, server disk use is small. Local JSON storage needs regular backup of `kp-builder-data`. On a shared `8 CPU / 12 GB RAM / 120 GB disk` server, this project is safe as a temporary demo next to `fantasy-scout` and `sharovik`; avoid running retention jobs during other heavy builds.

## 0. Подключиться к серверу

Если входишь под `root`:

```bash
ssh root@tsyzhman.ru
```

Если входишь под обычным пользователем:

```bash
ssh nik@tsyzhman.ru
```

Дальше команды можно выполнять на сервере.

## 1. Проверить Docker, Git и Caddy

```bash
docker --version
docker compose version
git --version
caddy version
```

Если Caddy работает как systemd-сервис:

```bash
sudo systemctl status caddy --no-pager
```

## 2. Создать папку проекта

```bash
sudo mkdir -p /var/www/kp-builder
sudo chown -R "$USER":"$USER" /var/www/kp-builder
cd /var/www/kp-builder
```

## 3. Скачать проект

```bash
git clone https://github.com/Tsyzhman/PRISMA.git .
```

Проверить, что код на месте:

```bash
ls -la
git status
```

## 4. Создать production env

```bash
cp .env.example .env.production
```

Сгенерировать секрет для password-cookie:

```bash
openssl rand -hex 32
```

Открыть env:

```bash
nano .env.production
```

Вставить значения:

```env
PROPOSAL_ACCESS_SECRET=PASTE_LONG_RANDOM_SECRET_HERE

# Если Supabase пока не подключаем, оставить пустыми.
# Тогда данные будут храниться в Docker volume /app/.data.
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Сохранить в nano: `Ctrl+O`, `Enter`, `Ctrl+X`.

## 5. Создать docker-compose.yml

```bash
cp docker-compose.example.yml docker-compose.yml
```

Проверить файл:

```bash
cat docker-compose.yml
```

Ожидаемый смысл: контейнер `kp-builder-web` слушает внутри `3000`, а наружу на host отдаётся только `127.0.0.1:3005`.

Если порт `3005` занят, найти свободный:

```bash
sudo ss -ltnp | grep 3005 || true
```

Если занят, открой compose:

```bash
nano docker-compose.yml
```

И поменяй:

```yaml
ports:
  - "127.0.0.1:3005:3000"
```

например на:

```yaml
ports:
  - "127.0.0.1:3017:3000"
```

В Caddy ниже нужно будет использовать тот же порт.

## 6. Собрать и запустить PRISMA

```bash
docker compose up -d --build
```

Проверить контейнер:

```bash
docker compose ps
docker compose logs --tail=100 prisma
curl -I http://127.0.0.1:3005
```

Если порт менял на `3017`, проверка такая:

```bash
curl -I http://127.0.0.1:3017
```

## 7. Добавить PRISMA в Caddy

Сделать backup Caddyfile:

```bash
sudo cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.backup.$(date +%Y%m%d-%H%M%S)"
```

Открыть Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Добавить в конец файла отдельный блок:

```caddyfile
doplist.tsyzhman.ru {
  encode zstd gzip

  @publicProposal path /p/*
  header @publicProposal X-Robots-Tag "noindex, nofollow"

  header {
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
  }

  reverse_proxy 127.0.0.1:3005
}
```

Если в `docker-compose.yml` выбрал порт `3017`, то в Caddy должно быть:

```caddyfile
reverse_proxy 127.0.0.1:3017
```

Сохранить в nano: `Ctrl+O`, `Enter`, `Ctrl+X`.

Проверить Caddyfile:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Перезагрузить Caddy:

```bash
sudo systemctl reload caddy
```

Проверить статус:

```bash
sudo systemctl status caddy --no-pager
```

## 8. Проверить сайт

```bash
curl -I https://doplist.tsyzhman.ru
```

Открыть в браузере:

```text
https://doplist.tsyzhman.ru
```

Публичные КП будут открываться так:

```text
https://doplist.tsyzhman.ru/p/<shareSlug>
```

Например:

```text
https://doplist.tsyzhman.ru/p/cb3QyFDvt4d2jb
```

Caddy не нужно редактировать под каждое новое КП. Все `/p/...` ссылки обрабатывает Next.js внутри PRISMA.

## 9. Обновление после нового коммита

```bash
cd /var/www/kp-builder
git pull
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 prisma
```

Проверить:

```bash
curl -I http://127.0.0.1:3005
curl -I https://doplist.tsyzhman.ru
```

## 10. Посмотреть логи

Логи PRISMA:

```bash
cd /var/www/kp-builder
docker compose logs -f prisma
```

Логи Caddy:

```bash
sudo journalctl -u caddy -f
```

## 11. Остановить или перезапустить PRISMA

Перезапустить:

```bash
cd /var/www/kp-builder
docker compose restart prisma
```

Остановить:

```bash
cd /var/www/kp-builder
docker compose down
```

Запустить снова:

```bash
cd /var/www/kp-builder
docker compose up -d
```

## 12. Backup, если используешь локальное хранилище без Supabase

Посмотреть volume:

```bash
docker volume ls | grep prisma
```

Сделать backup:

```bash
mkdir -p /opt/backups
docker run --rm \
  -v kp-builder-data:/data \
  -v /opt/backups:/backup \
  alpine \
  tar czf /backup/kp-builder-data-$(date +%F).tgz -C /data .
```

Восстановить backup:

```bash
cd /var/www/kp-builder
docker compose down
docker run --rm \
  -v kp-builder-data:/data \
  -v /opt/backups:/backup \
  alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/kp-builder-data-YYYY-MM-DD.tgz -C /data"
docker compose up -d
```

## 13. Если Caddy тоже работает в Docker

Если Caddy не systemd-сервис, а контейнер, то лучше подключить PRISMA к той же Docker network.

Посмотреть контейнер Caddy:

```bash
docker ps
docker inspect caddy --format '{{json .NetworkSettings.Networks}}'
```

Допустим, сеть называется `caddy`. Тогда открой compose:

```bash
cd /var/www/kp-builder
nano docker-compose.yml
```

Замени содержимое на:

```yaml
services:
  prisma:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: kp-builder-web
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
      HOSTNAME: 0.0.0.0
      PORT: 3000
    volumes:
      - kp-builder-data:/app/.data
    networks:
      - caddy

volumes:
  kp-builder-data:

networks:
  caddy:
    external: true
```

Запустить:

```bash
docker compose up -d --build
```

В Caddyfile тогда использовать не `127.0.0.1:3005`, а имя контейнера:

```caddyfile
doplist.tsyzhman.ru {
  encode zstd gzip

  @publicProposal path /p/*
  header @publicProposal X-Robots-Tag "noindex, nofollow"

  reverse_proxy prisma:3000
}
```

## 14. Быстрая диагностика

Контейнер не поднялся:

```bash
cd /var/www/kp-builder
docker compose logs --tail=200 prisma
```

Caddy отдаёт 502:

```bash
curl -I http://127.0.0.1:3005
docker compose ps
sudo journalctl -u caddy --tail=100 --no-pager
```

Порт занят:

```bash
sudo ss -ltnp | grep 3005
```

Не выпускается HTTPS:

```bash
dig +short doplist.tsyzhman.ru
sudo journalctl -u caddy --tail=200 --no-pager
```

Публичная ссылка КП не открывается:

```bash
curl -I https://doplist.tsyzhman.ru/p/YOUR_SHARE_SLUG
```

Проверь в админке PRISMA, что КП опубликовано, не истекло и slug скопирован полностью.
