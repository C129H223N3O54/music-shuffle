# 🔄 SYNC-SERVER — Geräteübergreifende Synchronisation

Anleitung zum Einrichten des Sync-Servers auf der Synology NAS mit Docker/Container Manager.

---

## Was macht der Sync-Server?

Der Sync-Server speichert deine Daten auf der NAS und synchronisiert sie automatisch zwischen allen Geräten.

| Daten | Datei | Endpunkt |
|-------|-------|----------|
| Artist-Listen | `lists.json` | `/api/lists` |
| Wiedergabe-Statistiken | `stats.json` | `/api/stats` |
| Blacklist | `blacklist.json` | `/api/blacklist` |
| Album-Cache | `cache.json` | `/api/cache` |

---

## Voraussetzungen

- Synology NAS mit DSM 7.x
- Container Manager installiert
- Reverse Proxy läuft bereits (aus DEPLOYMENT.md)

---

## Schritt 1 — Dateien hochladen

1. Öffne die **File Station**
2. Navigiere zu `/volume1/docker/` und erstelle `artist-shuffle-sync`
3. Lade folgende Dateien hoch:
   - `sync-server.js`
   - `Dockerfile`

```
/volume1/docker/artist-shuffle-sync/
├── sync-server.js
├── Dockerfile
└── data/          ← wird automatisch erstellt
    ├── lists.json
    ├── stats.json
    ├── blacklist.json
    └── cache.json
```

---

## Schritt 2 — Docker Image bauen

Per SSH auf der NAS:

```bash
cd /volume1/docker/artist-shuffle-sync
sudo docker build -t artist-shuffle-sync:latest .
```

---

## Schritt 3 — Container erstellen

```bash
sudo docker run -d \
  --name artist-shuffle-sync \
  --restart always \
  -p 3001:3001 \
  -v /volume1/docker/artist-shuffle-sync/data:/data \
  artist-shuffle-sync:latest
```

---

## Schritt 4 — Reverse Proxy einrichten

**DSM → Systemsteuerung → Anmeldeportal → Reverse Proxy → Erstellen:**

| Feld | Wert |
|------|------|
| Name | Music Shuffle Sync |
| Quelle Protokoll | HTTPS |
| Quelle Hostname | `sync.deine-domain.de` |
| Quelle Port | `9443` |
| Ziel Protokoll | HTTP |
| Ziel Hostname | `127.0.0.1` |
| Ziel Port | `3001` |

---

## Schritt 5 — Testen

```
https://sync.deine-domain.de:9443/api/health
```

Erwartete Antwort:

```json
{
  "status": "ok",
  "lists": 1,
  "plays": 937,
  "blacklist": 12,
  "updatedAt": "2026-04-25T20:20:57.001Z"
}
```

---

## Schritt 6 — config.js anpassen

```javascript
window.SPOTIFY_CONFIG = {
    clientId:    'DEINE_CLIENT_ID',
    redirectUri: 'https://deine-domain.de/music-shuffle/',
    syncUrl:     'https://sync.deine-domain.de:9443',
    syncStats:   true,
};
```

---

## Updates einspielen

Bei neuer `sync-server.js`:

```bash
cd /volume1/docker/artist-shuffle-sync
sudo docker build -t artist-shuffle-sync:latest .
sudo docker stop artist-shuffle-sync
sudo docker rm artist-shuffle-sync
sudo docker run -d \
  --name artist-shuffle-sync \
  --restart always \
  -p 3001:3001 \
  -v /volume1/docker/artist-shuffle-sync/data:/data \
  artist-shuffle-sync:latest
```

> Die `/data/` Dateien bleiben beim Rebuild erhalten.

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| Health-Check schlägt fehl | Container läuft? `sudo docker logs artist-shuffle-sync` |
| CORS-Fehler | Reverse Proxy Konfiguration prüfen |
| Daten werden nicht gespeichert | Schreibrechte auf `/volume1/docker/artist-shuffle-sync/data/` prüfen |
| Sync-Icon grau | `syncUrl` in `config.js` prüfen |

---

## Datensicherung

Alle Daten liegen in `/volume1/docker/artist-shuffle-sync/data/` — einfach in die Synology Backup-Aufgabe einbeziehen.

---

*Erstellt für Music Shuffle — MIT License*
