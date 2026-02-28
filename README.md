# MeTVe – Online Television (Web-based Virtual Interactive TV)

This repository contains a classic ASPX/WebForms-era operator console foundation for MeTVe, focused on account access, channel creation, creator studio workflows, media ingest, and reliability for API/socket connectivity.

## Included in this update

- User account area with sign in, sign out, and create-account flows.
- Home + Creator Studio sections for channel operations.
- Channel manager: create/save/list/clone/archive with validation.
- Media ingest panel with drag-and-drop + resumable upload simulation.
- Playout configuration controls (SD/HD/FHD/UHD, live assist, failover profile).
- Reliability-first client runtime:
  - request timeout/retries/backoff
  - idempotency and correlation headers
  - optimistic concurrency for saves
  - socket auto-reconnect and manual reconnect
  - local draft persistence

## Files

- `Default.aspx` — primary ASPX operator console.
- `preview.html` — HTML-renderable page used for local screenshot/testing rendering.
- `Content/Site.css` — visual styling.
- `Scripts/metve-app.js` — client runtime and feature logic.
- `docs/API_CONTRACT.md` — recommended backend contract.
