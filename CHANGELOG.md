# Changelog

All notable changes to Music Shuffle will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.2/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] — 2026-04-03 — Sync & Filter Release

### Added
- **Stats sync** — play statistics (plays, shuffle count) are now stored on the sync server and shared across all devices
- **Server-side album cache** — Spotify album data is cached on the sync server after the first fetch; subsequent app starts load from cache instead of hitting the Spotify API (24h TTL, eliminates cold-start 429 errors)
- **Instrumental filter** — per-list toggle to hide tracks containing "instrumental", "karaoke", "backing track", "playback", "(inst" or "inst." in the track name
- **`syncStats` config flag** — set `syncStats: false` in `config.js` to keep play statistics local even when a sync server is configured

### Changed
- **Spotify 429 handling** — up to 3 retries (was 1) with full `Retry-After` wait between each attempt
- **Rate limit recovery** — after exhausting retries, app automatically retries shuffle after 35 seconds instead of stopping playback silently
- **`fillQueue` delay** — increased from 5s to 20s after first track to give server cache time to load on startup
- **Stats sync debounce** — stats are synced to server 30 seconds after the last play (not per song, not tied to list sync)
- **Sync server `/api/health`** — response now includes `plays` count in addition to `lists`

### Sync Server
- New endpoint `GET /api/stats` — load play statistics
- New endpoint `POST /api/stats` — save play statistics
- New endpoint `GET /api/cache` — load full album cache
- New endpoint `POST /api/cache` — store single artist album cache entry
- New data files: `stats.json`, `cache.json` (separate from `lists.json`)

---

## [1.1.2] — 2026-03-29 — Cleanup & Balance Release

### Added
- Artist section header with count — "🎤 Künstler (31)" above artist grid
- Album section now shows count — "🎵 Alben (2)"
- Section headers switch language with DE/EN toggle

### Changed
- Artist pool weight increased to 3× vs albums (1×) — prevents single albums from dominating shuffle
- Complete code rewrite — app.js reduced from 3039 to ~1900 lines (−37%)
- spotify-api.js reduced from 651 to 300 lines (−54%)
- Startup API calls delayed to reduce 429 rate limiting on page load
- Device auto-refresh every 2 minutes (was 30 seconds)
- Player state polling every 15 seconds (was 5 seconds)

### Fixed
- fillQueue referenced undefined variable — next track now always works
- duplicateActiveList now correctly copies albums
- Dead code removed (Like section, unused functions)
- Sync helper consolidated into single request method

---

## [1.2.0] — 2026-04-03 — Sync & Filter Release

### Added
- **Stats sync** — play statistics (plays, shuffle count) are now stored on the sync server and shared across all devices
- **Server-side album cache** — Spotify album data is cached on the sync server after the first fetch; subsequent app starts load from cache instead of hitting the Spotify API (24h TTL, eliminates cold-start 429 errors)
- **Instrumental filter** — per-list toggle to hide tracks containing "instrumental", "karaoke", "backing track", "playback", "(inst" or "inst." in the track name
- **`syncStats` config flag** — set `syncStats: false` in `config.js` to keep play statistics local even when a sync server is configured

### Changed
- **Spotify 429 handling** — up to 3 retries (was 1) with full `Retry-After` wait between each attempt
- **Rate limit recovery** — after exhausting retries, app automatically retries shuffle after 35 seconds instead of stopping playback silently
- **`fillQueue` delay** — increased from 5s to 20s after first track to give server cache time to load on startup
- **Stats sync debounce** — stats are synced to server 30 seconds after the last play (not per song, not tied to list sync)
- **Sync server `/api/health`** — response now includes `plays` count in addition to `lists`

### Sync Server
- New endpoint `GET /api/stats` — load play statistics
- New endpoint `POST /api/stats` — save play statistics
- New endpoint `GET /api/cache` — load full album cache
- New endpoint `POST /api/cache` — store single artist album cache entry
- New data files: `stats.json`, `cache.json` (separate from `lists.json`)

---

## [1.1.2] — 2026-03-29 — Bugfix Release

### Fixed
- Shuffle now truly random across all sources — artists, albums and genres in one equal pool
- Albums-only lists now work correctly (no "no artists" error)
- Skip now instant when queue has tracks — no delay
- Empty queue falls back to direct shuffle instead of waiting

### Changed
- Each artist and album has equal chance of being picked (1 entry each in pool)
- Artists with more albums naturally provide more variety when selected
- Smart Shuffle still applies — artists not played recently get higher weight

---

## [1.2.0] — 2026-04-03 — Sync & Filter Release

### Added
- **Stats sync** — play statistics (plays, shuffle count) are now stored on the sync server and shared across all devices
- **Server-side album cache** — Spotify album data is cached on the sync server after the first fetch; subsequent app starts load from cache instead of hitting the Spotify API (24h TTL, eliminates cold-start 429 errors)
- **Instrumental filter** — per-list toggle to hide tracks containing "instrumental", "karaoke", "backing track", "playback", "(inst" or "inst." in the track name
- **`syncStats` config flag** — set `syncStats: false` in `config.js` to keep play statistics local even when a sync server is configured

### Changed
- **Spotify 429 handling** — up to 3 retries (was 1) with full `Retry-After` wait between each attempt
- **Rate limit recovery** — after exhausting retries, app automatically retries shuffle after 35 seconds instead of stopping playback silently
- **`fillQueue` delay** — increased from 5s to 20s after first track to give server cache time to load on startup
- **Stats sync debounce** — stats are synced to server 30 seconds after the last play (not per song, not tied to list sync)
- **Sync server `/api/health`** — response now includes `plays` count in addition to `lists`

### Sync Server
- New endpoint `GET /api/stats` — load play statistics
- New endpoint `POST /api/stats` — save play statistics
- New endpoint `GET /api/cache` — load full album cache
- New endpoint `POST /api/cache` — store single artist album cache entry
- New data files: `stats.json`, `cache.json` (separate from `lists.json`)

---

## [1.1.2] — 2026-03-28 — Mobile & Albums Release

### Added
- **Album support** — add individual albums to lists via artist discography browser
- **Album search** — search for an artist and browse their discography without adding the artist
- **Album section** — albums shown in a separate section below artists, sorted alphabetically
- **Mobile mini player** — play/pause, next track and shuffle button at bottom of sidebar on mobile
- **Mobile device selector** — choose Spotify Connect device directly on mobile
- **Mobile shuffle button** — large shuffle button visible on mobile without needing the player view
- **iOS support (partial)** — app fully usable on iPhone for list management and remote control of other devices (Sonos, PC, etc.)
- **Sync timeout** — sync server requests timeout after 3 seconds, app works without VPN/NAS access
- **Track tooltips** — hover over truncated song/artist/album names to see full text
- **Top songs expandable** — "Show all" button in stats to see complete song history

### Changed
- Artist grid switched from 3 to 2 columns — larger images, more breathing room
- Artist grid sorted alphabetically
- Filter toggle buttons for year range — filters off by default, click to activate
- App path changed from `/spotify-shuffle/` to `/music-shuffle/`
- Album cache TTL increased to 24 hours
- API throttle increased to 1 request per second
- Sync debounce increased to 3 seconds

### Fixed
- Artist cards no longer shrink with many artists — fixed size with scrollbar
- iOS scrolling improved with momentum scrolling
- Bottom sheet menu for list options (iOS compatible)
- Mobile layout no longer has invisible player blocking taps

---

## [1.2.0] — 2026-04-03 — Sync & Filter Release

### Added
- **Stats sync** — play statistics (plays, shuffle count) are now stored on the sync server and shared across all devices
- **Server-side album cache** — Spotify album data is cached on the sync server after the first fetch; subsequent app starts load from cache instead of hitting the Spotify API (24h TTL, eliminates cold-start 429 errors)
- **Instrumental filter** — per-list toggle to hide tracks containing "instrumental", "karaoke", "backing track", "playback", "(inst" or "inst." in the track name
- **`syncStats` config flag** — set `syncStats: false` in `config.js` to keep play statistics local even when a sync server is configured

### Changed
- **Spotify 429 handling** — up to 3 retries (was 1) with full `Retry-After` wait between each attempt
- **Rate limit recovery** — after exhausting retries, app automatically retries shuffle after 35 seconds instead of stopping playback silently
- **`fillQueue` delay** — increased from 5s to 20s after first track to give server cache time to load on startup
- **Stats sync debounce** — stats are synced to server 30 seconds after the last play (not per song, not tied to list sync)
- **Sync server `/api/health`** — response now includes `plays` count in addition to `lists`

### Sync Server
- New endpoint `GET /api/stats` — load play statistics
- New endpoint `POST /api/stats` — save play statistics
- New endpoint `GET /api/cache` — load full album cache
- New endpoint `POST /api/cache` — store single artist album cache entry
- New data files: `stats.json`, `cache.json` (separate from `lists.json`)

---

## [1.1.2] — 2026-03-27 — Bugfix Release

### Added
- Artist grid now sorted alphabetically

### Changed
- Artist grid switched from 3 to 2 columns — larger images, more breathing room

---

## [1.2.0] — 2026-04-03 — Sync & Filter Release

### Added
- **Stats sync** — play statistics (plays, shuffle count) are now stored on the sync server and shared across all devices
- **Server-side album cache** — Spotify album data is cached on the sync server after the first fetch; subsequent app starts load from cache instead of hitting the Spotify API (24h TTL, eliminates cold-start 429 errors)
- **Instrumental filter** — per-list toggle to hide tracks containing "instrumental", "karaoke", "backing track", "playback", "(inst" or "inst." in the track name
- **`syncStats` config flag** — set `syncStats: false` in `config.js` to keep play statistics local even when a sync server is configured

### Changed
- **Spotify 429 handling** — up to 3 retries (was 1) with full `Retry-After` wait between each attempt
- **Rate limit recovery** — after exhausting retries, app automatically retries shuffle after 35 seconds instead of stopping playback silently
- **`fillQueue` delay** — increased from 5s to 20s after first track to give server cache time to load on startup
- **Stats sync debounce** — stats are synced to server 30 seconds after the last play (not per song, not tied to list sync)
- **Sync server `/api/health`** — response now includes `plays` count in addition to `lists`

### Sync Server
- New endpoint `GET /api/stats` — load play statistics
- New endpoint `POST /api/stats` — save play statistics
- New endpoint `GET /api/cache` — load full album cache
- New endpoint `POST /api/cache` — store single artist album cache entry
- New data files: `stats.json`, `cache.json` (separate from `lists.json`)

---

## [1.1.2] — 2026-03-27 — Bugfix Release

### Added
- Filter toggle buttons for year range — filters are now off by default, click to activate
- Track tooltips — hover over truncated song/artist/album names to see full text

### Fixed
- Artist cards no longer shrink with many artists — fixed size with scrollbar
- Year filters were always active even when empty

---

## [1.2.0] — 2026-04-03 — Sync & Filter Release

### Added
- **Stats sync** — play statistics (plays, shuffle count) are now stored on the sync server and shared across all devices
- **Server-side album cache** — Spotify album data is cached on the sync server after the first fetch; subsequent app starts load from cache instead of hitting the Spotify API (24h TTL, eliminates cold-start 429 errors)
- **Instrumental filter** — per-list toggle to hide tracks containing "instrumental", "karaoke", "backing track", "playback", "(inst" or "inst." in the track name
- **`syncStats` config flag** — set `syncStats: false` in `config.js` to keep play statistics local even when a sync server is configured

### Changed
- **Spotify 429 handling** — up to 3 retries (was 1) with full `Retry-After` wait between each attempt
- **Rate limit recovery** — after exhausting retries, app automatically retries shuffle after 35 seconds instead of stopping playback silently
- **`fillQueue` delay** — increased from 5s to 20s after first track to give server cache time to load on startup
- **Stats sync debounce** — stats are synced to server 30 seconds after the last play (not per song, not tied to list sync)
- **Sync server `/api/health`** — response now includes `plays` count in addition to `lists`

### Sync Server
- New endpoint `GET /api/stats` — load play statistics
- New endpoint `POST /api/stats` — save play statistics
- New endpoint `GET /api/cache` — load full album cache
- New endpoint `POST /api/cache` — store single artist album cache entry
- New data files: `stats.json`, `cache.json` (separate from `lists.json`)

---

## [1.1.2] — 2026-03-26 — Initial Release

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
