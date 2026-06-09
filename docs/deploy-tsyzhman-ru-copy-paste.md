# Копипастный деплой PRISMA на doplist.tsyzhman.ru

Основная инструкция лежит здесь: [deploy-docker-caddy.md](deploy-docker-caddy.md).

Перед командами проверь DNS: `doplist.tsyzhman.ru` должен быть `A`-записью на IP сервера.

Этот файл оставлен как короткий алиас, чтобы не потеряться:

```bash
ssh root@tsyzhman.ru
sudo mkdir -p /var/www/kp-builder
sudo chown -R "$USER":"$USER" /var/www/kp-builder
cd /var/www/kp-builder
git clone https://github.com/Tsyzhman/PRISMA.git .
cp .env.example .env.production
ACCESS_SECRET="$(openssl rand -hex 32)"
ADMIN_SECRET="$(openssl rand -hex 32)"
sed -i "s/^PROPOSAL_ACCESS_SECRET=.*/PROPOSAL_ACCESS_SECRET=$ACCESS_SECRET/" .env.production
sed -i "s/^PROPOSAL_ADMIN_SECRET=.*/PROPOSAL_ADMIN_SECRET=$ADMIN_SECRET/" .env.production
cp docker-compose.example.yml docker-compose.yml
docker compose up -d --build
curl -I http://127.0.0.1:3005
```

После этого сгенерируй `basic_auth` hash через `caddy hash-password` и добавь в `/etc/caddy/Caddyfile`:

```caddyfile
doplist.tsyzhman.ru {
  encode zstd gzip

  @public path /p/* /api/public-events /api/public/* /api/proposal-media/*
  @admin not path /p/* /api/public-events /api/public/* /api/proposal-media/*

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

И применить:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -I https://doplist.tsyzhman.ru
curl -I https://doplist.tsyzhman.ru/p/YOUR_SHARE_SLUG
```

Для полной версии с проверками, backup и вариантом Caddy-in-Docker смотри [deploy-docker-caddy.md](deploy-docker-caddy.md).
