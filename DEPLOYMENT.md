# 🚀 Deployment — Music Shuffle

Anleitung zum Deployen von Music Shuffle auf einer Synology NAS.

---

## Voraussetzungen

- Synology NAS mit DSM 7.x
- Web Station installiert
- HTTPS-Zertifikat (Let's Encrypt über DSM oder eigenes)
- Reverse Proxy in DSM eingerichtet

---

## Schritt 1 — Dateien hochladen

Lade alle Dateien in das Web-Verzeichnis der NAS:

```
/volume1/web/music-shuffle/
├── index.html
├── style.css
├── sideforge-tokens.css
├── app.js
├── spotify-api.js
├── i18n.js
├── config.js               ← selbst anlegen (nicht im Repo!)
├── config.example.js
├── manifest.json
├── service-worker.js
├── favicon.svg
├── favicon.ico
└── icons/
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-192.png
    └── icon-512.png
```

---

## Schritt 2 — config.js anlegen

Kopiere `config.example.js` zu `config.js` und trage deine Werte ein:

```javascript
window.SPOTIFY_CONFIG = {
    clientId:   'DEINE_SPOTIFY_CLIENT_ID',
    redirectUri: 'https://deine-domain.de/music-shuffle/',
    syncUrl:    'https://sync.deine-domain.de',  // optional
    syncStats:  true,                             // optional
};
```

---

## Schritt 3 — Reverse Proxy einrichten

**DSM → Systemsteuerung → Anmeldeportal → Reverse Proxy → Erstellen:**

| Feld | Wert |
|------|------|
| Name | Music Shuffle |
| Quelle Protokoll | HTTPS |
| Quelle Hostname | `deine-domain.de` |
| Quelle Port | `8443` |
| Quelle Pfad | `/music-shuffle/` |
| Ziel Protokoll | HTTP |
| Ziel Hostname | `127.0.0.1` |
| Ziel Port | `80` |

---

## Schritt 4 — Sync-Server einrichten (optional)

Siehe [sync-server/SYNC-SERVER.md](sync-server/SYNC-SERVER.md) für die vollständige Anleitung.

Kurzfassung per SSH:

```bash
cd /volume1/docker/artist-shuffle-sync
sudo docker build -t artist-shuffle-sync:latest .
sudo docker run -d \
  --name artist-shuffle-sync \
  --restart always \
  -p 3001:3001 \
  -v /volume1/docker/artist-shuffle-sync/data:/data \
  artist-shuffle-sync:latest
```

---

## Schritt 5 — Testen

1. App-URL im Browser öffnen: `https://deine-domain.de/music-shuffle/`
2. Mit Spotify einloggen
3. Artists hinzufügen und shufflen 🎲

---

## Updates einspielen

1. Neue Dateien per File Station hochladen (vorhandene ersetzen)
2. `config.js` nicht überschreiben — sie liegt in `.gitignore`
3. Browser-Cache leeren: **F12 → Application → Storage → Clear site data**
4. Bei Sync-Server Änderungen: Image neu bauen + Container neu erstellen

---

*Erstellt für Music Shuffle — MIT License*
