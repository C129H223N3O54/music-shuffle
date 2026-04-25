# 🎲 Music Shuffle

> Shuffle durch deine liebsten Spotify-Artists und Genres — kein Algorithmus, nur deine Auswahl.

[![Version](https://img.shields.io/badge/version-1.3.3-blue.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Vanilla JS](https://img.shields.io/badge/Gebaut%20mit-Vanilla%20JS-yellow)
![Spotify API](https://img.shields.io/badge/Spotify-Web%20API%20%2B%20SDK-1DB954)
![PWA](https://img.shields.io/badge/PWA-Ready-blue)

---

> 📋 Versionshistorie: [CHANGELOG.md](CHANGELOG.md)

## 📸 Screenshot

![Music Shuffle](screenshot.png)

---

## ✨ Features

### 🎵 Wiedergabe
- **Shuffle durch die gesamte Diskografie** — zufällige Tracks aus allen Alben, nicht nur Top 10
- **Smart Shuffle** — Artists die lange nicht gespielt wurden kommen öfter dran
- **Favoriten-Artists** — ⭐ Artists anpinnen für 3× höhere Wahrscheinlichkeit
- **Queue** mit 2 vorgeladenen nächsten Songs
- **Verlauf** — letzte 20 Tracks, anklickbar zum Erneut-Abspielen oder direkt zur Blacklist hinzufügen
- **Album-Blacklist** — ganzes Album des aktuellen Songs auf einmal sperren via Player-Button
- **Crossfade** — sanftes Ausblenden vor Track-Ende
- **Auto-Skip** — Tracks unter 60 Sekunden automatisch überspringen
- **Wiederholen-Modus**
- **Mediatasten-Unterstützung** — Tastatur Play/Pause/Weiter/Zurück funktionieren nativ
- **Round-Robin Modus** — reihum je ein Song pro Artist, zufällig gemischt

### 📋 Listen-Verwaltung
- Mehrere benannte Listen ("Metal Abend", "Gym Rotation", etc.)
- Artist-Suche mit **Multi-Select** — mehrere Artists auf einmal hinzufügen
- **Genre-Listen** — nach Genre shufflen (150+ Genres)
- **Kombi-Listen** — Artists und Genres mischen
- Listen **duplizieren** und **zusammenführen**
- **Import / Export** Listen als JSON
- **Geräteübergreifende Synchronisation** über optionalen selbst gehosteten Sync-Server

### 🔍 Filter (pro Liste)
- 🚫 Keine Live-Alben — prüft Album- und Tracknamen
- 🎼 Keine Instrumentals — filtert Tracks mit "instrumental", "karaoke", "backing track" usw. im Namen
- 🎸 Keine Akustik-Versionen — filtert Tracks mit "acoustic", "unplugged", "stripped" usw. im Track- oder Albumnamen
- 🎻 Keine Orchestral-Versionen — filtert Tracks mit "orchestral" im Track- oder Albumnamen
- 🔁 Artist-Wiederholung — konfigurierbare Mindestanzahl Tracks zwischen Wiederholungen desselben Artists (Standard: 3)
- 📅 Jahres-Range (von / bis)

### 🔎 Discovery
- **Ähnliche Artists** — verwandte Artists finden und hinzufügen
- **"Nur neue Songs"** — bereits gehörte Tracks überspringen

### 📊 Stats & Tracking
- Plays, Hörzeit, Shuffle-Counter
- Top Artists und Top Songs
- Wöchentlicher Sessions-Chart
- **Shuffle-Log** — warum wurde welcher Track gewählt?
- **Artist-Stats** — pro Artist: Plays und Top Songs (Artist-Card anklicken)
- **Geräteübergreifende Stats** — Wiedergabe-Statistiken werden über den Sync-Server geteilt
- **Track-Sperre pro Artist** — jeder Track wird erst wiederholt wenn die gesamte Diskografie gespielt wurde

### 🖥️ UI / UX
- Dark Theme — Sideforge Design System (Ember-Orange / Anvil Warmgrau)
- Dynamischer Album-Cover-Hintergrund mit farblich passendem Schatten
- Vollbild-Modus (`F`-Taste)
- **Desktop-Benachrichtigungen** — Song-Wechsel-Alert wenn Tab im Hintergrund
- **PWA** — installierbar auf Handy und Desktop
- Vollständig responsiv (Mobile + Desktop)
- Tastatur-Shortcuts
- Spotify Connect Geräte-Auswahl (Sonos, Lautsprecher, Handy, etc.)
- Automatische Geräte-Aktualisierung alle 2 Minuten

---

## 🚀 Installation

### Voraussetzungen

- **Spotify Premium** Account (für Web Playback erforderlich)
- Ein moderner Browser (Chrome, Edge, Firefox, Safari)
- Eine kostenlose [Spotify Developer App](https://developer.spotify.com/dashboard)
- Ein Webserver der statische Dateien über **HTTPS** ausliefert

> ⚠️ Spotify OAuth benötigt HTTPS — `http://localhost` ist die einzige Ausnahme für lokale Entwicklung.

---

### Schritt 1 — Spotify Developer App erstellen

1. Gehe zu [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Klicke **"Create app"**
3. Name und Beschreibung eingeben
4. **Redirect URI** hinzufügen (z.B. `https://deine-domain.de/` oder `http://localhost:8080/`)
5. **Web API** und **Web Playback SDK** aktivieren
6. **Speichern** und **Client ID** kopieren

---

### Schritt 2 — Dich als Test-User eintragen

Spotify Dashboard → deine App → **Settings** → **User Management** → deine Spotify E-Mail-Adresse eintragen.

> Im Development Mode erforderlich. Spotify erlaubt aktuell bis zu 5 Test-User pro App.

---

### Schritt 3 — Dateien deployen

Repository klonen oder herunterladen:

```bash
git clone https://github.com/yourusername/music-shuffle.git
cd music-shuffle
```

Config-Datei anlegen:

```bash
cp config.example.js config.js
```

`config.js` bearbeiten:

```javascript
window.SPOTIFY_CONFIG = {
    clientId: 'DEINE_CLIENT_ID_HIER',
    redirectUri: 'https://deine-domain.de/',
    syncUrl: null,   // optional — siehe sync-server/SYNC-SERVER.md
    syncStats: true, // optional — false = Stats nur lokal speichern
};
```

Alle Dateien auf deinen Webserver hochladen. Die App ist komplett statisch — kein Build-Schritt nötig.

---

### Schritt 4 — Lokale Entwicklung

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve . -p 8080

# PHP
php -S localhost:8080
```

`redirectUri: 'http://localhost:8080/'` in `config.js` setzen und `http://localhost:8080/` im Spotify Dashboard eintragen.

[http://localhost:8080](http://localhost:8080) im Browser öffnen.

---

### Schritt 5 — App öffnen und einloggen

1. App-URL im Browser öffnen
2. Client ID eingeben (falls nicht in `config.js` gesetzt)
3. **"Mit Spotify einloggen"** klicken
4. App autorisieren
5. Shufflen 🎲

---

## ⌨️ Tastatur-Shortcuts

| Taste | Aktion |
|-------|--------|
| `Space` | Play / Pause |
| `N` | Nächster Track (Shuffle) |
| `P` | Vorheriger Track |
| `F` | Vollbild umschalten |
| `B` | Aktuellen Track zur Blacklist hinzufügen |
| `M` | Stummschalten |
| `↑ / ↓` | Lautstärke ±5% |
| `1–9` | Zu Liste 1–9 wechseln |
| Mediatasten | Play / Pause / Weiter / Zurück |

---

## 🏗️ Tech Stack

| Technologie | Zweck |
|------------|-------|
| HTML + CSS + Vanilla JS | UI & Logik — kein Framework, kein Build-Schritt |
| Spotify Web API | Artist-Suche, Alben, Geräte, Wiedergabe-Steuerung |
| Spotify Web Playback SDK | In-Browser Audio-Wiedergabe |
| OAuth 2.0 PKCE | Sichere Authentifizierung — kein Backend nötig |
| Media Session API | OS-seitige Mediatasten-Unterstützung |
| Web Notifications API | Desktop Song-Benachrichtigungen |
| Service Worker + Manifest | PWA / installierbare App |
| Node.js (optional) | Geräteübergreifender Sync-Server |

---

## 📁 Dateistruktur

```
music-shuffle/
├── index.html              # Haupt-HTML
├── style.css               # Alle Styles
├── app.js                  # App-Logik, UI, Player, State-Management
├── spotify-api.js          # Spotify API Wrapper + OAuth PKCE Flow
├── i18n.js                 # Mehrsprachigkeit (DE/EN)
├── config.js               # Deine Konfiguration — nicht ins Git!
├── config.example.js       # Konfigurations-Template
├── manifest.json           # PWA Manifest
├── service-worker.js       # PWA Service Worker + Offline-Cache
├── favicon.svg             # SVG Favicon
├── favicon.ico             # ICO Favicon
├── icons/                  # PWA Icons (72, 96, 128, 192, 512px)
├── sync-server/
│   ├── sync-server.js      # Optionaler Node.js Sync-Server
│   ├── Dockerfile          # Docker Image
│   └── SYNC-SERVER.md      # Sync-Server Setup-Anleitung
├── DEPLOYMENT.md           # Deployment-Anleitung
├── CONTRIBUTING.md         # Beitrags-Richtlinien
├── README.md               # Englische Dokumentation
├── README.de.md            # Diese Datei
├── LICENSE                 # MIT
└── .gitignore
```

---

## 🌐 Deployment-Optionen

| Plattform | Hinweise |
|-----------|---------|
| Beliebiger VPS/Server | Dateien ins Web-Root kopieren (Apache, Nginx, Caddy) |
| GitHub Pages | In `gh-pages` Branch pushen — HTTPS inklusive |
| Netlify | Ordner drag & drop — HTTPS inklusive |
| Vercel | `vercel deploy` — HTTPS inklusive |
| Synology NAS | Siehe [DEPLOYMENT.md](DEPLOYMENT.md) |

---

## 🔄 Geräteübergreifende Synchronisation (Optional)

Der optionale Sync-Server hält deine Artist-Listen, Wiedergabe-Statistiken und den Album-Cache auf allen Geräten synchron. Ein minimaler Node.js HTTP-Server — keine Datenbank nötig.

Docker-Setup in wenigen Minuten. Siehe [sync-server/SYNC-SERVER.md](sync-server/SYNC-SERVER.md).

```
Desktop (PWA)  ←→  Sync-Server  ←→  Mobil (PWA)
```

### Was wird synchronisiert

| Daten | Endpunkt | Hinweis |
|-------|----------|---------|
| Artist-Listen | `/api/lists` | Immer synchronisiert wenn `syncUrl` gesetzt |
| Wiedergabe-Statistiken | `/api/stats` | Synchronisiert wenn `syncUrl` gesetzt; deaktivierbar mit `syncStats: false` |
| Blacklist | `/api/blacklist` | Gesperrte Tracks geräteübergreifend synchronisiert, beim Laden gemergt |
| Album-Cache | `/api/cache` | Geteilter 24h-Cache — verhindert Spotify API Calls beim Start |

### Health Check

```
GET /api/health
```
```json
{ "status": "ok", "lists": 3, "plays": 142, "blacklist": 12, "updatedAt": "2026-04-25T..." }
```

---

## ⚠️ Spotify API Einschränkungen

Music Shuffle zielt auf den **Development Mode** ab — kostenlos, keine Genehmigung nötig, nur für persönliche Nutzung.

| Feature | Status |
|---------|--------|
| Shuffle durch gesamte Diskografie | ✅ Funktioniert |
| Artist-Suche | ✅ Funktioniert |
| Ähnliche Artists | ✅ Funktioniert |
| Web Playback (Premium erforderlich) | ✅ Funktioniert |
| Spotify Connect Geräte | ✅ Funktioniert |
| Audio Features (Energy, BPM) | ❌ Im Dev Mode eingeschränkt |
| User Top Tracks/Artists | ❌ Im Dev Mode eingeschränkt |
| Max. Test-User | ⚠️ 5 User (Dev Mode Limit) |

Extended Quota (zum Entsperren der eingeschränkten APIs) erfordert seit 2025 250.000 monatlich aktive Nutzer und ein eingetragenes Unternehmen — für persönliche Projekte faktisch nicht erhältlich.

---

## 🔒 Datenschutz & Sicherheit

- **Kein externes Backend nötig** — alle Daten im Browser `localStorage` oder deinem eigenen Sync-Server
- **Keine Analytics, kein Tracking, keine Werbung**
- **Kein externer Font-Request** — Verdana System-Schrift, kein Google Fonts
- **OAuth 2.0 PKCE** — sicherster Flow für öffentliche Clients, kein Client Secret nötig
- `config.js` ist in `.gitignore` — deine Client ID wird nie committed

---

## 🤝 Beitragen

Pull Requests willkommen! Bitte Vanilla JS beibehalten — kein Framework, kein Build-Schritt.

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Details.

---

## 📄 Lizenz

MIT — siehe [LICENSE](LICENSE)

---

## Credits

Die Idee, Anforderungen und Richtung für dieses Projekt kamen von **Jan Erik Mueller**.  
Der gesamte Code — jede Zeile HTML, CSS und JavaScript, der Spotify API Wrapper, der OAuth PKCE Flow, das PWA-Setup, der Sync-Server — wurde von **[Claude](https://claude.ai)** geschrieben, einem KI-Assistenten von [Anthropic](https://www.anthropic.com).

Dieses Projekt ist ein Beispiel für Mensch–KI-Zusammenarbeit: ein Mensch mit einer Vision, und eine KI die sie umsetzt.

---

*Gebaut mit ❤️ und der [Spotify Web API](https://developer.spotify.com/documentation/web-api)*
