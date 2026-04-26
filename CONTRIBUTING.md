# 🤝 Contributing — Music Shuffle

Danke für dein Interesse an Music Shuffle! Hier sind die Richtlinien für Beiträge.

---

## Grundregeln

- **Vanilla JS** — kein Framework, kein Build-Schritt, keine npm-Abhängigkeiten
- **Sideforge Design System** — alle UI-Änderungen nutzen `sideforge-tokens.css` Variablen
- **Keine externen Abhängigkeiten** — die App ist komplett statisch und selbst gehostet
- **Bilingual** — alle neuen UI-Strings in `i18n.js` auf Deutsch und Englisch

---

## Design System

Music Shuffle nutzt das [Sideforge Design System](https://github.com/C129H223N3O54/SideForge).

Farb-Tokens:
- Accent: `var(--accent)` / `var(--sf-ember-300)` — Ember Orange
- Backgrounds: `var(--bg)` bis `var(--bg5)` — Anvil Warm Grays
- Text: `var(--text)`, `var(--text2)`, `var(--text3)`
- Border: `var(--border)`

Schrift: **Verdana** — kein Webfont, keine externen Requests.

---

## Dateistruktur

| Datei | Zweck |
|-------|-------|
| `app.js` | App-Logik, UI, Player, State |
| `spotify-api.js` | Spotify API Wrapper + OAuth PKCE |
| `i18n.js` | Übersetzungen DE/EN |
| `style.css` | Alle Styles (nutzt Sideforge-Tokens) |
| `sideforge-tokens.css` | Design System Tokens |
| `sync-server.js` | Optionaler Node.js Sync-Server |

---

## Neue Features

1. Fork erstellen
2. Feature in `app.js` / `spotify-api.js` implementieren
3. UI-Strings in `i18n.js` ergänzen (DE + EN)
4. Styles in `style.css` mit Sideforge-Tokens
5. Changelog-Eintrag in `CHANGELOG.md`
6. Pull Request erstellen

---

## Sync-Server Endpunkte

| Endpunkt | Methode | Zweck |
|----------|---------|-------|
| `/api/lists` | GET, POST, DELETE | Artist-Listen |
| `/api/stats` | GET, POST | Wiedergabe-Statistiken |
| `/api/blacklist` | GET, POST | Gesperrte Tracks |
| `/api/cache` | GET, POST | Album-Cache |
| `/api/health` | GET | Status-Check |

---

## Bekannte Einschränkungen

| Feature | Status |
|---------|--------|
| Ähnliche Artists (Discovery) | ❌ Von Spotify im Dev Mode gesperrt |
| Like-Button | ❌ Extended Quota erforderlich |
| Audio Features (BPM, Energy) | ❌ Extended Quota erforderlich |
| iOS Web Playback | ❌ Web Playback SDK läuft nicht auf iOS Safari |

---

## Versionierung

Music Shuffle folgt [Semantic Versioning](https://semver.org/):
- **Major** (x.0.0) — Breaking Changes
- **Minor** (1.x.0) — Neue Features
- **Patch** (1.1.x) — Bugfixes, kleine Verbesserungen

---

*MIT License — Idee & Richtung: Jan Erik Mueller — Code: Claude (Anthropic)*
