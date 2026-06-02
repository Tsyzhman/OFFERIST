# Telegram retention archive

Сервис автоматически выгружает старые КП в Telegram-чат и удаляет рабочие
данные из БД только после успешной отправки архива.

## Env

```env
PROPOSAL_MAINTENANCE_SECRET=
PROPOSAL_PUBLIC_ORIGIN=https://example.com
TELEGRAM_BOT_TOKEN=
TELEGRAM_ARCHIVE_CHAT_ID=
```

- `PROPOSAL_MAINTENANCE_SECRET` - секрет для cron-запроса. Если не задан,
  используется `PROPOSAL_ACCESS_SECRET`.
- `PROPOSAL_PUBLIC_ORIGIN` - публичный origin сервиса для ссылки на КП в архиве.
- `TELEGRAM_BOT_TOKEN` - токен Telegram-бота.
- `TELEGRAM_ARCHIVE_CHAT_ID` - ID чата или канала архива. Бот должен иметь
  право отправлять сообщения туда.

## Endpoint

```bash
curl -X POST https://example.com/api/maintenance/proposals-retention \
  -H "Authorization: Bearer $PROPOSAL_MAINTENANCE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":25}'
```

Dry run:

```bash
curl -X POST https://example.com/api/maintenance/proposals-retention \
  -H "Authorization: Bearer $PROPOSAL_MAINTENANCE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'
```

## Cron

Для self-hosted сервера достаточно ежедневного cron:

```cron
15 3 * * * curl -fsS -X POST https://example.com/api/maintenance/proposals-retention -H "Authorization: Bearer $PROPOSAL_MAINTENANCE_SECRET" -H "Content-Type: application/json" -d '{"limit":25}'
```

Логика очистки:

1. Берутся КП старше 6 месяцев от `created_at`.
2. КП с `retention_hold = true` пропускаются.
3. Полный текст КП отправляется в Telegram-архив.
4. Если Telegram вернул `message_id` для всех частей, КП удаляется из БД.
5. Если отправка или удаление упали, запись остается и будет повторена позже.

Служебный журнал хранится в `proposal_archive_jobs`; сам текст архива там не
сохраняется.
