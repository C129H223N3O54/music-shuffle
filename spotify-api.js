/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — spotify-api.js
   Spotify Web API Wrapper + OAuth PKCE Flow
   ═══════════════════════════════════════════════════════ */

'use strict';

const SpotifyAPI = (() => {

  const SCOPES = [
    'user-read-playback-state', 'user-modify-playback-state',
    'streaming', 'user-read-email', 'user-read-private',
  ].join(' ');

  const BASE        = 'https://api.spotify.com/v1';
  const AUTH_URL    = 'https://accounts.spotify.com/authorize';
  const TOKEN_URL   = 'https://accounts.spotify.com/api/token';
  const STORAGE_KEY = 'spotify_auth';
  const CACHE_TTL   = 24 * 60 * 60 * 1000;
  const MIN_INTERVAL = 1000;

  let _accessToken = null, _tokenExpiry = 0, _refreshToken = null;
  let _clientId = null, _redirectUri = null, _lastRequest = 0;
  let _userMarket = localStorage.getItem('as_market') || 'DE'; // Fallback DE
  const _albumCache = new Map();
  const _trackCache = new Map(); // albumId → { tracks: [...], ts }

  // ── PKCE ──────────────────────────────────────────────
  function _randomString(len = 64) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => chars[b % chars.length]).join('');
  }

  function _base64url(buf) {
    let s = '';
    new Uint8Array(buf).forEach(b => s += String.fromCharCode(b));
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  }

  async function _pkce() {
    const verifier  = _randomString(64);
    const challenge = _base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    return { verifier, challenge };
  }

  // ── AUTH ──────────────────────────────────────────────
  function init(clientId, redirectUri) {
    _clientId = clientId; _redirectUri = redirectUri;
    const s = _loadAuth();
    if (s) { _accessToken = s.accessToken; _tokenExpiry = s.tokenExpiry; _refreshToken = s.refreshToken; }
  }

  async function startLogin() {
    if (!_clientId) throw new Error('Client ID not set');
    const { verifier, challenge } = await _pkce();
    const state = _randomString(16);
    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('pkce_state', state);
    const p = new URLSearchParams({ client_id: _clientId, response_type: 'code', redirect_uri: _redirectUri,
      scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: challenge });
    window.location.href = `${AUTH_URL}?${p}`;
  }

  async function handleCallback() {
    const p = new URLSearchParams(window.location.search);
    const code = p.get('code'), state = p.get('state'), error = p.get('error');
    if (error) throw new Error(`Spotify auth error: ${error}`);
    if (!code) return false;
    if (state !== sessionStorage.getItem('pkce_state')) throw new Error('State mismatch');
    const verifier = sessionStorage.getItem('pkce_verifier');
    if (!verifier) throw new Error('No PKCE verifier');
    const res = await fetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code,
        redirect_uri: _redirectUri, client_id: _clientId, code_verifier: verifier }).toString(),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(`Token exchange: ${e.error_description||e.error}`); }
    _storeTokens(await res.json());
    sessionStorage.removeItem('pkce_verifier'); sessionStorage.removeItem('pkce_state');
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }

  async function _refreshAccessToken() {
    if (!_refreshToken) throw new Error('No refresh token');
    const res = await fetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: _refreshToken, client_id: _clientId }).toString(),
    });
    if (!res.ok) {
      // invalid_grant = Refresh-Token abgelaufen (ab Juli 2026: nach 6 Monaten).
      // Token verwerfen, KEIN Retry, User muss sich neu einloggen.
      const err = await res.json().catch(() => ({}));
      _clearAuth();
      if (err.error === 'invalid_grant') throw new Error('NOT_AUTHENTICATED');
      throw new Error('Token refresh failed');
    }
    _storeTokens(await res.json());
    return _accessToken;
  }

  function _storeTokens(d) {
    _accessToken = d.access_token;
    _tokenExpiry = Date.now() + d.expires_in * 1000 - 60000;
    if (d.refresh_token) _refreshToken = d.refresh_token;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: _accessToken, tokenExpiry: _tokenExpiry, refreshToken: _refreshToken }));
  }

  function _loadAuth() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); } catch { return null; } }
  function _clearAuth() { _accessToken=null; _tokenExpiry=0; _refreshToken=null; localStorage.removeItem(STORAGE_KEY); }
  function logout()    { _clearAuth(); }
  function isLoggedIn(){ return !!_accessToken; }

  async function getToken() {
    if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
    if (_refreshToken) return _refreshAccessToken();
    return null;
  }

  // ── HTTP ──────────────────────────────────────────────
  const _sleep = ms => new Promise(r => setTimeout(r, ms));

  async function _throttle() {
    const wait = MIN_INTERVAL - (Date.now() - _lastRequest);
    if (wait > 0) await _sleep(wait);
    _lastRequest = Date.now();
  }

  async function _fetch(endpoint, options = {}, retryCount = 0) {
    await _throttle();
    const token = await getToken();
    if (!token) throw new Error('NOT_AUTHENTICATED');
    const url = endpoint.startsWith('http') ? endpoint : `${BASE}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers||{}) },
    });

    if (res.status === 401) {
      if (!retryCount) { await _refreshAccessToken(); return _fetch(endpoint, options, 1); }
      _clearAuth(); throw new Error('NOT_AUTHENTICATED');
    }
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After')||'30', 10);
      console.warn(`[API] Rate limited, waiting ${wait}s… (attempt ${retryCount + 1}/3)`);
      await _sleep(wait * 1000);
      if (retryCount < 3) return _fetch(endpoint, options, retryCount + 1);
      throw new Error('Rate limit exceeded — bitte später versuchen');
    }
    if (res.status === 403) {
      const d = await res.json().catch(()=>({}));
      if (d.error?.reason === 'PREMIUM_REQUIRED') throw new Error('PREMIUM_REQUIRED');
      throw new Error(`Forbidden: ${d.error?.message||res.status}`);
    }
    if (res.status === 204 || res.status === 202) return null;
    if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(`HTTP ${res.status}: ${JSON.stringify(d)}`); }
    return res.json();
  }

  // ── ALBUM CACHE ───────────────────────────────────────
  // Server-Cache URL — wird von app.js gesetzt
  let _serverCacheUrl = null;
  function setServerCacheUrl(url) { _serverCacheUrl = url; }

  // Kompletten Cache vom Server laden (einmalig beim Start)
  async function loadServerCache() {
    if (!_serverCacheUrl) return false;
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${_serverCacheUrl}/api/cache`, { signal: controller.signal });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.cache) return false;
      let count = 0;
      for (const [artistId, entry] of Object.entries(data.cache)) {
        // Nur laden wenn noch frisch (max 24h alt)
        if (entry.ts && Date.now() - entry.ts < CACHE_TTL) {
          _albumCache.set(artistId, entry);
          count++;
        }
      }
      console.log(`[Cache] Loaded ${count} artists from server`);
      return count > 0;
    } catch { return false; }
  }

  // Cache-Eintrag zum Server hochladen (nach Spotify-Abruf)
  async function _pushCacheToServer(artistId, entry) {
    if (!_serverCacheUrl) return;
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      await fetch(`${_serverCacheUrl}/api/cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, albums: entry.albums, ts: entry.ts }),
        signal: controller.signal,
      });
    } catch { /* fire and forget */ }
  }

  // ── TRACK CACHE ───────────────────────────────────────
  async function _getCachedTracks(albumId, albumData) {
    const cached = _trackCache.get(albumId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.tracks;
    const data = await _fetch(`/albums/${albumId}/tracks?limit=50&market=${_userMarket}`).catch(()=>null);
    if (!data?.items?.length) return [];
    const tracks = _enrichTracks(data.items, albumData);
    const entry = { tracks, ts: Date.now() };
    _trackCache.set(albumId, entry);
    _pushTrackCacheToServer(albumId, entry);
    return tracks;
  }

  async function _pushTrackCacheToServer(albumId, entry) {
    if (!_serverCacheUrl) return;
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      await fetch(`${_serverCacheUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId, tracks: entry.tracks, ts: entry.ts }),
        signal: controller.signal,
      });
    } catch { /* fire and forget */ }
  }

  async function loadServerTrackCache() {
    if (!_serverCacheUrl) return false;
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${_serverCacheUrl}/api/tracks`, { signal: controller.signal });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.cache) return false;
      let count = 0;
      for (const [albumId, entry] of Object.entries(data.cache)) {
        if (entry.ts && Date.now() - entry.ts < CACHE_TTL) {
          _trackCache.set(albumId, entry);
          count++;
        }
      }
      console.log(`[Cache] Loaded ${count} album track lists from server`);
      return count > 0;
    } catch { return false; }
  }

  async function _getCachedAlbums(artistId) {
    // 1. In-Memory Cache prüfen
    const cached = _albumCache.get(artistId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.albums;
    // 2. Spotify API abrufen
    const albums = [];
    for (let offset = 0; offset < 40; offset += 10) {
      const data = await _fetch(`/artists/${artistId}/albums?include_groups=album,single&limit=10&offset=${offset}`).catch(()=>null);
      const items = data?.items || [];
      albums.push(...items);
      if (items.length < 10) break;
    }
    const entry = { albums, ts: Date.now() };
    _albumCache.set(artistId, entry);
    // 3. Zum Server pushen damit andere Geräte / nächster Start davon profitieren
    _pushCacheToServer(artistId, entry);
    return albums;
  }

  // ── HELPERS ───────────────────────────────────────────
  function _enrichTracks(tracks, album) {
    const albumArt = album.images?.[0]?.url || '';
    return tracks.map(t => ({
      ...t, albumArt,
      album: { name: album.name, release_date: album.release_date, album_type: album.album_type, images: album.images },
    }));
  }

  function _applyFilters(tracks, filters, blacklist) {
    let r = tracks.filter(t => !blacklist.has(t.id));
    if (filters.noLive) {
      const LIVE_ALBUM = ['live', 'concert', 'unplugged'];
      // Für Tracknamen nur eindeutige Muster — "live" allein trifft zu viele Songnamen
      const LIVE_TRACK = [' live', '(live', '- live', 'live at ', 'live in ', 'unplugged', 'concert'];
      r = r.filter(t => {
        const track = (t.name||'').toLowerCase();
        const album = (t.album?.name||'').toLowerCase();
        if (LIVE_ALBUM.some(k => album.includes(k))) return false;
        if (LIVE_TRACK.some(k => track.includes(k))) return false;
        return true;
      });
    }
    if (filters.noInstrumental) {
      r = r.filter(t => {
        const n = (t.name||'').toLowerCase();
        return !n.includes('instrumental') && !n.includes('karaoke') &&
               !n.includes('backing track') && !n.includes('playback') &&
               !n.includes('(inst') && !n.includes('inst.');
      });
    }
    if (filters.noOrchestral) {
      r = r.filter(t => {
        const track = (t.name||'').toLowerCase();
        const album = (t.album?.name||'').toLowerCase();
        return !track.includes('orchestral') && !album.includes('orchestral');
      });
    }
    if (filters.noAcoustic) {
      r = r.filter(t => {
        const track = (t.name||'').toLowerCase();
        const album = (t.album?.name||'').toLowerCase();
        const ACOUSTIC = ['acoustic', 'acoustique', 'akustik', 'unplugged', 'stripped'];
        return !ACOUSTIC.some(k => track.includes(k) || album.includes(k));
      });
    }
    if (filters.yearFrom || filters.yearTo) {
      r = r.filter(t => {
        const y = parseInt((t.album?.release_date||'0').slice(0,4), 10);
        if (filters.yearFrom && y < filters.yearFrom) return false;
        if (filters.yearTo   && y > filters.yearTo)   return false;
        return true;
      });
    }
    return r;
  }

  // ── PUBLIC ────────────────────────────────────────────
  async function getMe() {
    // Hinweis: Seit Feb 2026 liefert /me kein country/email/product mehr.
    // Der Marktcode kommt daher aus localStorage (as_market) mit Fallback DE.
    return _fetch('/me');
  }
  async function getArtistAlbums(id, limit=10, offset=0) {
    return (await _fetch(`/artists/${id}/albums?include_groups=album,single&limit=${limit}&offset=${offset}`))?.items || [];
  }
  async function searchArtists(q, limit=8) {
    if (!q.trim()) return [];
    return (await _fetch(`/search?${new URLSearchParams({q, type:'artist', limit})}`))?.artists?.items || [];
  }
  async function getDevices()          { return (await _fetch('/me/player/devices'))?.devices || []; }

  async function playTrack(trackUri, deviceId) {
    await _fetch(`/me/player/play${deviceId?`?device_id=${deviceId}`:''}`, { method:'PUT', body: JSON.stringify({ uris:[trackUri] }) });
  }
  async function setVolume(vol, deviceId) {
    await _fetch(`/me/player/volume?volume_percent=${Math.round(vol)}${deviceId?`&device_id=${deviceId}`:''}`, { method:'PUT' });
  }
  async function seek(ms, deviceId) {
    await _fetch(`/me/player/seek?position_ms=${Math.round(ms)}${deviceId?`&device_id=${deviceId}`:''}`, { method:'PUT' });
  }
  async function transferPlayback(deviceId, play=true) {
    await _fetch('/me/player', { method:'PUT', body: JSON.stringify({ device_ids:[deviceId], play }) });
  }
  async function setRepeat(state, deviceId) {
    await _fetch(`/me/player/repeat?state=${state}${deviceId?`&device_id=${deviceId}`:''}`, { method:'PUT' });
  }

  async function getRandomTrack(artistId, filters={}, blacklist=new Set(), history=new Set(), onlyNew=false, artistTrackHistory={}, artistRepeatLimit=3) {
    let albums = await _getCachedAlbums(artistId);
    if (!albums.length) return null;
    if (filters.noLive) albums = albums.filter(a=>{ const n=(a.name||'').toLowerCase(); return !n.includes('live')&&!n.includes('concert')&&!n.includes('unplugged')&&a.album_type!=='live'; });
    if (filters.yearFrom||filters.yearTo) {
      albums = albums.filter(a=>{ const y=parseInt((a.release_date||'0').slice(0,4),10); if(filters.yearFrom&&y<filters.yearFrom)return false; if(filters.yearTo&&y>filters.yearTo)return false; return true; });
    }
    if (!albums.length) return null;
    // Alle gespielten Tracks dieses Artists sperren — erst resetten wenn Diskografie erschöpft
    const playedForArtist = new Set(artistTrackHistory[artistId] || []);
    // Alben in zufälliger Reihenfolge (Sicherheitslimit gegen Riesen-Diskografien)
    const candidates = [...albums].sort(()=>Math.random()-0.5).slice(0, 25);

    // WICHTIG: Erst ALLE Tracks aller Kandidaten-Alben sammeln, dann gleichverteilt
    // einen Track wählen. Früher wurde erst ein Album gewählt und dann ein Track daraus —
    // dadurch waren Singles/kurze Alben massiv überrepräsentiert (ein Track auf einer
    // Single hatte 100% Chance, ein Track auf einem 15-Track-Album nur 1/15).
    let allTracks = [];
    for (const album of candidates) {
      const raw = await _getCachedTracks(album.id, album);
      if (raw.length) allTracks.push(...raw);
    }
    // Duplikate entfernen (gleicher Track auf mehreren Alben/Compilations)
    const seen = new Set();
    allTracks = allTracks.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });

    // Filter anwenden
    let tracks = _applyFilters(allTracks, filters, blacklist);
    if (onlyNew) { const f = tracks.filter(t=>!history.has(t.id)); if (f.length) tracks = f; }

    // Bereits gespielte Tracks dieses Artists ausschließen (Sperre)
    if (playedForArtist.size) {
      const f = tracks.filter(t=>!playedForArtist.has(t.id));
      if (f.length) {
        // Gleichverteilt aus allen ungespielten Tracks wählen
        return f[Math.floor(Math.random()*f.length)];
      }
      // Alle Tracks gespielt → Diskografie erschöpft, History zurücksetzen
      console.log(`[Shuffle] Diskografie von Artist ${artistId} erschöpft — History reset`);
      artistTrackHistory[artistId] = [];
    }

    // Keine Sperre aktiv (oder gerade resettet) → gleichverteilt aus allen Tracks
    if (tracks.length) return tracks[Math.floor(Math.random()*tracks.length)];
    return null;
  }

  async function getArtistAlbumsFull(artistId) { return _getCachedAlbums(artistId); }

  async function getRandomTrackFromAlbum(albumId, albumData, blacklist=new Set(), history=new Set(), onlyNew=false) {
    const data = await _fetch(`/albums/${albumId}/tracks?limit=50&market=${_userMarket}`).catch(()=>null);
    if (!data?.items?.length) return null;
    let tracks = _applyFilters(_enrichTracks(data.items, albumData), {}, blacklist);
    if (onlyNew) { const f=tracks.filter(t=>!history.has(t.id)); if(f.length) tracks=f; }
    if (!tracks.length) return null;
    return tracks[Math.floor(Math.random()*tracks.length)];
  }

  // Genre-Shuffle — seit Feb 2026 ist limit bei /search auf max. 10 begrenzt.
  // Die Suche selbst bleibt verfügbar; nur das zu hohe Limit (50/20) warf zuvor
  // den irreführenden 400 "Invalid limit".
  async function getRandomTrackByGenre(genre, filters={}, blacklist=new Set()) {
    const tryQuery = async (q, offset=0) => {
      const params = new URLSearchParams({ q, type: 'track', limit: '10' });
      if (offset) params.set('offset', String(offset));
      let data = null;
      try {
        data = await _fetch(`/search?${params}`);
      } catch { return []; }
      let tracks = (data?.tracks?.items||[]).map(t=>({...t, albumArt: t.album?.images?.[0]?.url||''}));
      return _applyFilters(tracks, filters, blacklist);
    };
    // 1. genre:-Filter, verschiedene Offsets (offset+limit ≤ 1000)
    for (const offset of [0, 40, 100, 200, 400].sort(()=>Math.random()-0.5)) {
      const tracks = await tryQuery(`genre:${genre}`, offset);
      if (tracks.length) return tracks[Math.floor(Math.random()*tracks.length)];
    }
    // 2. Fallback: Freitext (Spezial-Genres sind oft nicht im genre:-Filter)
    for (const offset of [0, 30, 60]) {
      const tracks = await tryQuery(genre.replace(/-/g, ' '), offset);
      if (tracks.length) return tracks[Math.floor(Math.random()*tracks.length)];
    }
    return null;
  }

  function getAvailableGenres() {
    // Statische Liste gängiger Spotify-Genres (der /recommendations/available-genre-seeds
    // Endpunkt wurde 2024 entfernt). Für die Genre-Suche als Vorschläge.
    return [
      'acoustic','alternative','ambient','black-metal','blues','classical','club',
      'country','dance','death-metal','deep-house','disco','drum-and-bass','dubstep',
      'edm','electro','electronic','folk','folk-metal','funk','garage','gospel','goth',
      'grindcore','groove','grunge','hard-rock','hardcore','hardstyle','heavy-metal',
      'hip-hop','house','indie','indie-pop','industrial','jazz','k-pop','melodic-death-metal',
      'metal','metalcore','new-age','opera','pop','pop-rock','power-metal','progressive-house',
      'progressive-metal','psychedelic','punk','punk-rock','r-n-b','reggae','reggaeton','rock',
      'rock-n-roll','singer-songwriter','ska','soul','soundtrack','swedish','symphonic-metal',
      'synth-pop','techno','thrash-metal','trance','trip-hop','viking-metal',
    ];
  }

  return {
    init, startLogin, handleCallback, logout, isLoggedIn, getToken,
    getMe, searchArtists, getArtistAlbums,
    getDevices, playTrack, setVolume, seek, transferPlayback, setRepeat,
    getRandomTrack, getArtistAlbumsFull, getRandomTrackFromAlbum,
    getRandomTrackByGenre, getAvailableGenres,
    setServerCacheUrl, loadServerCache, loadServerTrackCache,
  };

})();
