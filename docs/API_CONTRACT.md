# MeTVe Channel Reliability API Contract

This contract is designed for stable channel create/save lifecycle, resilient sockets, and web-based operator workflows.

## 1) Channels API

### Create channel

`POST /api/channels`

Headers:
- `X-Request-Id`: unique per request
- `X-Idempotency-Key`: deterministic key (`create-{slug}`)

Body:

```json
{
  "name": "Retro Movies",
  "slug": "retro-movies",
  "mode": "public",
  "outputProfile": "HD",
  "timezone": "UTC",
  "brandingTheme": "Classic Cable",
  "language": "en-US"
}
```

Response `201`:

```json
{
  "channelId": "chn_8f8b2",
  "version": 1,
  "status": "created"
}
```

### Save channel

`PUT /api/channels/{channelId}`

Headers:
- `X-Request-Id`
- `X-Idempotency-Key`
- `If-Match: <version>`

Body includes schedule/settings and previous version.

Response `200`:

```json
{
  "channelId": "chn_8f8b2",
  "version": 2,
  "status": "saved"
}
```

### List/clone/archive channel

- `GET /api/channels` for channel grid/list refresh.
- `POST /api/channels/{channelId}/clone` to duplicate branding/schedule profiles.
- `POST /api/channels/{channelId}/archive` to move channel to archive state.

## 2) Media API

### Resumable upload session

- `POST /api/media/uploads` returns `uploadId`, chunk size, resume token.
- `PUT /api/media/uploads/{uploadId}/chunks/{index}` uploads chunks with retry.
- `POST /api/media/uploads/{uploadId}/complete` finalizes and triggers transcode.

Returned media payload should include detected format, duration, resolution, and catalog category.

## 3) Sockets

Endpoint: `wss://<host>/socket`

Supported messages:

```json
{"type":"subscribe","topic":"channel-status"}
{"type":"channel-status","channelId":"chn_8f8b2","state":"on-air"}
{"type":"alert","level":"warning","text":"Primary source unavailable, switched to backup"}
```

Heartbeat:
- server emits `ping`
- client responds with `{"type":"pong","ts":1710000000}`

## 4) Reliability checklist

- API timeout budget: 12s with retry/backoff for 429/5xx/network failures.
- Persist local channel draft in browser storage before create/save.
- Exponential socket reconnect + auto-resubscribe.
- Return structured error bodies with correlation ids.
- Enforce optimistic concurrency with version checks to prevent channel corruption.
