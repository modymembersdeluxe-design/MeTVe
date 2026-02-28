# MeTVe – Online Television (Interactive Cable-Style Web Platform)

MeTVe is a WebForms-era operator console starter that now includes account sign-in, creator studio channel controls, TV/radio preview layout, searchable media library folders, and project advertising panel features.

## New feature highlights

- Interactive cable-style UI with TV/Radio preview screen.
- User account actions: sign in, sign out, create account.
- Creator Studio channel lifecycle: create/save/list/clone/archive.
- Design controls: channel theme, language, ticker text, timezone by broadcaster location.
- Media Composer library folders:
  - Shows, Movies, Commercials, Bumpers, Songs, Idents, Promos, Graphics/Images/GIFs.
- Library search for folder media entries.
- Project advertising page section for creators to publish their own project promos.
- Scheduling and alert panel (video blocks, fillers, fixed-time clips, clash/free-slot alerts).
- Reliability-first runtime:
  - API timeout + retry/backoff + idempotency
  - optimistic concurrency for channel save
  - socket reconnect/resubscribe + manual reconnect
  - local draft persistence and resumable upload simulation

## Files

- `Default.aspx` — main ASPX operator console.
- `preview.html` — static render copy used for screenshot/testing.
- `Content/Site.css` — dashboard styling.
- `Scripts/metve-app.js` — frontend app runtime.
- `docs/API_CONTRACT.md` — suggested backend contract.
