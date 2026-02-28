# MeTVe API & Socket Contract (Accounts + Creator Studio + Library)

## Authentication

- `POST /api/auth/signup`
- `POST /api/auth/signin`

Signin returns `{ token, userId, email }` and must support persistent user sessions for creator studio access.

## Channel management

- `GET /api/channels`
- `POST /api/channels`
- `PUT /api/channels/{channelId}`
- `POST /api/channels/{channelId}/clone`
- `POST /api/channels/{channelId}/archive`

Create/save requirements:
- Required headers: `Authorization`, `X-Request-Id`, `X-Idempotency-Key`
- Save also requires `If-Match` and versioned body for optimistic concurrency.
- Timezone should be stored per broadcaster location.

## Library folders and assets

Suggested endpoints:
- `GET /api/library`
- `POST /api/library/{folder}` (folders: shows, movies, commercials, bumpers, songs, idents, promos, graphics)
- `GET /api/library/search?q=`

Accepted media:
- Video/audio/images/GIF
- Multi-format video including MP4, MOV, AVI, MPEG-2, TS, MKV, WebM
- External source references (YouTube, VidLii, Internet Archive, live stream URL)

## Upload pipeline (resumable)

- `POST /api/media/uploads` => `{ uploadId, chunkSize, resumeToken }`
- `PUT /api/media/uploads/{uploadId}/chunks/{index}`
- `POST /api/media/uploads/{uploadId}/complete`

## Project advertising board

Suggested endpoints:
- `POST /api/projects/ads`
- `GET /api/projects/ads`

Payload sample: `{ project, link, message, channelId }`

## Sockets

- Endpoint: `wss://<host>/socket?token=<authToken>`
- Topics: `channel-status`, `playout-events`, `alerts`, `audience-events`
- Heartbeat: server `ping` and client `{"type":"pong","ts":<ms>}`

## Reliability requirements

- Timeout budget 12s with retry/backoff for network/429/5xx failures.
- Idempotency keys for mutating endpoints.
- Automatic reconnect + manual reconnect trigger.
- Validate channel payload before save and reject corrupt requests.
