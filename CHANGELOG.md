# Changelog

All notable changes to Music Shuffle will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.2/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.5.0] — 2026-06-19 — Compact Menus & API Fixes

### Added
- **Compact list dropdown** — clicking the list name now opens a slim dropdown positioned right below it, instead of a full-width bottom sheet. Each entry shows its item count (artists + albums). Click outside to close.
- **Compact options menu** — the three-dot options button (rename, duplicate, merge, export, import, delete) now opens a compact right-aligned dropdown instead of a full-width sheet
- **Combined list counter** — the count next to the list name now includes both artists and albums (was artists only)

### Changed
- **`market` parameter** — API requests now use the account's actual country code (fetched from `/me` and cached) instead of the deprecated `market=from_token`, which Spotify has begun rejecting with HTTP 400

### Removed
- **Genre shuffle** — Spotify has restricted track search (`type=track`) for Development Mode apps without Extended Quota. Requests return HTTP 400 with a misleading `"Invalid limit"` message; the real cause is missing catalog access for personal apps. As with the "Similar Artists" feature removed in v1.4.0, this is a deliberate Spotify platform restriction and cannot be fixed on our end. The genre search field and genre-based shuffling have been removed. Existing genre entries in lists are preserved as data but ignored.

---

## [1.4.2] — 2026-06-18 — Token Handling & Fixes

### Changed
- **Spotify refresh token expiry handling** — starting July 20, 2026, Spotify refresh tokens expire after 6 months. The app now detects the `invalid_grant` error on token refresh, discards the stored token without retrying, and redirects the user to sign in again. No data is lost — lists, stats, blacklist and track history all live on the sync server.

### Fixed
- **Artist card modal** — clicking an artist card opens the album/track-status modal again; it was blocked by leftover `discoverBtn` references from the Discovery removal in v1.4.0, which threw a JavaScript error on click
- **Progress bar thumb** — the draggable thumb now follows the playback position correctly instead of sticking to the right edge (CSS `right: 0` conflicted with the JS-set `left` value)

---

## [1.4.1] — 2026-05-18 — Light Mode & Restore

### Added
- **Light mode** — full light theme using Sideforge Anvil palette; follows `prefers-color-scheme` automatically; manually overridable via 🌙/☀️ toggle button in the sidebar header; preference saved to `localStorage`
- **Last track restore** — the last played track (cover, title, artist, album, progress) is shown on app open after browser restart; pressing Play starts the track from the beginning
- **Clear track history button** — red 🗑️ History button in the Stats tab clears the entire `artistTrackHistory` immediately, both locally and on the sync server

### Changed
- **Player buttons** — hover state now shows Ember orange color + glow instead of gray background; applies to all control buttons (repeat, volume, blacklist, notifications, round robin, etc.)
- **Play/Pause button** — hover shows Ember orange; idle state is neutral (was always orange)
- **Sidebar** — right edge now has rounded corners (`border-radius: 0 var(--radius-lg) var(--radius-lg) 0`)
- **Track artist and album name** below cover — switched from `var(--text2)`/`var(--text3)` to `var(--text)`/`var(--text2)` for better contrast in light mode

---

## [1.4.0] — 2026-05-09 — Cache & History Release

### Added
- **Track status tab** in album browser — click an artist card and switch to the "📊 Track Status" tab to see all tracks with ✅ played or 🔒 locked status, plus a progress counter (e.g. "12 / 34 played")
- **Server-side track cache** — album track lists are now cached on the sync server (`/api/tracks`, `tracks.json`); after the first playthrough all track requests are served from cache — no more cold-start 429 errors
- **Track history sync** — the per-artist played-track history is synced across devices via the sync server (`/api/track-history`, `track-history.json`); merged on load so no plays are lost
- **Track history persistence** — `artistTrackHistory` is now saved to `localStorage` and survives browser restarts and page reloads
- **"No track repeats" filter** (per list) — toggle to enable/disable the artist track lock; when active, each track is only repeated after the full discography has been played; default: on
- **PWA icons updated** — all icon sizes (96, 128, 192, 512px) regenerated with the Sideforge SF monogram logo

### Changed
- **Discovery (Similar Artists) removed** — Spotify has permanently restricted the `/artists/{id}/related-artists` endpoint for Development Mode apps; the button, modal and all related code have been removed
- **Live filter** now also checks track names for unambiguous patterns (` live`, `(live`, `- live`, `live at `, `live in `) to catch tracks like "Song Title - Live, at Wacken 2015" without false positives on song titles containing the word "live"
- **`manifest.json` theme color** updated to Ember Orange `#E8600A` (was Spotify teal)
- **DEPLOYMENT.md** — completely rewritten for current file structure including `sideforge-tokens.css`
- **CONTRIBUTING.md** — completely rewritten; documents Sideforge Design System, all sync server endpoints, and known Spotify API limitations
- **SYNC-SERVER.md** — completely rewritten; documents all 6 data files and endpoints including new `/api/tracks` and `/api/track-history`

### Sync Server
- New endpoint `GET/POST /api/tracks` — album track cache, stored in `tracks.json`
- New endpoint `GET/POST /api/track-history` — per-artist played track history, stored in `track-history.json`

---

## [1.3.3] — 2026-04-25 — Sideforge & Blacklist Sync

### Added
- **Sideforge Design System** — migrated from Spotify-green to the Sideforge Ember/Anvil palette; warm orange accents, warm grayscale backgrounds
- **Sideforge logo** (SF monogram) in sidebar header, left of the version button
- **Sideforge favicon** — SVG favicon with SF monogram replaces the vinyl+dice icon
- **Blacklist sync** — blacklisted tracks are now synced across all devices via the sync server (merged on load, 10s debounce on save)
- **Sync server `/api/blacklist`** — `GET` and `POST` endpoints, stored in `/data/blacklist.json`
- **Verdana UI font** (Sideforge Design System v1.0.1) — replaces Syne + DM Sans; no webfont download, consistent look on Windows/macOS/Linux

### Changed
- **Google Fonts removed** — no more external font requests on page load; app works fully offline
- **Sync server `/api/health`** — now also returns `blacklist` count
- **Blacklist sync merge logic** — local entries not present on the server are preserved on load

---

## [1.3.2] — 2026-04-25 — Sideforge v1.0.1 — Verdana

### Changed
- **Font migrated to Verdana** (Sideforge Design System v1.0.1) — `Verdana, Geneva, "DejaVu Sans", Tahoma, sans-serif` replaces Syne + DM Sans across all UI elements
- **Google Fonts removed** — no more external font requests on page load; faster startup, works fully offline
- Logo font (Georgia italic bold) unchanged — intentional contrast, per Sideforge spec
- Mono areas (`font-family: monospace`) unchanged

---

## [1.3.1] — 2026-04-22 — Album Blacklist

### Added
- **Album blacklist button** — new button in player secondary controls (💿, next to the track blacklist button) that adds all tracks of the currently playing album to the blacklist at once; shows a toast with the count of added tracks and skips to the next song automatically

### Fixed
- Album ID is now stored in `currentTrack` state — this was required for the album blacklist feature to work correctly

---

## [1.3.0] — 2026-04-22 — Filter & Shuffle Release

### Added
- **Acoustic filter** — per-list toggle to hide tracks with "acoustic", "unplugged", "stripped", "acoustique", "akustik" in track or album name
- **Orchestral filter** — per-list toggle to hide tracks with "orchestral" in track or album name
- **Artist repeat limit** — configurable per list: set how many tracks must play between repeats of the same artist (default: 3, range: 1–50)
- **Blacklist button in history** — 🚫 button directly on every history entry, no keyboard shortcut needed
- **Round Robin mode** — player button that cycles through all artists one by one in a randomly shuffled order; reshuffles when all artists have played once
- **Per-artist track lock** — tracks are never repeated for an artist until the entire discography has been played; auto-resets when exhausted

### Changed
- **Live filter** now checks track name in addition to album name — tracks like "Song - Live, at Wacken, 2015" are now correctly filtered (uses precise patterns like " live", "- live", "live at ", "live in " to avoid false positives on song titles containing "live")
- **Artist cooldown after Round Robin** — when Round Robin is deactivated, the last 5 played artists are locked for 5 songs to prevent immediate repeats
- **fillQueue in Round Robin** now uses the same shared artist queue and index as doShuffle — no more out-of-order artist picks in the pre-loaded queue

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

## [1.5.0] — 2026-06-19 — Compact Menus & API Fixes

### Added
- **Compact list dropdown** — clicking the list name now opens a slim dropdown positioned right below it, instead of a full-width bottom sheet. Each entry shows its item count (artists + albums). Click outside to close.
- **Compact options menu** — the three-dot options button (rename, duplicate, merge, export, import, delete) now opens a compact right-aligned dropdown instead of a full-width sheet
- **Combined list counter** — the count next to the list name now includes both artists and albums (was artists only)

### Changed
- **`market` parameter** — API requests now use the account's actual country code (fetched from `/me` and cached) instead of the deprecated `market=from_token`, which Spotify has begun rejecting with HTTP 400

### Removed
- **Genre shuffle** — Spotify has restricted track search (`type=track`) for Development Mode apps without Extended Quota. Requests return HTTP 400 with a misleading `"Invalid limit"` message; the real cause is missing catalog access for personal apps. As with the "Similar Artists" feature removed in v1.4.0, this is a deliberate Spotify platform restriction and cannot be fixed on our end. The genre search field and genre-based shuffling have been removed. Existing genre entries in lists are preserved as data but ignored.

---

## [1.4.2] — 2026-06-18 — Token Handling & Fixes

### Changed
- **Spotify refresh token expiry handling** — starting July 20, 2026, Spotify refresh tokens expire after 6 months. The app now detects the `invalid_grant` error on token refresh, discards the stored token without retrying, and redirects the user to sign in again. No data is lost — lists, stats, blacklist and track history all live on the sync server.

### Fixed
- **Artist card modal** — clicking an artist card opens the album/track-status modal again; it was blocked by leftover `discoverBtn` references from the Discovery removal in v1.4.0, which threw a JavaScript error on click
- **Progress bar thumb** — the draggable thumb now follows the playback position correctly instead of sticking to the right edge (CSS `right: 0` conflicted with the JS-set `left` value)

---

## [1.4.1] — 2026-05-18 — Light Mode & Restore

### Added
- **Light mode** — full light theme using Sideforge Anvil palette; follows `prefers-color-scheme` automatically; manually overridable via 🌙/☀️ toggle button in the sidebar header; preference saved to `localStorage`
- **Last track restore** — the last played track (cover, title, artist, album, progress) is shown on app open after browser restart; pressing Play starts the track from the beginning
- **Clear track history button** — red 🗑️ History button in the Stats tab clears the entire `artistTrackHistory` immediately, both locally and on the sync server

### Changed
- **Player buttons** — hover state now shows Ember orange color + glow instead of gray background; applies to all control buttons (repeat, volume, blacklist, notifications, round robin, etc.)
- **Play/Pause button** — hover shows Ember orange; idle state is neutral (was always orange)
- **Sidebar** — right edge now has rounded corners (`border-radius: 0 var(--radius-lg) var(--radius-lg) 0`)
- **Track artist and album name** below cover — switched from `var(--text2)`/`var(--text3)` to `var(--text)`/`var(--text2)` for better contrast in light mode

---

## [1.4.0] — 2026-05-09 — Cache & History Release

### Added
- **Track status tab** in album browser — click an artist card and switch to the "📊 Track Status" tab to see all tracks with ✅ played or 🔒 locked status, plus a progress counter (e.g. "12 / 34 played")
- **Server-side track cache** — album track lists are now cached on the sync server (`/api/tracks`, `tracks.json`); after the first playthrough all track requests are served from cache — no more cold-start 429 errors
- **Track history sync** — the per-artist played-track history is synced across devices via the sync server (`/api/track-history`, `track-history.json`); merged on load so no plays are lost
- **Track history persistence** — `artistTrackHistory` is now saved to `localStorage` and survives browser restarts and page reloads
- **"No track repeats" filter** (per list) — toggle to enable/disable the artist track lock; when active, each track is only repeated after the full discography has been played; default: on
- **PWA icons updated** — all icon sizes (96, 128, 192, 512px) regenerated with the Sideforge SF monogram logo

### Changed
- **Discovery (Similar Artists) removed** — Spotify has permanently restricted the `/artists/{id}/related-artists` endpoint for Development Mode apps; the button, modal and all related code have been removed
- **Live filter** now also checks track names for unambiguous patterns (` live`, `(live`, `- live`, `live at `, `live in `) to catch tracks like "Song Title - Live, at Wacken 2015" without false positives on song titles containing the word "live"
- **`manifest.json` theme color** updated to Ember Orange `#E8600A` (was Spotify teal)
- **DEPLOYMENT.md** — completely rewritten for current file structure including `sideforge-tokens.css`
- **CONTRIBUTING.md** — completely rewritten; documents Sideforge Design System, all sync server endpoints, and known Spotify API limitations
- **SYNC-SERVER.md** — completely rewritten; documents all 6 data files and endpoints including new `/api/tracks` and `/api/track-history`

### Sync Server
- New endpoint `GET/POST /api/tracks` — album track cache, stored in `tracks.json`
- New endpoint `GET/POST /api/track-history` — per-artist played track history, stored in `track-history.json`

---

## [1.3.3] — 2026-04-25 — Sideforge & Blacklist Sync

### Added
- **Sideforge Design System** — migrated from Spotify-green to the Sideforge Ember/Anvil palette; warm orange accents, warm grayscale backgrounds
- **Sideforge logo** (SF monogram) in sidebar header, left of the version button
- **Sideforge favicon** — SVG favicon with SF monogram replaces the vinyl+dice icon
- **Blacklist sync** — blacklisted tracks are now synced across all devices via the sync server (merged on load, 10s debounce on save)
- **Sync server `/api/blacklist`** — `GET` and `POST` endpoints, stored in `/data/blacklist.json`
- **Verdana UI font** (Sideforge Design System v1.0.1) — replaces Syne + DM Sans; no webfont download, consistent look on Windows/macOS/Linux

### Changed
- **Google Fonts removed** — no more external font requests on page load; app works fully offline
- **Sync server `/api/health`** — now also returns `blacklist` count
- **Blacklist sync merge logic** — local entries not present on the server are preserved on load

---

## [1.3.2] — 2026-04-25 — Sideforge v1.0.1 — Verdana

### Changed
- **Font migrated to Verdana** (Sideforge Design System v1.0.1) — `Verdana, Geneva, "DejaVu Sans", Tahoma, sans-serif` replaces Syne + DM Sans across all UI elements
- **Google Fonts removed** — no more external font requests on page load; faster startup, works fully offline
- Logo font (Georgia italic bold) unchanged — intentional contrast, per Sideforge spec
- Mono areas (`font-family: monospace`) unchanged

---

## [1.3.1] — 2026-04-22 — Album Blacklist

### Added
- **Album blacklist button** — new button in player secondary controls (💿, next to the track blacklist button) that adds all tracks of the currently playing album to the blacklist at once; shows a toast with the count of added tracks and skips to the next song automatically

### Fixed
- Album ID is now stored in `currentTrack` state — this was required for the album blacklist feature to work correctly

---

## [1.3.0] — 2026-04-22 — Filter & Shuffle Release

### Added
- **Acoustic filter** — per-list toggle to hide tracks with "acoustic", "unplugged", "stripped", "acoustique", "akustik" in track or album name
- **Orchestral filter** — per-list toggle to hide tracks with "orchestral" in track or album name
- **Artist repeat limit** — configurable per list: set how many tracks must play between repeats of the same artist (default: 3, range: 1–50)
- **Blacklist button in history** — 🚫 button directly on every history entry, no keyboard shortcut needed
- **Round Robin mode** — player button that cycles through all artists one by one in a randomly shuffled order; reshuffles when all artists have played once
- **Per-artist track lock** — tracks are never repeated for an artist until the entire discography has been played; auto-resets when exhausted

### Changed
- **Live filter** now checks track name in addition to album name — tracks like "Song - Live, at Wacken, 2015" are now correctly filtered (uses precise patterns like " live", "- live", "live at ", "live in " to avoid false positives on song titles containing "live")
- **Artist cooldown after Round Robin** — when Round Robin is deactivated, the last 5 played artists are locked for 5 songs to prevent immediate repeats
- **fillQueue in Round Robin** now uses the same shared artist queue and index as doShuffle — no more out-of-order artist picks in the pre-loaded queue

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

## [1.5.0] — 2026-06-19 — Compact Menus & API Fixes

### Added
- **Compact list dropdown** — clicking the list name now opens a slim dropdown positioned right below it, instead of a full-width bottom sheet. Each entry shows its item count (artists + albums). Click outside to close.
- **Compact options menu** — the three-dot options button (rename, duplicate, merge, export, import, delete) now opens a compact right-aligned dropdown instead of a full-width sheet
- **Combined list counter** — the count next to the list name now includes both artists and albums (was artists only)

### Changed
- **`market` parameter** — API requests now use the account's actual country code (fetched from `/me` and cached) instead of the deprecated `market=from_token`, which Spotify has begun rejecting with HTTP 400

### Removed
- **Genre shuffle** — Spotify has restricted track search (`type=track`) for Development Mode apps without Extended Quota. Requests return HTTP 400 with a misleading `"Invalid limit"` message; the real cause is missing catalog access for personal apps. As with the "Similar Artists" feature removed in v1.4.0, this is a deliberate Spotify platform restriction and cannot be fixed on our end. The genre search field and genre-based shuffling have been removed. Existing genre entries in lists are preserved as data but ignored.

---

## [1.4.2] — 2026-06-18 — Token Handling & Fixes

### Changed
- **Spotify refresh token expiry handling** — starting July 20, 2026, Spotify refresh tokens expire after 6 months. The app now detects the `invalid_grant` error on token refresh, discards the stored token without retrying, and redirects the user to sign in again. No data is lost — lists, stats, blacklist and track history all live on the sync server.

### Fixed
- **Artist card modal** — clicking an artist card opens the album/track-status modal again; it was blocked by leftover `discoverBtn` references from the Discovery removal in v1.4.0, which threw a JavaScript error on click
- **Progress bar thumb** — the draggable thumb now follows the playback position correctly instead of sticking to the right edge (CSS `right: 0` conflicted with the JS-set `left` value)

---

## [1.4.1] — 2026-05-18 — Light Mode & Restore

### Added
- **Light mode** — full light theme using Sideforge Anvil palette; follows `prefers-color-scheme` automatically; manually overridable via 🌙/☀️ toggle button in the sidebar header; preference saved to `localStorage`
- **Last track restore** — the last played track (cover, title, artist, album, progress) is shown on app open after browser restart; pressing Play starts the track from the beginning
- **Clear track history button** — red 🗑️ History button in the Stats tab clears the entire `artistTrackHistory` immediately, both locally and on the sync server

### Changed
- **Player buttons** — hover state now shows Ember orange color + glow instead of gray background; applies to all control buttons (repeat, volume, blacklist, notifications, round robin, etc.)
- **Play/Pause button** — hover shows Ember orange; idle state is neutral (was always orange)
- **Sidebar** — right edge now has rounded corners (`border-radius: 0 var(--radius-lg) var(--radius-lg) 0`)
- **Track artist and album name** below cover — switched from `var(--text2)`/`var(--text3)` to `var(--text)`/`var(--text2)` for better contrast in light mode

---

## [1.4.0] — 2026-05-09 — Cache & History Release

### Added
- **Track status tab** in album browser — click an artist card and switch to the "📊 Track Status" tab to see all tracks with ✅ played or 🔒 locked status, plus a progress counter (e.g. "12 / 34 played")
- **Server-side track cache** — album track lists are now cached on the sync server (`/api/tracks`, `tracks.json`); after the first playthrough all track requests are served from cache — no more cold-start 429 errors
- **Track history sync** — the per-artist played-track history is synced across devices via the sync server (`/api/track-history`, `track-history.json`); merged on load so no plays are lost
- **Track history persistence** — `artistTrackHistory` is now saved to `localStorage` and survives browser restarts and page reloads
- **"No track repeats" filter** (per list) — toggle to enable/disable the artist track lock; when active, each track is only repeated after the full discography has been played; default: on
- **PWA icons updated** — all icon sizes (96, 128, 192, 512px) regenerated with the Sideforge SF monogram logo

### Changed
- **Discovery (Similar Artists) removed** — Spotify has permanently restricted the `/artists/{id}/related-artists` endpoint for Development Mode apps; the button, modal and all related code have been removed
- **Live filter** now also checks track names for unambiguous patterns (` live`, `(live`, `- live`, `live at `, `live in `) to catch tracks like "Song Title - Live, at Wacken 2015" without false positives on song titles containing the word "live"
- **`manifest.json` theme color** updated to Ember Orange `#E8600A` (was Spotify teal)
- **DEPLOYMENT.md** — completely rewritten for current file structure including `sideforge-tokens.css`
- **CONTRIBUTING.md** — completely rewritten; documents Sideforge Design System, all sync server endpoints, and known Spotify API limitations
- **SYNC-SERVER.md** — completely rewritten; documents all 6 data files and endpoints including new `/api/tracks` and `/api/track-history`

### Sync Server
- New endpoint `GET/POST /api/tracks` — album track cache, stored in `tracks.json`
- New endpoint `GET/POST /api/track-history` — per-artist played track history, stored in `track-history.json`

---

## [1.3.3] — 2026-04-25 — Sideforge & Blacklist Sync

### Added
- **Sideforge Design System** — migrated from Spotify-green to the Sideforge Ember/Anvil palette; warm orange accents, warm grayscale backgrounds
- **Sideforge logo** (SF monogram) in sidebar header, left of the version button
- **Sideforge favicon** — SVG favicon with SF monogram replaces the vinyl+dice icon
- **Blacklist sync** — blacklisted tracks are now synced across all devices via the sync server (merged on load, 10s debounce on save)
- **Sync server `/api/blacklist`** — `GET` and `POST` endpoints, stored in `/data/blacklist.json`
- **Verdana UI font** (Sideforge Design System v1.0.1) — replaces Syne + DM Sans; no webfont download, consistent look on Windows/macOS/Linux

### Changed
- **Google Fonts removed** — no more external font requests on page load; app works fully offline
- **Sync server `/api/health`** — now also returns `blacklist` count
- **Blacklist sync merge logic** — local entries not present on the server are preserved on load

---

## [1.3.2] — 2026-04-25 — Sideforge v1.0.1 — Verdana

### Changed
- **Font migrated to Verdana** (Sideforge Design System v1.0.1) — `Verdana, Geneva, "DejaVu Sans", Tahoma, sans-serif` replaces Syne + DM Sans across all UI elements
- **Google Fonts removed** — no more external font requests on page load; faster startup, works fully offline
- Logo font (Georgia italic bold) unchanged — intentional contrast, per Sideforge spec
- Mono areas (`font-family: monospace`) unchanged

---

## [1.3.1] — 2026-04-22 — Album Blacklist

### Added
- **Album blacklist button** — new button in player secondary controls (💿, next to the track blacklist button) that adds all tracks of the currently playing album to the blacklist at once; shows a toast with the count of added tracks and skips to the next song automatically

### Fixed
- Album ID is now stored in `currentTrack` state — this was required for the album blacklist feature to work correctly

---

## [1.3.0] — 2026-04-22 — Filter & Shuffle Release

### Added
- **Acoustic filter** — per-list toggle to hide tracks with "acoustic", "unplugged", "stripped", "acoustique", "akustik" in track or album name
- **Orchestral filter** — per-list toggle to hide tracks with "orchestral" in track or album name
- **Artist repeat limit** — configurable per list: set how many tracks must play between repeats of the same artist (default: 3, range: 1–50)
- **Blacklist button in history** — 🚫 button directly on every history entry, no keyboard shortcut needed
- **Round Robin mode** — player button that cycles through all artists one by one in a randomly shuffled order; reshuffles when all artists have played once
- **Per-artist track lock** — tracks are never repeated for an artist until the entire discography has been played; auto-resets when exhausted

### Changed
- **Live filter** now checks track name in addition to album name — tracks like "Song - Live, at Wacken, 2015" are now correctly filtered (uses precise patterns like " live", "- live", "live at ", "live in " to avoid false positives on song titles containing "live")
- **Artist cooldown after Round Robin** — when Round Robin is deactivated, the last 5 played artists are locked for 5 songs to prevent immediate repeats
- **fillQueue in Round Robin** now uses the same shared artist queue and index as doShuffle — no more out-of-order artist picks in the pre-loaded queue

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

## [1.5.0] — 2026-06-19 — Compact Menus & API Fixes

### Added
- **Compact list dropdown** — clicking the list name now opens a slim dropdown positioned right below it, instead of a full-width bottom sheet. Each entry shows its item count (artists + albums). Click outside to close.
- **Compact options menu** — the three-dot options button (rename, duplicate, merge, export, import, delete) now opens a compact right-aligned dropdown instead of a full-width sheet
- **Combined list counter** — the count next to the list name now includes both artists and albums (was artists only)

### Changed
- **`market` parameter** — API requests now use the account's actual country code (fetched from `/me` and cached) instead of the deprecated `market=from_token`, which Spotify has begun rejecting with HTTP 400

### Removed
- **Genre shuffle** — Spotify has restricted track search (`type=track`) for Development Mode apps without Extended Quota. Requests return HTTP 400 with a misleading `"Invalid limit"` message; the real cause is missing catalog access for personal apps. As with the "Similar Artists" feature removed in v1.4.0, this is a deliberate Spotify platform restriction and cannot be fixed on our end. The genre search field and genre-based shuffling have been removed. Existing genre entries in lists are preserved as data but ignored.

---

## [1.4.2] — 2026-06-18 — Token Handling & Fixes

### Changed
- **Spotify refresh token expiry handling** — starting July 20, 2026, Spotify refresh tokens expire after 6 months. The app now detects the `invalid_grant` error on token refresh, discards the stored token without retrying, and redirects the user to sign in again. No data is lost — lists, stats, blacklist and track history all live on the sync server.

### Fixed
- **Artist card modal** — clicking an artist card opens the album/track-status modal again; it was blocked by leftover `discoverBtn` references from the Discovery removal in v1.4.0, which threw a JavaScript error on click
- **Progress bar thumb** — the draggable thumb now follows the playback position correctly instead of sticking to the right edge (CSS `right: 0` conflicted with the JS-set `left` value)

---

## [1.4.1] — 2026-05-18 — Light Mode & Restore

### Added
- **Light mode** — full light theme using Sideforge Anvil palette; follows `prefers-color-scheme` automatically; manually overridable via 🌙/☀️ toggle button in the sidebar header; preference saved to `localStorage`
- **Last track restore** — the last played track (cover, title, artist, album, progress) is shown on app open after browser restart; pressing Play starts the track from the beginning
- **Clear track history button** — red 🗑️ History button in the Stats tab clears the entire `artistTrackHistory` immediately, both locally and on the sync server

### Changed
- **Player buttons** — hover state now shows Ember orange color + glow instead of gray background; applies to all control buttons (repeat, volume, blacklist, notifications, round robin, etc.)
- **Play/Pause button** — hover shows Ember orange; idle state is neutral (was always orange)
- **Sidebar** — right edge now has rounded corners (`border-radius: 0 var(--radius-lg) var(--radius-lg) 0`)
- **Track artist and album name** below cover — switched from `var(--text2)`/`var(--text3)` to `var(--text)`/`var(--text2)` for better contrast in light mode

---

## [1.4.0] — 2026-05-09 — Cache & History Release

### Added
- **Track status tab** in album browser — click an artist card and switch to the "📊 Track Status" tab to see all tracks with ✅ played or 🔒 locked status, plus a progress counter (e.g. "12 / 34 played")
- **Server-side track cache** — album track lists are now cached on the sync server (`/api/tracks`, `tracks.json`); after the first playthrough all track requests are served from cache — no more cold-start 429 errors
- **Track history sync** — the per-artist played-track history is synced across devices via the sync server (`/api/track-history`, `track-history.json`); merged on load so no plays are lost
- **Track history persistence** — `artistTrackHistory` is now saved to `localStorage` and survives browser restarts and page reloads
- **"No track repeats" filter** (per list) — toggle to enable/disable the artist track lock; when active, each track is only repeated after the full discography has been played; default: on
- **PWA icons updated** — all icon sizes (96, 128, 192, 512px) regenerated with the Sideforge SF monogram logo

### Changed
- **Discovery (Similar Artists) removed** — Spotify has permanently restricted the `/artists/{id}/related-artists` endpoint for Development Mode apps; the button, modal and all related code have been removed
- **Live filter** now also checks track names for unambiguous patterns (` live`, `(live`, `- live`, `live at `, `live in `) to catch tracks like "Song Title - Live, at Wacken 2015" without false positives on song titles containing the word "live"
- **`manifest.json` theme color** updated to Ember Orange `#E8600A` (was Spotify teal)
- **DEPLOYMENT.md** — completely rewritten for current file structure including `sideforge-tokens.css`
- **CONTRIBUTING.md** — completely rewritten; documents Sideforge Design System, all sync server endpoints, and known Spotify API limitations
- **SYNC-SERVER.md** — completely rewritten; documents all 6 data files and endpoints including new `/api/tracks` and `/api/track-history`

### Sync Server
- New endpoint `GET/POST /api/tracks` — album track cache, stored in `tracks.json`
- New endpoint `GET/POST /api/track-history` — per-artist played track history, stored in `track-history.json`

---

## [1.3.3] — 2026-04-25 — Sideforge & Blacklist Sync

### Added
- **Sideforge Design System** — migrated from Spotify-green to the Sideforge Ember/Anvil palette; warm orange accents, warm grayscale backgrounds
- **Sideforge logo** (SF monogram) in sidebar header, left of the version button
- **Sideforge favicon** — SVG favicon with SF monogram replaces the vinyl+dice icon
- **Blacklist sync** — blacklisted tracks are now synced across all devices via the sync server (merged on load, 10s debounce on save)
- **Sync server `/api/blacklist`** — `GET` and `POST` endpoints, stored in `/data/blacklist.json`
- **Verdana UI font** (Sideforge Design System v1.0.1) — replaces Syne + DM Sans; no webfont download, consistent look on Windows/macOS/Linux

### Changed
- **Google Fonts removed** — no more external font requests on page load; app works fully offline
- **Sync server `/api/health`** — now also returns `blacklist` count
- **Blacklist sync merge logic** — local entries not present on the server are preserved on load

---

## [1.3.2] — 2026-04-25 — Sideforge v1.0.1 — Verdana

### Changed
- **Font migrated to Verdana** (Sideforge Design System v1.0.1) — `Verdana, Geneva, "DejaVu Sans", Tahoma, sans-serif` replaces Syne + DM Sans across all UI elements
- **Google Fonts removed** — no more external font requests on page load; faster startup, works fully offline
- Logo font (Georgia italic bold) unchanged — intentional contrast, per Sideforge spec
- Mono areas (`font-family: monospace`) unchanged

---

## [1.3.1] — 2026-04-22 — Album Blacklist

### Added
- **Album blacklist button** — new button in player secondary controls (💿, next to the track blacklist button) that adds all tracks of the currently playing album to the blacklist at once; shows a toast with the count of added tracks and skips to the next song automatically

### Fixed
- Album ID is now stored in `currentTrack` state — this was required for the album blacklist feature to work correctly

---

## [1.3.0] — 2026-04-22 — Filter & Shuffle Release

### Added
- **Acoustic filter** — per-list toggle to hide tracks with "acoustic", "unplugged", "stripped", "acoustique", "akustik" in track or album name
- **Orchestral filter** — per-list toggle to hide tracks with "orchestral" in track or album name
- **Artist repeat limit** — configurable per list: set how many tracks must play between repeats of the same artist (default: 3, range: 1–50)
- **Blacklist button in history** — 🚫 button directly on every history entry, no keyboard shortcut needed
- **Round Robin mode** — player button that cycles through all artists one by one in a randomly shuffled order; reshuffles when all artists have played once
- **Per-artist track lock** — tracks are never repeated for an artist until the entire discography has been played; auto-resets when exhausted

### Changed
- **Live filter** now checks track name in addition to album name — tracks like "Song - Live, at Wacken, 2015" are now correctly filtered (uses precise patterns like " live", "- live", "live at ", "live in " to avoid false positives on song titles containing "live")
- **Artist cooldown after Round Robin** — when Round Robin is deactivated, the last 5 played artists are locked for 5 songs to prevent immediate repeats
- **fillQueue in Round Robin** now uses the same shared artist queue and index as doShuffle — no more out-of-order artist picks in the pre-loaded queue

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

## [1.5.0] — 2026-06-19 — Compact Menus & API Fixes

### Added
- **Compact list dropdown** — clicking the list name now opens a slim dropdown positioned right below it, instead of a full-width bottom sheet. Each entry shows its item count (artists + albums). Click outside to close.
- **Compact options menu** — the three-dot options button (rename, duplicate, merge, export, import, delete) now opens a compact right-aligned dropdown instead of a full-width sheet
- **Combined list counter** — the count next to the list name now includes both artists and albums (was artists only)

### Changed
- **`market` parameter** — API requests now use the account's actual country code (fetched from `/me` and cached) instead of the deprecated `market=from_token`, which Spotify has begun rejecting with HTTP 400

### Removed
- **Genre shuffle** — Spotify has restricted track search (`type=track`) for Development Mode apps without Extended Quota. Requests return HTTP 400 with a misleading `"Invalid limit"` message; the real cause is missing catalog access for personal apps. As with the "Similar Artists" feature removed in v1.4.0, this is a deliberate Spotify platform restriction and cannot be fixed on our end. The genre search field and genre-based shuffling have been removed. Existing genre entries in lists are preserved as data but ignored.

---

## [1.4.2] — 2026-06-18 — Token Handling & Fixes

### Changed
- **Spotify refresh token expiry handling** — starting July 20, 2026, Spotify refresh tokens expire after 6 months. The app now detects the `invalid_grant` error on token refresh, discards the stored token without retrying, and redirects the user to sign in again. No data is lost — lists, stats, blacklist and track history all live on the sync server.

### Fixed
- **Artist card modal** — clicking an artist card opens the album/track-status modal again; it was blocked by leftover `discoverBtn` references from the Discovery removal in v1.4.0, which threw a JavaScript error on click
- **Progress bar thumb** — the draggable thumb now follows the playback position correctly instead of sticking to the right edge (CSS `right: 0` conflicted with the JS-set `left` value)

---

## [1.4.1] — 2026-05-18 — Light Mode & Restore

### Added
- **Light mode** — full light theme using Sideforge Anvil palette; follows `prefers-color-scheme` automatically; manually overridable via 🌙/☀️ toggle button in the sidebar header; preference saved to `localStorage`
- **Last track restore** — the last played track (cover, title, artist, album, progress) is shown on app open after browser restart; pressing Play starts the track from the beginning
- **Clear track history button** — red 🗑️ History button in the Stats tab clears the entire `artistTrackHistory` immediately, both locally and on the sync server

### Changed
- **Player buttons** — hover state now shows Ember orange color + glow instead of gray background; applies to all control buttons (repeat, volume, blacklist, notifications, round robin, etc.)
- **Play/Pause button** — hover shows Ember orange; idle state is neutral (was always orange)
- **Sidebar** — right edge now has rounded corners (`border-radius: 0 var(--radius-lg) var(--radius-lg) 0`)
- **Track artist and album name** below cover — switched from `var(--text2)`/`var(--text3)` to `var(--text)`/`var(--text2)` for better contrast in light mode

---

## [1.4.0] — 2026-05-09 — Cache & History Release

### Added
- **Track status tab** in album browser — click an artist card and switch to the "📊 Track Status" tab to see all tracks with ✅ played or 🔒 locked status, plus a progress counter (e.g. "12 / 34 played")
- **Server-side track cache** — album track lists are now cached on the sync server (`/api/tracks`, `tracks.json`); after the first playthrough all track requests are served from cache — no more cold-start 429 errors
- **Track history sync** — the per-artist played-track history is synced across devices via the sync server (`/api/track-history`, `track-history.json`); merged on load so no plays are lost
- **Track history persistence** — `artistTrackHistory` is now saved to `localStorage` and survives browser restarts and page reloads
- **"No track repeats" filter** (per list) — toggle to enable/disable the artist track lock; when active, each track is only repeated after the full discography has been played; default: on
- **PWA icons updated** — all icon sizes (96, 128, 192, 512px) regenerated with the Sideforge SF monogram logo

### Changed
- **Discovery (Similar Artists) removed** — Spotify has permanently restricted the `/artists/{id}/related-artists` endpoint for Development Mode apps; the button, modal and all related code have been removed
- **Live filter** now also checks track names for unambiguous patterns (` live`, `(live`, `- live`, `live at `, `live in `) to catch tracks like "Song Title - Live, at Wacken 2015" without false positives on song titles containing the word "live"
- **`manifest.json` theme color** updated to Ember Orange `#E8600A` (was Spotify teal)
- **DEPLOYMENT.md** — completely rewritten for current file structure including `sideforge-tokens.css`
- **CONTRIBUTING.md** — completely rewritten; documents Sideforge Design System, all sync server endpoints, and known Spotify API limitations
- **SYNC-SERVER.md** — completely rewritten; documents all 6 data files and endpoints including new `/api/tracks` and `/api/track-history`

### Sync Server
- New endpoint `GET/POST /api/tracks` — album track cache, stored in `tracks.json`
- New endpoint `GET/POST /api/track-history` — per-artist played track history, stored in `track-history.json`

---

## [1.3.3] — 2026-04-25 — Sideforge & Blacklist Sync

### Added
- **Sideforge Design System** — migrated from Spotify-green to the Sideforge Ember/Anvil palette; warm orange accents, warm grayscale backgrounds
- **Sideforge logo** (SF monogram) in sidebar header, left of the version button
- **Sideforge favicon** — SVG favicon with SF monogram replaces the vinyl+dice icon
- **Blacklist sync** — blacklisted tracks are now synced across all devices via the sync server (merged on load, 10s debounce on save)
- **Sync server `/api/blacklist`** — `GET` and `POST` endpoints, stored in `/data/blacklist.json`
- **Verdana UI font** (Sideforge Design System v1.0.1) — replaces Syne + DM Sans; no webfont download, consistent look on Windows/macOS/Linux

### Changed
- **Google Fonts removed** — no more external font requests on page load; app works fully offline
- **Sync server `/api/health`** — now also returns `blacklist` count
- **Blacklist sync merge logic** — local entries not present on the server are preserved on load

---

## [1.3.2] — 2026-04-25 — Sideforge v1.0.1 — Verdana

### Changed
- **Font migrated to Verdana** (Sideforge Design System v1.0.1) — `Verdana, Geneva, "DejaVu Sans", Tahoma, sans-serif` replaces Syne + DM Sans across all UI elements
- **Google Fonts removed** — no more external font requests on page load; faster startup, works fully offline
- Logo font (Georgia italic bold) unchanged — intentional contrast, per Sideforge spec
- Mono areas (`font-family: monospace`) unchanged

---

## [1.3.1] — 2026-04-22 — Album Blacklist

### Added
- **Album blacklist button** — new button in player secondary controls (💿, next to the track blacklist button) that adds all tracks of the currently playing album to the blacklist at once; shows a toast with the count of added tracks and skips to the next song automatically

### Fixed
- Album ID is now stored in `currentTrack` state — this was required for the album blacklist feature to work correctly

---

## [1.3.0] — 2026-04-22 — Filter & Shuffle Release

### Added
- **Acoustic filter** — per-list toggle to hide tracks with "acoustic", "unplugged", "stripped", "acoustique", "akustik" in track or album name
- **Orchestral filter** — per-list toggle to hide tracks with "orchestral" in track or album name
- **Artist repeat limit** — configurable per list: set how many tracks must play between repeats of the same artist (default: 3, range: 1–50)
- **Blacklist button in history** — 🚫 button directly on every history entry, no keyboard shortcut needed
- **Round Robin mode** — player button that cycles through all artists one by one in a randomly shuffled order; reshuffles when all artists have played once
- **Per-artist track lock** — tracks are never repeated for an artist until the entire discography has been played; auto-resets when exhausted

### Changed
- **Live filter** now checks track name in addition to album name — tracks like "Song - Live, at Wacken, 2015" are now correctly filtered (uses precise patterns like " live", "- live", "live at ", "live in " to avoid false positives on song titles containing "live")
- **Artist cooldown after Round Robin** — when Round Robin is deactivated, the last 5 played artists are locked for 5 songs to prevent immediate repeats
- **fillQueue in Round Robin** now uses the same shared artist queue and index as doShuffle — no more out-of-order artist picks in the pre-loaded queue

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

## [1.5.0] — 2026-06-19 — Compact Menus & API Fixes

### Added
- **Compact list dropdown** — clicking the list name now opens a slim dropdown positioned right below it, instead of a full-width bottom sheet. Each entry shows its item count (artists + albums). Click outside to close.
- **Compact options menu** — the three-dot options button (rename, duplicate, merge, export, import, delete) now opens a compact right-aligned dropdown instead of a full-width sheet
- **Combined list counter** — the count next to the list name now includes both artists and albums (was artists only)

### Changed
- **`market` parameter** — API requests now use the account's actual country code (fetched from `/me` and cached) instead of the deprecated `market=from_token`, which Spotify has begun rejecting with HTTP 400

### Removed
- **Genre shuffle** — Spotify has restricted track search (`type=track`) for Development Mode apps without Extended Quota. Requests return HTTP 400 with a misleading `"Invalid limit"` message; the real cause is missing catalog access for personal apps. As with the "Similar Artists" feature removed in v1.4.0, this is a deliberate Spotify platform restriction and cannot be fixed on our end. The genre search field and genre-based shuffling have been removed. Existing genre entries in lists are preserved as data but ignored.

---

## [1.4.2] — 2026-06-18 — Token Handling & Fixes

### Changed
- **Spotify refresh token expiry handling** — starting July 20, 2026, Spotify refresh tokens expire after 6 months. The app now detects the `invalid_grant` error on token refresh, discards the stored token without retrying, and redirects the user to sign in again. No data is lost — lists, stats, blacklist and track history all live on the sync server.

### Fixed
- **Artist card modal** — clicking an artist card opens the album/track-status modal again; it was blocked by leftover `discoverBtn` references from the Discovery removal in v1.4.0, which threw a JavaScript error on click
- **Progress bar thumb** — the draggable thumb now follows the playback position correctly instead of sticking to the right edge (CSS `right: 0` conflicted with the JS-set `left` value)

---

## [1.4.1] — 2026-05-18 — Light Mode & Restore

### Added
- **Light mode** — full light theme using Sideforge Anvil palette; follows `prefers-color-scheme` automatically; manually overridable via 🌙/☀️ toggle button in the sidebar header; preference saved to `localStorage`
- **Last track restore** — the last played track (cover, title, artist, album, progress) is shown on app open after browser restart; pressing Play starts the track from the beginning
- **Clear track history button** — red 🗑️ History button in the Stats tab clears the entire `artistTrackHistory` immediately, both locally and on the sync server

### Changed
- **Player buttons** — hover state now shows Ember orange color + glow instead of gray background; applies to all control buttons (repeat, volume, blacklist, notifications, round robin, etc.)
- **Play/Pause button** — hover shows Ember orange; idle state is neutral (was always orange)
- **Sidebar** — right edge now has rounded corners (`border-radius: 0 var(--radius-lg) var(--radius-lg) 0`)
- **Track artist and album name** below cover — switched from `var(--text2)`/`var(--text3)` to `var(--text)`/`var(--text2)` for better contrast in light mode

---

## [1.4.0] — 2026-05-09 — Cache & History Release

### Added
- **Track status tab** in album browser — click an artist card and switch to the "📊 Track Status" tab to see all tracks with ✅ played or 🔒 locked status, plus a progress counter (e.g. "12 / 34 played")
- **Server-side track cache** — album track lists are now cached on the sync server (`/api/tracks`, `tracks.json`); after the first playthrough all track requests are served from cache — no more cold-start 429 errors
- **Track history sync** — the per-artist played-track history is synced across devices via the sync server (`/api/track-history`, `track-history.json`); merged on load so no plays are lost
- **Track history persistence** — `artistTrackHistory` is now saved to `localStorage` and survives browser restarts and page reloads
- **"No track repeats" filter** (per list) — toggle to enable/disable the artist track lock; when active, each track is only repeated after the full discography has been played; default: on
- **PWA icons updated** — all icon sizes (96, 128, 192, 512px) regenerated with the Sideforge SF monogram logo

### Changed
- **Discovery (Similar Artists) removed** — Spotify has permanently restricted the `/artists/{id}/related-artists` endpoint for Development Mode apps; the button, modal and all related code have been removed
- **Live filter** now also checks track names for unambiguous patterns (` live`, `(live`, `- live`, `live at `, `live in `) to catch tracks like "Song Title - Live, at Wacken 2015" without false positives on song titles containing the word "live"
- **`manifest.json` theme color** updated to Ember Orange `#E8600A` (was Spotify teal)
- **DEPLOYMENT.md** — completely rewritten for current file structure including `sideforge-tokens.css`
- **CONTRIBUTING.md** — completely rewritten; documents Sideforge Design System, all sync server endpoints, and known Spotify API limitations
- **SYNC-SERVER.md** — completely rewritten; documents all 6 data files and endpoints including new `/api/tracks` and `/api/track-history`

### Sync Server
- New endpoint `GET/POST /api/tracks` — album track cache, stored in `tracks.json`
- New endpoint `GET/POST /api/track-history` — per-artist played track history, stored in `track-history.json`

---

## [1.3.3] — 2026-04-25 — Sideforge & Blacklist Sync

### Added
- **Sideforge Design System** — migrated from Spotify-green to the Sideforge Ember/Anvil palette; warm orange accents, warm grayscale backgrounds
- **Sideforge logo** (SF monogram) in sidebar header, left of the version button
- **Sideforge favicon** — SVG favicon with SF monogram replaces the vinyl+dice icon
- **Blacklist sync** — blacklisted tracks are now synced across all devices via the sync server (merged on load, 10s debounce on save)
- **Sync server `/api/blacklist`** — `GET` and `POST` endpoints, stored in `/data/blacklist.json`
- **Verdana UI font** (Sideforge Design System v1.0.1) — replaces Syne + DM Sans; no webfont download, consistent look on Windows/macOS/Linux

### Changed
- **Google Fonts removed** — no more external font requests on page load; app works fully offline
- **Sync server `/api/health`** — now also returns `blacklist` count
- **Blacklist sync merge logic** — local entries not present on the server are preserved on load

---

## [1.3.2] — 2026-04-25 — Sideforge v1.0.1 — Verdana

### Changed
- **Font migrated to Verdana** (Sideforge Design System v1.0.1) — `Verdana, Geneva, "DejaVu Sans", Tahoma, sans-serif` replaces Syne + DM Sans across all UI elements
- **Google Fonts removed** — no more external font requests on page load; faster startup, works fully offline
- Logo font (Georgia italic bold) unchanged — intentional contrast, per Sideforge spec
- Mono areas (`font-family: monospace`) unchanged

---

## [1.3.1] — 2026-04-22 — Album Blacklist

### Added
- **Album blacklist button** — new button in player secondary controls (💿, next to the track blacklist button) that adds all tracks of the currently playing album to the blacklist at once; shows a toast with the count of added tracks and skips to the next song automatically

### Fixed
- Album ID is now stored in `currentTrack` state — this was required for the album blacklist feature to work correctly

---

## [1.3.0] — 2026-04-22 — Filter & Shuffle Release

### Added
- **Acoustic filter** — per-list toggle to hide tracks with "acoustic", "unplugged", "stripped", "acoustique", "akustik" in track or album name
- **Orchestral filter** — per-list toggle to hide tracks with "orchestral" in track or album name
- **Artist repeat limit** — configurable per list: set how many tracks must play between repeats of the same artist (default: 3, range: 1–50)
- **Blacklist button in history** — 🚫 button directly on every history entry, no keyboard shortcut needed
- **Round Robin mode** — player button that cycles through all artists one by one in a randomly shuffled order; reshuffles when all artists have played once
- **Per-artist track lock** — tracks are never repeated for an artist until the entire discography has been played; auto-resets when exhausted

### Changed
- **Live filter** now checks track name in addition to album name — tracks like "Song - Live, at Wacken, 2015" are now correctly filtered (uses precise patterns like " live", "- live", "live at ", "live in " to avoid false positives on song titles containing "live")
- **Artist cooldown after Round Robin** — when Round Robin is deactivated, the last 5 played artists are locked for 5 songs to prevent immediate repeats
- **fillQueue in Round Robin** now uses the same shared artist queue and index as doShuffle — no more out-of-order artist picks in the pre-loaded queue

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
