/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — app.js  v1.3.3
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── VERSION ───────────────────────────────────────────────────────────────────
const APP_VERSION = '1.3.3';

// ── STATE ─────────────────────────────────────────────────────────────────────
const State = {
  user: null,
  lists: [],
  activeListId: null,
  currentTrack: null,
  isPlaying: false,
  volume: 80,
  isMuted: false,
  prevVolume: 80,
  repeatMode: false,
  position: 0,
  duration: 0,
  queue: [],
  history: [],
  historyIds: new Set(),
  blacklist: [],
  blacklistEnabled: true,
  player: null,
  deviceId: null,
  activeDeviceId: null,
  stats: { plays: [], shuffles: 0 },
  onlyNew: false,
  autoSkip: false,
  autoSkipMin: 60,
  crossfade: false,
  _crossfading: false,
  _autoNextPending: false,
  smartShuffle: true,
  shuffleLog: [],
  artistTrackHistory: {}, // { artistId: [trackId, trackId, ...] }
  roundRobin: false,      // Round-Robin Modus: je ein Song pro Artist reihum
  _rrQueue: [],           // gemischte Artist-Reihenfolge für aktuellen Durchlauf
  _rrIndex: 0,            // aktueller Index in _rrQueue
  _artistCooldown: [],    // [ {artistId, remaining} ] — gesperrte Artists nach RR-Deaktivierung
};

// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────
const LS = {
  _syncTimer: null,
  _statsSyncTimer: null,
  _blacklistSyncTimer: null,
  save() {
    localStorage.setItem('as_lists',     JSON.stringify(State.lists));
    localStorage.setItem('as_blacklist', JSON.stringify(State.blacklist));
    localStorage.setItem('as_stats',     JSON.stringify(State.stats));
    localStorage.setItem('as_volume',    State.volume);
    localStorage.setItem('as_active_list', State.activeListId || '');
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => Sync.save(), 10000);
  },
  saveBlacklistDebounced() {
    localStorage.setItem('as_blacklist', JSON.stringify(State.blacklist));
    clearTimeout(this._blacklistSyncTimer);
    this._blacklistSyncTimer = setTimeout(() => Sync.saveBlacklist(), 10000);
  },
  saveStatsDebounced() {
    localStorage.setItem('as_stats', JSON.stringify(State.stats));
    clearTimeout(this._statsSyncTimer);
    this._statsSyncTimer = setTimeout(() => Sync.saveStats(), 30000);
  },
  load() {
    try { State.lists     = JSON.parse(localStorage.getItem('as_lists')     || '[]'); } catch { State.lists = []; }
    try { State.blacklist = JSON.parse(localStorage.getItem('as_blacklist') || '[]'); } catch { State.blacklist = []; }
    try { State.stats = { plays:[], shuffles:0, ...JSON.parse(localStorage.getItem('as_stats') || '{}') }; } catch {}
    State.volume          = parseInt(localStorage.getItem('as_volume') || '80', 10);
    State.activeListId    = localStorage.getItem('as_active_list') || null;
    State.blacklistEnabled = localStorage.getItem('as_blacklist_enabled') !== 'false';
    // Migration
    State.lists.forEach(l => {
      if (!l.filters) l.filters = defaultFilters();
      if (!l.albums)  l.albums  = [];
      if (!l.genres)  l.genres  = [];
    });
  },
};

function defaultFilters() { return { noLive: false, noInstrumental: false, noAcoustic: false, noOrchestral: false, artistRepeatLimit: 3, yearFrom: null, yearTo: null }; }

// ── SYNC ──────────────────────────────────────────────────────────────────────
const Sync = {
  get url()       { return window.SPOTIFY_CONFIG?.syncUrl   || null; },
  get statsSync() { return window.SPOTIFY_CONFIG?.syncStats !== false; }, // default true wenn syncUrl gesetzt

  async _request(method, endpoint, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const opts = { signal: controller.signal };
      if (method === 'POST') {
        opts.method  = 'POST';
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body    = JSON.stringify(body);
      }
      const res = await fetch(`${this.url}${endpoint}`, opts);
      clearTimeout(timeout);
      return res.ok ? res.json() : null;
    } catch { clearTimeout(timeout); return null; }
  },

  async load() {
    if (!this.url) return false;
    const data = await this._request('GET', '/api/lists');
    if (!data?.lists?.length) return false;
    const serverIds = new Set(data.lists.map(l => l.id));
    const localOnly = State.lists.filter(l => !serverIds.has(l.id));
    State.lists = [...data.lists, ...localOnly];
    State.lists.forEach(l => { if (!l.filters) l.filters = defaultFilters(); if (!l.albums) l.albums = []; if (!l.genres) l.genres = []; });
    LS.save();
    console.log('[Sync] Loaded:', data.lists.length);
    return true;
  },

  async save() {
    if (!this.url) return false;
    const ok = await this._request('POST', '/api/lists', { lists: State.lists });
    if (ok) console.log('[Sync] Saved:', State.lists.length);
    return !!ok;
  },

  async loadStats() {
    if (!this.url || !this.statsSync) return false;
    const data = await this._request('GET', '/api/stats');
    if (!data?.plays) return false;
    // Server-Stats übernehmen (last-write-wins — wir hören nur auf einem Gerät)
    State.stats = { plays: data.plays || [], shuffles: data.shuffles || 0 };
    localStorage.setItem('as_stats', JSON.stringify(State.stats));
    console.log('[Sync] Stats loaded:', data.plays.length, 'plays');
    return true;
  },

  async saveStats() {
    if (!this.url || !this.statsSync) return false;
    const ok = await this._request('POST', '/api/stats', { plays: State.stats.plays, shuffles: State.stats.shuffles });
    if (ok) console.log('[Sync] Stats saved:', State.stats.plays.length, 'plays');
    return !!ok;
  },

  async loadBlacklist() {
    if (!this.url) return false;
    const data = await this._request('GET', '/api/blacklist');
    if (!Array.isArray(data?.blacklist)) return false;
    // Mergen: Server-Einträge + lokale die nicht auf dem Server sind
    const serverIds = new Set(data.blacklist.map(b => b.id));
    const localOnly = State.blacklist.filter(b => !serverIds.has(b.id));
    State.blacklist = [...data.blacklist, ...localOnly];
    localStorage.setItem('as_blacklist', JSON.stringify(State.blacklist));
    console.log('[Sync] Blacklist loaded:', data.blacklist.length, 'tracks');
    return true;
  },

  async saveBlacklist() {
    if (!this.url) return false;
    const ok = await this._request('POST', '/api/blacklist', { blacklist: State.blacklist });
    if (ok) console.log('[Sync] Blacklist saved:', State.blacklist.length, 'tracks');
    return !!ok;
  },

  async check() {
    if (!this.url) return false;
    try {
      const c = new AbortController();
      setTimeout(() => c.abort(), 2000);
      const res = await fetch(`${this.url}/api/health`, { signal: c.signal });
      return res.ok;
    } catch { return false; }
  },
};

// ── PWA ───────────────────────────────────────────────────────────────────────
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  if (!document.getElementById('app')?.classList.contains('hidden')) showInstallBanner();
});

function showInstallBanner() {
  if (document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `<p>${I18N.t('pwa_install')}</p>
    <button class="btn-primary" id="pwa-install-btn">${I18N.t('pwa_install_btn')}</button>
    <button class="pwa-install-close" id="pwa-close-btn">✕</button>`;
  document.body.appendChild(banner);
  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const r = await _deferredPrompt.userChoice;
    if (r.outcome === 'accepted') showToast(I18N.t('pwa_installed'), 'success');
    _deferredPrompt = null; banner.remove();
  });
  document.getElementById('pwa-close-btn').addEventListener('click', () => banner.remove());
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/music-shuffle/service-worker.js')
      .then(r => console.log('[SW] Registered:', r.scope))
      .catch(e => console.warn('[SW] Failed:', e));
  });
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  LS.load();
  const clientId   = window.SPOTIFY_CONFIG?.clientId   || localStorage.getItem('as_client_id') || '';
  const redirectUri = window.SPOTIFY_CONFIG?.redirectUri || '';

  const hint = document.getElementById('redirect-uri-hint');
  if (hint) hint.textContent = redirectUri;

  const savedCid = localStorage.getItem('as_client_id');
  if (savedCid) { const inp = document.getElementById('client-id-input'); if (inp) inp.value = savedCid; }

  SpotifyAPI.init(clientId, redirectUri);

  if (window.location.search.includes('code=')) {
    try { await SpotifyAPI.handleCallback(); await bootApp(); }
    catch (err) { showToast('Login fehlgeschlagen: ' + err.message, 'error'); showLoginScreen(); }
    return;
  }

  if (SpotifyAPI.isLoggedIn()) await bootApp();
  else showLoginScreen();

  bindLoginEvents(clientId, redirectUri);
});

async function bootApp() {
  try { State.user = await SpotifyAPI.getMe(); }
  catch (err) { if (err.message === 'NOT_AUTHENTICATED') { showLoginScreen(); return; } }

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  renderUserInfo();
  I18N.applyAll();
  updateLangBtn();
  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = APP_VERSION;

  const synced = await Sync.load();
  if (synced) console.log('[Sync] Synced');
  await Sync.loadStats();
  await Sync.loadBlacklist();

  // Album-Cache vom Sync-Server laden — reduziert Spotify API Calls beim Start
  if (Sync.url) {
    SpotifyAPI.setServerCacheUrl(Sync.url);
    SpotifyAPI.loadServerCache();
  }

  renderLists();
  renderArtistGrid();
  renderAlbumGrid();
  renderGenreTags();
  renderBlacklist();
  renderStats();
  updateFiltersUI();
  bindAllEvents();
  initSDK();
  setTimeout(() => loadDevices(), 2000);
  setVolume(State.volume);
  updateSyncStatus();
  setupMediaSession();
  if (_deferredPrompt) showInstallBanner();
  updateNotificationBtn();
}

// ── LOGIN ──────────────────────────────────────────────────────────────────────
function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function bindLoginEvents(clientId, redirectUri) {
  const loginBtn = document.getElementById('login-btn');
  const cidInput = document.getElementById('client-id-input');
  loginBtn.addEventListener('click', async () => {
    const cid = cidInput.value.trim() || clientId;
    if (!cid) { showToast('Bitte erst eine Spotify Client ID eintragen', 'error'); cidInput.focus(); return; }
    const uri = window.SPOTIFY_CONFIG?.redirectUri || redirectUri;
    localStorage.setItem('as_client_id', cid);
    SpotifyAPI.init(cid, uri);
    try { await SpotifyAPI.startLogin(); }
    catch (err) { showToast('Login-Fehler: ' + err.message, 'error'); }
  });
  cidInput.addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn.click(); });
}

function renderUserInfo() {
  if (!State.user) return;
  const nameEl   = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  nameEl.textContent = nameEl.title = State.user.display_name || State.user.id;
  const img = State.user.images?.[0]?.url;
  if (img) { avatarEl.src = avatarEl.title = img; avatarEl.classList.remove('hidden'); }
}

// ── SDK ───────────────────────────────────────────────────────────────────────
window.onSpotifyWebPlaybackSDKReady = () => {};

function initSDK() {
  const initFn = () => {
    SpotifyAPI.getToken().then(token => {
      if (!token) return;
      State.player = new Spotify.Player({
        name: 'Music Shuffle',
        getOAuthToken: cb => SpotifyAPI.getToken().then(cb),
        volume: State.volume / 100,
      });
      State.player.addListener('ready', ({ device_id }) => {
        State.deviceId = device_id;
        console.log('[SDK] Ready, device:', device_id);
        setTimeout(() => loadDevices(), 3000);
        showToast(I18N.t('toast_ready'), 'success');
      });
      State.player.addListener('not_ready', () => { State.deviceId = null; showToast(I18N.t('toast_offline'), 'error'); });
      State.player.addListener('player_state_changed', onPlayerStateChanged);
      State.player.addListener('initialization_error', ({ message }) => console.error('[SDK] init:', message));
      State.player.addListener('authentication_error', ({ message }) => { console.error('[SDK] auth:', message); showLoginScreen(); });
      State.player.addListener('account_error', () => showToast('Spotify Premium benötigt', 'error'));
      State.player.addListener('playback_error', ({ message }) => console.error('[SDK] playback:', message));
      State.player.connect();
    });
  };
  if (window.Spotify) initFn(); else window.onSpotifyWebPlaybackSDKReady = initFn;
}

function onPlayerStateChanged(state) {
  if (!state) return;
  State.isPlaying = !state.paused;
  State.position  = state.position;
  State.duration  = state.duration;

  updatePlayPauseUI();
  updateMiniPlayerPlayPause();
  updateProgressUI();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = State.isPlaying ? 'playing' : 'paused';

  const track = state.track_window?.current_track;
  if (track && (!State.currentTrack || State.currentTrack.id !== track.id)) {
    State.currentTrack = {
      id:       track.id,
      name:     track.name,
      uri:      track.uri,
      artist:   track.artists?.[0]?.name || '—',
      artistId: track.artists?.[0]?.uri?.split(':')[2],
      album:    track.album?.name || '—',
      albumId:  track.album?.uri?.split(':')[2] || null,
      albumArt: track.album?.images?.[0]?.url || '',
      duration: state.duration,
    };
    renderNowPlaying(State.currentTrack);
    updateMiniPlayer(State.currentTrack);
    checkAndAddToHistory(State.currentTrack);
    showTrackNotification(State.currentTrack);
    updateMediaSession(State.currentTrack);
  }

  // Auto-next when track ends
  if (state.paused && state.position === 0 && state.track_window?.previous_tracks?.length > 0) {
    if (!State.repeatMode && !State._autoNextPending) {
      State._autoNextPending = true;
      setTimeout(() => { State._autoNextPending = false; playNextFromQueue(); }, 300);
    }
  }

  // Crossfade
  if (State.crossfade && State.duration > 0 && State.isPlaying) {
    const remaining = State.duration - State.position;
    if (remaining < 10000 && remaining > 0 && !State._crossfading) {
      State._crossfading = true;
      const steps = 20, interval = remaining / steps;
      let step = 0;
      const fade = setInterval(() => {
        step++;
        State.player?.setVolume(Math.max(0, (State.volume / 100) * (1 - step / steps))).catch(() => {});
        if (step >= steps) {
          clearInterval(fade);
          State._crossfading = false;
          State.player?.setVolume(State.volume / 100).catch(() => {});
        }
      }, interval);
    }
  } else if (!State.isPlaying) {
    State._crossfading = false;
  }
}

// ── DEVICES ───────────────────────────────────────────────────────────────────
async function loadDevices() {
  try {
    const devices = await SpotifyAPI.getDevices();
    const select  = document.getElementById('device-select');
    const prev    = select.value;
    select.innerHTML = `<option value="">— ${I18N.t('player_device_choose')} —</option>`;

    [...devices].sort((a, b) => {
      if (a.id === State.deviceId) return -1;
      if (b.id === State.deviceId) return  1;
      if (a.is_active) return -1;
      if (b.is_active) return  1;
      return 0;
    }).forEach(d => {
      const opt  = document.createElement('option');
      opt.value  = d.id;
      const icon = d.id === State.deviceId ? '🌐' : d.type === 'Speaker' ? '🔊' : d.type === 'Smartphone' ? '📱' : d.type === 'Computer' ? '💻' : '🎵';
      opt.textContent = `${icon} ${d.name}${d.is_active ? ' ▶' : ''}`;
      select.appendChild(opt);
    });

    if (!devices.length) {
      const opt = document.createElement('option');
      opt.textContent = I18N.t('player_device_not_found');
      select.appendChild(opt);
    }

    // Restore selection
    if (prev && devices.find(d => d.id === prev)) {
      select.value = prev; State.activeDeviceId = prev;
    } else if (State.deviceId) {
      select.value = State.deviceId; State.activeDeviceId = State.deviceId;
    } else {
      const active = devices.find(d => d.is_active);
      if (active) { select.value = active.id; State.activeDeviceId = active.id; }
    }

    // Sync mobile select
    const mob = document.getElementById('mobile-device-select');
    if (mob) { mob.innerHTML = select.innerHTML; mob.value = select.value; }
  } catch (err) { console.warn('[Devices]', err.message); }
}

setInterval(() => { if (SpotifyAPI.isLoggedIn()) loadDevices(); }, 120000);

// Poll player state every 15s
setInterval(async () => {
  if (!State.player || !State.isPlaying) return;
  try { const s = await State.player.getCurrentState(); if (s) { State.position = s.position; State.duration = s.duration; } } catch {}
}, 15000);

// ── LISTS ──────────────────────────────────────────────────────────────────────
function getActiveList() {
  return State.lists.find(l => l.id === State.activeListId) || State.lists[0] || null;
}

function renderLists() {
  const select = document.getElementById('list-select');
  select.innerHTML = '';
  State.lists.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    select.appendChild(opt);
  });
  if (State.activeListId) select.value = State.activeListId;
  else if (State.lists.length) { State.activeListId = State.lists[0].id; select.value = State.activeListId; }

  const active   = getActiveList();
  const nameText = document.getElementById('list-name-text');
  if (nameText) {
    nameText.textContent = active
      ? `${active.name} (${active.artists?.length || 0})`
      : I18N.t('list_none');
  }
}

function createList(name) {
  const list = { id: 'list_' + Date.now(), name: name.trim() || 'Neue Liste', artists: [], albums: [], genres: [], filters: defaultFilters() };
  State.lists.push(list);
  State.activeListId = list.id;
  LS.save(); renderLists(); renderArtistGrid(); renderAlbumGrid(); updateFiltersUI();
  showToast(`Liste "${list.name}" erstellt`, 'success');
}

function deleteActiveList() {
  if (!State.activeListId) return;
  State.lists     = State.lists.filter(l => l.id !== State.activeListId);
  State.activeListId = State.lists[0]?.id || null;
  LS.save(); renderLists(); renderArtistGrid(); renderAlbumGrid(); updateFiltersUI();
}

function renameActiveList(name) {
  const list = getActiveList();
  if (!list) return;
  list.name = name.trim() || list.name;
  LS.save(); renderLists();
  showToast(I18N.t('toast_list_renamed'), 'success');
}

function duplicateActiveList() {
  const list = getActiveList();
  if (!list) return;
  const copy = {
    id: 'list_' + Date.now(),
    name: list.name + ' (Kopie)',
    artists: list.artists.map(a => ({ ...a })),
    albums:  (list.albums  || []).map(a => ({ ...a })),
    genres:  (list.genres  || []).slice(),
    filters: { ...list.filters },
  };
  State.lists.push(copy);
  State.activeListId = copy.id;
  LS.save(); renderLists(); renderArtistGrid(); renderAlbumGrid(); renderGenreTags(); updateFiltersUI();
  showToast(`Liste "${copy.name}" erstellt`, 'success');
}

function mergeListIntoActive(sourceId) {
  const target = getActiveList();
  const source = State.lists.find(l => l.id === sourceId);
  if (!target || !source || target.id === source.id) return;
  let added = 0;
  source.artists.forEach(a => { if (!target.artists.find(x => x.id === a.id)) { target.artists.push({ ...a }); added++; } });
  (source.genres || []).forEach(g => { if (!target.genres.includes(g)) target.genres.push(g); });
  (source.albums || []).forEach(a => { if (!target.albums.find(x => x.id === a.id)) target.albums.push({ ...a }); });
  LS.save(); renderArtistGrid(); renderAlbumGrid(); renderGenreTags(); renderLists();
  showToast(`${added} Artists aus "${source.name}" hinzugefügt`, 'success');
}

// ── ARTIST GRID ───────────────────────────────────────────────────────────────
function renderArtistGrid() {
  const grid  = document.getElementById('artist-grid');
  const empty = document.getElementById('list-empty');
  const list  = getActiveList();
  grid.innerHTML = '';
  const count = list?.artists?.length || 0;
  const countEl = document.getElementById('artist-count');
  if (countEl) countEl.textContent = count ? `(${count})` : '';
  const labelEl = document.getElementById('artist-section-label');
  if (labelEl) labelEl.childNodes[0].textContent = `🎤 ${I18N.getLang() === 'de' ? 'Künstler' : 'Artists'} `;
  if (!count) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  [...list.artists]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .forEach((artist, idx) => {
      const card = document.createElement('div');
      card.className = 'artist-card';
      card.style.animationDelay = `${idx * 0.04}s`;
      card.dataset.artistId = artist.id;
      const img   = artist.images?.[0]?.url || '';
      const genre = artist.genres?.[0] || '';
      const fallback = `data:image/svg+xml,%3Csvg viewBox='0 0 60 60' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='30' fill='%23282828'/%3E%3Ccircle cx='30' cy='24' r='10' fill='%23444'/%3E%3Cellipse cx='30' cy='50' rx='18' ry='12' fill='%23444'/%3E%3C/svg%3E`;
      card.innerHTML = `
        <img class="artist-card-img" src="${img}" alt="${escHtml(artist.name)}" onerror="this.src='${fallback}'" />
        <div class="artist-card-name">${escHtml(artist.name)}</div>
        ${genre ? `<div class="artist-card-genre">${escHtml(genre)}</div>` : ''}
        <button class="artist-card-remove"   data-id="${artist.id}" title="Entfernen">✕</button>
        <button class="artist-card-discovery" data-id="${artist.id}" data-name="${escHtml(artist.name)}" title="Ähnliche Artists">+</button>
        <button class="artist-card-favorite ${artist.favorite ? 'active' : ''}" data-id="${artist.id}" title="Favorit">⭐</button>
      `;
      grid.appendChild(card);
    });
}

function addArtistToList(artist) {
  let list = getActiveList();
  if (!list) { createList('Meine Liste'); list = getActiveList(); }
  if (!list) return;
  if (list.artists.find(a => a.id === artist.id)) {
    showToast(`${artist.name} ${I18N.t('toast_artist_exists')}`, 'info'); return;
  }
  list.artists.push({ id: artist.id, name: artist.name, images: artist.images || [], genres: artist.genres || [], uri: artist.uri });
  LS.save(); renderArtistGrid(); renderLists();
  showToast(`${artist.name} ${I18N.t('toast_artist_added')}`, 'success');
}

function toggleArtistFavorite(artistId) {
  const list   = getActiveList();
  const artist = list?.artists?.find(a => a.id === artistId);
  if (!artist) return;
  artist.favorite = !artist.favorite;
  LS.save(); renderArtistGrid();
  showToast(artist.favorite ? `⭐ ${artist.name} als Favorit markiert` : `${artist.name} nicht mehr Favorit`, 'info');
}

function removeArtistFromList(artistId) {
  const list = getActiveList();
  if (!list) return;
  list.artists = list.artists.filter(a => a.id !== artistId);
  LS.save(); renderArtistGrid(); renderLists();
}

// ── ALBUM BROWSER ─────────────────────────────────────────────────────────────
let _albumBrowserSelected = new Set();

async function showAlbumBrowser(artistId, artistName) {
  _albumBrowserSelected = new Set();
  document.getElementById('album-browser-title').textContent = artistName;
  document.getElementById('album-browser-sub').textContent   = 'Wähle Alben aus';
  const grid = document.getElementById('album-browser-grid');
  const btn  = document.getElementById('confirm-album-browser');
  grid.innerHTML = '<p style="color:var(--text3);text-align:center;padding:20px">Lade Diskografie…</p>';
  btn.disabled   = true;
  btn.textContent = 'Hinzufügen';
  document.getElementById('modal-album-browser').classList.remove('hidden');

  try {
    const albums = await SpotifyAPI.getArtistAlbumsFull(artistId);
    const list   = getActiveList();
    const existing = new Set((list?.albums || []).map(a => a.id));
    grid.innerHTML = '';
    albums.forEach(album => {
      const card  = document.createElement('div');
      const added = existing.has(album.id);
      card.className   = 'album-browser-card' + (added ? ' added' : '');
      card.dataset.albumId = album.id;
      const img  = album.images?.[0]?.url || '';
      const year = album.release_date?.slice(0, 4) || '';
      card.innerHTML = `
        <div class="album-browser-check ${added ? 'checked' : ''}">✓</div>
        <img src="${img}" alt="${escHtml(album.name)}" onerror="this.style.background='#282828'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px"/>
        <div style="font-size:0.72rem;font-weight:600;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(album.name)}">${escHtml(album.name)}</div>
        <div style="font-size:0.65rem;color:var(--text3)">${year}</div>
      `;
      if (!added) {
        card.addEventListener('click', () => {
          const sel = _albumBrowserSelected.has(album.id);
          if (sel) { _albumBrowserSelected.delete(album.id); card.classList.remove('selected'); card.querySelector('.album-browser-check').classList.remove('checked'); }
          else {
            _albumBrowserSelected.add(album.id);
            card.classList.add('selected');
            card.querySelector('.album-browser-check').classList.add('checked');
            card.dataset.albumData = JSON.stringify({ id: album.id, name: album.name, artistId, artistName, images: album.images, release_date: album.release_date, album_type: album.album_type });
          }
          const n = _albumBrowserSelected.size;
          btn.disabled    = n === 0;
          btn.textContent = n > 0 ? `${n} Album${n > 1 ? 's' : ''} hinzufügen` : 'Hinzufügen';
        });
      }
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--danger);padding:20px">Fehler: ${escHtml(err.message)}</p>`;
  }
}

function addSelectedAlbumsToList() {
  const list = getActiveList();
  if (!list) return;
  const grid = document.getElementById('album-browser-grid');
  let added = 0;
  _albumBrowserSelected.forEach(albumId => {
    const card = grid.querySelector(`[data-album-id="${albumId}"]`);
    if (card?.dataset.albumData) {
      const data = JSON.parse(card.dataset.albumData);
      if (!list.albums.find(a => a.id === albumId)) { list.albums.push(data); added++; }
    }
  });
  LS.save(); renderAlbumGrid();
  document.getElementById('modal-album-browser').classList.add('hidden');
  showToast(`${added} Album${added !== 1 ? 's' : ''} hinzugefügt`, 'success');
}

function renderAlbumGrid() {
  const list    = getActiveList();
  const albums  = list?.albums || [];
  const section = document.getElementById('album-section');
  const grid    = document.getElementById('album-grid');
  if (!albums.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  grid.innerHTML = '';
  const albumCountEl = document.getElementById('album-count');
  if (albumCountEl) albumCountEl.textContent = `(${albums.length})`;
  const albumLabelEl = document.getElementById('album-section-label');
  if (albumLabelEl) albumLabelEl.childNodes[0].textContent = `🎵 ${I18N.getLang() === 'de' ? 'Alben' : 'Albums'} `;
  [...albums]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .forEach(album => {
      const card = document.createElement('div');
      card.className = 'album-card';
      const img  = album.images?.[0]?.url || '';
      const year = album.release_date?.slice(0, 4) || '';
      card.innerHTML = `
        <img src="${img}" alt="${escHtml(album.name)}" onerror="this.style.background='#282828'" class="album-card-img"/>
        <div class="album-card-name" title="${escHtml(album.name)}">${escHtml(album.name)}</div>
        <div class="album-card-artist">${escHtml(album.artistName)} · ${year}</div>
        <button class="album-card-remove" data-id="${album.id}" title="Entfernen">✕</button>
      `;
      card.querySelector('.album-card-remove').addEventListener('click', e => {
        e.stopPropagation();
        list.albums = list.albums.filter(a => a.id !== album.id);
        LS.save(); renderAlbumGrid();
      });
      grid.appendChild(card);
    });
}

// ── GENRES ────────────────────────────────────────────────────────────────────
let _allGenres = [];

async function loadGenres() {
  if (!_allGenres.length) _allGenres = SpotifyAPI.getAvailableGenres();
  return _allGenres;
}

function renderGenreTags() {
  const list      = getActiveList();
  const container = document.getElementById('genre-tags');
  if (!container) return;
  container.innerHTML = '';
  (list?.genres || []).forEach(genre => {
    const tag = document.createElement('span');
    tag.className = 'genre-tag';
    tag.innerHTML = `${escHtml(genre)} <button class="genre-tag-remove" data-genre="${escHtml(genre)}">✕</button>`;
    container.appendChild(tag);
  });
}

function addGenreToList(genre) {
  const list = getActiveList();
  if (!list || list.genres.includes(genre)) return;
  list.genres.push(genre);
  LS.save(); renderGenreTags();
  showToast(`${I18N.t('toast_genre_added')}: ${genre}`, 'success');
}

function removeGenreFromList(genre) {
  const list = getActiveList();
  if (!list) return;
  list.genres = list.genres.filter(g => g !== genre);
  LS.save(); renderGenreTags();
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
let _searchTimer = null;
let _selectedArtists = new Map();

function setupSearch() {
  const input   = document.getElementById('artist-search');
  const results = document.getElementById('search-results');
  const clearBtn = document.getElementById('clear-search');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn.classList.toggle('hidden', !q);
    clearTimeout(_searchTimer);
    if (!q) { results.classList.add('hidden'); return; }
    results.classList.remove('hidden');
    results.innerHTML = '<div class="search-result-loading">Suche…</div>';
    _searchTimer = setTimeout(() => doSearch(q, results), 400);
  });

  clearBtn.addEventListener('click', () => { input.value = ''; clearBtn.classList.add('hidden'); results.classList.add('hidden'); input.focus(); });
  document.addEventListener('click', e => { if (!e.target.closest('.search-section')) results.classList.add('hidden'); });
}

async function doSearch(query, resultsEl) {
  try {
    const artists = await SpotifyAPI.searchArtists(query, 10);
    resultsEl.innerHTML = '';
    _selectedArtists.clear();
    if (!artists.length) { resultsEl.innerHTML = `<div class="search-result-empty">${I18N.t('search_empty')}</div>`; return; }

    const actionBar = document.createElement('div');
    actionBar.className = 'search-action-bar';
    actionBar.innerHTML = `
      <span class="search-selected-count" id="search-selected-count">0 <span data-i18n="search_selected">ausgewählt</span></span>
      <button class="btn-search-add-all" id="search-add-all" disabled data-i18n="search_add_btn">✚ Alle hinzufügen</button>`;
    resultsEl.appendChild(actionBar);

    artists.forEach(artist => {
      const item = document.createElement('div');
      item.className = 'search-result-item search-result-selectable';
      item.dataset.artistId = artist.id;
      const img    = artist.images?.slice(-1)[0]?.url || '';
      const genres = (artist.genres || []).slice(0, 2).join(', ');
      item.innerHTML = `
        <div class="search-result-check"><svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg></div>
        <img src="${img}" alt="" onerror="this.style.background='#282828'" />
        <div>
          <div class="search-result-name">${escHtml(artist.name)}</div>
          ${genres ? `<div class="search-result-genres">${escHtml(genres)}</div>` : ''}
        </div>`;
      item.addEventListener('click', () => {
        if (_selectedArtists.has(artist.id)) { _selectedArtists.delete(artist.id); item.classList.remove('selected'); }
        else { _selectedArtists.set(artist.id, artist); item.classList.add('selected'); }
        const n = _selectedArtists.size;
        document.getElementById('search-selected-count').textContent = n + ' ausgewählt';
        const btn = document.getElementById('search-add-all');
        btn.disabled    = n === 0;
        btn.textContent = n > 0 ? `✚ ${n} hinzufügen` : '✚ Alle hinzufügen';
      });
      resultsEl.appendChild(item);
    });

    document.getElementById('search-add-all').addEventListener('click', () => {
      _selectedArtists.forEach(a => addArtistToList(a));
      const n = _selectedArtists.size;
      _selectedArtists.clear();
      document.getElementById('artist-search').value = '';
      document.getElementById('clear-search').classList.add('hidden');
      resultsEl.classList.add('hidden');
      showToast(`${n} Artists hinzugefügt`, 'success');
    });
  } catch (err) {
    resultsEl.innerHTML = `<div class="search-result-empty">Fehler: ${escHtml(err.message)}</div>`;
  }
}

function setupAlbumArtistSearch() {
  const input    = document.getElementById('album-artist-search');
  const results  = document.getElementById('album-artist-results');
  const clearBtn = document.getElementById('clear-album-search');
  if (!input) return;
  let timer = null;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn.classList.toggle('hidden', !q);
    clearTimeout(timer);
    if (!q) { results.classList.add('hidden'); return; }
    results.classList.remove('hidden');
    results.innerHTML = `<div class="search-result-loading">${I18N.t('search_loading')}</div>`;
    timer = setTimeout(async () => {
      try {
        const artists = await SpotifyAPI.searchArtists(q, 6);
        results.innerHTML = '';
        if (!artists.length) { results.innerHTML = `<div class="search-result-empty">${I18N.t('search_empty')}</div>`; return; }
        artists.forEach(artist => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          const img = artist.images?.slice(-1)[0]?.url || '';
          item.innerHTML = `<img src="${img}" alt="" onerror="this.style.background='#282828'" /><div class="search-result-name">${escHtml(artist.name)}</div>`;
          item.addEventListener('click', () => { input.value = ''; clearBtn.classList.add('hidden'); results.classList.add('hidden'); showAlbumBrowser(artist.id, artist.name); });
          results.appendChild(item);
        });
      } catch (err) { results.innerHTML = `<div class="search-result-empty">Fehler: ${escHtml(err.message)}</div>`; }
    }, 400);
  });

  clearBtn?.addEventListener('click', () => { input.value = ''; clearBtn.classList.add('hidden'); results.classList.add('hidden'); input.focus(); });
  document.addEventListener('click', e => { if (!e.target.closest('#album-search-section')) results.classList.add('hidden'); });
}

function setupGenreSearch() {
  const input    = document.getElementById('genre-search-input');
  const results  = document.getElementById('genre-results');
  const clearBtn = document.getElementById('genre-clear-btn');
  if (!input) return;

  input.addEventListener('focus', async () => { await loadGenres(); showGenreResults(input.value.trim().toLowerCase(), results); });
  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn?.classList.toggle('hidden', !q);
    showGenreResults(q.toLowerCase(), results);
  });
  clearBtn?.addEventListener('click', () => { input.value = ''; clearBtn.classList.add('hidden'); results.classList.add('hidden'); input.focus(); });
  document.addEventListener('click', e => { if (!e.target.closest('.genre-section')) results.classList.add('hidden'); });
  document.getElementById('genre-tags')?.addEventListener('click', e => {
    const btn = e.target.closest('.genre-tag-remove');
    if (btn) removeGenreFromList(btn.dataset.genre);
  });
}

function showGenreResults(query, resultsEl) {
  const filtered = query ? _allGenres.filter(g => g.includes(query)).slice(0, 20) : _allGenres.slice(0, 20);
  const list     = getActiveList();
  const existing = new Set(list?.genres || []);
  resultsEl.innerHTML = '';
  if (!filtered.length) { resultsEl.innerHTML = `<div class="search-result-empty">${I18N.t('search_genre_empty')}</div>`; resultsEl.classList.remove('hidden'); return; }

  filtered.forEach(genre => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    const sel = existing.has(genre);
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;width:100%">
        <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${sel?'var(--accent)':'var(--border)'};background:${sel?'var(--accent)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${sel?'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>':''}
        </div>
        <span class="search-result-name">${escHtml(genre)}</span>
      </div>`;
    item.addEventListener('click', () => {
      if (existing.has(genre)) { removeGenreFromList(genre); existing.delete(genre); }
      else { addGenreToList(genre); existing.add(genre); }
      showGenreResults(query, resultsEl);
    });
    resultsEl.appendChild(item);
  });
  resultsEl.classList.remove('hidden');
}

// ── FILTERS ───────────────────────────────────────────────────────────────────
function updateFiltersUI() {
  const list = getActiveList();
  const f    = list?.filters || defaultFilters();
  document.getElementById('filter-no-live').checked = !!f.noLive;
  document.getElementById('filter-no-instrumental').checked = !!f.noInstrumental;
  document.getElementById('filter-no-acoustic').checked = !!f.noAcoustic;
  document.getElementById('filter-no-orchestral').checked = !!f.noOrchestral;
  const repeatLimit = document.getElementById('filter-artist-repeat-limit');
  if (repeatLimit) repeatLimit.value = f.artistRepeatLimit ?? 3;

  const fromInput = document.getElementById('filter-year-from');
  const fromBtn   = document.getElementById('filter-year-from-toggle');
  if (f.yearFrom) { fromInput.value = f.yearFrom; fromInput.classList.remove('hidden'); fromBtn.classList.add('active'); }
  else            { fromInput.value = '';          fromInput.classList.add('hidden');    fromBtn.classList.remove('active'); }

  const toInput = document.getElementById('filter-year-to');
  const toBtn   = document.getElementById('filter-year-to-toggle');
  if (f.yearTo) { toInput.value = f.yearTo; toInput.classList.remove('hidden'); toBtn.classList.add('active'); }
  else          { toInput.value = '';        toInput.classList.add('hidden');    toBtn.classList.remove('active'); }

  updateFiltersBadge(f);
}

function saveFilters() {
  const list = getActiveList();
  if (!list) return;
  list.filters = {
    noLive:          document.getElementById('filter-no-live').checked,
    noInstrumental:  document.getElementById('filter-no-instrumental').checked,
    noAcoustic:      document.getElementById('filter-no-acoustic').checked,
    noOrchestral:    document.getElementById('filter-no-orchestral').checked,
    artistRepeatLimit: parseInt(document.getElementById('filter-artist-repeat-limit').value, 10) || 3,
    yearFrom:        parseInt(document.getElementById('filter-year-from').value, 10) || null,
    yearTo:          parseInt(document.getElementById('filter-year-to').value,   10) || null,
  };
  LS.save(); updateFiltersBadge(list.filters);
}

function updateFiltersBadge(f) {
  let n = 0;
  if (f.noLive)          n++;
  if (f.noInstrumental)  n++;
  if (f.noAcoustic)      n++;
  if (f.noOrchestral)    n++;
  if (f.artistRepeatLimit && f.artistRepeatLimit !== 3) n++;
  if (f.yearFrom)        n++;
  if (f.yearTo)          n++;
  const badge = document.getElementById('filters-badge');
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
}

// ── SMART SHUFFLE ─────────────────────────────────────────────────────────────
function pickSmartArtist(artists) {
  if (!artists?.length) return null;
  if (!State.smartShuffle) return artists[Math.floor(Math.random() * artists.length)];

  const now    = Date.now();
  const recent = State.stats.plays.slice(-50);

  const weights = artists.map(a => {
    const base      = a.favorite ? 3 : 1;
    const last      = recent.filter(p => p.artistId === a.id);
    if (!last.length) return 3 * base;
    const ago = (now - Math.max(...last.map(p => p.ts))) / 60000;
    if (ago < 10) return 0.3 * base;
    if (ago < 30) return 0.7 * base;
    if (ago < 60) return 1.5 * base;
    return 3 * base;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < artists.length; i++) { r -= weights[i]; if (r <= 0) return artists[i]; }
  return artists[artists.length - 1];
}

// ── SHUFFLE ───────────────────────────────────────────────────────────────────
function _buildPool(list) {
  const pool = [];
  // Artists get 3 entries each — they have full discographies to pick from
  // Albums get 1 entry each — they are a single album
  // This balances the randomness so a single album doesn't dominate
  // Artists 5× weight — each has a full discography vs a single album
  (list.artists || []).forEach(a => {
    for (let i = 0; i < 5; i++) pool.push({ type: 'artist', data: a });
  });
  (list.albums  || []).forEach(a => pool.push({ type: 'album',  data: a }));
  (list.genres  || []).forEach(g => pool.push({ type: 'genre',  data: g }));
  return pool;
}

async function doShuffle() {
  const list = getActiveList();
  const pool = list ? _buildPool(list) : [];
  if (!pool.length) { showToast(I18N.t('toast_no_artists'), 'error'); return; }

  animateDice();
  State.stats.shuffles++;
  LS.save();

  const blacklistSet = State.blacklistEnabled ? new Set(State.blacklist.map(b => b.id)) : new Set();
  const filters      = list.filters || defaultFilters();

  // Round-Robin: nächsten Artist aus der gemischten Reihenfolge wählen
  let picked;
  if (State.roundRobin && list.artists?.length) {
    // Nur Artists im Pool, keine Alben/Genres für Round-Robin
    const artists = list.artists;
    if (!State._rrQueue.length || State._rrIndex >= State._rrQueue.length) {
      // Neu mischen
      State._rrQueue = [...artists].sort(() => Math.random() - 0.5).map(a => ({ type: 'artist', data: a }));
      State._rrIndex = 0;
    }
    picked = State._rrQueue[State._rrIndex++];
  } else {
    // Artist-Cooldown nach Round-Robin: gesperrte Artists aus Pool filtern
    let filteredPool = pool;
    if (State._artistCooldown.length) {
      const cooledIds = new Set(State._artistCooldown.map(x => x.artistId));
      const reduced = pool.filter(p => p.type !== 'artist' || !cooledIds.has(p.data.id));
      if (reduced.length) filteredPool = reduced;
      // Cooldown runterzählen
      State._artistCooldown = State._artistCooldown
        .map(x => ({ ...x, remaining: x.remaining - 1 }))
        .filter(x => x.remaining > 0);
    }
    picked = filteredPool[Math.floor(Math.random() * filteredPool.length)];
  }

  try {
    let track = null;

    if (picked.type === 'genre') {
      track = await SpotifyAPI.getRandomTrackByGenre(picked.data, filters, blacklistSet);
    } else if (picked.type === 'album') {
      track = await SpotifyAPI.getRandomTrackFromAlbum(picked.data.id, picked.data, blacklistSet, State.historyIds, State.onlyNew);
      if (track) State.shuffleLog.unshift({ trackName: track.name, artistName: picked.data.artistName, reason: '💿 Album', ts: Date.now() });
    } else {
      const artist = State.smartShuffle ? pickSmartArtist(list.artists) : picked.data;
      track = await SpotifyAPI.getRandomTrack(artist.id, filters, blacklistSet, State.historyIds, State.onlyNew, State.artistTrackHistory, filters.artistRepeatLimit ?? 3);
      if (track) State.shuffleLog.unshift({ trackName: track.name, artistName: artist.name, reason: artist.favorite ? '⭐ Favorit' : State.smartShuffle ? '🧠 Smart' : '🎲 Zufall', ts: Date.now() });
    }

    if (State.shuffleLog.length > 20) State.shuffleLog.pop();

    if (!track) { showToast(I18N.t('toast_no_track'), 'info'); return; }
    if (State.autoSkip && track.duration_ms && track.duration_ms < State.autoSkipMin * 1000) {
      showToast(`⏭️ Auto-Skip: ${Math.round(track.duration_ms/1000)}s`, 'info');
      setTimeout(() => doShuffle(), 500); return;
    }

    await playTrack(track);
    setTimeout(() => fillQueue(), 20000);
  } catch (err) { handlePlaybackError(err); }
}

async function playTrack(track) {
  if (!State.activeDeviceId) { showToast(I18N.t('toast_device_none'), 'error'); return; }
  try { await SpotifyAPI.playTrack(track.uri, State.activeDeviceId); }
  catch (err) { handlePlaybackError(err); }
}

async function fillQueue() {
  const list = getActiveList();
  const pool = list ? _buildPool(list).filter(p => p.type !== 'genre') : [];
  if (!pool.length) return;

  const needed = 2 - State.queue.length;
  if (needed <= 0) return;

  const blacklistSet = State.blacklistEnabled ? new Set(State.blacklist.map(b => b.id)) : new Set();
  const filters      = list.filters || defaultFilters();

  for (let i = 0; i < needed; i++) {
    let picked;
    // Round-Robin: Queue-Tracks auch reihum aus Artists wählen
    if (State.roundRobin && list.artists?.length) {
      if (!State._rrQueue.length || State._rrIndex >= State._rrQueue.length) {
        State._rrQueue = [...list.artists].sort(() => Math.random() - 0.5).map(a => ({ type: 'artist', data: a }));
        State._rrIndex = 0;
      }
      picked = State._rrQueue[State._rrIndex++];
    } else {
      picked = pool[Math.floor(Math.random() * pool.length)];
    }
    let track = null;
    try {
      if (picked.type === 'album') {
        track = await SpotifyAPI.getRandomTrackFromAlbum(picked.data.id, picked.data, blacklistSet, State.historyIds, State.onlyNew);
      } else {
        const artist = State.roundRobin ? picked.data : (State.smartShuffle ? pickSmartArtist(list.artists) : picked.data);
        if (artist) track = await SpotifyAPI.getRandomTrack(artist.id, filters, blacklistSet, State.historyIds, State.onlyNew, State.artistTrackHistory, filters.artistRepeatLimit ?? 3);
      }
    } catch {}
    if (track && !State.queue.find(q => q.id === track.id)) { State.queue.push(track); renderQueue(); }
    await new Promise(r => setTimeout(r, 1000));
  }
  renderQueue();
}

async function playNextFromQueue() {
  if (State.queue.length) {
    const track = State.queue.shift();
    renderQueue();
    await playTrack(track);
    setTimeout(() => fillQueue(), 5000);
    return;
  }
  await doShuffle();
}

async function playPrevFromHistory() {
  if (State.history.length < 2) return;
  const prev = State.history[1];
  if (prev) await playTrack(prev);
}

// ── NOW PLAYING ───────────────────────────────────────────────────────────────
function renderNowPlaying(track) {
  document.getElementById('player-idle').classList.add('hidden');
  document.getElementById('now-playing').classList.remove('hidden');

  const artEl = document.getElementById('album-art');
  artEl.classList.add('changing');
  setTimeout(() => { artEl.src = track.albumArt || ''; artEl.classList.remove('changing'); updateBackground(track.albumArt); }, 200);

  document.getElementById('track-name').textContent   = document.getElementById('track-name').title   = track.name;
  document.getElementById('track-artist').textContent = document.getElementById('track-artist').title = track.artist;
  document.getElementById('track-album').textContent  = document.getElementById('track-album').title  = track.album;

  document.getElementById('fs-art').src      = track.albumArt || '';
  document.getElementById('fs-track').textContent  = track.name;
  document.getElementById('fs-artist').textContent = track.artist;
  document.getElementById('fs-bg').style.backgroundImage = `url(${track.albumArt})`;
  document.title = `${track.name} · ${track.artist} — Music Shuffle`;
}

function updateBackground(imageUrl) {
  if (!imageUrl) return;
  const bg = document.getElementById('bg-blur');
  bg.style.backgroundImage = `url(${imageUrl})`;
  bg.classList.add('active');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 4;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 4, 4);
      const d = ctx.getImageData(0, 0, 4, 4).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
      const n = d.length / 4;
      document.documentElement.style.setProperty('--accent-shadow', `rgba(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)},0.6)`);
    } catch {}
  };
  img.src = imageUrl;
}

// ── MEDIA SESSION ─────────────────────────────────────────────────────────────
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play',          () => State.player?.resume());
  navigator.mediaSession.setActionHandler('pause',         () => State.player?.pause());
  navigator.mediaSession.setActionHandler('nexttrack',     () => playNextFromQueue());
  navigator.mediaSession.setActionHandler('previoustrack', () => playPrevFromHistory());
  navigator.mediaSession.setActionHandler('stop',          () => State.player?.pause());
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name, artist: track.artist, album: track.album,
    artwork: track.albumArt ? [{ src: track.albumArt, sizes: '640x640', type: 'image/jpeg' }] : [],
  });
  navigator.mediaSession.playbackState = State.isPlaying ? 'playing' : 'paused';
}

// ── MINI PLAYER ───────────────────────────────────────────────────────────────
function updateMiniPlayer(track) {
  if (!track) return;
  document.getElementById('mini-player')?.classList.remove('hidden');
  const art = document.getElementById('mini-art');
  if (art) art.src = track.albumArt || '';
  const te = document.getElementById('mini-track');   if (te) te.textContent = track.name;
  const ae = document.getElementById('mini-artist'); if (ae) ae.textContent = track.artist;
}

function updateMiniPlayerPlayPause() {
  document.getElementById('mini-play-icon') ?.classList.toggle('hidden',  State.isPlaying);
  document.getElementById('mini-pause-icon')?.classList.toggle('hidden', !State.isPlaying);
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
let _notificationsEnabled = false;

function updateNotificationBtn() {
  const btn = document.getElementById('notification-btn');
  if (!btn || !('Notification' in window)) { if (btn) btn.style.display = 'none'; return; }
  if (Notification.permission === 'granted') { _notificationsEnabled = true; btn.classList.add('active'); btn.title = 'Benachrichtigungen aktiv'; }
  else if (Notification.permission === 'denied') { btn.style.opacity = '0.3'; }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') { _notificationsEnabled = true; return true; }
  if (Notification.permission !== 'denied') {
    _notificationsEnabled = await Notification.requestPermission() === 'granted';
    return _notificationsEnabled;
  }
  return false;
}

function showTrackNotification(track) {
  if (!_notificationsEnabled || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  const n = new Notification(track.name, {
    body: `${track.artist} — ${track.album}`,
    icon: track.albumArt || '/music-shuffle/icons/icon-192.png',
    tag: 'music-shuffle-track', silent: true,
  });
  n.onclick = () => { window.focus(); n.close(); };
  setTimeout(() => n.close(), 5000);
}

// ── PLAYBACK UI ───────────────────────────────────────────────────────────────
function updatePlayPauseUI() {
  document.getElementById('play-icon') ?.classList.toggle('hidden',  State.isPlaying);
  document.getElementById('pause-icon')?.classList.toggle('hidden', !State.isPlaying);
  document.getElementById('fs-play-icon') ?.classList.toggle('hidden',  State.isPlaying);
  document.getElementById('fs-pause-icon')?.classList.toggle('hidden', !State.isPlaying);
}

// ── PROGRESS ──────────────────────────────────────────────────────────────────
let _progressTimer = null;

function startProgressTimer() {
  clearInterval(_progressTimer);
  _progressTimer = setInterval(() => {
    if (!State.isPlaying) return;
    State.position = Math.min(State.position + 1000, State.duration);
    updateProgressUI();
  }, 1000);
}

function updateProgressUI() {
  const pct = State.duration ? (State.position / State.duration) * 100 : 0;
  document.getElementById('progress-fill').style.width  = `${pct}%`;
  document.getElementById('progress-thumb').style.left  = `${pct}%`;
  document.getElementById('time-current').textContent   = msToTime(State.position);
  document.getElementById('time-total').textContent     = msToTime(State.duration);
}

// ── HISTORY ───────────────────────────────────────────────────────────────────
function checkAndAddToHistory(track) {
  if (State.history[0]?.id === track.id) return;
  State.history.unshift({ ...track });
  if (State.history.length > 20) State.history.pop();
  State.historyIds.add(track.id);
  // Artist-Track-History pflegen
  if (track.artistId) {
    if (!State.artistTrackHistory[track.artistId]) State.artistTrackHistory[track.artistId] = [];
    if (!State.artistTrackHistory[track.artistId].includes(track.id))
      State.artistTrackHistory[track.artistId].push(track.id);
  }
  renderHistory();
  trackPlay(track);
}

function renderHistory() {
  const list  = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  list.innerHTML = '';
  if (!State.history.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('history_empty')}</p>`;
    return;
  }
  empty?.classList.add('hidden');
  State.history.forEach((track, idx) => {
    const item = createTrackItem(track, idx, [{ icon: '▶', title: 'Abspielen', action: () => playTrack(track) }, { icon: '🚫', title: 'Zur Blacklist hinzufügen', action: () => addToBlacklist(track) }]);
    if (track.id === State.currentTrack?.id) item.classList.add('playing');
    list.appendChild(item);
  });
}

// ── QUEUE ──────────────────────────────────────────────────────────────────────
function renderQueue() {
  const list  = document.getElementById('queue-list');
  const empty = document.getElementById('queue-empty');
  list.innerHTML = '';
  if (!State.queue.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('queue_empty')}</p><small>${I18N.t('queue_empty_sub')}</small>`;
    return;
  }
  empty?.classList.add('hidden');
  State.queue.forEach((track, idx) => {
    const item = createTrackItem(track, idx + 1, [{ icon: '✕', title: 'Entfernen', action: () => { State.queue.splice(idx, 1); renderQueue(); } }]);
    item.addEventListener('click', e => {
      if (e.target.closest('.track-item-actions')) return;
      State.queue.splice(idx, 1); renderQueue(); playTrack(track);
    });
    list.appendChild(item);
  });
}

// ── BLACKLIST ──────────────────────────────────────────────────────────────────
function addToBlacklist(track) {
  if (!track || State.blacklist.find(b => b.id === track.id)) return;
  State.blacklist.push({ id: track.id, name: track.name, artist: track.artist, albumArt: track.albumArt });
  LS.saveBlacklistDebounced(); renderBlacklist();
  showToast(`"${track.name}" zur Blacklist hinzugefügt`, 'info');
  playNextFromQueue();
}

async function addAlbumToBlacklist() {
  const track = State.currentTrack;
  if (!track) return;
  // Album-ID aus dem aktuellen Track holen
  const albumId = track.albumId || null;
  if (!albumId) {
    // Fallback: nur aktuellen Track blacklisten
    addToBlacklist(track);
    return;
  }
  try {
    const token = await SpotifyAPI.getToken();
    const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50&market=from_token`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Album nicht ladbar');
    const data = await res.json();
    const tracks = data.items || [];
    let added = 0;
    tracks.forEach(t => {
      if (!State.blacklist.find(b => b.id === t.id)) {
        State.blacklist.push({ id: t.id, name: t.name, artist: track.artist, albumArt: track.albumArt });
        added++;
      }
    });
    LS.save(); renderBlacklist();
    showToast(`💿 "${track.album}" — ${added} Tracks zur Blacklist hinzugefügt`, 'info');
    if (added > 0) playNextFromQueue();
  } catch (err) {
    showToast('Fehler beim Laden des Albums: ' + err.message, 'error');
  }
}

function removeFromBlacklist(trackId) {
  State.blacklist = State.blacklist.filter(b => b.id !== trackId);
  LS.saveBlacklistDebounced(); renderBlacklist();
}

function renderBlacklist() {
  const list  = document.getElementById('blacklist-list');
  const empty = document.getElementById('blacklist-empty');
  list.innerHTML = '';
  if (!State.blacklist.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('blacklist_empty')}</p><small>${I18N.t('blacklist_empty_sub')}</small>`;
    return;
  }
  empty?.classList.add('hidden');
  State.blacklist.forEach((track, idx) => {
    list.appendChild(createTrackItem(track, idx + 1, [{ icon: '✕', title: 'Entfernen', action: () => removeFromBlacklist(track.id) }]));
  });
  document.getElementById('blacklist-toggle').checked = State.blacklistEnabled;
}

// ── TRACK ITEM ────────────────────────────────────────────────────────────────
function createTrackItem(track, num, actions = []) {
  const item = document.createElement('div');
  item.className = 'track-item';
  const artist = track.artist || track.artists?.[0]?.name || '';
  const img    = track.albumArt || track.album?.images?.[0]?.url || '';
  item.innerHTML = `
    <span class="track-item-num">${num}</span>
    <img class="track-item-img" src="${img}" alt="" onerror="this.style.background='#282828'" />
    <div class="track-item-info">
      <div class="track-item-name">${escHtml(track.name)}</div>
      <div class="track-item-artist">${escHtml(artist)}</div>
    </div>
    <div class="track-item-actions">${actions.map(a => `<button class="btn-icon" title="${a.title}">${a.icon}</button>`).join('')}</div>`;
  actions.forEach((a, i) => item.querySelectorAll('.track-item-actions .btn-icon')[i]?.addEventListener('click', e => { e.stopPropagation(); a.action(); }));
  return item;
}

// ── SHUFFLE LOG ───────────────────────────────────────────────────────────────
function renderShuffleLog() {
  const list  = document.getElementById('shufflelog-list');
  const empty = document.getElementById('shufflelog-empty');
  if (!list) return;
  list.innerHTML = '';
  if (!State.shuffleLog.length) { empty?.classList.remove('hidden'); if (empty) empty.innerHTML = `<p>${I18N.t('log_empty')}</p>`; return; }
  empty?.classList.add('hidden');
  State.shuffleLog.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'track-item';
    const time = new Date(entry.ts).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    item.innerHTML = `
      <span class="track-item-num" style="font-size:0.7rem;min-width:38px">${time}</span>
      <div class="track-item-info">
        <div class="track-item-name">${escHtml(entry.trackName)}</div>
        <div style="font-size:0.72rem;color:var(--text3);margin-top:2px">${escHtml(entry.artistName)} &nbsp;<span style="color:var(--accent);font-weight:600">${escHtml(entry.reason)}</span></div>
      </div>`;
    list.appendChild(item);
  });
}

// ── MERGE MODAL ───────────────────────────────────────────────────────────────
function showMergeModal() {
  const select = document.getElementById('merge-list-select');
  if (!select) return;
  select.innerHTML = '';
  const active = getActiveList();
  State.lists.filter(l => l.id !== active?.id).forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name + (l.artists?.length ? ` (${l.artists.length})` : '');
    select.appendChild(opt);
  });
  if (!select.options.length) { showToast(I18N.t('toast_no_lists_merge'), 'info'); return; }
  document.getElementById('modal-merge-list').classList.remove('hidden');
}

// ── DISCOVERY ─────────────────────────────────────────────────────────────────
async function showDiscovery(artistId, artistName) {
  const modal    = document.getElementById('modal-discovery');
  const subtitle = document.getElementById('discovery-subtitle');
  const results  = document.getElementById('discovery-results');
  subtitle.textContent = `Ähnliche Artists wie "${artistName}"`;
  results.innerHTML    = `<p style="color:var(--text3);text-align:center;padding:20px">${I18N.t('discovery_loading')}</p>`;
  modal.classList.remove('hidden');
  try {
    const related = await SpotifyAPI.getRelatedArtists(artistId);
    results.innerHTML = '';
    if (!related.length) { results.innerHTML = `<p style="color:var(--text3);text-align:center;padding:20px">${I18N.t('discovery_none')}</p>`; return; }
    const list       = getActiveList();
    const existingIds = new Set(list?.artists?.map(a => a.id) || []);
    related.slice(0, 20).forEach(artist => {
      const card    = document.createElement('div');
      const isAdded = existingIds.has(artist.id);
      card.className = 'discovery-card' + (isAdded ? ' added' : '');
      const img = artist.images?.[1]?.url || artist.images?.[0]?.url || '';
      card.innerHTML = `
        <img src="${img}" alt="${escHtml(artist.name)}" onerror="this.style.background='#282828'" />
        <div class="discovery-card-name">${escHtml(artist.name)}</div>
        <div class="discovery-card-btn">${isAdded ? '✓ In Liste' : '+ Hinzufügen'}</div>`;
      if (!isAdded) {
        card.addEventListener('click', () => {
          addArtistToList(artist);
          card.classList.add('added');
          card.querySelector('.discovery-card-btn').textContent = I18N.t('discovery_added');
          existingIds.add(artist.id);
        });
      }
      results.appendChild(card);
    });
  } catch (err) {
    const isForbidden = err.message?.includes('Forbidden') || err.message?.includes('403');
    if (isForbidden) {
      results.innerHTML = `
        <div style="padding:20px;text-align:center">
          <p style="font-size:1.5rem;margin:0 0 8px">🔒</p>
          <p style="color:var(--text);font-weight:600;margin:0 0 6px">${I18N.t('discovery_forbidden_title')}</p>
          <p style="color:var(--text2);font-size:0.85rem;margin:0">${I18N.t('discovery_forbidden_body')}</p>
        </div>`;
    } else {
      results.innerHTML = `<p style="color:var(--danger);padding:20px">Fehler: ${escHtml(err.message)}</p>`;
    }
  }
}

// ── FULLSCREEN ────────────────────────────────────────────────────────────────
function toggleFullscreen() { document.getElementById('fullscreen-overlay').classList.toggle('hidden'); }

// ── IMPORT / EXPORT ───────────────────────────────────────────────────────────
function exportLists() {
  const blob = new Blob([JSON.stringify({ lists: State.lists, version: 1 }, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'music-shuffle-listen.json'; a.click();
  URL.revokeObjectURL(url);
  showToast(I18N.t('toast_exported'), 'success');
}

function importLists(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.lists)) throw new Error('Ungültiges Format');
      State.lists = [...State.lists, ...data.lists];
      if (!State.activeListId && State.lists.length) State.activeListId = State.lists[0].id;
      LS.save(); renderLists(); renderArtistGrid();
      showToast(`${data.lists.length} Listen importiert`, 'success');
    } catch (err) { showToast('Import fehlgeschlagen: ' + err.message, 'error'); }
  };
  reader.readAsText(file);
}

// ── VOLUME ────────────────────────────────────────────────────────────────────
function setVolume(vol) {
  State.volume = Math.max(0, Math.min(100, vol));
  document.getElementById('volume-slider').value = State.volume;
  State.player?.setVolume(State.volume / 100).catch(() => {});
  localStorage.setItem('as_volume', State.volume);
  const muted = State.isMuted || State.volume === 0;
  document.getElementById('vol-icon') ?.classList.toggle('hidden',  muted);
  document.getElementById('mute-icon')?.classList.toggle('hidden', !muted);
}

function toggleMute() {
  if (State.isMuted) { State.isMuted = false; setVolume(State.prevVolume || 80); }
  else {
    State.prevVolume = State.volume; State.isMuted = true;
    State.player?.setVolume(0).catch(() => {});
    document.getElementById('vol-icon') ?.classList.add('hidden');
    document.getElementById('mute-icon')?.classList.remove('hidden');
  }
}

// ── STATS ──────────────────────────────────────────────────────────────────────
function trackPlay(track) {
  State.stats.plays.push({ trackId: track.id, trackName: track.name, artistId: track.artistId, artistName: track.artist, ts: Date.now(), duration: track.duration || 0 });
  LS.saveStatsDebounced();
  renderStats();
}

function renderStats() {
  const rangeEl = document.getElementById('stats-range');
  const range   = parseInt(rangeEl?.value || '30', 10);
  const since   = isNaN(range) ? 0 : Date.now() - range * 86400000;
  const plays   = State.stats.plays.filter(p => !since || p.ts >= since);

  document.getElementById('stat-total-plays').textContent = plays.length;
  document.getElementById('stat-shuffles').textContent    = State.stats.shuffles;
  const totalMs = plays.reduce((s, p) => s + (p.duration || 0), 0);
  document.getElementById('stat-total-time').textContent  = totalMs >= 3600000 ? (totalMs/3600000).toFixed(1)+'h' : Math.round(totalMs/60000)+'m';

  const artistCounts = {};
  plays.forEach(p => { if (p.artistName) artistCounts[p.artistName] = (artistCounts[p.artistName]||0)+1; });
  renderStatsBars('stats-top-artists', artistCounts, 5);

  const songCounts = {}, songArtists = {};
  plays.forEach(p => { if (!p.trackName) return; songCounts[p.trackName]=(songCounts[p.trackName]||0)+1; if(p.artistName) songArtists[p.trackName]=p.artistName; });
  const expandBtn = document.getElementById('stats-songs-expand');
  const expanded  = expandBtn?.dataset.expanded === '1';
  renderStatsBarsWithArtist('stats-top-songs', songCounts, songArtists, expanded ? 999 : 5);
  if (expandBtn) expandBtn.textContent = expanded ? (I18N.getLang()==='de'?'Weniger':'Show less') : (I18N.getLang()==='de'?'Alle anzeigen':'Show all');

  renderSessionsChart(plays);
}

function renderStatsBarsWithArtist(id, counts, artists, limit) {
  const el = document.getElementById(id);
  if (!el) return;
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, limit);
  const max    = sorted[0]?.[1] || 1;
  el.innerHTML = sorted.map(([name, count]) => `
    <div class="stat-bar-item">
      <div class="stat-bar-label">
        <span title="${escHtml(name)}">${escHtml(name)}${artists[name]?`<span style="color:var(--text3);font-weight:400"> · ${escHtml(artists[name])}</span>`:''}</span>
        <span style="flex-shrink:0">${count}×</span>
      </div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(count/max*100).toFixed(1)}%"></div></div>
    </div>`).join('');
}

function renderStatsBars(id, counts, limit) {
  const el = document.getElementById(id);
  if (!el) return;
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, limit);
  const max    = sorted[0]?.[1] || 1;
  el.innerHTML = sorted.map(([name, count]) => `
    <div class="stat-bar-item">
      <div class="stat-bar-label"><span>${escHtml(name)}</span><span>${count}×</span></div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(count/max*100).toFixed(1)}%"></div></div>
    </div>`).join('');
}

function renderSessionsChart(plays) {
  const el = document.getElementById('stats-sessions');
  if (!el) return;
  const weeks = Array(8).fill(0);
  const now   = Date.now();
  plays.forEach(p => { const w = Math.floor((now - p.ts) / (7 * 86400000)); if (w < 8) weeks[7-w]++; });
  const max = Math.max(...weeks, 1);
  el.innerHTML = weeks.map((v, i) => `<div class="stats-chart-bar" style="height:${(v/max*100).toFixed(1)}%" title="Woche ${i+1}: ${v} Songs"></div>`).join('');
}

// ── PLAYLIST FROM HISTORY ─────────────────────────────────────────────────────
async function createPlaylistFromHistory() {
  if (!State.history.length) { showToast('Verlauf ist leer', 'info'); return; }
  if (!State.user) return;
  const name = `Music Shuffle — ${new Date().toLocaleDateString('de-DE')}`;
  try {
    showToast(I18N.t('toast_playlist_creating'), 'info');
    const token = await SpotifyAPI.getToken();
    const res   = await fetch(`https://api.spotify.com/v1/users/${State.user.id}/playlists`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: 'Erstellt von Music Shuffle', public: false }),
    });
    if (!res.ok) throw new Error('Playlist konnte nicht erstellt werden');
    const playlist = await res.json();
    const uris     = State.history.map(t => t.uri).filter(Boolean).slice(0, 100);
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris }),
    });
    showToast(`✓ "${name}" erstellt (${uris.length} Songs)`, 'success');
  } catch (err) { showToast('Fehler: ' + err.message, 'error'); }
}

// ── ERROR ──────────────────────────────────────────────────────────────────────
let _rateLimitRetryTimer = null;

function handlePlaybackError(err) {
  if (err.message === 'PREMIUM_REQUIRED') {
    showToast(I18N.t('toast_premium'), 'error');
  } else if (err.message === 'NOT_AUTHENTICATED') {
    showLoginScreen();
  } else if (err.message?.includes('No active device')) {
    showToast('Bitte ein Wiedergabegerät auswählen', 'error');
  } else if (err.message?.includes('Rate limit')) {
    if (_rateLimitRetryTimer) return;
    showToast('⏳ Spotify Rate Limit — versuche in 35s erneut…', 'info');
    console.warn('[Playback] Rate limit — retry in 35s');
    _rateLimitRetryTimer = setTimeout(() => {
      _rateLimitRetryTimer = null;
      console.log('[Playback] Rate limit retry…');
      doShuffle();
    }, 35000);
  } else {
    showToast('Fehler: ' + err.message, 'error');
    console.error('[Playback Error]', err);
  }
}

// ── TOAST ──────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 400); }, 3000);
}

// ── DICE ANIMATION ────────────────────────────────────────────────────────────
function animateDice() {
  document.querySelectorAll('.btn-shuffle-big').forEach(btn => {
    btn.classList.add('rolling');
    setTimeout(() => btn.classList.remove('rolling'), 600);
  });
}

// ── KEYBOARD ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  switch (e.code) {
    case 'Space':      e.preventDefault(); State.isPlaying ? State.player?.pause() : State.player?.resume(); break;
    case 'KeyN':       playNextFromQueue(); break;
    case 'KeyP':       playPrevFromHistory(); break;
    case 'KeyF':       toggleFullscreen(); break;
    case 'KeyB':       if (State.currentTrack) addToBlacklist(State.currentTrack); break;
    case 'KeyM':       toggleMute(); break;
    case 'ArrowUp':    e.preventDefault(); setVolume(State.volume + 5); break;
    case 'ArrowDown':  e.preventDefault(); setVolume(State.volume - 5); break;
    default:
      const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
      if (!isNaN(idx) && State.lists[idx]) {
        State.activeListId = State.lists[idx].id;
        document.getElementById('list-select').value = State.activeListId;
        renderArtistGrid(); renderAlbumGrid(); updateFiltersUI(); renderLists();
      }
  }
});

// ── SYNC STATUS ───────────────────────────────────────────────────────────────
function updateSyncStatus() {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;
  if (!Sync.url) { indicator.style.display = 'none'; return; }
  Sync.check().then(ok => {
    indicator.title      = ok ? 'Sync aktiv ✓' : 'Sync-Server nicht erreichbar';
    indicator.style.color = ok ? 'var(--accent)' : 'var(--text3)';
  });
}

function updateLangBtn() {
  const label = document.getElementById('lang-label');
  if (label) label.textContent = I18N.getLang().toUpperCase();
}

// ── BIND ALL EVENTS ───────────────────────────────────────────────────────────
function bindAllEvents() {

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    SpotifyAPI.logout(); State.player?.disconnect();
    showLoginScreen(); document.title = 'Music Shuffle';
  });

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sidebar-view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`view-${tab.dataset.view}`)?.classList.add('active');
      if (tab.dataset.view === 'shufflelog') renderShuffleLog();
    });
  });

  // Mobile menu
  const menuBtn  = document.getElementById('mobile-menu-btn');
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);
  menuBtn.addEventListener('click', () => { sidebar.classList.toggle('open'); backdrop.classList.toggle('visible', sidebar.classList.contains('open')); });
  backdrop.addEventListener('click', () => { sidebar.classList.remove('open'); backdrop.classList.remove('visible'); });

  // List name display
  document.getElementById('list-name-display')?.addEventListener('click', () => {
    const sheet = document.getElementById('sheet-list-picker');
    const items = document.getElementById('sheet-list-items');
    items.innerHTML = '';
    State.lists.forEach(list => {
      const btn = document.createElement('button');
      btn.className   = 'btn-menu-item' + (list.id === State.activeListId ? ' active' : '');
      btn.textContent = list.name + (list.artists?.length ? ` (${list.artists.length})` : '');
      btn.style.fontWeight = list.id === State.activeListId ? '700' : '400';
      btn.addEventListener('click', () => {
        State.activeListId = list.id;
        document.getElementById('list-select').value = list.id;
        localStorage.setItem('as_active_list', list.id);
        sheet.classList.add('hidden');
        renderLists(); renderArtistGrid(); renderAlbumGrid(); renderGenreTags(); updateFiltersUI();
      });
      items.appendChild(btn);
    });
    sheet.classList.remove('hidden');
  });
  document.getElementById('sheet-list-picker')?.addEventListener('click', e => {
    if (e.target === document.getElementById('sheet-list-picker')) document.getElementById('sheet-list-picker').classList.add('hidden');
  });

  // List select
  document.getElementById('list-select').addEventListener('change', e => {
    State.activeListId = e.target.value;
    renderArtistGrid(); renderAlbumGrid(); updateFiltersUI();
    localStorage.setItem('as_active_list', State.activeListId);
  });

  // New list
  const newListModal = document.getElementById('modal-new-list');
  document.getElementById('new-list-btn').addEventListener('click', () => { document.getElementById('new-list-name').value = ''; newListModal.classList.remove('hidden'); setTimeout(() => document.getElementById('new-list-name').focus(), 50); });
  document.getElementById('confirm-new-list').addEventListener('click', () => { createList(document.getElementById('new-list-name').value); newListModal.classList.add('hidden'); });
  document.getElementById('cancel-new-list').addEventListener('click', () => newListModal.classList.add('hidden'));
  document.getElementById('new-list-name').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('confirm-new-list').click(); if (e.key === 'Escape') document.getElementById('cancel-new-list').click(); });

  // List options bottom sheet
  const listOptionsSheet = document.getElementById('modal-list-options');
  const openSheet  = () => listOptionsSheet.classList.remove('hidden');
  const closeSheet = () => listOptionsSheet.classList.add('hidden');

  document.getElementById('list-options-btn').addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); openSheet(); });
  document.getElementById('close-list-options')?.addEventListener('click', closeSheet);
  document.getElementById('close-list-options')?.addEventListener('touchend', e => { e.preventDefault(); closeSheet(); });
  listOptionsSheet?.addEventListener('touchend', e => { if (e.target === listOptionsSheet) closeSheet(); });
  listOptionsSheet?.querySelectorAll('.btn-menu-item').forEach(btn => { btn.addEventListener('touchend', e => { e.preventDefault(); btn.click(); }); });

  // Rename
  document.getElementById('rename-list-btn').addEventListener('click', () => {
    closeSheet();
    const list = getActiveList(); if (!list) return;
    document.getElementById('rename-list-input').value = list.name;
    document.getElementById('modal-rename-list').classList.remove('hidden');
    setTimeout(() => document.getElementById('rename-list-input').focus(), 50);
  });
  document.getElementById('confirm-rename-list').addEventListener('click', () => { renameActiveList(document.getElementById('rename-list-input').value); document.getElementById('modal-rename-list').classList.add('hidden'); });
  document.getElementById('cancel-rename-list').addEventListener('click', () => document.getElementById('modal-rename-list').classList.add('hidden'));
  document.getElementById('rename-list-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('confirm-rename-list').click(); if (e.key === 'Escape') document.getElementById('cancel-rename-list').click(); });

  // Delete
  document.getElementById('delete-list-btn').addEventListener('click', () => { closeSheet(); document.getElementById('modal-delete-list').classList.remove('hidden'); });
  document.getElementById('confirm-delete-list').addEventListener('click', () => { deleteActiveList(); document.getElementById('modal-delete-list').classList.add('hidden'); });
  document.getElementById('cancel-delete-list').addEventListener('click', () => document.getElementById('modal-delete-list').classList.add('hidden'));

  // Duplicate / Merge / Export / Import
  document.getElementById('duplicate-list-btn')?.addEventListener('click', () => { closeSheet(); duplicateActiveList(); });
  document.getElementById('merge-list-btn')?.addEventListener('click', () => { closeSheet(); showMergeModal(); });
  document.getElementById('export-lists-btn').addEventListener('click', () => { closeSheet(); exportLists(); });
  document.getElementById('import-lists-btn').addEventListener('click', () => { closeSheet(); document.getElementById('import-file-input').click(); });
  document.getElementById('import-file-input').addEventListener('change', e => { const f = e.target.files?.[0]; if (f) importLists(f); e.target.value = ''; });

  // Merge modal
  document.getElementById('cancel-merge-list')?.addEventListener('click', () => document.getElementById('modal-merge-list').classList.add('hidden'));
  document.getElementById('confirm-merge-list')?.addEventListener('click', () => {
    const sel = document.getElementById('merge-list-select');
    if (sel.value) mergeListIntoActive(sel.value);
    document.getElementById('modal-merge-list').classList.add('hidden');
  });

  // Album browser
  document.getElementById('close-album-browser')?.addEventListener('click', () => document.getElementById('modal-album-browser').classList.add('hidden'));
  document.getElementById('confirm-album-browser')?.addEventListener('click', addSelectedAlbumsToList);

  // Artist grid
  document.getElementById('artist-grid').addEventListener('click', e => {
    const card = e.target.closest('.artist-card');
    if (!card) return;
    const removeBtn   = e.target.closest('.artist-card-remove');
    const discoverBtn = e.target.closest('.artist-card-discovery');
    const favoriteBtn = e.target.closest('.artist-card-favorite');
    if (removeBtn)   { removeArtistFromList(removeBtn.dataset.id); return; }
    if (discoverBtn) { showDiscovery(discoverBtn.dataset.id, discoverBtn.dataset.name); return; }
    if (favoriteBtn) { toggleArtistFavorite(favoriteBtn.dataset.id); return; }
    const artist = getActiveList()?.artists?.find(a => a.id === card.dataset.artistId);
    if (artist) showAlbumBrowser(artist.id, artist.name);
  });

  // Artist stats close
  document.getElementById('close-artist-stats')?.addEventListener('click', () => document.getElementById('modal-artist-stats').classList.add('hidden'));

  // Discovery
  document.getElementById('discovery-btn').addEventListener('click', () => { if (State.currentTrack?.artistId) showDiscovery(State.currentTrack.artistId, State.currentTrack.artist); });
  document.getElementById('close-discovery').addEventListener('click', () => document.getElementById('modal-discovery').classList.add('hidden'));

  // Changelog
  document.getElementById('changelog-btn')?.addEventListener('click', showChangelog);
  document.getElementById('close-changelog')?.addEventListener('click', () => document.getElementById('modal-changelog').classList.add('hidden'));

  // Language
  document.getElementById('lang-btn')?.addEventListener('click', () => {
    I18N.setLang(I18N.getLang() === 'de' ? 'en' : 'de');
    updateLangBtn();
    renderLists(); renderArtistGrid(); renderAlbumGrid(); renderGenreTags();
    renderQueue(); renderHistory(); renderBlacklist(); renderShuffleLog(); renderStats(); updateFiltersUI();
  });

  // Notifications
  document.getElementById('notification-btn')?.addEventListener('click', async () => {
    const ok = await requestNotificationPermission();
    if (ok) { document.getElementById('notification-btn').classList.add('active'); showToast(I18N.t('toast_notification_on'), 'success'); }
    else showToast(I18N.t('toast_notification_blocked'), 'error');
  });

  // Crossfade
  document.getElementById('crossfade-btn')?.addEventListener('click', () => {
    State.crossfade = !State.crossfade;
    document.getElementById('crossfade-btn').classList.toggle('active', State.crossfade);
    showToast(State.crossfade ? I18N.t('toast_crossfade_on') : I18N.t('toast_crossfade_off'), 'info');
  });

  // Shuffle
  document.getElementById('shuffle-btn-idle').addEventListener('click', doShuffle);
  document.getElementById('shuffle-btn').addEventListener('click', doShuffle);

  // Play/Pause
  ['play-pause-btn', 'fs-play'].forEach(id => document.getElementById(id)?.addEventListener('click', () => { State.isPlaying ? State.player?.pause() : State.player?.resume(); }));

  // Next / Prev
  document.getElementById('next-btn').addEventListener('click', playNextFromQueue);
  document.getElementById('prev-btn').addEventListener('click', playPrevFromHistory);
  document.getElementById('fs-next').addEventListener('click', playNextFromQueue);
  document.getElementById('fs-prev').addEventListener('click', playPrevFromHistory);

  // Repeat
  document.getElementById('repeat-btn').addEventListener('click', () => {
    State.repeatMode = !State.repeatMode;
    document.getElementById('repeat-btn').classList.toggle('active', State.repeatMode);
    SpotifyAPI.setRepeat(State.repeatMode ? 'track' : 'off', State.activeDeviceId).catch(() => {});
    showToast(State.repeatMode ? I18N.t('toast_repeat_on') : I18N.t('toast_repeat_off'), 'info');
  });

  // Volume
  document.getElementById('volume-slider').addEventListener('input', e => { State.isMuted = false; setVolume(parseInt(e.target.value, 10)); });
  document.getElementById('mute-btn').addEventListener('click', toggleMute);

  // Blacklist
  document.getElementById('blacklist-btn').addEventListener('click', () => { if (State.currentTrack) addToBlacklist(State.currentTrack); });
  document.getElementById('blacklist-album-btn').addEventListener('click', () => { addAlbumToBlacklist(); });
  document.getElementById('blacklist-toggle').addEventListener('change', e => { State.blacklistEnabled = e.target.checked; localStorage.setItem('as_blacklist_enabled', State.blacklistEnabled); });

  // Progress bar
  const progressTrack = document.getElementById('progress-track');
  progressTrack.addEventListener('click', e => {
    if (!State.duration) return;
    const rect  = progressTrack.getBoundingClientRect();
    const posMs = ((e.clientX - rect.left) / rect.width) * State.duration;
    State.position = posMs; updateProgressUI();
    SpotifyAPI.seek(posMs, State.activeDeviceId).catch(() => {});
  });

  // Fullscreen
  document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
  document.getElementById('fs-exit').addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('fullscreen-overlay').classList.add('hidden'); });

  // Devices
  document.getElementById('device-select').addEventListener('change', async e => {
    const id = e.target.value;
    if (!id) return;
    State.activeDeviceId = id;
    try { await SpotifyAPI.transferPlayback(id, false); showToast(I18N.t('toast_device_changed'), 'success'); }
    catch (err) { showToast('Geräte-Fehler: ' + err.message, 'error'); }
  });
  document.getElementById('refresh-devices-btn').addEventListener('click', loadDevices);

  // Mobile controls
  document.getElementById('mobile-shuffle-btn')?.addEventListener('click', doShuffle);
  document.getElementById('mini-play-pause')?.addEventListener('click', () => { State.isPlaying ? State.player?.pause() : State.player?.resume(); });
  document.getElementById('mini-next')?.addEventListener('click', playNextFromQueue);
  document.getElementById('mini-shuffle')?.addEventListener('click', doShuffle);

  // Mobile device select
  const mobDevSel = document.getElementById('mobile-device-select');
  if (mobDevSel) {
    mobDevSel.addEventListener('change', e => {
      const id = e.target.value;
      if (!id) return;
      State.activeDeviceId = id;
      document.getElementById('device-select').value = id;
      SpotifyAPI.transferPlayback(id, false).catch(() => {});
      showToast(I18N.t('toast_device_changed'), 'success');
    });
    document.getElementById('mobile-refresh-devices')?.addEventListener('click', loadDevices);
  }

  // Filters
  document.getElementById('filter-no-live').addEventListener('change', saveFilters);
  document.getElementById('filter-no-instrumental').addEventListener('change', saveFilters);
  document.getElementById('filter-no-acoustic').addEventListener('change', saveFilters);
  document.getElementById('filter-no-orchestral').addEventListener('change', saveFilters);
  document.getElementById('filter-artist-repeat-limit').addEventListener('change', saveFilters);
  document.getElementById('filter-year-from').addEventListener('change', saveFilters);
  document.getElementById('filter-year-to').addEventListener('change', saveFilters);
  ['from', 'to'].forEach(dir => {
    const btn   = document.getElementById(`filter-year-${dir}-toggle`);
    const input = document.getElementById(`filter-year-${dir}`);
    btn.addEventListener('click', () => {
      const active = btn.classList.toggle('active');
      input.classList.toggle('hidden', !active);
      if (!active) { input.value = ''; saveFilters(); } else input.focus();
    });
  });

  // Stats
  document.getElementById('stats-range').addEventListener('change', renderStats);
  document.getElementById('stats-songs-expand')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    btn.dataset.expanded = btn.dataset.expanded === '1' ? '0' : '1';
    renderStats();
  });

  // History / Queue
  document.getElementById('clear-history-btn').addEventListener('click', () => { State.history = []; State.historyIds.clear(); renderHistory(); });
  document.getElementById('regenerate-queue-btn').addEventListener('click', () => { State.queue = []; fillQueue(); });

  // Stats reset
  document.getElementById('reset-stats-btn').addEventListener('click', () => {
    if (!confirm(I18N.t('confirm_stats_reset'))) return;
    State.stats = { plays: [], shuffles: 0 }; LS.save(); renderStats();
    showToast(I18N.t('toast_stats_reset'), 'info');
  });

  // Auto-Skip
  const autoSkipBtn = document.getElementById('autoskip-btn');
  if (autoSkipBtn) {
    autoSkipBtn.classList.toggle('active', State.autoSkip);
    autoSkipBtn.addEventListener('click', () => { State.autoSkip = !State.autoSkip; autoSkipBtn.classList.toggle('active', State.autoSkip); showToast(State.autoSkip ? I18N.t('toast_autoskip_on') : I18N.t('toast_autoskip_off'), 'info'); });
  }

  const roundRobinBtn = document.getElementById('round-robin-btn');
  if (roundRobinBtn) {
    roundRobinBtn.classList.toggle('active', State.roundRobin);
    roundRobinBtn.addEventListener('click', () => {
      State.roundRobin = !State.roundRobin;
      if (!State.roundRobin) {
        // Letzte 5 gespielte Artists für je 5 Songs sperren
        const recent = State.history.slice(0, 5)
          .filter(t => t.artistId)
          .reduce((acc, t) => { if (!acc.find(x => x.artistId === t.artistId)) acc.push({ artistId: t.artistId, remaining: 5 }); return acc; }, []);
        State._artistCooldown = recent;
        console.log('[RR] Cooldown gesetzt für', recent.map(x => x.artistId));
      }
      State._rrQueue = []; State._rrIndex = 0;
      roundRobinBtn.classList.toggle('active', State.roundRobin);
      showToast(State.roundRobin ? '🔁 Round Robin aktiv — je ein Song pro Artist' : '🔁 Round Robin deaktiviert', 'info');
    });
  }

  // Smart Shuffle
  const smartToggle = document.getElementById('smart-shuffle-toggle');
  if (smartToggle) {
    smartToggle.checked = State.smartShuffle;
    smartToggle.addEventListener('change', e => { State.smartShuffle = e.target.checked; showToast(State.smartShuffle ? I18N.t('toast_smart_on') : I18N.t('toast_smart_off'), 'info'); });
  }

  // Only New
  const onlyNewBtn = document.getElementById('only-new-btn');
  if (onlyNewBtn) {
    onlyNewBtn.addEventListener('click', () => { State.onlyNew = !State.onlyNew; onlyNewBtn.classList.toggle('active', State.onlyNew); showToast(State.onlyNew ? I18N.t('toast_only_new_on') : I18N.t('toast_only_new_off'), 'info'); });
  }

  // Create playlist
  document.getElementById('create-playlist-btn')?.addEventListener('click', createPlaylistFromHistory);

  // Sync
  document.getElementById('sync-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('sync-btn');
    btn.classList.add('spinning');
    const [ok] = await Promise.all([Sync.load(), Sync.loadStats(), Sync.loadBlacklist()]);
    btn.classList.remove('spinning');
    if (ok) { renderLists(); renderArtistGrid(); renderAlbumGrid(); updateFiltersUI(); renderStats(); renderBlacklist(); showToast(I18N.t('toast_synced'), 'success'); }
    else showToast('Sync fehlgeschlagen', 'error');
  });

  // Search setup
  setupSearch();
  setupAlbumArtistSearch();
  setupGenreSearch();

  // Start progress timer
  startProgressTimer();
}

// ── CHANGELOG ─────────────────────────────────────────────────────────────────
const CHANGELOG = [
  {
    version: '1.3.3',
    date: '2026-04-25',
    label: { de: 'Sideforge & Blacklist-Sync', en: 'Sideforge & Blacklist Sync' },
    added: {
      de: [
        'Sideforge Design System migriert — Ember-Orange Palette, Anvil-Grautöne (ersetzt Spotify-Grün)',
        'Sideforge Logo (SF-Monogramm) im Sidebar-Header neben der Version',
        'Sideforge Logo als Favicon (SVG)',
        'Blacklist-Sync — gesperrte Tracks werden geräteübergreifend über den Sync-Server synchronisiert',
        'Sync-Server: /api/blacklist Endpunkt (GET/POST), blacklist.json in /data/',
        'Verdana als UI-Schrift (Sideforge v1.0.1) — keine Google Fonts mehr, schnellerer Start',
      ],
      en: [
        'Sideforge Design System migrated — Ember orange palette, Anvil warm grays (replaces Spotify green)',
        'Sideforge logo (SF monogram) in sidebar header next to version button',
        'Sideforge logo as favicon (SVG)',
        'Blacklist sync — blacklisted tracks synced across devices via sync server',
        'Sync server: /api/blacklist endpoint (GET/POST), blacklist.json in /data/',
        'Verdana as UI font (Sideforge v1.0.1) — no Google Fonts, faster page load',
      ],
    },
    changed: {
      de: [
        'Google Fonts (Syne, DM Sans) entfernt — Verdana ist auf Windows/macOS/Linux vorinstalliert',
        'Sync-Server /api/health gibt jetzt auch Blacklist-Count zurück',
        'Blacklist-Sync mit Merge-Logik — lokale Einträge bleiben erhalten wenn sie nicht auf dem Server sind',
      ],
      en: [
        'Google Fonts (Syne, DM Sans) removed — Verdana is pre-installed on Windows/macOS/Linux',
        'Sync server /api/health now also returns blacklist count',
        'Blacklist sync uses merge logic — local entries are preserved if not on server',
      ],
    },
  },
  {
    version: '1.3.2',
    date: '2026-04-25',
    label: { de: 'Sideforge v1.0.1 — Verdana', en: 'Sideforge v1.0.1 — Verdana' },
    changed: {
      de: [
        'Schrift auf Verdana umgestellt (Sideforge Design System v1.0.1) — keine Webfont-Downloads mehr, einheitlicher Look auf Windows/macOS/Linux',
        'Google Fonts (Syne, DM Sans) entfernt — schnellerer Seitenstart, kein externer Request mehr',
        'Logo-Schrift (Georgia italic) und Mono-Bereiche unverändert',
      ],
      en: [
        'Font switched to Verdana (Sideforge Design System v1.0.1) — no webfont downloads, consistent look on Windows/macOS/Linux',
        'Google Fonts (Syne, DM Sans) removed — faster page load, no external font request',
        'Logo font (Georgia italic) and mono areas unchanged',
      ],
    },
  },
  {
    version: '1.3.1',
    date: '2026-04-22',
    label: { de: 'Album Blacklist', en: 'Album Blacklist' },
    added: {
      de: ['Album-Blacklist-Button in den Player-Controls — ganzes Album auf einmal sperren (💿-Button neben dem Track-Blacklist-Button)'],
      en: ['Album blacklist button in player controls — blacklist entire album at once (💿 button next to track blacklist button)'],
    },
    fixed: {
      de: ['Album-ID wird jetzt im currentTrack gespeichert — wird für Album-Blacklist benötigt'],
      en: ['Album ID now stored in currentTrack — required for album blacklist feature'],
    },
  },
  {
    version: '1.3.0',
    date: '2026-04-22',
    label: { de: 'Filter & Shuffle Release', en: 'Filter & Shuffle Release' },
    added: {
      de: [
        'Akustik-Filter — Tracks mit "acoustic", "unplugged", "stripped" usw. im Track- oder Albumnamen ausblenden (pro Liste)',
        'Orchestral-Filter — Tracks mit "orchestral" im Track- oder Albumnamen ausblenden (pro Liste)',
        'Artist-Wiederholung konfigurierbar — Anzahl der Tracks zwischen zwei Tracks desselben Artists einstellbar (pro Liste)',
        'Blacklist-Button direkt im Verlauf — 🚫 neben jedem Track ohne Shortcut-Workaround',
        'Round-Robin Modus — je ein Song pro Artist reihum, zufällig gemischt, Button im Player',
        'Track-Sperre pro Artist — jeder Track wird erst wieder gespielt wenn die gesamte Diskografie durch ist',
      ],
      en: [
        'Acoustic filter — hide tracks with "acoustic", "unplugged", "stripped" etc. in track or album name (per list)',
        'Orchestral filter — hide tracks with "orchestral" in track or album name (per list)',
        'Artist repeat limit configurable — set number of tracks between repeats of the same artist (per list)',
        'Blacklist button in history — 🚫 next to every track without needing the keyboard shortcut',
        'Round Robin mode — one song per artist in turn, randomly shuffled, button in player',
        'Per-artist track lock — each track is only repeated after the entire discography has been played',
      ],
    },
    changed: {
      de: [
        'Live-Filter prüft jetzt auch den Tracknamen — "Far from the Fame - Live, at Wacken" wird korrekt gefiltert',
        'Artist-Cooldown nach Round-Robin — die letzten 5 Artists werden nach Deaktivierung für 5 Songs gesperrt',
        'fillQueue im Round-Robin nutzt dieselbe Artist-Reihenfolge wie doShuffle — kein Durcheinander mehr',
      ],
      en: [
        'Live filter now also checks track name — "Far from the Fame - Live, at Wacken" correctly filtered',
        'Artist cooldown after Round Robin — last 5 artists locked for 5 songs after deactivation',
        'fillQueue in Round Robin uses same artist order as doShuffle — no more out-of-order picks',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2026-04-03',
    label: { de: 'Sync & Filter Release', en: 'Sync & Filter Release' },
    added: {
      de: [
        'Stats-Sync — Wiedergabe-Statistiken werden geräteübergreifend über den Sync-Server gespeichert',
        'Album-Cache auf dem Sync-Server — Spotify API Calls werden nach dem ersten Abruf serverübergreifend gecacht (24h TTL)',
        'Instrumental-Filter — Tracks mit "instrumental", "karaoke", "backing track" usw. im Namen ausblenden (pro Liste)',
        'config.js: syncStats Flag — Stats-Sync unabhängig von Listen-Sync deaktivierbar',
      ],
      en: [
        'Stats sync — play statistics stored across devices via sync server',
        'Server-side album cache — Spotify API calls cached on sync server after first fetch (24h TTL)',
        'Instrumental filter — hide tracks with "instrumental", "karaoke", "backing track" etc. in name (per list)',
        'config.js: syncStats flag — disable stats sync independently of list sync',
      ],
    },
    changed: {
      de: [
        'Spotify 429 Rate Limit: bis zu 3 Retries statt 1 — Musik läuft bei vorübergehenden Limits weiter',
        'Rate Limit Recovery: automatischer Shuffle-Retry nach 35s statt Musik-Stopp',
        'fillQueue startet 20s nach dem ersten Track — gibt Server-Cache Zeit zum Laden',
        'Stats-Debounce: 30s Verzögerung vor Server-Sync (statt pro Song)',
        'Sync-Server: /api/health gibt jetzt auch Anzahl der gecachten Plays zurück',
      ],
      en: [
        'Spotify 429 rate limit: up to 3 retries instead of 1 — music continues during temporary limits',
        'Rate limit recovery: automatic shuffle retry after 35s instead of stopping',
        'fillQueue starts 20s after first track — gives server cache time to load',
        'Stats debounce: 30s delay before server sync (instead of per song)',
        'Sync server: /api/health now also returns cached play count',
      ],
    },
  },
  {
    version: '1.1.2',
    date: '2026-03-29',
    label: { de: 'Aufräum & Balance Release', en: 'Cleanup & Balance Release' },
    added: {
      de: [
        'Künstler-Bereich mit Anzahl — "🎤 Künstler (31)" über dem Grid',
        'Alben-Bereich zeigt Anzahl — "🎵 Alben (2)"',
        'Beschriftungen wechseln mit DE/EN Toggle',
      ],
      en: [
        'Artist section header with count — "🎤 Artists (31)" above grid',
        'Album section now shows count — "🎵 Albums (2)"',
        'Section labels switch with DE/EN toggle',
      ],
    },
    changed: {
      de: [
        'Artists haben 3× Gewicht gegenüber Alben (1×) — verhindert Alben-Dominanz',
        'Komplettes Code-Rewrite — app.js von 3039 auf ~1900 Zeilen (−37%)',
        'spotify-api.js von 651 auf 300 Zeilen (−54%)',
        'Start-API-Calls verzögert — weniger 429 beim Laden',
        'Geräte-Refresh alle 2 Minuten statt 30 Sekunden',
        'Player-State Polling alle 15 Sekunden statt 5 Sekunden',
      ],
      en: [
        'Artist pool weight 3× vs albums (1×) — prevents album dominance',
        'Complete code rewrite — app.js from 3039 to ~1900 lines (−37%)',
        'spotify-api.js from 651 to 300 lines (−54%)',
        'Startup API calls delayed — fewer 429 on page load',
        'Device refresh every 2 minutes instead of 30 seconds',
        'Player state polling every 15 seconds instead of 5 seconds',
      ],
    },
    fixed: {
      de: [
        'fillQueue referenzierte undefinierte Variable — Nächster Song funktioniert immer',
        'duplicateActiveList kopiert jetzt korrekt Alben',
        'Toter Code entfernt (Like-Sektion, ungenutzte Funktionen)',
      ],
      en: [
        'fillQueue referenced undefined variable — next track always works now',
        'duplicateActiveList now correctly copies albums',
        'Dead code removed (Like section, unused functions)',
      ],
    },
  },
  {
    version: '1.1.2', date: '2026-03-29',
    label: { de: 'Bugfix Release', en: 'Bugfix Release' },
    fixed: {
      de: ['Shuffle vollkommen zufällig — Artists, Alben und Genres gleichberechtigt im Pool', 'Listen mit nur Alben funktionieren korrekt', 'Skip sofort wenn Queue gefüllt', 'Leere Queue fällt auf Shuffle zurück'],
      en: ['Shuffle truly random — artists, albums and genres in equal pool', 'Albums-only lists now work correctly', 'Skip instant when queue has tracks', 'Empty queue falls back to direct shuffle'],
    },
    changed: {
      de: ['Jeder Artist und jedes Album hat gleiche Chance', 'Smart Shuffle bleibt aktiv'],
      en: ['Each artist and album has equal chance', 'Smart Shuffle still active'],
    },
  },
  {
    version: '1.1.0', date: '2026-03-28',
    label: { de: 'Mobile & Alben Release', en: 'Mobile & Albums Release' },
    added: {
      de: ['Alben zur Liste hinzufügen via Diskografie-Browser', 'Album-Suche ohne Artist hinzuzufügen', 'Mobile Mini-Player', 'Mobile Geräte-Auswahl', 'Mobile Shuffle-Button', 'iOS Unterstützung (teilweise)', 'Top Songs erweiterbar'],
      en: ['Add albums via discography browser', 'Album search without adding artist', 'Mobile mini player', 'Mobile device selector', 'Mobile shuffle button', 'iOS support (partial)', 'Expandable top songs'],
    },
    changed: {
      de: ['Artist-Grid 2 Spalten, alphabetisch', 'Filter-Toggle-Buttons', 'Album-Cache 24h', 'API Throttle 1 req/s'],
      en: ['Artist grid 2 columns, alphabetical', 'Filter toggle buttons', 'Album cache 24h', 'API throttle 1 req/s'],
    },
    fixed: {
      de: ['iOS Scrolling', 'Bottom Sheet Menü', 'Mobile Layout ohne unsichtbaren Player'],
      en: ['iOS scrolling', 'Bottom sheet menu', 'Mobile layout without invisible player'],
    },
  },
  {
    version: '1.0.2', date: '2026-03-27',
    label: { de: 'Bugfix Release', en: 'Bugfix Release' },
    added: {
      de: ['Alphabetische Sortierung', 'Filter-Toggle-Buttons', 'Track-Tooltips'],
      en: ['Alphabetical sorting', 'Filter toggle buttons', 'Track tooltips'],
    },
    fixed: {
      de: ['Artist-Cards scrumpfen nicht mehr', 'Jahres-Filter immer aktiv'],
      en: ['Artist cards no longer shrink', 'Year filters always active'],
    },
  },
  {
    version: '1.0.0', date: '2026-03-26',
    label: { de: 'Erster Release', en: 'Initial Release' },
    added: {
      de: ['Shuffle durch gesamte Diskografie', 'Smart Shuffle', 'Favoriten-Artists', 'Genre-Listen', 'Queue & Verlauf', 'Blacklist', 'Crossfade', 'Auto-Skip', 'Shuffle-Log', 'Discovery', 'Listen-Verwaltung', 'Import / Export', 'Sync-Server', 'PWA', 'Vollbild', 'Statistiken', 'Mehrsprachig', 'Tastatur-Shortcuts'],
      en: ['Full discography shuffle', 'Smart Shuffle', 'Favorite artists', 'Genre lists', 'Queue & history', 'Blacklist', 'Crossfade', 'Auto-Skip', 'Shuffle log', 'Discovery', 'List management', 'Import / Export', 'Sync server', 'PWA', 'Fullscreen', 'Statistics', 'Multilingual', 'Keyboard shortcuts'],
    },
  },
];

function showChangelog() {
  const modal   = document.getElementById('modal-changelog');
  const content = document.getElementById('changelog-content');
  if (!modal || !content) return;
  const lang = I18N.getLang();
  const L    = { added: lang==='de'?'Hinzugefügt':'Added', changed: lang==='de'?'Geändert':'Changed', fixed: lang==='de'?'Behoben':'Fixed' };

  content.innerHTML = CHANGELOG.map(entry => {
    const label   = entry.label?.[lang] || entry.label?.en || '';
    const added   = entry.added?.[lang]   || entry.added?.en   || [];
    const changed = entry.changed?.[lang] || entry.changed?.en || [];
    const fixed   = entry.fixed?.[lang]   || entry.fixed?.en   || [];
    const section = (title, items, color) => items.length ? `
      <div style="font-size:0.75rem;font-weight:700;color:var(--text2);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.05em">${title}</div>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">
        ${items.map(i => `<li style="display:flex;gap:8px;font-size:0.8rem;color:var(--text2)"><span style="color:${color};flex-shrink:0">${color==='var(--accent)'?'+':color==='#f0a500'?'~':'✓'}</span><span>${escHtml(i)}</span></li>`).join('')}
      </ul>` : '';
    return `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:1rem;font-weight:800;color:var(--text)">v${entry.version}</span>
          <span style="font-size:0.75rem;color:var(--accent);font-weight:700;background:var(--accent-glow);padding:2px 8px;border-radius:20px">${escHtml(label)}</span>
          <span style="font-size:0.72rem;color:var(--text3);margin-left:auto">${entry.date}</span>
        </div>
        ${section(L.added,   added,   'var(--accent)')}
        ${section(L.changed, changed, '#f0a500')}
        ${section(L.fixed,   fixed,   '#e74c3c')}
      </div>`;
  }).join('<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">');

  modal.classList.remove('hidden');
}

// ── UTILS ──────────────────────────────────────────────────────────────────────
function msToTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
