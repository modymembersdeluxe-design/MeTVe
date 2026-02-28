# MeTVe API & Socket Contract (Accounts + Channels + Reliability)

## Authentication

### Sign up
- `POST /api/auth/signup`
- Body: `{ "email": "user@metve.tv", "password": "secret" }`
- Returns: `{ "userId": "usr_123", "email": "user@metve.tv" }`

### Sign in
- `POST /api/auth/signin`
- Body: `{ "email": "user@metve.tv", "password": "secret" }`
- Returns: `{ "token": "jwt_or_session", "userId": "usr_123", "email": "user@metve.tv" }`

## Channels

### Create channel
- `POST /api/channels`
- Headers: `Authorization`, `X-Request-Id`, `X-Idempotency-Key`
- Returns: `{ "channelId": "chn_001", "version": 1, "status": "created" }`

### Save channel
- `PUT /api/channels/{channelId}`
- Headers: `Authorization`, `X-Request-Id`, `X-Idempotency-Key`, `If-Match: <version>`
- Returns: `{ "channelId": "chn_001", "version": 2, "status": "saved" }`

### List/clone/archive
- `GET /api/channels`
- `POST /api/channels/{channelId}/clone`
- `POST /api/channels/{channelId}/archive`

## Media uploads

### Resumable upload
- `POST /api/media/uploads` -> `{ "uploadId": "upl_1", "chunkSize": 5242880, "resumeToken": "..." }`
- `PUT /api/media/uploads/{uploadId}/chunks/{index}`
- `POST /api/media/uploads/{uploadId}/complete`

Media types: video, audio, image, GIF. Suggested categories: shows, movies, commercials, bumpers, songs, idents, promos.

## Socket

- Endpoint: `wss://<host>/socket?token=<authToken>`
- Subscriptions: `channel-status`, `playout-events`, `alerts`, `audience-events`
- Heartbeat: server `ping`, client `{"type":"pong","ts":<ms>}`

## Reliability requirements

- 12s timeout + exponential retry/backoff for HTTP 429/5xx/network failures.
- Idempotency keys for create/save/clone/archive.
- Optimistic concurrency (`If-Match` + version) for channel save.
- Automatic socket reconnect + manual reconnect button.
- Validate channel payload before save to prevent corruption.
