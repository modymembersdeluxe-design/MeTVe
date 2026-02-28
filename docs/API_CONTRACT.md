# MeTVe API & Socket Contract (Live Stream + Reliable Channel Save)

## Authentication

- `POST /api/auth/signup`
- `POST /api/auth/signin`

Signin response: `{ token, userId, email }`.

## Channel management

- `GET /api/channels`
- `POST /api/channels`
- `PUT /api/channels/{channelId}`
- `POST /api/channels/{channelId}/clone`
- `POST /api/channels/{channelId}/archive`

Create/save requirements:
- `Authorization`, `X-Request-Id`, `X-Idempotency-Key`
- Save requires `If-Match` + `version` payload for optimistic concurrency.
- Persist timezone per broadcaster location.
- Persist `channelFormat` values: `all`, `slide-tv`, `video-tv`, `radio-tv`, `vip`, `ringtone-tv`, `chat`, `games`, `other`.

## Live stream engine

Suggested endpoints:
- `POST /api/live/start`
- `POST /api/live/stop`
- `GET /api/live/analytics`

Payload should include output profile, low-latency flag, bitrate ladder, outputs (RTMP/HLS/WebRTC), and multi-platform destinations.

## Library and media data

- `GET /api/library`
- `POST /api/library/{folder}` (`shows`, `movies`, `commercials`, `bumpers`, `songs`, `idents`, `promos`, `graphics`)
- `GET /api/library/search?q=`

Accepted media:
- MP4, MOV, AVI, WMV, MPEG-2, TS, MKV, WebM
- audio, images, GIF
- external references: YouTube, VidLii, Internet Archive, live URLs

## Upload pipeline

- `POST /api/media/uploads` => `{ uploadId, chunkSize, resumeToken }`
- `PUT /api/media/uploads/{uploadId}/chunks/{index}`
- `POST /api/media/uploads/{uploadId}/complete`

## Project advertising board

- `POST /api/projects/ads`
- `GET /api/projects/ads`

## Sockets

- Endpoint: `wss://<host>/socket?token=<authToken>`
- Topics: `channel-status`, `playout-events`, `alerts`, `audience-events`, `live-analytics`
- Heartbeat: server `ping`, client `{"type":"pong","ts":<ms>}`

## Reliability requirements

- 12s timeout + exponential retries for network/429/5xx.
- Idempotency keys on mutating requests.
- Auto reconnect/resubscribe when socket exists.
- Allow client offline mode when socket URL is absent.
- Validate channel payload before save and reject corruption.
- Preserve create/save with local fallback storage when API is temporarily unavailable.


## Interactive and telephony

Suggested endpoints:
- `POST /api/sms/moderation` (approve/reject)
- `POST /api/polls/start` / `POST /api/polls/close`
- `GET /api/polls/results`
- `GET /api/calls/queue`

Use websocket topics for `sms-events`, `poll-events`, and `call-events` to drive real-time OSD.


## Playlist / revenue / quiz

Suggested endpoints:
- `POST /api/playlists/auto-schedule`
- `POST /api/playlists/filler`
- `POST /api/playout/emergency-override`
- `GET /api/revenue/dashboard`
- `POST /api/quiz/round`

Return payloads should include timeline updates, ad break slots, vote counters, and SMS campaign totals for operator dashboards.


## Legacy browser behavior

For 2011-era browser support mode, client can operate in local/offline channel workflow while preserving data in browser storage and syncing when backend APIs are reachable.


## Broadcast automation and certification

Suggested endpoints:
- `POST /api/schedule/snap` (frame-accurate event alignment)
- `POST /api/epg/generate`
- `POST /api/scte/trigger` (`scte104`/`scte35`)
- `POST /api/failover/simulate`
- `POST /api/playback/profile` (codec/scaling/aspect/audio/caption/ip-output)
- `POST /api/logs/certification`

Recommended payload should include channelId, start frame, duration frames, audio channel map, caption track map, and network output targets.


## VS2013 hosting notes

For Visual Studio 2013 + public IIS hosting deployments, configure production API base and socket URLs via environment-aware config/transforms and verify channel create/save + local resync workflows after publish.


## V2 public channel browsing

Suggested endpoints:
- `GET /api/public/channels/featured`
- `GET /api/public/channels/search?q=`
- `POST /api/public/channels`
- `POST /api/public/shows`
- `POST /api/public/projects/advertise`

These endpoints support cable-style front-page browsing, creator uploads, and project promotion workflows in MeTVe V2.
