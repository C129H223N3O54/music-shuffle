# Changelog

All notable changes to Music Shuffle will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.1/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] — 2026-03-27 — Bugfix Release

### Added
- Filter toggle buttons for year range — filters are now off by default, click to activate
- Track tooltips — hover over truncated song/artist/album names to see full text

### Fixed
- Artist cards no longer shrink with many artists — fixed size with scrollbar
- Year filters were always active even when empty

---

## [1.0.1] — 2026-03-26 — Initial Release

### Added
- **Full discography shuffle** — random tracks from entire album catalog, not just top 10
- **Smart Shuffle** — artists not played recently get higher probability
- **Favorite artists** — pin artists for 3× higher play chance
- **Genre lists** — shuffle by genre (150+ genres available)
- **Combo lists** — mix artists and genres in one list
- **Queue** with 2 pre-loaded next songs
- **Play history** — last 20 tracks, clickable to replay
- **Blacklist** — block tracks from being played
- **Crossfade** — smooth volume fade before track end
- **Auto-Skip** — automatically skip tracks shorter than 60 seconds
- **Repeat mode** — loop current track
- **Artist stats** — per-artist play count and top songs (click any artist card)
- **Shuffle log** — track why each song was chosen (Smart Shuffle / Favorite / Random)
- **Similar artists discovery** — find and add related artists
- **"Only new songs"** toggle — skip tracks already in history
- **List management** — create, rename, duplicate, merge, delete lists
- **Import / Export** — backup and restore lists as JSON
- **Cross-device sync** — optional self-hosted Node.js sync server with 3s timeout (works without VPN)
- **Desktop notifications** — song change alert when tab is in background
- **Media Session API** — OS-level media key support (play/pause/next/prev)
- **Spotify Connect** — play on any device (Sonos, speakers, phone, etc.)
- **PWA** — installable on mobile and desktop
- **Fullscreen mode** — press F for immersive view
- **Dynamic album art background** — blurred cover with color-matched shadow glow
- **Statistics dashboard** — plays, listening time, shuffles, top artists, top songs, weekly chart
- **Multilingual** — German and English, switchable via button
- **In-app changelog** — version button opens changelog modal
- **Keyboard shortcuts** — full keyboard control
- **Dark theme** — Spotify-inspired UI
- **Responsive design** — works on mobile and desktop
- **Track tooltips** — hover over truncated song/artist/album names to see full text
- **24h album cache** — reduces Spotify API calls significantly

---

*Future versions will be listed here as the project evolves.*
