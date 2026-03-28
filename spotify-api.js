/* ═══════════════════════════════════════════════════════
   ARTIST SHUFFLE — spotify-api.js
   Spotify Web API Wrapper + OAuth PKCE Flow
   ═══════════════════════════════════════════════════════ */

'use strict';

const SpotifyAPI = (() => {

  // ── CONFIG ────────────────────────────────────────────
  const SCOPES = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'streaming',
    'user-read-email',
    'user-read-private',
  ].join(' ');

  const BASE = 'https://api.spotify.com/v1';
  const AUTH_URL = 'https://accounts.spotify.com/authorize';
  const TOKEN_URL = 'https://accounts.spotify.com/api/token';
  const STORAGE_KEY = 'spotify_auth';

  let _accessToken = null;
  let _tokenExpiry = 0;
  let _refreshToken = null;
  let _clientId = null;
  let _redirectUri = null;

  // ── PKCE HELPERS ──────────────────────────────────────
  function _randomString(len = 64) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => chars[b % chars.length]).join('');
  }

  async function _sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return crypto.subtle.digest('SHA-256', data);
  }

  function _base64urlEncode(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    bytes.forEach(b => str += String.fromCharCode(b));
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  async function _generatePKCE() {
    const verifier = _randomString(64);
    const hashed = await _sha256(verifier);
    const challenge = _base64urlEncode(hashed);
    return { verifier, challenge };
  }

  // ── AUTH ──────────────────────────────────────────────
  function init(clientId, redirectUri) {
    _clientId = clientId;
    _redirectUri = redirectUri;

    // Try to restore from storage
    const stored = _loadAuth();
    if (stored) {
      _accessToken = stored.accessToken;
      _tokenExpiry = stored.tokenExpiry;
      _refreshToken = stored.refreshToken;
    }
  }

  async function startLogin() {
    if (!_clientId) throw new Error('Client ID not set');
    const { verifier, challenge } = await _generatePKCE();
    const state = _randomString(16);

    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('pkce_state', state);

    const params = new URLSearchParams({
      client_id: _clientId,
      response_type: 'code',
      redirect_uri: _redirectUri,
      scope: SCOPES,
      state,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });

    window.location.href = `${AUTH_URL}?${params.toString()}`;
  }

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) throw new Error(`Spotify auth error: ${error}`);
    if (!code) return false;

    const storedState = sessionStorage.getItem('pkce_state');
    if (state !== storedState) throw new Error('State mismatch — possible CSRF');

    const verifier = sessionStorage.getItem('pkce_verifier');
    if (!verifier) throw new Error('No PKCE verifier found');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: _redirectUri,
      client_id: _clientId,
      code_verifier: verifier,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Token exchange failed: ${err.error_description || err.error}`);
    }

    const data = await res.json();
    _storeTokens(data);

    // Clean URL
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('pkce_state');
    window.history.replaceState({}, document.title, window.location.pathname);

    return true;
  }

  async function refreshAccessToken() {
    if (!_refreshToken) throw new Error('No refresh token');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: _refreshToken,
      client_id: _clientId,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      _clearAuth();
      throw new Error('Token refresh failed');
    }

    const data = await res.json();
    _storeTokens(data);
    return _accessToken;
  }

  function _storeTokens(data) {
    _accessToken = data.access_token;
    _tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1min buffer
    if (data.refresh_token) _refreshToken = data.refresh_token;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      accessToken: _accessToken,
      tokenExpiry: _tokenExpiry,
      refreshToken: _refreshToken,
    }));
  }

  function _loadAuth() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function _clearAuth() {
    _accessToken = null;
    _tokenExpiry = 0;
    _refreshToken = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  function logout() { _clearAuth(); }
  function isLoggedIn() { return !!_accessToken; }

  async function getToken() {
    if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
    if (_refreshToken) return refreshAccessToken();
    return null;
  }

  // ── HTTP HELPERS ──────────────────────────────────────
  // Album cache — vermeidet wiederholte API-Calls für dieselben Artists
  const _albumCache = new Map();
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 Stunden

  async function _getCachedAlbums(artistId) {
    const cached = _albumCache.get(artistId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.albums;
    }
    // Fetch fresh
    const albums = await getArtistAlbums(artistId, 10, 0);
    if (albums.length === 10) {
      const more = await getArtistAlbums(artistId, 10, 10).catch(() => []);
      const more2 = await getArtistAlbums(artistId, 10, 20).catch(() => []);
      const more3 = await getArtistAlbums(artistId, 10, 30).catch(() => []);
      albums.push(...more, ...more2, ...more3);
    }
    _albumCache.set(artistId, { albums, ts: Date.now() });
    return albums;
  }

  async function _fetch(endpoint, options = {}, retries = 2) {
    await _throttle();
    const token = await getToken();
    if (!token) throw new Error('NOT_AUTHENTICATED');

    const url = endpoint.startsWith('http') ? endpoint : `${BASE}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      if (retries > 0) {
        await refreshAccessToken();
        return _fetch(endpoint, options, retries - 1);
      }
      _clearAuth();
      throw new Error('NOT_AUTHENTICATED');
    }

    if (res.status === 429) {
      const retry = parseInt(res.headers.get('Retry-After') || '30', 10);
      console.warn(`[API] Rate limited, waiting ${retry}s...`);
      await _sleep(retry * 1000);
      // Only one retry after waiting — no recursive retries
      if (retries > 0) {
        const res2 = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${await getToken()}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        });
        if (res2.status === 429) throw new Error('Rate limit exceeded — bitte später versuchen');
        if (res2.status === 204 || res2.status === 202) return null;
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        return res2.json();
      }
      throw new Error('Rate limit exceeded — bitte später versuchen');
    }

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (data.error?.reason === 'PREMIUM_REQUIRED') throw new Error('PREMIUM_REQUIRED');
      throw new Error(`Forbidden: ${data.error?.message || res.status}`);
    }

    if (res.status === 204 || res.status === 202) return null;

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    }

    return res.json();
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Global rate limiter — max 1 request per 200ms
  let _lastRequestTime = 0;
  const MIN_REQUEST_INTERVAL = 1000; // 1 request per second

  async function _throttle() {
    const now = Date.now();
    const elapsed = now - _lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL) {
      await _sleep(MIN_REQUEST_INTERVAL - elapsed);
    }
    _lastRequestTime = Date.now();
  }

  // ── USER ──────────────────────────────────────────────
  async function getMe() {
    return _fetch('/me');
  }

  // ── SEARCH ────────────────────────────────────────────
  async function searchArtists(query, limit = 8) {
    if (!query.trim()) return [];
    const params = new URLSearchParams({ q: query, type: 'artist', limit });
    const data = await _fetch(`/search?${params}`);
    return data?.artists?.items || [];
  }

  // ── ARTIST ────────────────────────────────────────────
  async function getArtistTopTracks(artistId, market = 'DE') {
    const data = await _fetch(`/artists/${artistId}/top-tracks?market=${market}`);
    return data?.tracks || [];
  }

  async function getRelatedArtists(artistId) {
    const data = await _fetch(`/artists/${artistId}/related-artists`);
    return data?.artists || [];
  }

  async function getArtist(artistId) {
    return _fetch(`/artists/${artistId}`);
  }

  // ── ALBUMS & TRACKS ───────────────────────────────────
  async function getArtistAlbums(artistId, limit = 10, offset = 0) {
    const params = new URLSearchParams({
      include_groups: 'album,single',
      limit: String(Math.min(Number(limit), 10)),
      offset: String(Number(offset)),
    });
    const data = await _fetch(`/artists/${artistId}/albums?${params}`);
    return data?.items || [];
  }

  async function getAlbumTracks(albumId) {
    const data = await _fetch(`/albums/${albumId}/tracks?limit=50`);
    return data?.items || [];
  }

  async function getTrack(trackId) {
    return _fetch(`/tracks/${trackId}`);
  }

  async function getAudioFeatures(trackId) {
    return _fetch(`/audio-features/${trackId}`);
  }

  async function getMultipleAudioFeatures(trackIds) {
    if (!trackIds.length) return [];
    const ids = trackIds.slice(0, 100).join(',');
    const data = await _fetch(`/audio-features?ids=${ids}`);
    return data?.audio_features || [];
  }

  // ── LIBRARY ───────────────────────────────────────────
  async function likeTrack(trackId) {
    await _fetch('/me/tracks', {
      method: 'PUT',
      body: JSON.stringify({ ids: [trackId] }),
    });
  }

  async function unlikeTrack(trackId) {
    await _fetch('/me/tracks', {
      method: 'DELETE',
      body: JSON.stringify({ ids: [trackId] }),
    });
  }

  async function isTrackLiked(trackId) {
    try {
      const data = await _fetch(`/me/tracks/contains?ids=${trackId}`);
      return data?.[0] === true;
    } catch { return false; }
  }

  // ── PLAYBACK ──────────────────────────────────────────
  async function getDevices() {
    const data = await _fetch('/me/player/devices');
    return data?.devices || [];
  }

  async function getPlaybackState() {
    return _fetch('/me/player');
  }

  async function play(deviceId, uris) {
    const body = uris ? { uris } : {};
    await _fetch(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async function playTrack(trackUri, deviceId) {
    await _fetch(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify({ uris: [trackUri] }),
    });
  }

  async function pause(deviceId) {
    await _fetch(`/me/player/pause${deviceId ? `?device_id=${deviceId}` : ''}`, {
      method: 'PUT',
    });
  }

  async function resume(deviceId) {
    await _fetch(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, {
      method: 'PUT',
    });
  }

  async function setVolume(volumePercent, deviceId) {
    await _fetch(`/me/player/volume?volume_percent=${Math.round(volumePercent)}${deviceId ? `&device_id=${deviceId}` : ''}`, {
      method: 'PUT',
    });
  }

  async function seek(positionMs, deviceId) {
    await _fetch(`/me/player/seek?position_ms=${Math.round(positionMs)}${deviceId ? `&device_id=${deviceId}` : ''}`, {
      method: 'PUT',
    });
  }

  async function transferPlayback(deviceId, play = true) {
    await _fetch('/me/player', {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [deviceId], play }),
    });
  }

  async function setRepeat(state, deviceId) {
    // state: 'track' | 'context' | 'off'
    await _fetch(`/me/player/repeat?state=${state}${deviceId ? `&device_id=${deviceId}` : ''}`, {
      method: 'PUT',
    });
  }

  // ── GENRE SEARCH ──────────────────────────────────────
  async function getAvailableGenres() {
    // Endpoint removed by Spotify in 2024 — using curated list
    return [
      'acoustic','afrobeat','alt-rock','alternative','ambient','anime',
      'black-metal','bluegrass','blues','bossanova','brazil','breakbeat',
      'british','cantopop','chicago-house','children','chill','classical',
      'club','comedy','country','dance','dancehall','death-metal','deep-house',
      'detroit-techno','disco','disney','drum-and-bass','dub','dubstep',
      'edm','electro','electronic','emo','folk','forro','french','funk',
      'garage','german','gospel','goth','grindcore','groove','grunge',
      'guitar','happy','hard-rock','hardcore','hardstyle','heavy-metal',
      'hip-hop','holidays','honky-tonk','house','idm','indian','indie',
      'indie-pop','industrial','iranian','j-dance','j-idol','j-pop','j-rock',
      'jazz','k-pop','kids','latin','latino','malay','mandopop','metal',
      'metal-misc','metalcore','minimal-techno','movies','mpb','new-age',
      'new-release','opera','pagode','party','philippines-opm','piano','pop',
      'pop-film','post-dubstep','power-pop','progressive-house','psych-rock',
      'punk','punk-rock','r-n-b','rainy-day','reggae','reggaeton','road-trip',
      'rock','rock-n-roll','rockabilly','romance','sad','salsa','samba',
      'sertanejo','show-tunes','singer-songwriter','ska','sleep','songwriter',
      'soul','soundtracks','spanish','study','summer','swedish','synth-pop',
      'tango','techno','trance','trip-hop','turkish','work-out','world-music',
      // Extra subgenres
      'power-metal','folk-metal','symphonic-metal','viking-metal','doom-metal',
      'speed-metal','thrash-metal','progressive-metal','nu-metal','glam-metal',
      'melodic-death-metal','atmospheric-black-metal','post-rock','math-rock',
      'shoegaze','dream-pop','lo-fi','vaporwave','synthwave','retrowave',
      'darkwave','coldwave','new-wave','post-punk','gothic-rock','noise-rock',
      'stoner-rock','desert-rock','krautrock','space-rock','psychedelic-rock',
      'garage-rock','surf-rock','classic-rock','blues-rock','southern-rock',
      'country-rock','americana','bluegrass','outlaw-country','traditional-country',
    ];
  }

  async function getRandomTrackByGenre(genre, filters = {}, blacklist = new Set()) {
    // Search for tracks in genre
    const query = encodeURIComponent(`genre:${genre}`);
    const offset = Math.floor(Math.random() * 100);
    const data = await _fetch(`/search?q=${query}&type=track&limit=10&offset=${offset}&market=from_token`).catch(() => null);
    let tracks = data?.tracks?.items || [];

    if (!tracks.length) return null;

    // Filter blacklisted
    tracks = tracks.filter(t => !blacklist.has(t.id));

    // Filter live
    if (filters.noLive) {
      tracks = tracks.filter(t => {
        const name = (t.album?.name || '').toLowerCase();
        return !name.includes('live');
      });
    }

    // Year filter
    if (filters.yearFrom || filters.yearTo) {
      tracks = tracks.filter(t => {
        const year = parseInt((t.album?.release_date || '0').slice(0, 4), 10);
        if (filters.yearFrom && year < filters.yearFrom) return false;
        if (filters.yearTo && year > filters.yearTo) return false;
        return true;
      });
    }

    if (!tracks.length) return null;
    return tracks[Math.floor(Math.random() * tracks.length)];
  }

  // ── SHUFFLE LOGIC ─────────────────────────────────────
  /**
   * Get a random track from an artist, applying filters.
   * @param {string} artistId
   * @param {object} filters - { noLive, yearFrom, yearTo, energyMin, energyMax }
   * @param {Set} blacklist - Set of track IDs to skip
   * @param {Set} history - Set of track IDs already played (for discovery mode)
   * @param {boolean} onlyNew - Only tracks not in history
   */
  async function getRandomTrack(artistId, filters = {}, blacklist = new Set(), history = new Set(), onlyNew = false) {
    // 1. Fetch albums (cached to avoid rate limiting)
    let albums = await _getCachedAlbums(artistId);

    if (!albums.length) return null;

    // 2. Filter live albums
    if (filters.noLive) {
      albums = albums.filter(a => {
        const name = (a.name || '').toLowerCase();
        return !name.includes('live') && !name.includes('concert') &&
               !name.includes('unplugged') && a.album_type !== 'live';
      });
    }

    // 3. Year filter on albums
    if (filters.yearFrom || filters.yearTo) {
      albums = albums.filter(a => {
        const year = parseInt((a.release_date || '0').slice(0, 4), 10);
        if (filters.yearFrom && year < filters.yearFrom) return false;
        if (filters.yearTo && year > filters.yearTo) return false;
        return true;
      });
    }

    if (!albums.length) return null;

    // 4. Try up to 5 random albums to find a valid track
    const shuffledAlbums = albums.sort(() => Math.random() - 0.5).slice(0, 5);

    for (const album of shuffledAlbums) {
      const data = await _fetch(`/albums/${album.id}/tracks?limit=50&market=from_token`).catch(() => null);
      let tracks = data?.items || [];

      if (!tracks.length) continue;

      // Enrich tracks with album info including albumArt
      const albumArt = album.images?.[0]?.url || '';
      tracks = tracks.map(t => ({
        ...t,
        albumArt,
        album: {
          name: album.name,
          release_date: album.release_date,
          album_type: album.album_type,
          images: album.images,
        },
      }));

      // Filter blacklisted
      tracks = tracks.filter(t => !blacklist.has(t.id));

      // Only new filter
      if (onlyNew) {
        const fresh = tracks.filter(t => !history.has(t.id));
        if (fresh.length > 0) tracks = fresh;
      }

      if (!tracks.length) continue;

      // Pick random track
      return tracks[Math.floor(Math.random() * tracks.length)];
    }

    return null;
  }

  // ── ALBUM BROWSING ────────────────────────────────────
  async function getArtistAlbumsFull(artistId) {
    return _getCachedAlbums(artistId);
  }

  async function getRandomTrackFromAlbum(albumId, albumData, blacklist = new Set(), history = new Set(), onlyNew = false) {
    const data = await _fetch(`/albums/${albumId}/tracks?limit=50&market=from_token`).catch(() => null);
    let tracks = data?.items || [];
    if (!tracks.length) return null;

    const albumArt = albumData.images?.[0]?.url || '';
    tracks = tracks.map(t => ({
      ...t,
      albumArt,
      album: {
        name: albumData.name,
        release_date: albumData.release_date,
        album_type: albumData.album_type,
        images: albumData.images,
      },
    }));

    tracks = tracks.filter(t => !blacklist.has(t.id));
    if (onlyNew) {
      const fresh = tracks.filter(t => !history.has(t.id));
      if (fresh.length) tracks = fresh;
    }
    if (!tracks.length) return null;
    return tracks[Math.floor(Math.random() * tracks.length)];
  }

  // ── MARKET DETECTION ──────────────────────────────────
  async function getUserMarket() {
    try {
      const me = await getMe();
      return me?.country || 'DE';
    } catch { return 'DE'; }
  }

  // ── PUBLIC API ────────────────────────────────────────
  return {
    init,
    startLogin,
    handleCallback,
    logout,
    isLoggedIn,
    getToken,
    getMe,
    searchArtists,
    getRelatedArtists,
    searchArtists,
    getArtistAlbums,
    getDevices,
    playTrack,
    setVolume,
    seek,
    transferPlayback,
    setRepeat,
    getRandomTrack,
    getArtistAlbumsFull,
    getRandomTrackFromAlbum,
    getRandomTrackByGenre,
    getAvailableGenres,
  };

})();
