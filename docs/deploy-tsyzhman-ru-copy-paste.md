# Копипастный деплой PRISMA на prisma.tsyzhman.ru

Основная инструкция лежит здесь: [deploy-docker-caddy.md](deploy-docker-caddy.md).

Перед командами проверь DNS: `prisma.tsyzhman.ru` должен быть `A`-записью на IP сервера.

Этот файл оставлен как короткий алиас, чтобы не потеряться:

```bash
ssh root@tsyzhman.ru
sudo mkdir -p /opt/prisma
sudo chown -R "$USER":"$USER" /opt/prisma
cd /opt/prisma
git clone https://github.com/Tsyzhman/PRISMA.git .
cp .env.example .env.production
SECRET="$(openssl rand -hex 32)"
sed -i "s/^PROPOSAL_ACCESS_SECRET=.*/PROPOSAL_ACCESS_SECRET=$SECRET/" .env.production
cp docker-compose.example.yml docker-compose.yml
docker compose up -d --build
curl -I http://127.0.0.1:3007
```

После этого добавь в `/etc/caddy/Caddyfile`:

```caddyfile
prisma.tsyzhman.ru {
  encode zstd gzip

  @publicProposal path /p/*
  header @publicProposal X-Robots-Tag "noindex, nofollow"

  header {
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
  }

  reverse_proxy 127.0.0.1:3007
}
```

И применить:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -I https://prisma.tsyzhman.ru
```

Для полной версии с проверками, backup и вариантом Caddy-in-Docker смотри [deploy-docker-caddy.md](deploy-docker-caddy.md).
