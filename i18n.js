/* ═══════════════════════════════════════════════════════
   ARTIST SHUFFLE — i18n.js
   Internationalization — Deutsch / English
   ═══════════════════════════════════════════════════════ */

'use strict';

const I18N = (() => {

  const strings = {
    de: {
      // Login
      login_title: 'Deine Musik.\nDein Shuffle.',
      login_sub: 'Verbinde deinen Spotify-Account und shuffle durch deine liebsten Artists und Genres — ohne Algorithmus, nur deine Auswahl.',
      login_client_id_label: 'Spotify Client ID',
      login_client_id_placeholder: 'z.B. abc123def456…',
      login_client_id_hint: 'App erstellen unter',
      login_redirect_hint: 'Redirect URI eintragen:',
      login_btn: 'Mit Spotify einloggen',
      login_note: '⚠️ Erfordert Spotify Premium für die Web-Wiedergabe.',

      // Nav
      nav_lists: 'Listen',
      nav_queue: 'Queue',
      nav_history: 'Verlauf',
      nav_stats: 'Stats',
      nav_log: 'Log',
      nav_blacklist: 'Blacklist',

      // Lists
      list_new_placeholder: 'z.B. Metal Abend, Gym Rotation…',
      list_new_title: 'Neue Liste erstellen',
      list_rename_title: 'Liste umbenennen',
      list_delete_title: 'Liste löschen?',
      list_delete_confirm: 'Diese Aktion kann nicht rückgängig gemacht werden.',
      list_empty: 'Keine Artists in dieser Liste',
      list_empty_sub: 'Suche oben nach Artists zum Hinzufügen',
      list_none: '— Keine Listen —',
      list_rename: '✏️ Umbenennen',
      list_duplicate: '📋 Duplizieren',
      list_merge: '🔀 Liste einmischen',
      list_export: '📤 Exportieren',
      list_import: '📥 Importieren',
      list_delete: '🗑️ Liste löschen',
      list_merge_title: '🔀 Liste einmischen',
      list_merge_sub: 'Welche Liste soll in die aktive Liste eingemischt werden?',

      // Search
      search_artist_placeholder: 'Artist suchen und hinzufügen…',
      search_album_artist_placeholder: 'Artist für Album-Suche…',
      search_genre_placeholder: 'Genre suchen und hinzufügen…',
      search_loading: 'Suche…',
      search_empty: 'Keine Artists gefunden',
      search_genre_empty: 'Keine Genres gefunden',
      search_selected: ' ausgewählt',
      search_add_btn: '✚ Alle hinzufügen',

      // Filters
      filter_title: 'Filter',
      filter_no_live: '🚫 Keine Live-Alben',
      filter_year_from: '📅 Ab Jahr',
      filter_year_from_placeholder: '1990',
      filter_year_to: '📅 Bis Jahr',
      filter_year_to_placeholder: '2025',

      // Player
      player_idle_hint: 'Wähle eine Liste und drücke Shuffle',
      player_shuffle: 'SHUFFLE',
      player_no_device: 'Kein Gerät aktiv',
      player_device_none: 'Kein Gerät',
      player_device_choose: '— Gerät wählen —',
      player_device_not_found: 'Keine Geräte gefunden — Spotify öffnen',

      // Queue
      queue_title: 'Queue',
      queue_empty: 'Queue ist leer',
      queue_empty_sub: 'Starte den Shuffle um die Queue zu füllen',
      queue_regenerate: '↻ Neu generieren',

      // History
      history_title: 'Verlauf',
      history_empty: 'Noch nichts gespielt',
      history_clear: 'Leeren',
      history_only_new: '🆕 Nur neue',
      history_playlist: '🎵 Playlist',

      // Stats
      stats_title: 'Statistiken',
      stats_plays: '🎵 Songs gespielt',
      stats_time: '⏱️ Hörzeit',
      stats_shuffles: '🎲 Shuffles',
      stats_top_artists: '🏆 Top Artists',
      stats_top_songs: '🎵 Top Songs',
      stats_sessions: '📅 Sessions (letzte Wochen)',
      stats_reset: 'Stats zurücksetzen',
      stats_range_7: '7 Tage',
      stats_range_30: '30 Tage',
      stats_range_all: 'Alles',

      // Shuffle Log
      log_title: 'Shuffle-Log',
      log_empty: 'Noch keine Shuffles',
      log_smart: 'Smart',

      // Blacklist
      blacklist_title: 'Blacklist',
      blacklist_empty: 'Blacklist ist leer',
      blacklist_empty_sub: 'Drücke B beim Abspielen um einen Song zu blockieren',
      blacklist_active: 'Aktiv',

      // Artist stats
      artist_stats_played: '🎵 Songs gespielt',
      artist_stats_time: '⏱️ Hörzeit',
      artist_stats_last: 'Zuletzt gespielt:',
      artist_stats_top: '🏆 Top Songs',
      artist_stats_none: 'Noch nicht gespielt',
      artist_stats_close: 'Schließen',

      // Discovery
      discovery_title: '🎯 Ähnliche Artists entdecken',
      discovery_loading: 'Lade…',
      discovery_none: 'Keine Ergebnisse',
      discovery_add: '+ Hinzufügen',
      discovery_added: '✓ In Liste',
      discovery_close: 'Schließen',

      // Genres
      genres_label: '🎸 Genres',

      // Buttons / Controls
      btn_cancel: 'Abbrechen',
      btn_save: 'Speichern',
      btn_create: 'Erstellen',
      btn_delete: 'Löschen',
      btn_merge: 'Einmischen',
      btn_play: 'Abspielen',
      btn_remove: 'Entfernen',

      // Toasts
      toast_synced: 'Listen synchronisiert ✓',
      toast_sync_fail: 'Sync-Server nicht erreichbar',
      toast_list_created: 'Liste erstellt',
      toast_list_renamed: 'Liste umbenannt',
      toast_artist_added: 'hinzugefügt',
      toast_artist_exists: 'ist bereits in der Liste',
      toast_genre_added: 'Genre hinzugefügt',
      toast_no_artists: 'Keine Artists in der aktiven Liste!',
      toast_no_track: 'Kein passender Track gefunden',
      toast_autoskip: '⏭️ Auto-Skip: Track zu kurz',
      toast_queue_empty: 'Queue leer',
      toast_premium: 'Spotify Premium wird benötigt!',
      toast_device_none: 'Kein Wiedergabegerät aktiv. Bitte Gerät auswählen.',
      toast_device_changed: 'Gerät gewechselt',
      toast_repeat_on: 'Wiederholen: an',
      toast_repeat_off: 'Wiederholen: aus',
      toast_crossfade_on: '🎵 Crossfade aktiv',
      toast_crossfade_off: 'Crossfade deaktiviert',
      toast_autoskip_on: '⏭️ Auto-Skip aktiv',
      toast_autoskip_off: 'Auto-Skip deaktiviert',
      toast_smart_on: '🧠 Smart Shuffle aktiv',
      toast_smart_off: 'Smart Shuffle deaktiviert',
      toast_only_new_on: '🆕 Nur neue Songs aktiv',
      toast_only_new_off: 'Alle Songs',
      toast_notification_on: '🔔 Benachrichtigungen aktiviert',
      toast_notification_blocked: 'Benachrichtigungen blockiert — bitte in Browser-Einstellungen erlauben',
      toast_blacklisted: 'zur Blacklist hinzugefügt',
      toast_exported: 'Listen exportiert',
      toast_imported: 'Listen importiert',
      toast_import_fail: 'Import fehlgeschlagen',
      toast_stats_reset: 'Statistiken zurückgesetzt',
      toast_playlist_creating: 'Playlist wird erstellt…',
      toast_playlist_created: 'Playlist erstellt',
      toast_ready: 'Music Shuffle bereit ✓',
      toast_offline: 'Player offline',
      toast_no_lists_merge: 'Keine anderen Listen zum Mischen',
      toast_merged: 'Artists hinzugefügt',
      toast_duplicated: 'Liste erstellt',
      toast_favorite_on: 'als Favorit markiert',
      toast_favorite_off: 'nicht mehr Favorit',

      // Misc
      confirm_stats_reset: 'Statistiken wirklich zurücksetzen?',
      pwa_install: '🎲 Music Shuffle als App installieren',
      pwa_install_btn: 'Installieren',
      pwa_installed: 'App installiert! ✓',
      fullscreen_exit: 'Vollbild beenden',
      device_refresh: 'Geräte aktualisieren',
      logout: 'Abmelden',
    },

    en: {
      // Login
      login_title: 'Your Music.\nYour Shuffle.',
      login_sub: 'Connect your Spotify account and shuffle through your favorite artists and genres — no algorithm, just your picks.',
      login_client_id_label: 'Spotify Client ID',
      login_client_id_placeholder: 'e.g. abc123def456…',
      login_client_id_hint: 'Create an app at',
      login_redirect_hint: 'Add Redirect URI:',
      login_btn: 'Log in with Spotify',
      login_note: '⚠️ Spotify Premium required for web playback.',

      // Nav
      nav_lists: 'Lists',
      nav_queue: 'Queue',
      nav_history: 'History',
      nav_stats: 'Stats',
      nav_log: 'Log',
      nav_blacklist: 'Blacklist',

      // Lists
      list_new_placeholder: 'e.g. Metal Night, Gym Rotation…',
      list_new_title: 'Create new list',
      list_rename_title: 'Rename list',
      list_delete_title: 'Delete list?',
      list_delete_confirm: 'This action cannot be undone.',
      list_empty: 'No artists in this list',
      list_empty_sub: 'Search for artists above to add them',
      list_none: '— No lists —',
      list_rename: '✏️ Rename',
      list_duplicate: '📋 Duplicate',
      list_merge: '🔀 Merge list',
      list_export: '📤 Export',
      list_import: '📥 Import',
      list_delete: '🗑️ Delete list',
      list_merge_title: '🔀 Merge list',
      list_merge_sub: 'Which list should be merged into the active list?',

      // Search
      search_artist_placeholder: 'Search and add artists…',
      search_album_artist_placeholder: 'Search artist for albums…',
      search_genre_placeholder: 'Search and add genres…',
      search_loading: 'Searching…',
      search_empty: 'No artists found',
      search_genre_empty: 'No genres found',
      search_selected: ' selected',
      search_add_btn: '✚ Add all',

      // Filters
      filter_title: 'Filter',
      filter_no_live: '🚫 No live albums',
      filter_year_from: '📅 From year',
      filter_year_from_placeholder: '1990',
      filter_year_to: '📅 To year',
      filter_year_to_placeholder: '2025',

      // Player
      player_idle_hint: 'Select a list and press Shuffle',
      player_shuffle: 'SHUFFLE',
      player_no_device: 'No device active',
      player_device_none: 'No device',
      player_device_choose: '— Choose device —',
      player_device_not_found: 'No devices found — open Spotify',

      // Queue
      queue_title: 'Queue',
      queue_empty: 'Queue is empty',
      queue_empty_sub: 'Start shuffling to fill the queue',
      queue_regenerate: '↻ Regenerate',

      // History
      history_title: 'History',
      history_empty: 'Nothing played yet',
      history_clear: 'Clear',
      history_only_new: '🆕 Only new',
      history_playlist: '🎵 Playlist',

      // Stats
      stats_title: 'Statistics',
      stats_plays: '🎵 Songs played',
      stats_time: '⏱️ Listening time',
      stats_shuffles: '🎲 Shuffles',
      stats_top_artists: '🏆 Top Artists',
      stats_top_songs: '🎵 Top Songs',
      stats_sessions: '📅 Sessions (last weeks)',
      stats_reset: 'Reset stats',
      stats_range_7: '7 days',
      stats_range_30: '30 days',
      stats_range_all: 'All time',

      // Shuffle Log
      log_title: 'Shuffle Log',
      log_empty: 'No shuffles yet',
      log_smart: 'Smart',

      // Blacklist
      blacklist_title: 'Blacklist',
      blacklist_empty: 'Blacklist is empty',
      blacklist_empty_sub: 'Press B while playing to block a song',
      blacklist_active: 'Active',

      // Artist stats
      artist_stats_played: '🎵 Songs played',
      artist_stats_time: '⏱️ Listening time',
      artist_stats_last: 'Last played:',
      artist_stats_top: '🏆 Top Songs',
      artist_stats_none: 'Not played yet',
      artist_stats_close: 'Close',

      // Discovery
      discovery_title: '🎯 Discover Similar Artists',
      discovery_loading: 'Loading…',
      discovery_none: 'No results',
      discovery_add: '+ Add',
      discovery_added: '✓ In list',
      discovery_close: 'Close',

      // Genres
      genres_label: '🎸 Genres',

      // Buttons / Controls
      btn_cancel: 'Cancel',
      btn_save: 'Save',
      btn_create: 'Create',
      btn_delete: 'Delete',
      btn_merge: 'Merge',
      btn_play: 'Play',
      btn_remove: 'Remove',

      // Toasts
      toast_synced: 'Lists synced ✓',
      toast_sync_fail: 'Sync server unreachable',
      toast_list_created: 'List created',
      toast_list_renamed: 'List renamed',
      toast_artist_added: 'added',
      toast_artist_exists: 'is already in the list',
      toast_genre_added: 'Genre added',
      toast_no_artists: 'No artists in the active list!',
      toast_no_track: 'No matching track found',
      toast_autoskip: '⏭️ Auto-Skip: track too short',
      toast_queue_empty: 'Queue empty',
      toast_premium: 'Spotify Premium required!',
      toast_device_none: 'No playback device active. Please select a device.',
      toast_device_changed: 'Device switched',
      toast_repeat_on: 'Repeat: on',
      toast_repeat_off: 'Repeat: off',
      toast_crossfade_on: '🎵 Crossfade active',
      toast_crossfade_off: 'Crossfade disabled',
      toast_autoskip_on: '⏭️ Auto-Skip active',
      toast_autoskip_off: 'Auto-Skip disabled',
      toast_smart_on: '🧠 Smart Shuffle active',
      toast_smart_off: 'Smart Shuffle disabled',
      toast_only_new_on: '🆕 Only new songs active',
      toast_only_new_off: 'All songs',
      toast_notification_on: '🔔 Notifications enabled',
      toast_notification_blocked: 'Notifications blocked — please allow in browser settings',
      toast_blacklisted: 'added to blacklist',
      toast_exported: 'Lists exported',
      toast_imported: 'Lists imported',
      toast_import_fail: 'Import failed',
      toast_stats_reset: 'Stats reset',
      toast_playlist_creating: 'Creating playlist…',
      toast_playlist_created: 'Playlist created',
      toast_ready: 'Music Shuffle ready ✓',
      toast_offline: 'Player offline',
      toast_no_lists_merge: 'No other lists to merge',
      toast_merged: 'artists added',
      toast_duplicated: 'List created',
      toast_favorite_on: 'marked as favorite',
      toast_favorite_off: 'removed from favorites',

      // Misc
      confirm_stats_reset: 'Really reset all stats?',
      pwa_install: '🎲 Install Music Shuffle as app',
      pwa_install_btn: 'Install',
      pwa_installed: 'App installed! ✓',
      fullscreen_exit: 'Exit fullscreen',
      device_refresh: 'Refresh devices',
      logout: 'Log out',
    },
  };

  let _lang = localStorage.getItem('as_lang') || 'de';

  function t(key) {
    return strings[_lang]?.[key] || strings['de']?.[key] || key;
  }

  function setLang(lang) {
    _lang = lang;
    localStorage.setItem('as_lang', lang);
    applyAll();
  }

  function getLang() { return _lang; }

  // Apply all translations to DOM elements with data-i18n attribute
  function applyAll() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = t(key);
      if (el.dataset.i18nAttr) {
        // Set specific attribute (e.g. placeholder, title)
        el.setAttribute(el.dataset.i18nAttr, val);
      } else if (el.tagName === 'OPTION') {
        el.textContent = val;
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.placeholder !== undefined) el.placeholder = val;
      } else {
        el.textContent = val;
      }
    });

    // Update html lang attribute
    document.documentElement.lang = _lang;

    // Dispatch event so app.js can react
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: _lang } }));
  }

  return { t, setLang, getLang, applyAll };

})();
