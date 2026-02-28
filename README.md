# MeTVe – Online Television (WebForms-era foundation)

MeTVe is a browser-based virtual interactive TV platform starter built in a classic ASPX/WebForms style with modern reliability behavior for API and socket connections.

## Delivered foundation

- 2011-style operator console layout (`Default.aspx`) for:
  - Channel creation/save
  - Channel list + clone/archive actions
  - Playout profile controls
  - Media ingest/upload panel
  - Interactive + monetization sections
- Reliability-first runtime (`Scripts/metve-app.js`) for:
  - Persistent channel draft saving in `localStorage`
  - Channel validation before API writes
  - API timeout/retry/backoff and idempotency/correlation headers
  - Socket reconnect, heartbeat response, auto-resubscribe, manual reconnect
  - Channel listing + selection + version-aware save flow
- API guidance (`docs/API_CONTRACT.md`) for stable create/save/list/clone/archive and resumable media uploads.

## Platform goals represented in this update

- Robust channel creation and save lifecycle
- Real-time operator dashboard with socket events
- Cloud-like media management workflow scaffolding
- Scheduling/playout, interactive, graphics and monetization control surface placeholders
- Reliability and failover-minded behavior for unstable networks

## Files

- `Default.aspx`
- `Content/Site.css`
- `Scripts/metve-app.js`
- `docs/API_CONTRACT.md`
