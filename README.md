# 🎲 Music Shuffle

> Shuffle through your favorite Spotify artists and genres — no algorithm, just your picks.

[![Version](https://img.shields.io/badge/version-1.3.3-blue.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Vanilla JS](https://img.shields.io/badge/Built%20with-Vanilla%20JS-yellow)
![Spotify API](https://img.shields.io/badge/Spotify-Web%20API%20%2B%20SDK-1DB954)
![PWA](https://img.shields.io/badge/PWA-Ready-blue)

---

> 📋 See [CHANGELOG.md](CHANGELOG.md) for version history.

## 📸 Screenshot

![Music Shuffle](screenshot.png)

---

## ✨ Features

### 🎵 Playback
- **Full discography shuffle** — random tracks from entire album catalog, not just top 10
- **Smart Shuffle** — artists not played recently get higher probability
- **Favorite artists** — ⭐ pin artists for 3× higher play chance
- **Queue** with 2 pre-loaded next songs
- **Play history** — last 20 tracks, clickable to replay or blacklist directly
- **Album blacklist** — blacklist all tracks of the current album at once via player button
- **Crossfade** — smooth volume fade before track end
- **Auto-Skip** — skip tracks shorter than 60 seconds
- **Repeat mode**
- **Media key support** — keyboard play/pause/next/prev keys work natively
- **Round Robin mode** — cycle through all artists one by one, randomly shuffled

### 📋 List Management
- Multiple named lists ("Metal Evening", "Gym Rotation", etc.)
- Artist search with **multi-select**
- **Genre lists** — shuffle by genre (150+ genres)
- **Combo lists** — mix artists and genres
- **Duplicate** and **merge** lists
- **Import / Export** lists as JSON
- **Cross-device sync** via optional self-hosted sync server

### 🔍 Filters (per list)
- 🚫 No live albums — checks both album and track name
- 🎼 No instrumentals — filters tracks with "instrumental", "karaoke", "backing track" etc. in the name
- 🎸 No acoustic versions — filters tracks with "acoustic", "unplugged", "stripped" etc. in track or album name
- 🎻 No orchestral versions — filters tracks with "orchestral" in track or album name
- 🔁 Artist repeat limit — configurable minimum tracks between repeats of the same artist (default: 3)
- 📅 Year range

### 🔎 Discovery
- **Similar Artists** — find and add related artists
- **"Only new songs"** — skip tracks already in history

### 📊 Stats & Tracking
- Plays, listening time, shuffle count
- Top artists and top songs
- Weekly sessions chart
- **Shuffle log** — why was each track chosen?
- **Artist stats** — per-artist play count and top songs (click any artist card)
- **Cross-device stats sync** — play statistics shared across all devices via sync server
- **Per-artist track lock** — each track only repeats after the full discography has been played

### 🖥️ UI / UX
- Dark theme — Sideforge Design System (Ember orange / Anvil warm grays)
- Dynamic album art background with color-matched shadow glow
- Fullscreen mode (`F` key)
- **Desktop notifications** — song change alert when tab is in background
- **PWA** — installable on mobile and desktop
- Fully responsive (mobile + desktop)
- Keyboard shortcuts
- Spotify Connect device selector (Sonos, speakers, phone, etc.)
- Auto-refresh device list every 2 minutes

---

## 🚀 Installation

### Prerequisites

- **Spotify Premium** account (required for Web Playback SDK)
- A modern browser (Chrome, Edge, Firefox, Safari)
- A free [Spotify Developer App](https://developer.spotify.com/dashboard)
- Any web server that can serve static files over **HTTPS**

> ⚠️ Spotify OAuth requires HTTPS — `http://localhost` is the only exception for local development.

---

### Step 1 — Create a Spotify Developer App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **"Create app"**
3. Enter a name and description
4. Add your **Redirect URI** (e.g. `https://your-domain.com/` or `http://localhost:8080/`)
5. Enable **Web API** and **Web Playback SDK**
6. Click **Save** and copy your **Client ID**

> After deploying, go back and add your production Redirect URI too.

---

### Step 2 — Add yourself as a test user

In your Spotify App → **Settings** → **User Management** → add your Spotify email address.

> Required for Development Mode. Spotify currently allows up to 5 users per app.

---

### Step 3 — Deploy the files

Clone or download this repository:

```bash
git clone https://github.com/yourusername/music-shuffle.git
cd music-shuffle
```

Copy and edit the config file:

```bash
cp config.example.js config.js
```

Edit `config.js`:

```javascript
window.SPOTIFY_CONFIG = {
    clientId: 'YOUR_CLIENT_ID_HERE',
    redirectUri: 'https://your-domain.com/',
    syncUrl: null,   // optional — see sync-server/SYNC-SERVER.md
    syncStats: true, // optional — set false to keep stats local only
};
```

Upload all files to your web server. The app is entirely static — no build step required.

---

### Step 4 — Local development

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve . -p 8080

# PHP
php -S localhost:8080
```

Set `redirectUri: 'http://localhost:8080/'` in `config.js` and add `http://localhost:8080/` in your Spotify Dashboard.

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

### Step 5 — Open the app and log in

1. Open the app URL in your browser
2. Enter your Client ID (if not set in `config.js`)
3. Click **"Mit Spotify einloggen"**
4. Authorize the app
5. Start shuffling 🎲

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `N` | Next track (shuffle) |
| `P` | Previous track |
| `F` | Fullscreen toggle |
| `B` | Add current track to blacklist |
| `M` | Mute toggle |
| `↑ / ↓` | Volume ±5% |
| `1–9` | Switch to list 1–9 |
| Media keys | Play / Pause / Next / Prev |

---

## 🏗️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| HTML + CSS + Vanilla JS | UI & logic — no framework, no build step |
| Spotify Web API | Artist search, albums, devices, playback control |
| Spotify Web Playback SDK | In-browser audio playback |
| OAuth 2.0 PKCE | Secure authentication — no backend needed |
| Media Session API | OS-level media key support |
| Web Notifications API | Desktop song notifications |
| Service Worker + Manifest | PWA / installable app |
| Node.js (optional) | Cross-device sync server |

---

## 📁 File Structure

```
music-shuffle/
├── index.html              # Main HTML
├── style.css               # All styles
├── app.js                  # App logic, UI, player, state management
├── spotify-api.js          # Spotify API wrapper + OAuth PKCE flow
├── config.js               # Your config — not in git!
├── config.example.js       # Config template
├── manifest.json           # PWA manifest
├── service-worker.js       # PWA service worker + offline cache
├── favicon.svg             # SVG favicon
├── favicon.ico             # ICO favicon
├── icons/                  # PWA icons (72, 96, 128, 192, 512px)
├── sync-server/
│   ├── sync-server.js      # Optional Node.js sync server
│   ├── Dockerfile          # Docker image
│   └── SYNC-SERVER.md      # Sync server setup guide
├── DEPLOYMENT.md           # Self-hosting deployment guide
├── CONTRIBUTING.md         # Contribution guidelines
├── README.md               # This file
├── LICENSE                 # MIT
└── .gitignore
```

---

## 🌐 Deployment Options

| Platform | Notes |
|----------|-------|
| Any VPS/server | Copy files to web root (Apache, Nginx, Caddy) |
| GitHub Pages | Push to `gh-pages` branch — free HTTPS included |
| Netlify | Drag & drop the folder — free HTTPS included |
| Vercel | `vercel deploy` — free HTTPS included |
| Synology NAS | See [DEPLOYMENT.md](DEPLOYMENT.md) |
| Any static host | As long as HTTPS is available |

---

## 🔄 Cross-Device Sync (Optional)

The optional sync server keeps your artist lists, play statistics and album cache in sync across all devices. It's a minimal Node.js HTTP server — no database needed.

Setup with Docker in minutes. See [sync-server/SYNC-SERVER.md](sync-server/SYNC-SERVER.md).

```
Desktop (PWA)  ←→  Sync Server  ←→  Mobile (PWA)
```

### What gets synced

| Data | Endpoint | Notes |
|------|----------|-------|
| Artist lists | `/api/lists` | Always synced when `syncUrl` is set |
| Play statistics | `/api/stats` | Synced when `syncUrl` is set; disable with `syncStats: false` |
| Blacklist | `/api/blacklist` | Blacklisted tracks synced across devices, merged on load |
| Album cache | `/api/cache` | Shared 24h cache — eliminates cold-start Spotify API calls |

### Health check

```
GET /api/health
```
```json
{ "status": "ok", "lists": 3, "plays": 142, "blacklist": 12, "updatedAt": "2026-04-25T..." }
```

---

## ⚠️ Spotify API Limitations

Music Shuffle targets **Development Mode** — free, no approval needed, personal use only.

| Feature | Status |
|---------|--------|
| Full discography shuffle | ✅ Works |
| Artist search | ✅ Works |
| Similar artists | ✅ Works |
| Web Playback (Premium required) | ✅ Works |
| Spotify Connect devices | ✅ Works |
| Audio features (energy, BPM) | ❌ Restricted in Dev Mode |
| User top tracks/artists | ❌ Restricted in Dev Mode |
| Max test users | ⚠️ 5 users (Dev Mode limit) |

Extended Quota (required to unlock restricted APIs) now requires 250,000 monthly active users and a registered business — effectively unavailable for personal projects.

---

## 🔒 Privacy & Security

- **No external backend required** — all data stored in browser `localStorage` or your own sync server
- **No analytics, no tracking, no ads**
- **No external font loading** — Verdana system font, no Google Fonts
- **OAuth 2.0 PKCE** — most secure flow for public clients, no client secret needed
- `config.js` is in `.gitignore` — your Client ID never gets committed
- Blacklisted tracks and albums stored locally in `localStorage`

---

## 🤝 Contributing

PRs welcome! Please keep it vanilla JS — no framework dependencies, no build step.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

## Credits

The idea, requirements and direction for this project came from **Jan Erik Mueller**.  
The entire codebase — every line of HTML, CSS and JavaScript, the Spotify API wrapper, the OAuth PKCE flow, the PWA setup, the sync server — was written by **[Claude](https://claude.ai)**, an AI assistant made by [Anthropic](https://www.anthropic.com).

This project is an example of human–AI collaboration: a person with a vision, and an AI that implements it.

---

*Built with ❤️ and the [Spotify Web API](https://developer.spotify.com/documentation/web-api)*
