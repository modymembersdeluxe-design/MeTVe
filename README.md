# MeTVe – Online Television (Live Stream & Expanded Features Edition)

MeTVe is a WebForms-style virtual interactive TV platform prototype with creator studio controls, live stream tooling, media library folders/search, project advertising, hardened channel create/save behavior, and 2011-era legacy browser mode support, including an expanded V2 online user home/channels/library/reliability experience.

## Implemented highlights

- Professional cable-style operator dashboard with TV/Radio preview and channel-format targeting (Slide TV, Video TV, Radio TV, VIP, Ringtone TV, Chat, Games, Other, All).
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
- Creator Freedom Hub: create channels, promote/advertise projects and channels, entertain viewers, and run cable-style experiences freely.
- Expanded MeTVe menu system: top legacy nav + quick-menu shortcuts for channel creation, go-live, media upload, promotion, monitoring logs, and local sync actions.
- Reliability & Sync Center: API/socket health, pending local channel count, and one-click local resync controls.
- MeTVe Mega Capabilities menu panel covering playout, graphics, interactive, distribution, and AI moderation operations.
- MeTVe V2 online TV page: expanded online user homepage, classic account login/sign-in flow, create/save channel management with API-first + local fallback, support for Slide TV/Video TV/Radio TV/VIP/Ringtone TV/Chat/Games/Other/All formats, TV Guide planner, media creator studio library management with folder batch actions (Shows/Movies/Commercials/Bumpers/Songs/Idents/Promos), channel and library search, project advertising page, API/socket reliability monitor with manual reconnect, and a new 2011 nostalgia FX panel with glow/ticker presets.
- Drag-and-drop playlist editor with filler/auto-schedule/emergency actions.
- Revenue dashboard simulation (SMS, ads, votes, subscriptions) and quiz round trigger.
- Hotkey-ready control-room presets (`Alt+1` chat, `Alt+2` clip, `Alt+3` ad).
- Broadcast automation extension: frame-accurate snap scheduling, auto-EPG generation, SCTE trigger simulation, traffic ingest hooks, and flover simulation.
- Playback/network extension: codec profile controls, aspect/scaling profile, up to 16 audio channels, caption mode, and UDP/RTMP/SRT/NDI output profile.
- Scheduling and smart alerts simulation (filler/free slot/clash examples).
- Advanced legacy-era modules: OSD/lower thirds, SMS moderation, poll/winner workflows, IVR/call queue simulation, scene presets (chat/clip/ad), and emergency text override.
- Broadcast compatibility placeholders: SDI/Composite, PAL/NTSC, safe-area guides, legacy 4:3 style controls.

## Files

- `Default.aspx` — main ASPX operator UI.
- `MeTVeV2.aspx` — new Visual Studio 2013 ASP.NET Web Application V2 page for public hosting profile.
- `MeTVeV2.preview.html` — static V2 preview page with interactive cable-style channel browsing and creator flows.
- `Scripts/metve-v2.js` — V2 runtime for channel browse/search, library item creation, and project advertising feed.
- `preview.html` — static render copy for screenshot/testing.
- `Content/Site.css` — styling.
- `Scripts/metve-app.js` — modern frontend runtime and reliability logic.
- `Scripts/metve-legacy.js` — ES5 legacy runtime for older browsers (IE9+/old engines).
- `docs/API_CONTRACT.md` — backend contract guidance.
