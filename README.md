# MeTVe – Online Television (Live Stream & Expanded Features Edition)

MeTVe is a WebForms-style virtual interactive TV platform prototype with creator studio controls, live stream tooling, media library folders/search, project advertising, and hardened channel create/save behavior.

## Implemented highlights

- Professional cable-style operator dashboard with TV/Radio preview.
- User account controls: sign up, sign in, sign out.
- Channel lifecycle: create/save/list/clone/archive with optimistic concurrency.
- Reliability fixes for channel creation/saving:
  - API timeout + retry/backoff
  - idempotency and request-correlation headers
  - local fallback store when API is unavailable (create/save still works)
- Socket stability improvements:
  - explicit offline mode when socket URL is not configured
  - reconnect/resubscribe logic when socket is available
- Live Stream Engine panel:
  - low-latency mode selector
  - multi-bitrate profile fields
  - RTMP/HLS/WebRTC outputs and multi-platform targets
  - live analytics snapshot widget
- Media Composer + Library folders:
  - Shows, Movies, Commercials, Bumpers, Songs, Idents, Promos, Graphics
  - local library search
  - drag/drop upload simulation with chunked progress
- Project advertising area for creators.
- Scheduling and smart alerts simulation (filler/free slot/clash examples).

## Files

- `Default.aspx` — main ASPX operator UI.
- `preview.html` — static render copy for screenshot/testing.
- `Content/Site.css` — styling.
- `Scripts/metve-app.js` — frontend runtime and reliability logic.
- `docs/API_CONTRACT.md` — backend contract guidance.
