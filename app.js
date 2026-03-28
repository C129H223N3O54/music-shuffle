/* ═══════════════════════════════════════════════════════
   ARTIST SHUFFLE — app.js
   Main application logic, player, UI, state management
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── VERSION ───────────────────────────────────────────────────────────────────
const APP_VERSION = '1.1.0';

// ── GLOBAL STATE ──────────────────────────────────────────────────────────────
const State = {
  // Auth
  user: null,

  // Lists
  lists: [],        // [{ id, name, artists: [{id, name, images, genres}], filters }]
  activeListId: null,

  // Player
  currentTrack: null,
  isPlaying: false,
  volume: 80,
  isMuted: false,
  prevVolume: 80,
  repeatMode: false,
  position: 0,      // ms
  duration: 0,      // ms

  // Queue & History
  queue: [],        // Array of track objects
  history: [],      // Last 20 tracks (newest first)
  historyIds: new Set(),

  // Blacklist
  blacklist: [],    // [{ id, name, artist, albumArt }]
  blacklistEnabled: true,

  // SDK
  player: null,
  deviceId: null,   // SDK device
  activeDeviceId: null, // currently selected device

  // Stats
  stats: {
    plays: [],      // [{ trackId, trackName, artistId, artistName, ts, duration }]
    shuffles: 0,
  },

  // Flags
  onlyNew: false,
  autoSkip: false,        // Auto-skip tracks under X seconds
  crossfade: false,       // Crossfade between tracks
  _crossfading: false,
  _autoNextPending: false, // Prevent multiple auto-next calls
  autoSkipMin: 60,        // Minimum track length in seconds
  smartShuffle: true,     // Artists not played recently get higher chance
  shuffleLog: [],         // Log of why each track was chosen
};

// ── LOCALSTORAGE ──────────────────────────────────────────────────────────────
const LS = {
  _syncTimer: null,
  save() {
    localStorage.setItem('as_lists', JSON.stringify(State.lists));
    localStorage.setItem('as_blacklist', JSON.stringify(State.blacklist));
    localStorage.setItem('as_stats', JSON.stringify(State.stats));
    localStorage.setItem('as_volume', State.volume);
    localStorage.setItem('as_active_list', State.activeListId || '');
    // Debounced sync to server
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => Sync.save(), 3000);
  },
  load() {
    try { State.lists = JSON.parse(localStorage.getItem('as_lists') || '[]'); } catch { State.lists = []; }
    try { State.blacklist = JSON.parse(localStorage.getItem('as_blacklist') || '[]'); } catch { State.blacklist = []; }
    try { State.stats = { plays: [], shuffles: 0, ...JSON.parse(localStorage.getItem('as_stats') || '{}') }; } catch {}
    State.volume = parseInt(localStorage.getItem('as_volume') || '80', 10);
    State.activeListId = localStorage.getItem('as_active_list') || null;
    State.blacklistEnabled = localStorage.getItem('as_blacklist_enabled') !== 'false';

    // Migration: ensure all lists have filters and albums
    State.lists.forEach(l => {
      if (!l.filters) l.filters = defaultFilters();
      if (!l.albums) l.albums = [];
    });
  },
};

function defaultFilters() {
  return { noLive: false, yearFrom: null, yearTo: null };
}

// ── SYNC ──────────────────────────────────────────────────────────────────────
const Sync = {
  // URL des Sync-Servers — wird aus config.js gelesen
  get url() { return window.SPOTIFY_CONFIG?.syncUrl || null; },

  async load() {
    if (!this.url) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.url}/api/lists`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return false;
      const data = await res.json();
      if (data.lists?.length) {
        // Merge: Server-Listen haben Vorrang, lokale Listen die nicht auf Server sind bleiben
        const serverIds = new Set(data.lists.map(l => l.id));
        const localOnly = State.lists.filter(l => !serverIds.has(l.id));
        State.lists = [...data.lists, ...localOnly];
        State.lists.forEach(l => { if (!l.filters) l.filters = defaultFilters(); });
        LS.save();
        console.log('[Sync] Listen geladen:', data.lists.length);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[Sync] Laden fehlgeschlagen:', err.message);
      return false;
    }
  },

  async save() {
    if (!this.url) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.url}/api/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lists: State.lists }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return false;
      console.log('[Sync] Listen gespeichert:', State.lists.length);
      return true;
    } catch (err) {
      console.warn('[Sync] Speichern fehlgeschlagen:', err.message);
      return false;
    }
  },

  async check() {
    if (!this.url) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.url}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch { return false; }
  },
};

// ── INIT ──────────────────────────────────────────────────────────────────────
window.onSpotifyWebPlaybackSDKReady = () => {
  console.log('[Shuffle] Spotify SDK ready');
};

// ── PWA INSTALL PROMPT ───────────────────────────────────────────────────────
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  // Wait until app is booted so language is set correctly
  if (document.getElementById('app') && !document.getElementById('app').classList.contains('hidden')) {
    showInstallBanner();
  }
  // Otherwise banner will be shown after bootApp()
});

function showInstallBanner() {
  if (document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <p>${I18N.t('pwa_install')}</p>
    <button class="btn-primary" id="pwa-install-btn">${I18N.t('pwa_install_btn')}</button>
    <button class="pwa-install-close" id="pwa-close-btn">✕</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const result = await _deferredPrompt.userChoice;
    if (result.outcome === 'accepted') showToast(I18N.t('pwa_installed'), 'success');
    _deferredPrompt = null;
    banner.remove();
  });

  document.getElementById('pwa-close-btn').addEventListener('click', () => {
    banner.remove();
  });
}

// ── PWA SERVICE WORKER ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/music-shuffle/service-worker.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  LS.load();

  // Load config — always use config.js values
  const clientId = window.SPOTIFY_CONFIG?.clientId || localStorage.getItem('as_client_id') || '';
  const redirectUri = window.SPOTIFY_CONFIG?.redirectUri || '';

  // Show redirect URI hint
  const hint = document.getElementById('redirect-uri-hint');
  if (hint) hint.textContent = redirectUri;

  // Restore saved client ID in input field
  const savedCid = localStorage.getItem('as_client_id');
  if (savedCid) {
    const inp = document.getElementById('client-id-input');
    if (inp) inp.value = savedCid;
  }

  // Init API with config values
  SpotifyAPI.init(clientId, redirectUri);

  // Handle OAuth callback
  if (window.location.search.includes('code=')) {
    try {
      await SpotifyAPI.handleCallback();
      await bootApp();
    } catch (err) {
      showToast('Login fehlgeschlagen: ' + err.message, 'error');
      showLoginScreen();
    }
    return;
  }

  if (SpotifyAPI.isLoggedIn()) {
    await bootApp();
  } else {
    showLoginScreen();
  }

  bindLoginEvents(clientId, redirectUri);
});

// ── BOOT APP ──────────────────────────────────────────────────────────────────
async function bootApp() {
  try {
    State.user = await SpotifyAPI.getMe();
  } catch (err) {
    if (err.message === 'NOT_AUTHENTICATED') {
      showLoginScreen();
      return;
    }
  }

  // Show app
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  renderUserInfo();
  I18N.applyAll();
  updateLangBtn();
  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = APP_VERSION;

  // Sync Listen vom Server laden
  const synced = await Sync.load();
  if (synced) {
    console.log('[Sync] Listen synchronisiert');
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
  loadDevices();
  setVolume(State.volume);
  updateSyncStatus();
  setupMediaSession();
  // Show PWA install banner if waiting
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
    let cid = cidInput.value.trim() || clientId;
    if (!cid) {
      showToast('Bitte erst eine Spotify Client ID eintragen', 'error');
      cidInput.focus();
      return;
    }
    const uri = window.SPOTIFY_CONFIG?.redirectUri || redirectUri;
    localStorage.setItem('as_client_id', cid);
    SpotifyAPI.init(cid, uri);
    try {
      await SpotifyAPI.startLogin();
    } catch (err) {
      showToast('Login-Fehler: ' + err.message, 'error');
    }
  });

  cidInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginBtn.click();
  });
}

// ── USER INFO ──────────────────────────────────────────────────────────────────
function renderUserInfo() {
  if (!State.user) return;
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  nameEl.textContent = State.user.display_name || State.user.id;
  nameEl.title = State.user.display_name || State.user.id;
  const img = State.user.images?.[0]?.url;
  if (img) {
    avatarEl.src = img;
    avatarEl.title = State.user.display_name || State.user.id;
    avatarEl.classList.remove('hidden');
  }
}

// ── SDK INIT ──────────────────────────────────────────────────────────────────
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
        console.log('[Shuffle] SDK ready, device:', device_id);
        loadDevices();
        showToast(I18N.t('toast_ready'), 'success');
      });

      State.player.addListener('not_ready', () => {
        State.deviceId = null;
        showToast(I18N.t('toast_offline'), 'error');
      });

      State.player.addListener('player_state_changed', onPlayerStateChanged);

      State.player.addListener('initialization_error', ({ message }) => {
        console.error('[SDK] init error:', message);
      });
      State.player.addListener('authentication_error', ({ message }) => {
        console.error('[SDK] auth error:', message);
        showLoginScreen();
      });
      State.player.addListener('account_error', ({ message }) => {
        showToast('Spotify Premium benötigt für die Web-Wiedergabe', 'error');
      });
      State.player.addListener('playback_error', ({ message }) => {
        console.error('[SDK] playback error:', message);
      });

      State.player.connect();
    });
  };

  if (window.Spotify) {
    initFn();
  } else {
    window.onSpotifyWebPlaybackSDKReady = initFn;
  }
}

function onPlayerStateChanged(state) {
  if (!state) return;

  const track = state.track_window?.current_track;
  State.isPlaying = !state.paused;
  State.position = state.position;
  State.duration = state.duration;

  updatePlayPauseUI();
  updateMiniPlayerPlayPause();
  updateProgressUI();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = State.isPlaying ? 'playing' : 'paused';

  if (track && (!State.currentTrack || State.currentTrack.id !== track.id)) {
    State.currentTrack = {
      id: track.id,
      name: track.name,
      uri: track.uri,
      artist: track.artists?.[0]?.name || '—',
      artistId: track.artists?.[0]?.uri?.split(':')[2],
      album: track.album?.name || '—',
      albumArt: track.album?.images?.[0]?.url || '',
      duration: state.duration,
    };
    renderNowPlaying(State.currentTrack);
    updateMiniPlayer(State.currentTrack);
    checkAndAddToHistory(State.currentTrack);
    showTrackNotification(State.currentTrack);
    updateMediaSession(State.currentTrack);
  }

  // Auto next when track ends
  if (state.paused && state.position === 0 && state.track_window?.previous_tracks?.length > 0) {
    if (!State.repeatMode && !State._autoNextPending) {
      State._autoNextPending = true;
      setTimeout(() => {
        State._autoNextPending = false;
        playNextFromQueue();
      }, 300);
    }
  }

  // Crossfade: start fading volume 10s before end
  if (State.crossfade && State.duration > 0 && State.isPlaying) {
    const remaining = State.duration - State.position;
    if (remaining < 10000 && remaining > 0 && !State._crossfading) {
      State._crossfading = true;
      const steps = 20;
      const interval = remaining / steps;
      let step = 0;
      const fade = setInterval(() => {
        step++;
        const vol = (State.volume / 100) * (1 - step / steps);
        State.player?.setVolume(Math.max(0, vol)).catch(() => {});
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
    const select = document.getElementById('device-select');
    const prevValue = select.value;
    select.innerHTML = `<option value="">— ${I18N.t('player_device_choose')} —</option>`;

    // Sort: active first, then SDK device, then others
    const sorted = [...devices].sort((a, b) => {
      if (a.id === State.deviceId) return -1;
      if (b.id === State.deviceId) return 1;
      if (a.is_active) return -1;
      if (b.is_active) return 1;
      return 0;
    });

    sorted.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      const isSDK = d.id === State.deviceId;
      const icon = isSDK ? '🌐' : d.type === 'Speaker' ? '🔊' : d.type === 'Smartphone' ? '📱' : d.type === 'Computer' ? '💻' : '🎵';
      const active = d.is_active ? ' ▶' : '';
      opt.textContent = `${icon} ${d.name}${active}`;
      select.appendChild(opt);
    });

    // Restore previous selection or auto-select
    if (prevValue && devices.find(d => d.id === prevValue)) {
      select.value = prevValue;
      State.activeDeviceId = prevValue;
    } else if (State.deviceId) {
      select.value = State.deviceId;
      State.activeDeviceId = State.deviceId;
    } else {
      const active = devices.find(d => d.is_active);
      if (active) {
        select.value = active.id;
        State.activeDeviceId = active.id;
      }
    }

    if (!devices.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = I18N.t('player_device_not_found');
      select.appendChild(opt);
    }

    // Sync mobile device select
    const mobileSelect = document.getElementById('mobile-device-select');
    if (mobileSelect) {
      mobileSelect.innerHTML = select.innerHTML;
      mobileSelect.value = select.value;
    }
  } catch (err) {
    console.warn('[Devices] error:', err.message);
  }
}

// Auto-refresh devices every 30s
setInterval(() => {
  if (SpotifyAPI.isLoggedIn()) loadDevices();
}, 30000);

// ── LISTS ──────────────────────────────────────────────────────────────────────
function getActiveList() {
  return State.lists.find(l => l.id === State.activeListId) || State.lists[0] || null;
}

function renderLists() {
  // Update hidden select for compatibility
  const select = document.getElementById('list-select');
  select.innerHTML = '';
  State.lists.forEach(list => {
    const opt = document.createElement('option');
    opt.value = list.id;
    opt.textContent = list.name;
    select.appendChild(opt);
  });
  if (State.activeListId) select.value = State.activeListId;
  else if (State.lists.length) {
    State.activeListId = State.lists[0].id;
    select.value = State.activeListId;
  }

  // Update visible name display
  const active = getActiveList();
  const nameText = document.getElementById('list-name-text');
  if (nameText) {
    nameText.textContent = active
      ? `${active.name} (${active.artists?.length || 0})`
      : I18N.t('list_none');
  }
}

function createList(name) {
  const list = {
    id: 'list_' + Date.now(),
    name: name.trim() || 'Neue Liste',
    artists: [],
    albums: [],
    filters: defaultFilters(),
  };
  State.lists.push(list);
  State.activeListId = list.id;
  LS.save();
  renderLists();
  renderArtistGrid();
  updateFiltersUI();
  showToast(`Liste "${list.name}" erstellt`, 'success');
}

function deleteActiveList() {
  if (!State.activeListId) return;
  State.lists = State.lists.filter(l => l.id !== State.activeListId);
  State.activeListId = State.lists[0]?.id || null;
  LS.save();
  renderLists();
  renderArtistGrid();
  updateFiltersUI();
}

function renameActiveList(newName) {
  const list = getActiveList();
  if (!list) return;
  list.name = newName.trim() || list.name;
  LS.save();
  renderLists();
  showToast(I18N.t('toast_list_renamed'), 'success');
}

function duplicateActiveList() {
  const list = getActiveList();
  if (!list) return;
  const copy = {
    id: 'list_' + Date.now(),
    name: list.name + ' (Kopie)',
    artists: list.artists.map(a => ({ ...a })),
    genres: (list.genres || []).slice(),
    filters: { ...list.filters },
  };
  State.lists.push(copy);
  State.activeListId = copy.id;
  LS.save();
  renderLists();
  renderArtistGrid();
  renderGenreTags();
  updateFiltersUI();
  showToast(`Liste "${copy.name}" erstellt`, 'success');
}

function mergeListIntoActive(sourceListId) {
  const target = getActiveList();
  const source = State.lists.find(l => l.id === sourceListId);
  if (!target || !source || target.id === source.id) return;

  // Add artists not already in target
  let added = 0;
  source.artists.forEach(a => {
    if (!target.artists.find(x => x.id === a.id)) {
      target.artists.push({ ...a });
      added++;
    }
  });

  // Add genres not already in target
  (source.genres || []).forEach(g => {
    if (!target.genres) target.genres = [];
    if (!target.genres.includes(g)) target.genres.push(g);
  });

  LS.save();
  renderArtistGrid();
  renderGenreTags();
  renderLists();
  showToast(`${added} Artists aus "${source.name}" hinzugefügt`, 'success');
}

// ── ARTIST GRID ───────────────────────────────────────────────────────────────
function renderArtistGrid() {
  const grid = document.getElementById('artist-grid');
  const empty = document.getElementById('list-empty');
  const list = getActiveList();

  grid.innerHTML = '';

  if (!list || !list.artists?.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const sorted = [...list.artists].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  sorted.forEach((artist, idx) => {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.style.animationDelay = `${idx * 0.04}s`;
    card.dataset.artistId = artist.id;

    const imgUrl = artist.images?.[0]?.url || '';
    const genre = artist.genres?.[0] || '';

    card.innerHTML = `
      <img class="artist-card-img" src="${imgUrl}" alt="${escHtml(artist.name)}"
           onerror="this.src='data:image/svg+xml,%3Csvg viewBox=\\'0 0 60 60\\' fill=\\'none\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Ccircle cx=\\'30\\' cy=\\'30\\' r=\\'30\\' fill=\\'%23282828\\'/%3E%3Ccircle cx=\\'30\\' cy=\\'24\\' r=\\'10\\' fill=\\'%23444\\'/%3E%3Cellipse cx=\\'30\\' cy=\\'50\\' rx=\\'18\\' ry=\\'12\\' fill=\\'%23444\\'/%3E%3C/svg%3E'" />
      <div class="artist-card-name">${escHtml(artist.name)}</div>
      ${genre ? `<div class="artist-card-genre">${escHtml(genre)}</div>` : ''}
      <button class="artist-card-remove" data-id="${artist.id}" title="Entfernen">✕</button>
      <button class="artist-card-discovery" data-id="${artist.id}" data-name="${escHtml(artist.name)}" title="Ähnliche Artists">+</button>
      <button class="artist-card-favorite ${artist.favorite ? 'active' : ''}" data-id="${artist.id}" title="Favorit">⭐</button>
    `;

    grid.appendChild(card);
  });
}

function addArtistToList(artist) {
  let list = getActiveList();
  if (!list) {
    createList('Meine Liste');
    list = getActiveList();
  }
  if (!list) return;

  if (list.artists.find(a => a.id === artist.id)) {
    showToast(`${artist.name} ${I18N.t('toast_artist_exists')}`, 'info');
    return;
  }

  list.artists.push({
    id: artist.id,
    name: artist.name,
    images: artist.images || [],
    genres: artist.genres || [],
    uri: artist.uri,
  });

  LS.save();
  renderArtistGrid();
  renderLists(); // Update count
  showToast(`${artist.name} ${I18N.t('toast_artist_added')}`, 'success');
}

function toggleArtistFavorite(artistId) {
  const list = getActiveList();
  if (!list) return;
  const artist = list.artists.find(a => a.id === artistId);
  if (!artist) return;
  artist.favorite = !artist.favorite;
  LS.save();
  renderArtistGrid();
  showToast(artist.favorite ? `⭐ ${artist.name} als Favorit markiert` : `${artist.name} nicht mehr Favorit`, 'info');
}

function removeArtistFromList(artistId) {
  const list = getActiveList();
  if (!list) return;
  list.artists = list.artists.filter(a => a.id !== artistId);
  LS.save();
  renderArtistGrid();
  renderLists();
}

// ── ARTIST STATS ──────────────────────────────────────────────────────────────
function showArtistStats(artistId, artistName) {
  const plays = State.stats.plays.filter(p => p.artistId === artistId);
  const totalPlays = plays.length;
  const totalMs = plays.reduce((s, p) => s + (p.duration || 0), 0);
  const lastPlayed = plays.length ? new Date(Math.max(...plays.map(p => p.ts))) : null;

  // Top songs by this artist
  const songCounts = {};
  plays.forEach(p => {
    songCounts[p.trackName] = (songCounts[p.trackName] || 0) + 1;
  });
  const topSongs = Object.entries(songCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const modal = document.getElementById('modal-artist-stats');
  document.getElementById('artist-stats-name').textContent = artistName;
  document.getElementById('artist-stats-plays').textContent = totalPlays;
  document.getElementById('artist-stats-time').textContent =
    totalMs >= 3600000 ? (totalMs/3600000).toFixed(1) + 'h' : Math.round(totalMs/60000) + 'min';
  document.getElementById('artist-stats-last').textContent =
    lastPlayed ? lastPlayed.toLocaleDateString('de-DE') : '—';

  const songsList = document.getElementById('artist-stats-songs');
  songsList.innerHTML = topSongs.length
    ? topSongs.map(([name, count]) => `
        <div class="stat-bar-item">
          <div class="stat-bar-label"><span>${escHtml(name)}</span><span>${count}×</span></div>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(count/topSongs[0][1]*100).toFixed(0)}%"></div></div>
        </div>`).join('')
    : `<p style="color:var(--text3);font-size:0.8rem">${I18N.t('artist_stats_none')}</p>`;

  modal.classList.remove('hidden');
}

// ── GENRES ────────────────────────────────────────────────────────────────────
let _allGenres = [];

async function loadGenres() {
  if (_allGenres.length) return _allGenres;
  try {
    _allGenres = await SpotifyAPI.getAvailableGenres();
  } catch {
    _allGenres = [];
  }
  return _allGenres;
}

function renderGenreTags() {
  const list = getActiveList();
  const container = document.getElementById('genre-tags');
  if (!container) return;

  const genres = list?.genres || [];
  container.innerHTML = '';

  if (!genres.length) return;

  genres.forEach(genre => {
    const tag = document.createElement('span');
    tag.className = 'genre-tag';
    tag.innerHTML = `${escHtml(genre)} <button class="genre-tag-remove" data-genre="${escHtml(genre)}">✕</button>`;
    container.appendChild(tag);
  });
}

function addGenreToList(genre) {
  const list = getActiveList();
  if (!list) return;
  if (!list.genres) list.genres = [];
  if (list.genres.includes(genre)) return;
  list.genres.push(genre);
  LS.save();
  renderGenreTags();
  showToast(`${I18N.t('toast_genre_added')}: ${genre}`, 'success');
}

function removeGenreFromList(genre) {
  const list = getActiveList();
  if (!list?.genres) return;
  list.genres = list.genres.filter(g => g !== genre);
  LS.save();
  renderGenreTags();
}

function setupAlbumArtistSearch() {
  const input = document.getElementById('album-artist-search');
  const results = document.getElementById('album-artist-results');
  const clearBtn = document.getElementById('clear-album-search');
  if (!input) return;

  let _timer = null;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn.classList.toggle('hidden', !q);
    clearTimeout(_timer);
    if (!q) { results.classList.add('hidden'); return; }
    results.classList.remove('hidden');
    results.innerHTML = `<div class="search-result-loading">${I18N.t('search_loading')}</div>`;
    _timer = setTimeout(async () => {
      try {
        const artists = await SpotifyAPI.searchArtists(q, 6);
        results.innerHTML = '';
        if (!artists.length) {
          results.innerHTML = `<div class="search-result-empty">${I18N.t('search_empty')}</div>`;
          return;
        }
        artists.forEach(artist => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          const img = artist.images?.slice(-1)[0]?.url || '';
          item.innerHTML = `
            <img src="${img}" alt="" onerror="this.style.background='#282828'" />
            <div class="search-result-name">${escHtml(artist.name)}</div>
          `;
          item.addEventListener('click', () => {
            input.value = '';
            clearBtn.classList.add('hidden');
            results.classList.add('hidden');
            showAlbumBrowser(artist.id, artist.name);
          });
          results.appendChild(item);
        });
      } catch (err) {
        results.innerHTML = `<div class="search-result-empty">Fehler: ${escHtml(err.message)}</div>`;
      }
    }, 400);
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    results.classList.add('hidden');
    input.focus();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#album-search-section')) {
      results.classList.add('hidden');
    }
  });
}

function setupGenreSearch() {
  const input = document.getElementById('genre-search-input');
  const results = document.getElementById('genre-results');
  const clearBtn = document.getElementById('genre-clear-btn');

  if (!input) return;

  input.addEventListener('focus', async () => {
    await loadGenres();
    showGenreResults(input.value.trim().toLowerCase(), results);
    results.classList.remove('hidden');
  });

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (clearBtn) clearBtn.classList.toggle('hidden', !q);
    showGenreResults(q.toLowerCase(), results);
    results.classList.remove('hidden');
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      results.classList.add('hidden');
      input.focus();
    });
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.genre-section')) {
      results.classList.add('hidden');
    }
  });

  // Genre tag remove
  document.getElementById('genre-tags')?.addEventListener('click', e => {
    const removeBtn = e.target.closest('.genre-tag-remove');
    if (removeBtn) removeGenreFromList(removeBtn.dataset.genre);
  });
}

function showGenreResults(query, resultsEl) {
  const filtered = query
    ? _allGenres.filter(g => g.includes(query)).slice(0, 20)
    : _allGenres.slice(0, 20);

  resultsEl.innerHTML = '';
  if (!filtered.length) {
    resultsEl.innerHTML = `<div class="search-result-empty">${I18N.t('search_genre_empty')}</div>`;
    resultsEl.classList.remove('hidden');
    return;
  }

  const list = getActiveList();
  const existing = new Set(list?.genres || []);

  filtered.forEach(genre => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.style.cursor = 'pointer';
    const isSelected = existing.has(genre);
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;width:100%">
        <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};background:${isSelected ? 'var(--accent)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${isSelected ? '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
        <span class="search-result-name">${escHtml(genre)}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      if (existing.has(genre)) {
        removeGenreFromList(genre);
        existing.delete(genre);
      } else {
        addGenreToList(genre);
        existing.add(genre);
      }
      showGenreResults(query, resultsEl);
    });
    resultsEl.appendChild(item);
  });

  resultsEl.classList.remove('hidden');
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
let _searchTimer = null;

function setupSearch() {
  const input = document.getElementById('artist-search');
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

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    results.classList.add('hidden');
    input.focus();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-section')) {
      results.classList.add('hidden');
    }
  });
}

// Selected artists for multi-select
let _selectedArtists = new Map();

async function doSearch(query, resultsEl) {
  try {
    const artists = await SpotifyAPI.searchArtists(query, 10);
    resultsEl.innerHTML = '';
    _selectedArtists.clear();

    if (!artists.length) {
      resultsEl.innerHTML = `<div class="search-result-empty">${I18N.t('search_empty')}</div>`;
      return;
    }

    // Add-all button bar
    const actionBar = document.createElement('div');
    actionBar.className = 'search-action-bar';
    actionBar.innerHTML = `
      <span class="search-selected-count" id="search-selected-count">0 <span data-i18n="search_selected">ausgewählt</span></span>
      <button class="btn-search-add-all" id="search-add-all" disabled data-i18n="search_add_btn">✚ Alle hinzufügen</button>
    `;
    resultsEl.appendChild(actionBar);

    artists.forEach(artist => {
      const item = document.createElement('div');
      item.className = 'search-result-item search-result-selectable';
      item.dataset.artistId = artist.id;
      const imgUrl = artist.images?.slice(-1)[0]?.url || '';
      const genres = (artist.genres || []).slice(0, 2).join(', ');
      item.innerHTML = `
        <div class="search-result-check">
          <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <img src="${imgUrl}" alt="" onerror="this.style.background='#282828'" />
        <div>
          <div class="search-result-name">${escHtml(artist.name)}</div>
          ${genres ? `<div class="search-result-genres">${escHtml(genres)}</div>` : ''}
        </div>
      `;

      item.addEventListener('click', () => {
        if (_selectedArtists.has(artist.id)) {
          _selectedArtists.delete(artist.id);
          item.classList.remove('selected');
        } else {
          _selectedArtists.set(artist.id, artist);
          item.classList.add('selected');
        }
        const count = _selectedArtists.size;
        document.getElementById('search-selected-count').textContent = count + ' ausgewählt';
        const addAllBtn = document.getElementById('search-add-all');
        addAllBtn.disabled = count === 0;
        addAllBtn.textContent = count > 0 ? `✚ ${count} hinzufügen` : '✚ Alle hinzufügen';
      });

      resultsEl.appendChild(item);
    });

    // Add all button handler
    document.getElementById('search-add-all').addEventListener('click', () => {
      _selectedArtists.forEach(artist => addArtistToList(artist));
      const count = _selectedArtists.size;
      _selectedArtists.clear();
      document.getElementById('artist-search').value = '';
      document.getElementById('clear-search').classList.add('hidden');
      resultsEl.classList.add('hidden');
      showToast(`${count} Artists hinzugefügt`, 'success');
    });

  } catch (err) {
    resultsEl.innerHTML = `<div class="search-result-empty">Fehler: ${escHtml(err.message)}</div>`;
  }
}

// ── FILTERS ───────────────────────────────────────────────────────────────────
function updateFiltersUI() {
  const list = getActiveList();
  const f = list?.filters || defaultFilters();

  document.getElementById('filter-no-live').checked = !!f.noLive;

  // Year from toggle
  const fromInput = document.getElementById('filter-year-from');
  const fromBtn = document.getElementById('filter-year-from-toggle');
  if (f.yearFrom) {
    fromInput.value = f.yearFrom;
    fromInput.classList.remove('hidden');
    fromBtn.classList.add('active');
  } else {
    fromInput.value = '';
    fromInput.classList.add('hidden');
    fromBtn.classList.remove('active');
  }

  // Year to toggle
  const toInput = document.getElementById('filter-year-to');
  const toBtn = document.getElementById('filter-year-to-toggle');
  if (f.yearTo) {
    toInput.value = f.yearTo;
    toInput.classList.remove('hidden');
    toBtn.classList.add('active');
  } else {
    toInput.value = '';
    toInput.classList.add('hidden');
    toBtn.classList.remove('active');
  }

  updateFiltersBadge(f);
}

function saveFilters() {
  const list = getActiveList();
  if (!list) return;
  list.filters = {
    noLive: document.getElementById('filter-no-live').checked,
    yearFrom: parseInt(document.getElementById('filter-year-from').value, 10) || null,
    yearTo: parseInt(document.getElementById('filter-year-to').value, 10) || null,
  };
  LS.save();
  updateFiltersBadge(list.filters);
}

function updateFiltersBadge(f) {
  let count = 0;
  if (f.noLive) count++;
  if (f.yearFrom) count++;
  if (f.yearTo) count++;

  const badge = document.getElementById('filters-badge');
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

// ── ALBUM BROWSER ─────────────────────────────────────────────────────────────
let _albumBrowserArtistId = null;
let _albumBrowserSelected = new Set();

async function showAlbumBrowser(artistId, artistName) {
  _albumBrowserArtistId = artistId;
  _albumBrowserSelected = new Set();

  document.getElementById('album-browser-title').textContent = artistName;
  document.getElementById('album-browser-sub').textContent = 'Wähle Alben aus';
  const grid = document.getElementById('album-browser-grid');
  grid.innerHTML = '<p style="color:var(--text3);text-align:center;padding:20px">Lade Diskografie…</p>';
  document.getElementById('modal-album-browser').classList.remove('hidden');

  try {
    const albums = await SpotifyAPI.getArtistAlbumsFull(artistId);
    const list = getActiveList();
    const existingIds = new Set((list.albums || []).map(a => a.id));

    grid.innerHTML = '';
    albums.forEach(album => {
      const card = document.createElement('div');
      card.className = 'album-browser-card' + (existingIds.has(album.id) ? ' added' : '');
      card.dataset.albumId = album.id;
      const img = album.images?.[0]?.url || '';
      const year = album.release_date?.slice(0, 4) || '';
      card.innerHTML = `
        <div class="album-browser-check ${existingIds.has(album.id) ? 'checked' : ''}">✓</div>
        <img src="${img}" alt="${escHtml(album.name)}" onerror="this.style.background='#282828'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px"/>
        <div style="font-size:0.72rem;font-weight:600;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(album.name)}">${escHtml(album.name)}</div>
        <div style="font-size:0.65rem;color:var(--text3)">${year}</div>
      `;
      if (!existingIds.has(album.id)) {
        card.addEventListener('click', () => {
          if (_albumBrowserSelected.has(album.id)) {
            _albumBrowserSelected.delete(album.id);
            card.classList.remove('selected');
            card.querySelector('.album-browser-check').classList.remove('checked');
          } else {
            _albumBrowserSelected.add(album.id);
            card.classList.add('selected');
            card.querySelector('.album-browser-check').classList.add('checked');
            // Store album data
            card.dataset.albumData = JSON.stringify({
              id: album.id,
              name: album.name,
              artistId: artistId,
              artistName: artistName,
              images: album.images,
              release_date: album.release_date,
              album_type: album.album_type,
            });
          }
          const btn = document.getElementById('confirm-album-browser');
          btn.textContent = _albumBrowserSelected.size > 0
            ? `${_albumBrowserSelected.size} Album${_albumBrowserSelected.size > 1 ? 's' : ''} hinzufügen`
            : 'Hinzufügen';
          btn.disabled = _albumBrowserSelected.size === 0;
        });
      }
      grid.appendChild(card);
    });

    document.getElementById('confirm-album-browser').disabled = true;
    document.getElementById('confirm-album-browser').textContent = 'Hinzufügen';
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--danger);padding:20px">Fehler: ${escHtml(err.message)}</p>`;
  }
}

function addSelectedAlbumsToList() {
  const list = getActiveList();
  if (!list) return;
  if (!list.albums) list.albums = [];

  const grid = document.getElementById('album-browser-grid');
  let added = 0;
  _albumBrowserSelected.forEach(albumId => {
    const card = grid.querySelector(`[data-album-id="${albumId}"]`);
    if (card?.dataset.albumData) {
      const albumData = JSON.parse(card.dataset.albumData);
      if (!list.albums.find(a => a.id === albumId)) {
        list.albums.push(albumData);
        added++;
      }
    }
  });

  LS.save();
  renderAlbumGrid();
  document.getElementById('modal-album-browser').classList.add('hidden');
  showToast(`${added} Album${added !== 1 ? 's' : ''} hinzugefügt`, 'success');
}

function renderAlbumGrid() {
  const list = getActiveList();
  const albums = list?.albums || [];
  const section = document.getElementById('album-section');
  const grid = document.getElementById('album-grid');

  if (!albums.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  grid.innerHTML = '';

  const sorted = [...albums].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  sorted.forEach(album => {
    const card = document.createElement('div');
    card.className = 'album-card';
    const img = album.images?.[0]?.url || '';
    const year = album.release_date?.slice(0, 4) || '';
    card.innerHTML = `
      <img src="${img}" alt="${escHtml(album.name)}" onerror="this.style.background='#282828'" class="album-card-img"/>
      <div class="album-card-name" title="${escHtml(album.name)}">${escHtml(album.name)}</div>
      <div class="album-card-artist" title="${escHtml(album.artistName)}">${escHtml(album.artistName)} · ${year}</div>
      <button class="album-card-remove" data-id="${album.id}" title="Entfernen">✕</button>
    `;
    card.querySelector('.album-card-remove').addEventListener('click', e => {
      e.stopPropagation();
      list.albums = list.albums.filter(a => a.id !== album.id);
      LS.save();
      renderAlbumGrid();
    });
    grid.appendChild(card);
  });
}

// ── SMART SHUFFLE ─────────────────────────────────────────────────────────────
function pickSmartArtist(artists) {
  if (!artists?.length) return null;
  if (!State.smartShuffle) {
    return artists[Math.floor(Math.random() * artists.length)];
  }

  // Calculate weights — artists not played recently get higher weight
  const now = Date.now();
  const recentPlays = State.stats.plays.slice(-50); // Last 50 plays

  const weights = artists.map(artist => {
    const isFavorite = artist.favorite ? 3 : 1; // Favorites get 3x weight
    const lastPlayed = recentPlays.filter(p => p.artistId === artist.id);
    if (!lastPlayed.length) return 3 * isFavorite; // Never played = high weight

    const lastPlayTime = Math.max(...lastPlayed.map(p => p.ts));
    const minutesAgo = (now - lastPlayTime) / 60000;

    // More time passed = higher weight
    if (minutesAgo < 10) return 0.3 * isFavorite;
    if (minutesAgo < 30) return 0.7 * isFavorite;
    if (minutesAgo < 60) return 1.5 * isFavorite;
    return 3 * isFavorite;
  });

  // Weighted random pick
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < artists.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return artists[i];
  }
  return artists[artists.length - 1];
}

// ── SHUFFLE LOGIC ──────────────────────────────────────────────────────────────
async function doShuffle() {
  const list = getActiveList();
  if (!list || !list.artists?.length) {
    showToast(I18N.t('toast_no_artists'), 'error');
    return;
  }

  // Animate dice
  animateDice();
  State.stats.shuffles++;
  LS.save();

  const blacklistSet = State.blacklistEnabled
    ? new Set(State.blacklist.map(b => b.id))
    : new Set();

  const filters = list.filters || defaultFilters();
  const hasArtists = list.artists?.length > 0;
  const hasGenres = list.genres?.length > 0;
  const hasAlbums = list.albums?.length > 0;

  // Pick randomly between artist, album and genre
  const rand = Math.random();
  const totalSources = (hasArtists ? 1 : 0) + (hasAlbums ? 1 : 0) + (hasGenres ? 0.3 : 0);
  const useGenre = hasGenres && rand < 0.3 / totalSources;
  const useAlbum = !useGenre && hasAlbums && (!hasArtists || rand < (hasAlbums ? 0.5 : 0));

  try {
    let track = null;

    if (useGenre) {
      const genre = list.genres[Math.floor(Math.random() * list.genres.length)];
      track = await SpotifyAPI.getRandomTrackByGenre(genre, filters, blacklistSet);
    } else if (useAlbum) {
      const album = list.albums[Math.floor(Math.random() * list.albums.length)];
      track = await SpotifyAPI.getRandomTrackFromAlbum(album.id, album, blacklistSet, State.historyIds, State.onlyNew);
      if (track) {
        State.shuffleLog.unshift({
          trackName: track.name,
          artistName: album.artistName,
          reason: '💿 Album',
          ts: Date.now(),
        });
        if (State.shuffleLog.length > 20) State.shuffleLog.pop();
      }
    } else if (hasArtists) {
      const artist = pickSmartArtist(list.artists);
      track = await SpotifyAPI.getRandomTrack(
        artist.id, filters, blacklistSet, State.historyIds, State.onlyNew
      );
      if (track) {
        // Log shuffle reason
        State.shuffleLog.unshift({
          trackName: track.name,
          artistName: artist.name,
          reason: artist.favorite ? '⭐ Favorit' : State.smartShuffle ? '🧠 Smart Shuffle' : '🎲 Zufall',
          ts: Date.now(),
        });
        if (State.shuffleLog.length > 20) State.shuffleLog.pop();
      }
    }

    if (!track) {
      showToast(I18N.t('toast_no_track'), 'info');
      return;
    }

    // Auto-skip check
    if (State.autoSkip && track.duration_ms && track.duration_ms < State.autoSkipMin * 1000) {
      showToast(`⏭️ Auto-Skip: Track zu kurz (${Math.round(track.duration_ms/1000)}s)`, 'info');
      setTimeout(() => doShuffle(), 500);
      return;
    }

    await playTrack(track);
    // Fill queue after delay to avoid rate limiting
    setTimeout(() => fillQueue(), 5000);

  } catch (err) {
    handlePlaybackError(err);
  }
}

async function playTrack(track) {
  const deviceId = State.activeDeviceId;
  if (!deviceId) {
    showToast(I18N.t('toast_device_none'), 'error');
    return;
  }

  try {
    await SpotifyAPI.playTrack(track.uri, deviceId);
    // SDK will fire onPlayerStateChanged
  } catch (err) {
    handlePlaybackError(err);
  }
}

async function fillQueue() {
  const list = getActiveList();
  if (!list || !list.artists?.length) return;

  const needed = 2 - State.queue.length;
  if (needed <= 0) return;

  const blacklistSet = State.blacklistEnabled
    ? new Set(State.blacklist.map(b => b.id))
    : new Set();
  const filters = list.filters || defaultFilters();

  // Fill one at a time with delay to avoid 429
  for (let i = 0; i < needed; i++) {
    const artist = pickSmartArtist(list.artists);
    const track = artist ? await SpotifyAPI.getRandomTrack(artist.id, filters, blacklistSet, State.historyIds, State.onlyNew).catch(() => null) : null;
    if (track && !State.queue.find(q => q.id === track.id)) {
      State.queue.push(track);
      renderQueue();
    }
    // Delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  renderQueue();
}

async function playNextFromQueue() {
  if (!State.queue.length) await fillQueue();
  if (!State.queue.length) { showToast(I18N.t('toast_queue_empty'), 'info'); return; }

  const track = State.queue.shift();
  renderQueue();
  await playTrack(track);
  setTimeout(() => fillQueue(), 5000);
}

async function playPrevFromHistory() {
  if (State.history.length < 2) return;
  // history[0] is current, history[1] is previous
  const prev = State.history[1];
  if (!prev) return;
  await playTrack(prev);
}

// ── NOW PLAYING UI ─────────────────────────────────────────────────────────────
function renderNowPlaying(track) {
  // Show now-playing, hide idle
  document.getElementById('player-idle').classList.add('hidden');
  document.getElementById('now-playing').classList.remove('hidden');

  // Album art with fade
  const artEl = document.getElementById('album-art');
  artEl.classList.add('changing');
  setTimeout(() => {
    artEl.src = track.albumArt || '';
    artEl.classList.remove('changing');
    updateBackground(track.albumArt);
  }, 200);

  document.getElementById('track-name').textContent = track.name;
  document.getElementById('track-name').title = track.name;
  document.getElementById('track-artist').textContent = track.artist;
  document.getElementById('track-artist').title = track.artist;
  document.getElementById('track-album').textContent = track.album;
  document.getElementById('track-album').title = track.album;

  // Fullscreen sync
  document.getElementById('fs-art').src = track.albumArt || '';
  document.getElementById('fs-track').textContent = track.name;
  document.getElementById('fs-artist').textContent = track.artist;
  document.getElementById('fs-bg').style.backgroundImage = `url(${track.albumArt})`;

  // Update page title
  document.title = `${track.name} · ${track.artist} — Music Shuffle`;
}

function updateBackground(imageUrl) {
  if (!imageUrl) return;
  const bg = document.getElementById('bg-blur');
  bg.style.backgroundImage = `url(${imageUrl})`;
  bg.classList.add('active');

  // Extract dominant color from album art for shadow glow
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 4;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 4, 4);
      const d = ctx.getImageData(0, 0, 4, 4).data;
      // Average color
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]; g += d[i+1]; b += d[i+2];
      }
      const n = d.length / 4;
      r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
      // Apply as shadow color
      document.documentElement.style.setProperty(
        '--accent-shadow', `rgba(${r},${g},${b},0.6)`
      );
    } catch {}
  };
  img.src = imageUrl;
}

// ── MEDIA SESSION API ─────────────────────────────────────────────────────────
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', () => {
    State.player?.resume();
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    State.player?.pause();
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    playNextFromQueue();
  });
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    playPrevFromHistory();
  });
  navigator.mediaSession.setActionHandler('stop', () => {
    State.player?.pause();
  });
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name,
    artist: track.artist,
    album: track.album,
    artwork: track.albumArt ? [
      { src: track.albumArt, sizes: '640x640', type: 'image/jpeg' },
    ] : [],
  });

  navigator.mediaSession.playbackState = State.isPlaying ? 'playing' : 'paused';
}

// ── MINI PLAYER ───────────────────────────────────────────────────────────────
function updateMiniPlayer(track) {
  if (!track) return;
  const mini = document.getElementById('mini-player');
  if (mini) mini.classList.remove('hidden');
  const art = document.getElementById('mini-art');
  const trackEl = document.getElementById('mini-track');
  const artistEl = document.getElementById('mini-artist');
  if (art) art.src = track.albumArt || '';
  if (trackEl) trackEl.textContent = track.name;
  if (artistEl) artistEl.textContent = track.artist;
}

function updateMiniPlayerPlayPause() {
  const playIcon = document.getElementById('mini-play-icon');
  const pauseIcon = document.getElementById('mini-pause-icon');
  if (!playIcon || !pauseIcon) return;
  playIcon.classList.toggle('hidden', State.isPlaying);
  pauseIcon.classList.toggle('hidden', !State.isPlaying);
}

// ── DESKTOP NOTIFICATIONS ─────────────────────────────────────────────────────
let _notificationsEnabled = false;

function updateNotificationBtn() {
  const btn = document.getElementById('notification-btn');
  if (!btn) return;
  if (!('Notification' in window)) { btn.style.display = 'none'; return; }
  if (Notification.permission === 'granted') {
    _notificationsEnabled = true;
    btn.classList.add('active');
    btn.title = 'Benachrichtigungen aktiv';
  } else if (Notification.permission === 'denied') {
    btn.style.opacity = '0.3';
    btn.title = 'Benachrichtigungen blockiert (Browser-Einstellungen)';
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    _notificationsEnabled = true;
    return true;
  }
  if (Notification.permission !== 'denied') {
    const result = await Notification.requestPermission();
    _notificationsEnabled = result === 'granted';
    return _notificationsEnabled;
  }
  return false;
}

function showTrackNotification(track) {
  if (!_notificationsEnabled || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return; // Nur wenn Tab im Hintergrund

  const notification = new Notification(track.name, {
    body: `${track.artist} — ${track.album}`,
    icon: track.albumArt || '/music-shuffle/icons/icon-192.png',
    badge: '/music-shuffle/icons/icon-72.png',
    tag: 'music-shuffle-track', // Ersetzt vorherige Notification
    silent: true,
  });

  // Klick auf Notification bringt Tab in den Vordergrund
  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  // Automatisch schließen nach 5 Sekunden
  setTimeout(() => notification.close(), 5000);
}

function updatePlayPauseUI() {
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const fsPlayIcon = document.getElementById('fs-play-icon');
  const fsPauseIcon = document.getElementById('fs-pause-icon');

  if (State.isPlaying) {
    playIcon.classList.add('hidden'); pauseIcon.classList.remove('hidden');
    fsPlayIcon.classList.add('hidden'); fsPauseIcon.classList.remove('hidden');
  } else {
    playIcon.classList.remove('hidden'); pauseIcon.classList.add('hidden');
    fsPlayIcon.classList.remove('hidden'); fsPauseIcon.classList.add('hidden');
  }
}

// ── PROGRESS ───────────────────────────────────────────────────────────────────
let _progressTimer = null;

function startProgressTimer() {
  clearInterval(_progressTimer);
  _progressTimer = setInterval(() => {
    if (!State.isPlaying) return;
    State.position += 1000;
    if (State.position > State.duration) State.position = State.duration;
    updateProgressUI();
  }, 1000);
}

function updateProgressUI() {
  const pct = State.duration ? (State.position / State.duration) * 100 : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-thumb').style.left = `${pct}%`;
  document.getElementById('time-current').textContent = msToTime(State.position);
  document.getElementById('time-total').textContent = msToTime(State.duration);
}

// Poll player state for accurate progress
setInterval(async () => {
  if (!State.player || !State.isPlaying) return;
  try {
    const s = await State.player.getCurrentState();
    if (s) {
      State.position = s.position;
      State.duration = s.duration;
    }
  } catch {}
}, 5000);

// ── HISTORY ────────────────────────────────────────────────────────────────────
function checkAndAddToHistory(track) {
  if (State.history[0]?.id === track.id) return; // Already at top
  State.history.unshift({ ...track });
  if (State.history.length > 20) State.history.pop();
  State.historyIds.add(track.id);
  renderHistory();
  trackPlay(track);
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  list.innerHTML = '';
  if (!State.history.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('history_empty')}</p>`;
    return;
  }
  empty?.classList.add('hidden');

  State.history.forEach((track, idx) => {
    const item = createTrackItem(track, idx, [
      { icon: '▶', title: 'Abspielen', action: () => playTrack(track) },
    ]);
    if (track.id === State.currentTrack?.id) item.classList.add('playing');
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
  if (!select.options.length) {
    showToast(I18N.t('toast_no_lists_merge'), 'info');
    return;
  }
  document.getElementById('modal-merge-list').classList.remove('hidden');
}

// ── SHUFFLE LOG ───────────────────────────────────────────────────────────────
function renderShuffleLog() {
  const list = document.getElementById('shufflelog-list');
  const empty = document.getElementById('shufflelog-empty');
  if (!list) return;

  list.innerHTML = '';
  if (!State.shuffleLog.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('log_empty')}</p>`;
    return;
  }
  empty?.classList.add('hidden');

  State.shuffleLog.forEach((entry, idx) => {
    const item = document.createElement('div');
    item.className = 'track-item';
    const time = new Date(entry.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    item.innerHTML = `
      <span class="track-item-num" style="font-size:0.7rem;min-width:38px">${time}</span>
      <div class="track-item-info">
        <div class="track-item-name">${escHtml(entry.trackName)}</div>
        <div style="font-size:0.72rem;color:var(--text3);margin-top:2px">
          ${escHtml(entry.artistName)} &nbsp;
          <span style="color:var(--accent);font-weight:600">${escHtml(entry.reason)}</span>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
}

// ── QUEUE ──────────────────────────────────────────────────────────────────────
function renderQueue() {
  const list = document.getElementById('queue-list');
  const empty = document.getElementById('queue-empty');

  list.innerHTML = '';
  if (!State.queue.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('queue_empty')}</p><small>${I18N.t('queue_empty_sub')}</small>`;
    return;
  }
  empty?.classList.add('hidden');

  State.queue.forEach((track, idx) => {
    const item = createTrackItem(track, idx + 1, [
      {
        icon: '✕', title: 'Aus Queue entfernen',
        action: () => {
          State.queue.splice(idx, 1);
          renderQueue();
        }
      },
    ]);
    item.addEventListener('click', (e) => {
      if (e.target.closest('.track-item-actions')) return;
      State.queue.splice(idx, 1);
      renderQueue();
      playTrack(track);
    });
    list.appendChild(item);
  });
}

// ── BLACKLIST ──────────────────────────────────────────────────────────────────
function addToBlacklist(track) {
  if (!track) return;
  if (State.blacklist.find(b => b.id === track.id)) return;
  State.blacklist.push({
    id: track.id,
    name: track.name,
    artist: track.artist,
    albumArt: track.albumArt,
  });
  LS.save();
  renderBlacklist();
  showToast(`"${track.name}" zur Blacklist hinzugefügt`, 'info');
  playNextFromQueue();
}

function removeFromBlacklist(trackId) {
  State.blacklist = State.blacklist.filter(b => b.id !== trackId);
  LS.save();
  renderBlacklist();
}

function renderBlacklist() {
  const list = document.getElementById('blacklist-list');
  const empty = document.getElementById('blacklist-empty');

  list.innerHTML = '';
  if (!State.blacklist.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('blacklist_empty')}</p><small>${I18N.t('blacklist_empty_sub')}</small>`;
    return;
  }
  empty?.classList.add('hidden');

  State.blacklist.forEach((track, idx) => {
    const item = createTrackItem(track, idx + 1, [
      {
        icon: '✕', title: 'Aus Blacklist entfernen',
        action: () => removeFromBlacklist(track.id),
      },
    ]);
    list.appendChild(item);
  });

  document.getElementById('blacklist-toggle').checked = State.blacklistEnabled;
}

// ── TRACK ITEM HELPER ──────────────────────────────────────────────────────────
function createTrackItem(track, num, actions = []) {
  const item = document.createElement('div');
  item.className = 'track-item';

  const actionsHtml = actions.map(a =>
    `<button class="btn-icon" title="${a.title}">${a.icon}</button>`
  ).join('');

  // Handle both formats: track.artist (string) or track.artists (array)
  const artistName = track.artist || track.artists?.[0]?.name || '';
  // Handle both albumArt formats
  const imgUrl = track.albumArt || track.album?.images?.[0]?.url || '';

  item.innerHTML = `
    <span class="track-item-num">${num}</span>
    <img class="track-item-img" src="${imgUrl}" alt=""
         onerror="this.style.background='#282828'" />
    <div class="track-item-info">
      <div class="track-item-name">${escHtml(track.name)}</div>
      <div class="track-item-artist">${escHtml(artistName)}</div>
    </div>
    <div class="track-item-actions">${actionsHtml}</div>
  `;

  actions.forEach((a, i) => {
    item.querySelectorAll('.track-item-actions .btn-icon')[i]?.addEventListener('click', e => {
      e.stopPropagation();
      a.action();
    });
  });

  return item;
}

// ── LIKE ───────────────────────────────────────────────────────────────────────


// ── VOLUME ─────────────────────────────────────────────────────────────────────
function setVolume(vol) {
  State.volume = Math.max(0, Math.min(100, vol));
  document.getElementById('volume-slider').value = State.volume;
  State.player?.setVolume(State.volume / 100).catch(() => {});
  localStorage.setItem('as_volume', State.volume);

  const icon = document.getElementById('vol-icon');
  const muteIcon = document.getElementById('mute-icon');
  const muted = State.isMuted || State.volume === 0;
  icon.classList.toggle('hidden', muted);
  muteIcon.classList.toggle('hidden', !muted);
}

function toggleMute() {
  if (State.isMuted) {
    State.isMuted = false;
    setVolume(State.prevVolume || 80);
  } else {
    State.prevVolume = State.volume;
    State.isMuted = true;
    State.player?.setVolume(0).catch(() => {});
    document.getElementById('vol-icon').classList.add('hidden');
    document.getElementById('mute-icon').classList.remove('hidden');
  }
}

// ── STATS ──────────────────────────────────────────────────────────────────────
function trackPlay(track) {
  State.stats.plays.push({
    trackId: track.id,
    trackName: track.name,
    artistId: track.artistId,
    artistName: track.artist,
    ts: Date.now(),
    duration: track.duration || 0,
  });
  LS.save();
  renderStats();
}

function renderStats() {
  const range = parseInt(document.getElementById('stats-range')?.value || '30', 10);
  const since = range === Infinity || isNaN(range) ? 0 : Date.now() - range * 86400000;
  const plays = State.stats.plays.filter(p => !since || p.ts >= since);

  // Totals
  document.getElementById('stat-total-plays').textContent = plays.length;
  document.getElementById('stat-shuffles').textContent = State.stats.shuffles;
  const totalMs = plays.reduce((s, p) => s + (p.duration || 0), 0);
  const totalH = totalMs / 3600000;
  document.getElementById('stat-total-time').textContent = totalH >= 1
    ? totalH.toFixed(1) + 'h'
    : Math.round(totalMs / 60000) + 'm';

  // Top artists
  const artistCounts = {};
  plays.forEach(p => {
    if (!p.artistName) return;
    artistCounts[p.artistName] = (artistCounts[p.artistName] || 0) + 1;
  });
  renderStatsBars('stats-top-artists', artistCounts, 5);

  // Top songs
  const songCounts = {};
  const songArtists = {};
  plays.forEach(p => {
    if (!p.trackName) return;
    songCounts[p.trackName] = (songCounts[p.trackName] || 0) + 1;
    if (p.artistName) songArtists[p.trackName] = p.artistName;
  });
  const expandBtn = document.getElementById('stats-songs-expand');
  const expanded = expandBtn?.dataset.expanded === '1';
  renderStatsBarsWithArtist('stats-top-songs', songCounts, songArtists, expanded ? 999 : 5);
  if (expandBtn) {
    expandBtn.textContent = expanded
      ? (I18N.getLang() === 'de' ? 'Weniger' : 'Show less')
      : (I18N.getLang() === 'de' ? 'Alle anzeigen' : 'Show all');
  }

  // Sessions per week
  renderSessionsChart(plays);
}

function renderStatsBarsWithArtist(containerId, counts, artists, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = sorted[0]?.[1] || 1;

  container.innerHTML = sorted.map(([name, count]) => `
    <div class="stat-bar-item">
      <div class="stat-bar-label">
        <span title="${escHtml(name)}">${escHtml(name)}${artists[name] ? `<span style="color:var(--text3);font-weight:400"> · ${escHtml(artists[name])}</span>` : ''}</span>
        <span style="flex-shrink:0">${count}×</span>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill" style="width:${(count/max*100).toFixed(1)}%"></div>
      </div>
    </div>
  `).join('');
}

function renderStatsBars(containerId, counts, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = sorted[0]?.[1] || 1;

  container.innerHTML = sorted.map(([name, count]) => `
    <div class="stat-bar-item">
      <div class="stat-bar-label">
        <span>${escHtml(name)}</span>
        <span>${count}×</span>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill" style="width:${(count/max*100).toFixed(1)}%"></div>
      </div>
    </div>
  `).join('');
}

function renderSessionsChart(plays) {
  const container = document.getElementById('stats-sessions');
  if (!container) return;

  // Build 8-week buckets
  const weeks = Array(8).fill(0);
  const now = Date.now();
  plays.forEach(p => {
    const weeksAgo = Math.floor((now - p.ts) / (7 * 86400000));
    if (weeksAgo < 8) weeks[7 - weeksAgo]++;
  });

  const max = Math.max(...weeks, 1);
  container.innerHTML = weeks.map((v, i) => `
    <div class="stats-chart-bar" style="height:${(v/max*100).toFixed(1)}%" title="Woche ${i+1}: ${v} Songs"></div>
  `).join('');
}

// ── DISCOVERY ──────────────────────────────────────────────────────────────────
async function showDiscovery(artistId, artistName) {
  const modal = document.getElementById('modal-discovery');
  const subtitle = document.getElementById('discovery-subtitle');
  const results = document.getElementById('discovery-results');

  subtitle.textContent = `Ähnliche Artists wie "${artistName}"`;
  results.innerHTML = `<p style="color:var(--text3);text-align:center;padding:20px">${I18N.t('discovery_loading')}</p>`;
  modal.classList.remove('hidden');

  try {
    const related = await SpotifyAPI.getRelatedArtists(artistId);
    results.innerHTML = '';

    if (!related.length) {
      results.innerHTML = `<p style="color:var(--text3);text-align:center;padding:20px">${I18N.t('discovery_none')}</p>`;
      return;
    }

    const list = getActiveList();
    const existingIds = new Set(list?.artists?.map(a => a.id) || []);

    related.slice(0, 20).forEach(artist => {
      const card = document.createElement('div');
      const isAdded = existingIds.has(artist.id);
      card.className = 'discovery-card' + (isAdded ? ' added' : '');

      const img = artist.images?.[1]?.url || artist.images?.[0]?.url || '';
      card.innerHTML = `
        <img src="${img}" alt="${escHtml(artist.name)}" onerror="this.style.background='#282828'" />
        <div class="discovery-card-name">${escHtml(artist.name)}</div>
        <div class="discovery-card-btn">${isAdded ? '✓ In Liste' : '+ Hinzufügen'}</div>
      `;

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
    results.innerHTML = `<p style="color:var(--danger);padding:20px">Fehler: ${escHtml(err.message)}</p>`;
  }
}

// ── FULLSCREEN ─────────────────────────────────────────────────────────────────
function toggleFullscreen() {
  const overlay = document.getElementById('fullscreen-overlay');
  const isHidden = overlay.classList.contains('hidden');
  overlay.classList.toggle('hidden', !isHidden);
}

// ── IMPORT / EXPORT ────────────────────────────────────────────────────────────
function exportLists() {
  const data = JSON.stringify({ lists: State.lists, version: 1 }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'music-shuffle-listen.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast(I18N.t('toast_exported'), 'success');
}

function importLists(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.lists || !Array.isArray(data.lists)) throw new Error('Ungültiges Format');
      State.lists = [...State.lists, ...data.lists];
      if (!State.activeListId && State.lists.length) {
        State.activeListId = State.lists[0].id;
      }
      LS.save();
      renderLists();
      renderArtistGrid();
      showToast(`${data.lists.length} Listen importiert`, 'success');
    } catch (err) {
      showToast('Import fehlgeschlagen: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ── ERROR HANDLING ─────────────────────────────────────────────────────────────
function handlePlaybackError(err) {
  if (err.message === 'PREMIUM_REQUIRED') {
    showToast(I18N.t('toast_premium'), 'error');
  } else if (err.message === 'NOT_AUTHENTICATED') {
    showLoginScreen();
  } else if (err.message?.includes('No active device')) {
    showToast('Bitte ein Wiedergabegerät auswählen', 'error');
  } else {
    showToast('Fehler: ' + err.message, 'error');
    console.error('[Playback Error]', err);
  }
}

// ── TOAST ──────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ── DICE ANIMATION ─────────────────────────────────────────────────────────────
function animateDice() {
  document.querySelectorAll('.btn-shuffle-big').forEach(btn => {
    btn.classList.add('rolling');
    setTimeout(() => btn.classList.remove('rolling'), 600);
  });
}

// ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Ignore when typing in inputs
  if (e.target.matches('input, textarea, select')) return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (State.isPlaying) State.player?.pause(); else State.player?.resume();
      break;
    case 'KeyN':
      playNextFromQueue();
      break;
    case 'KeyP':
      playPrevFromHistory();
      break;
    case 'KeyF':
      toggleFullscreen();
      break;
    case 'KeyB':
      if (State.currentTrack) addToBlacklist(State.currentTrack);
      break;
    case 'KeyM':
      toggleMute();
      break;
    case 'ArrowUp':
      e.preventDefault();
      setVolume(State.volume + 5);
      break;
    case 'ArrowDown':
      e.preventDefault();
      setVolume(State.volume - 5);
      break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
    case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
      const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
      if (State.lists[idx]) {
        State.activeListId = State.lists[idx].id;
        document.getElementById('list-select').value = State.activeListId;
        renderArtistGrid();
        updateFiltersUI();
        renderLists();
      }
      break;
  }
});

// ── BIND ALL EVENTS ────────────────────────────────────────────────────────────
function bindAllEvents() {

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    SpotifyAPI.logout();
    State.player?.disconnect();
    showLoginScreen();
    document.title = 'Music Shuffle';
  });

  // Sidebar nav
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sidebar-view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      const view = document.getElementById(`view-${tab.dataset.view}`);
      if (view) view.classList.add('active');
    });
  });

  // Mobile menu
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  let backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('visible', sidebar.classList.contains('open'));
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('visible');
  });

  // List name display — opens picker sheet
  document.getElementById('list-name-display')?.addEventListener('click', () => {
    const sheet = document.getElementById('sheet-list-picker');
    const items = document.getElementById('sheet-list-items');
    items.innerHTML = '';
    State.lists.forEach(list => {
      const btn = document.createElement('button');
      btn.className = 'btn-menu-item' + (list.id === State.activeListId ? ' active' : '');
      btn.textContent = list.name + (list.artists?.length ? ` (${list.artists.length})` : '');
      btn.style.fontWeight = list.id === State.activeListId ? '700' : '400';
      btn.addEventListener('click', () => {
        State.activeListId = list.id;
        document.getElementById('list-select').value = list.id;
        localStorage.setItem('as_active_list', list.id);
        sheet.classList.add('hidden');
        renderLists();
        renderArtistGrid();
        renderGenreTags();
        updateFiltersUI();
      });
      items.appendChild(btn);
    });
    sheet.classList.remove('hidden');
  });

  // Close list picker on overlay tap
  document.getElementById('sheet-list-picker')?.addEventListener('click', e => {
    if (e.target === document.getElementById('sheet-list-picker')) {
      document.getElementById('sheet-list-picker').classList.add('hidden');
    }
  });

  // List selector (hidden, kept for compatibility)
  document.getElementById('list-select').addEventListener('change', e => {
    State.activeListId = e.target.value;
    renderArtistGrid();
    renderAlbumGrid();
    updateFiltersUI();
    localStorage.setItem('as_active_list', State.activeListId);
  });

  // New list
  document.getElementById('new-list-btn').addEventListener('click', () => {
    document.getElementById('new-list-name').value = '';
    document.getElementById('modal-new-list').classList.remove('hidden');
    setTimeout(() => document.getElementById('new-list-name').focus(), 50);
  });
  document.getElementById('confirm-new-list').addEventListener('click', () => {
    createList(document.getElementById('new-list-name').value);
    document.getElementById('modal-new-list').classList.add('hidden');
  });
  document.getElementById('cancel-new-list').addEventListener('click', () => {
    document.getElementById('modal-new-list').classList.add('hidden');
  });
  document.getElementById('new-list-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirm-new-list').click();
    if (e.key === 'Escape') document.getElementById('cancel-new-list').click();
  });
  // New list modal — no click-outside on iOS

  // List options dropdown
  // List options — modal (works on iOS)
  const listOptionsSheet = document.getElementById('modal-list-options');

  function openListOptions() {
    listOptionsSheet.classList.remove('hidden');
  }
  function closeListOptions() {
    listOptionsSheet.classList.add('hidden');
  }

  // Open
  document.getElementById('list-options-btn').addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    openListOptions();
  });

  // Close button
  document.getElementById('close-list-options')?.addEventListener('click', closeListOptions);
  document.getElementById('close-list-options')?.addEventListener('touchend', e => {
    e.preventDefault();
    closeListOptions();
  });

  // Close on overlay
  listOptionsSheet?.addEventListener('touchend', e => {
    if (e.target === listOptionsSheet) closeListOptions();
  });

  // Make all sheet buttons work with touchend on iOS
  listOptionsSheet?.querySelectorAll('.btn-menu-item').forEach(btn => {
    btn.addEventListener('touchend', e => {
      e.preventDefault();
      btn.click();
    });
  });

  // Rename list
  document.getElementById('rename-list-btn').addEventListener('click', () => {
    document.getElementById('modal-list-options').classList.add('hidden');
    const list = getActiveList();
    if (!list) return;
    document.getElementById('rename-list-input').value = list.name;
    document.getElementById('modal-rename-list').classList.remove('hidden');
    setTimeout(() => document.getElementById('rename-list-input').focus(), 50);
  });
  document.getElementById('confirm-rename-list').addEventListener('click', () => {
    renameActiveList(document.getElementById('rename-list-input').value);
    document.getElementById('modal-rename-list').classList.add('hidden');
  });
  document.getElementById('cancel-rename-list').addEventListener('click', () => {
    document.getElementById('modal-rename-list').classList.add('hidden');
  });
  document.getElementById('rename-list-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirm-rename-list').click();
    if (e.key === 'Escape') document.getElementById('cancel-rename-list').click();
  });

  // Delete list
  document.getElementById('delete-list-btn').addEventListener('click', () => {
    document.getElementById('modal-list-options').classList.add('hidden');
    document.getElementById('modal-delete-list').classList.remove('hidden');
  });
  document.getElementById('confirm-delete-list').addEventListener('click', () => {
    deleteActiveList();
    document.getElementById('modal-delete-list').classList.add('hidden');
  });
  document.getElementById('cancel-delete-list').addEventListener('click', () => {
    document.getElementById('modal-delete-list').classList.add('hidden');
  });
  // Delete/rename modals — no click-outside on iOS

  // Duplicate list
  document.getElementById('duplicate-list-btn')?.addEventListener('click', () => {
    document.getElementById('modal-list-options').classList.add('hidden');
    duplicateActiveList();
  });

  // Merge list
  document.getElementById('merge-list-btn')?.addEventListener('click', () => {
    document.getElementById('modal-list-options').classList.add('hidden');
    showMergeModal();
  });

  // Album browser
  document.getElementById('close-album-browser')?.addEventListener('click', () => {
    document.getElementById('modal-album-browser').classList.add('hidden');
  });
  document.getElementById('confirm-album-browser')?.addEventListener('click', addSelectedAlbumsToList);
  document.getElementById('modal-album-browser')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // Mobile shuffle button
  document.getElementById('mobile-shuffle-btn')?.addEventListener('click', doShuffle);

  // Mobile device select — sync with main select
  const mobileDeviceSelect = document.getElementById('mobile-device-select');
  if (mobileDeviceSelect) {
    mobileDeviceSelect.addEventListener('change', e => {
      const deviceId = e.target.value;
      if (deviceId) {
        State.activeDeviceId = deviceId;
        document.getElementById('device-select').value = deviceId;
        SpotifyAPI.transferPlayback(deviceId, false).catch(() => {});
        showToast(I18N.t('toast_device_changed'), 'success');
      }
    });
    document.getElementById('mobile-refresh-devices')?.addEventListener('click', loadDevices);
  }

  // Mini player controls
  document.getElementById('mini-play-pause')?.addEventListener('click', () => {
    if (State.isPlaying) State.player?.pause(); else State.player?.resume();
  });
  document.getElementById('mini-next')?.addEventListener('click', playNextFromQueue);
  document.getElementById('mini-shuffle')?.addEventListener('click', doShuffle);

  // Changelog button
  document.getElementById('changelog-btn')?.addEventListener('click', showChangelog);
  document.getElementById('close-changelog')?.addEventListener('click', () => {
    document.getElementById('modal-changelog').classList.add('hidden');
  });
  // Changelog modal — no click-outside on iOS

  // Language toggle
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      const newLang = I18N.getLang() === 'de' ? 'en' : 'de';
      I18N.setLang(newLang);
      updateLangBtn();
      // Re-render dynamic content
      renderLists();
      renderArtistGrid();
      renderGenreTags();
      renderQueue();
      renderHistory();
      renderBlacklist();
      renderShuffleLog();
      renderStats();
      updateFiltersUI();
    });
  }

  // Notification toggle
  const notificationBtn = document.getElementById('notification-btn');
  if (notificationBtn) {
    notificationBtn.addEventListener('click', async () => {
      const granted = await requestNotificationPermission();
      if (granted) {
        notificationBtn.classList.add('active');
        notificationBtn.title = 'Benachrichtigungen aktiv';
        showToast(I18N.t('toast_notification_on'), 'success');
      } else {
        showToast(I18N.t('toast_notification_blocked'), 'error');
      }
    });
  }

  // Crossfade toggle
  const crossfadeBtn = document.getElementById('crossfade-btn');
  if (crossfadeBtn) {
    crossfadeBtn.addEventListener('click', () => {
      State.crossfade = !State.crossfade;
      crossfadeBtn.classList.toggle('active', State.crossfade);
      showToast(State.crossfade ? I18N.t('toast_crossfade_on') : I18N.t('toast_crossfade_off'), 'info');
    });
  }

  // Artist stats via click on artist card
  document.getElementById('artist-grid').addEventListener('click', e => {
    const card = e.target.closest('.artist-card');
    if (!card) return;
    const removeBtn = e.target.closest('.artist-card-remove');
    const discoverBtn = e.target.closest('.artist-card-discovery');
    const favoriteBtn = e.target.closest('.artist-card-favorite');
    if (removeBtn) {
      removeArtistFromList(removeBtn.dataset.id);
    } else if (discoverBtn) {
      showDiscovery(discoverBtn.dataset.id, discoverBtn.dataset.name);
    } else if (favoriteBtn) {
      toggleArtistFavorite(favoriteBtn.dataset.id);
    } else {
      const artistId = card.dataset.artistId;
      const list = getActiveList();
      const artist = list?.artists?.find(a => a.id === artistId);
      if (artist) showAlbumBrowser(artist.id, artist.name);
    }
  });

  // Merge modal
  document.getElementById('cancel-merge-list')?.addEventListener('click', () => {
    document.getElementById('modal-merge-list').classList.add('hidden');
  });
  document.getElementById('confirm-merge-list')?.addEventListener('click', () => {
    const select = document.getElementById('merge-list-select');
    if (select.value) mergeListIntoActive(select.value);
    document.getElementById('modal-merge-list').classList.add('hidden');
  });
  // Merge modal — no click-outside on iOS

  // Artist stats modal close
  document.getElementById('close-artist-stats')?.addEventListener('click', () => {
    document.getElementById('modal-artist-stats').classList.add('hidden');
  });
  // Artist stats modal — no click-outside on iOS

  // Export / Import
  document.getElementById('export-lists-btn').addEventListener('click', () => {
    document.getElementById('modal-list-options').classList.add('hidden');
    exportLists();
  });
  document.getElementById('import-lists-btn').addEventListener('click', () => {
    document.getElementById('modal-list-options').classList.add('hidden');
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) importLists(file);
    e.target.value = '';
  });

  // Search
  setupSearch();

  // Album artist search
  setupAlbumArtistSearch();

  // Genres
  setupGenreSearch();

  // Filters
  document.getElementById('filter-no-live').addEventListener('change', saveFilters);
  document.getElementById('filter-year-from').addEventListener('change', saveFilters);
  document.getElementById('filter-year-to').addEventListener('change', saveFilters);

  // Year filter toggle buttons
  ['from', 'to'].forEach(dir => {
    const btn = document.getElementById(`filter-year-${dir}-toggle`);
    const input = document.getElementById(`filter-year-${dir}`);
    btn.addEventListener('click', () => {
      const active = btn.classList.toggle('active');
      input.classList.toggle('hidden', !active);
      if (!active) {
        input.value = '';
        saveFilters();
      } else {
        input.focus();
      }
    });
  });
  // Energy filter removed (API restricted)

  // Shuffle buttons
  document.getElementById('shuffle-btn-idle').addEventListener('click', doShuffle);
  document.getElementById('shuffle-btn').addEventListener('click', doShuffle);

  // Play/Pause
  document.getElementById('play-pause-btn').addEventListener('click', () => {
    if (State.isPlaying) State.player?.pause(); else State.player?.resume();
  });
  document.getElementById('fs-play').addEventListener('click', () => {
    if (State.isPlaying) State.player?.pause(); else State.player?.resume();
  });

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
  document.getElementById('volume-slider').addEventListener('input', e => {
    State.isMuted = false;
    setVolume(parseInt(e.target.value, 10));
  });
  document.getElementById('mute-btn').addEventListener('click', toggleMute);

  // Blacklist
  document.getElementById('blacklist-btn').addEventListener('click', () => {
    if (State.currentTrack) addToBlacklist(State.currentTrack);
  });
  document.getElementById('blacklist-toggle').addEventListener('change', e => {
    State.blacklistEnabled = e.target.checked;
    localStorage.setItem('as_blacklist_enabled', State.blacklistEnabled);
  });

  // Discovery
  document.getElementById('discovery-btn').addEventListener('click', () => {
    if (!State.currentTrack?.artistId) return;
    showDiscovery(State.currentTrack.artistId, State.currentTrack.artist);
  });
  document.getElementById('close-discovery').addEventListener('click', () => {
    document.getElementById('modal-discovery').classList.add('hidden');
  });
  // Discovery modal — no click-outside on iOS

  // Progress bar click/drag
  const track = document.getElementById('progress-track');
  track.addEventListener('click', e => {
    if (!State.duration) return;
    const rect = track.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const posMs = pct * State.duration;
    State.position = posMs;
    updateProgressUI();
    SpotifyAPI.seek(posMs, State.activeDeviceId).catch(() => {});
  });

  // Fullscreen
  document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
  document.getElementById('fs-exit').addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('fullscreen-overlay').classList.add('hidden');
  });

  // Device selection
  document.getElementById('device-select').addEventListener('change', async e => {
    const deviceId = e.target.value;
    if (deviceId) {
      State.activeDeviceId = deviceId;
      try {
        await SpotifyAPI.transferPlayback(deviceId, false);
        showToast(I18N.t('toast_device_changed'), 'success');
      } catch (err) {
        showToast('Geräte-Fehler: ' + err.message, 'error');
      }
    }
  });
  document.getElementById('refresh-devices-btn').addEventListener('click', loadDevices);

  // Stats range
  document.getElementById('stats-range').addEventListener('change', renderStats);

  // Expand songs list
  document.getElementById('stats-songs-expand')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.dataset.expanded = btn.dataset.expanded === '1' ? '0' : '1';
    renderStats();
  });

  // Clear history
  document.getElementById('clear-history-btn').addEventListener('click', () => {
    State.history = [];
    State.historyIds.clear();
    renderHistory();
  });

  // Regenerate queue
  document.getElementById('regenerate-queue-btn').addEventListener('click', () => {
    State.queue = [];
    fillQueue();
  });

  // Reset stats
  document.getElementById('reset-stats-btn').addEventListener('click', () => {
    if (!confirm(I18N.t('confirm_stats_reset'))) return;
    State.stats = { plays: [], shuffles: 0 };
    LS.save();
    renderStats();
    showToast(I18N.t('toast_stats_reset'), 'info');
  });

  // Auto-Skip Toggle
  const autoSkipBtn = document.getElementById('autoskip-btn');
  if (autoSkipBtn) {
    autoSkipBtn.classList.toggle('active', State.autoSkip);
    autoSkipBtn.addEventListener('click', () => {
      State.autoSkip = !State.autoSkip;
      autoSkipBtn.classList.toggle('active', State.autoSkip);
      showToast(State.autoSkip ? I18N.t('toast_autoskip_on') : I18N.t('toast_autoskip_off'), 'info');
    });
  }

  // Smart Shuffle Toggle
  const smartShuffleToggle = document.getElementById('smart-shuffle-toggle');
  if (smartShuffleToggle) {
    smartShuffleToggle.checked = State.smartShuffle;
    smartShuffleToggle.addEventListener('change', e => {
      State.smartShuffle = e.target.checked;
      showToast(State.smartShuffle ? I18N.t('toast_smart_on') : I18N.t('toast_smart_off'), 'info');
    });
  }

  // Shuffle Log Tab
  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.dataset.view === 'shufflelog') {
      tab.addEventListener('click', () => renderShuffleLog());
    }
  });

  // Nur neue Songs Toggle
  const onlyNewBtn = document.getElementById('only-new-btn');
  if (onlyNewBtn) {
    onlyNewBtn.addEventListener('click', () => {
      State.onlyNew = !State.onlyNew;
      onlyNewBtn.classList.toggle('active', State.onlyNew);
      showToast(State.onlyNew ? I18N.t('toast_only_new_on') : I18N.t('toast_only_new_off'), 'info');
    });
  }

  // Playlist erstellen
  const createPlaylistBtn = document.getElementById('create-playlist-btn');
  if (createPlaylistBtn) {
    createPlaylistBtn.addEventListener('click', createPlaylistFromHistory);
  }

  // Sync manuell
  const syncBtn = document.getElementById('sync-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.classList.add('spinning');
      const ok = await Sync.load();
      syncBtn.classList.remove('spinning');
      if (ok) {
        renderLists();
        renderArtistGrid();
        updateFiltersUI();
        showToast(I18N.t('toast_synced'), 'success');
      } else {
        showToast('Sync fehlgeschlagen', 'error');
      }
    });
  }

  // Start progress polling
  startProgressTimer();
}

// ── CHANGELOG ─────────────────────────────────────────────────────────────────
const CHANGELOG = [
  {
    version: '1.1.0',
    date: '2026-03-28',
    label: { de: 'Mobile & Alben Release', en: 'Mobile & Albums Release' },
    added: {
      de: [
        'Alben-Unterstützung — einzelne Alben zur Liste hinzufügen',
        'Album-Suche — Artist suchen und Diskografie durchsuchen ohne Artist hinzuzufügen',
        'Alben-Bereich — eigener Bereich unterhalb der Artists',
        'Mobile Mini-Player — Play/Pause, Nächster Track und Shuffle auf Mobile',
        'Mobile Geräte-Auswahl — Spotify Connect Gerät direkt auf Mobile wählen',
        'Mobile Shuffle-Button — großer Shuffle-Button auf Mobile',
        'iOS Unterstützung (teilweise) — Listen verwalten und andere Geräte steuern',
        'Track-Tooltips — Hover über abgeschnittene Namen',
        'Top Songs erweiterbar — "Alle anzeigen" Button in Statistiken',
      ],
      en: [
        'Album support — add individual albums to lists via discography browser',
        'Album search — search artist and browse discography without adding artist',
        'Album section — separate section below artists',
        'Mobile mini player — play/pause, next and shuffle on mobile',
        'Mobile device selector — choose Spotify Connect device on mobile',
        'Mobile shuffle button — large shuffle button visible on mobile',
        'iOS support (partial) — list management and remote control of other devices',
        'Track tooltips — hover over truncated names',
        'Top songs expandable — "Show all" button in statistics',
      ],
    },
    changed: {
      de: [
        'Artist-Grid von 3 auf 2 Spalten — größere Bilder',
        'Artist-Grid alphabetisch sortiert',
        'Filter-Toggle-Buttons für Jahresrange',
        'App-Pfad zu /music-shuffle/ geändert',
        'Album-Cache TTL auf 24 Stunden erhöht',
      ],
      en: [
        'Artist grid from 3 to 2 columns — larger images',
        'Artist grid sorted alphabetically',
        'Filter toggle buttons for year range',
        'App path changed to /music-shuffle/',
        'Album cache TTL increased to 24 hours',
      ],
    },
    fixed: {
      de: [
        'Artist-Cards schrumpfen nicht mehr bei vielen Artists',
        'iOS Scrolling verbessert',
        'Bottom Sheet Menü für Listen-Optionen (iOS kompatibel)',
        'Mobile Layout ohne unsichtbaren Player-Bereich',
      ],
      en: [
        'Artist cards no longer shrink with many artists',
        'iOS scrolling improved',
        'Bottom sheet menu for list options (iOS compatible)',
        'Mobile layout without invisible player blocking taps',
      ],
    },
  },
  {
    version: '1.0.2',
    date: '2026-03-27',
    label: { de: 'Bugfix Release', en: 'Bugfix Release' },
    added: {
      de: ['Artists werden alphabetisch sortiert angezeigt'],
      en: ['Artist grid now sorted alphabetically'],
    },
    changed: {
      de: ['Artist-Grid von 3 auf 2 Spalten umgestellt — größere Bilder, mehr Platz'],
      en: ['Artist grid switched from 3 to 2 columns — larger images, more breathing room'],
    },
  },
  {
    version: '1.0.2',
    date: '2026-03-27',
    label: { de: 'Bugfix Release', en: 'Bugfix Release' },
    added: {
      de: [
        'Filter-Toggle-Buttons für Jahresrange — Filter sind standardmäßig aus, Klick zum Aktivieren',
        'Track-Tooltips — Hover über abgeschnittene Namen zeigt vollständigen Text',
      ],
      en: [
        'Filter toggle buttons for year range — filters off by default, click to activate',
        'Track tooltips — hover over truncated names to see full text',
      ],
    },
    fixed: {
      de: [
        'Artist-Cards schrumpfen nicht mehr bei vielen Artists — feste Größe mit Scrollbar',
        'Jahres-Filter waren immer aktiv auch wenn leer',
      ],
      en: [
        'Artist cards no longer shrink with many artists — fixed size with scrollbar',
        'Year filters were always active even when empty',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-03-26',
    label: { de: 'Erster Release', en: 'Initial Release' },
    added: {
      de: [
        'Shuffle durch gesamte Diskografie — alle Alben, nicht nur Top 10',
        'Smart Shuffle — Artists die lange nicht gespielt wurden kommen öfter dran',
        'Favoriten-Artists — anpinnen für 3× höhere Wahrscheinlichkeit',
        'Genre-Listen — nach Genre shufflen (150+ Genres)',
        'Kombi-Listen — Artists und Genres mischen',
        'Queue mit 2 vorgeladenen Songs',
        'Verlauf — letzte 20 Tracks, anklickbar zum Erneut-Abspielen',
        'Blacklist — Tracks vom Abspielen ausschließen',
        'Crossfade — sanftes Ausblenden vor Track-Ende',
        'Auto-Skip — Tracks unter 60 Sekunden automatisch überspringen',
        'Wiederholen-Modus',
        'Artist-Stats — Plays und Top Songs pro Artist',
        'Shuffle-Log — warum wurde welcher Track gewählt?',
        'Discovery — ähnliche Artists finden',
        '"Nur neue Songs" Toggle',
        'Listen-Verwaltung — erstellen, umbenennen, duplizieren, mischen, löschen',
        'Import / Export als JSON',
        'Geräteübergreifende Synchronisation via Sync-Server (3s Timeout, funktioniert ohne VPN)',
        'Desktop-Benachrichtigungen bei Song-Wechsel',
        'Media Session API — Tastatur-Mediatasten',
        'Spotify Connect — Sonos, Lautsprecher, Handy, etc.',
        'PWA — installierbar auf Handy und Desktop',
        'Vollbild-Modus (F-Taste)',
        'Dynamischer Album-Cover-Hintergrund mit farblich passendem Schatten',
        'Statistiken-Dashboard',
        'Mehrsprachig — Deutsch und Englisch',
        'Changelog in der App',
        'Tastatur-Shortcuts',
        'Track-Tooltips — Hover über abgeschnittene Namen',
        '24h Album-Cache — weniger API-Calls',
      ],
      en: [
        'Full discography shuffle — entire album catalog, not just top 10',
        'Smart Shuffle — artists not played recently get higher probability',
        'Favorite artists — pin for 3× higher play chance',
        'Genre lists — shuffle by genre (150+ genres)',
        'Combo lists — mix artists and genres',
        'Queue with 2 pre-loaded next songs',
        'Play history — last 20 tracks, clickable to replay',
        'Blacklist — block tracks from being played',
        'Crossfade — smooth volume fade before track end',
        'Auto-Skip — skip tracks shorter than 60 seconds',
        'Repeat mode',
        'Artist stats — per-artist play count and top songs',
        'Shuffle log — why was each track chosen?',
        'Similar artists discovery',
        '"Only new songs" toggle',
        'List management — create, rename, duplicate, merge, delete',
        'Import / Export lists as JSON',
        'Cross-device sync via sync server (3s timeout, works without VPN)',
        'Desktop notifications on song change',
        'Media Session API — keyboard media keys',
        'Spotify Connect — Sonos, speakers, phone, etc.',
        'PWA — installable on mobile and desktop',
        'Fullscreen mode (F key)',
        'Dynamic album art background with color-matched glow',
        'Statistics dashboard',
        'Multilingual — German and English',
        'In-app changelog',
        'Keyboard shortcuts',
        'Track tooltips — hover over truncated names',
        '24h album cache — fewer API calls',
      ],
    },
  },
];

function showChangelog() {
  const modal = document.getElementById('modal-changelog');
  const content = document.getElementById('changelog-content');
  if (!modal || !content) return;

  const lang = I18N.getLang();
  const addedLabel = lang === 'de' ? 'Hinzugefügt' : 'Added';
  const changedLabel = lang === 'de' ? 'Geändert' : 'Changed';
  const fixedLabel = lang === 'de' ? 'Behoben' : 'Fixed';

  content.innerHTML = CHANGELOG.map(entry => {
    const label = typeof entry.label === 'object' ? entry.label[lang] || entry.label.en : entry.label;
    const added = Array.isArray(entry.added) ? entry.added : (entry.added?.[lang] || entry.added?.en || []);
    const changed = Array.isArray(entry.changed) ? entry.changed : (entry.changed?.[lang] || entry.changed?.en || []);
    const fixed = Array.isArray(entry.fixed) ? entry.fixed : (entry.fixed?.[lang] || entry.fixed?.en || []);
    return `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:1rem;font-weight:800;color:var(--text)">v${entry.version}</span>
        <span style="font-size:0.75rem;color:var(--accent);font-weight:700;background:var(--accent-glow);padding:2px 8px;border-radius:20px">${escHtml(label)}</span>
        <span style="font-size:0.72rem;color:var(--text3);margin-left:auto">${entry.date}</span>
      </div>
      ${added.length ? `
        <div style="font-size:0.75rem;font-weight:700;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">${addedLabel}</div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">
          ${added.map(item => `
            <li style="display:flex;gap:8px;font-size:0.8rem;color:var(--text2)">
              <span style="color:var(--accent);flex-shrink:0">+</span>
              <span>${escHtml(item)}</span>
            </li>`).join('')}
        </ul>` : ''}
      ${changed.length ? `
        <div style="font-size:0.75rem;font-weight:700;color:var(--text2);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.05em">${changedLabel}</div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">
          ${changed.map(item => `
            <li style="display:flex;gap:8px;font-size:0.8rem;color:var(--text2)">
              <span style="color:#f0a500;flex-shrink:0">~</span>
              <span>${escHtml(item)}</span>
            </li>`).join('')}
        </ul>` : ''}
      ${fixed.length ? `
        <div style="font-size:0.75rem;font-weight:700;color:var(--text2);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.05em">${fixedLabel}</div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">
          ${fixed.map(item => `
            <li style="display:flex;gap:8px;font-size:0.8rem;color:var(--text2)">
              <span style="color:#e74c3c;flex-shrink:0">✓</span>
              <span>${escHtml(item)}</span>
            </li>`).join('')}
        </ul>` : ''}
    </div>`;
  }).join('<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">');

  modal.classList.remove('hidden');
}

// ── LANGUAGE ──────────────────────────────────────────────────────────────────
function updateLangBtn() {
  const label = document.getElementById('lang-label');
  if (label) label.textContent = I18N.getLang().toUpperCase();
}

// ── SYNC STATUS UI ─────────────────────────────────────────────────────────────
function updateSyncStatus() {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;
  if (Sync.url) {
    Sync.check().then(ok => {
      indicator.title = ok ? 'Sync aktiv ✓' : 'Sync-Server nicht erreichbar';
      indicator.style.color = ok ? 'var(--accent)' : 'var(--text3)';
    });
  } else {
    indicator.style.display = 'none';
  }
}

// ── PLAYLIST ERSTELLEN ─────────────────────────────────────────────────────────
async function createPlaylistFromHistory() {
  if (!State.history.length) {
    showToast('Verlauf ist leer', 'info');
    return;
  }
  if (!State.user) return;

  const name = `Music Shuffle — ${new Date().toLocaleDateString('de-DE')}`;

  try {
    showToast(I18N.t('toast_playlist_creating'), 'info');

    // Create playlist
    const token = await SpotifyAPI.getToken();
    const createRes = await fetch(`https://api.spotify.com/v1/users/${State.user.id}/playlists`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: 'Erstellt von Music Shuffle', public: false }),
    });

    if (!createRes.ok) throw new Error('Playlist konnte nicht erstellt werden');
    const playlist = await createRes.json();

    // Add tracks
    const uris = State.history.map(t => t.uri).filter(Boolean).slice(0, 100);
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris }),
    });

    showToast(`✓ Playlist "${name}" erstellt (${uris.length} Songs)`, 'success');
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

// ── UTILS ──────────────────────────────────────────────────────────────────────
function msToTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
