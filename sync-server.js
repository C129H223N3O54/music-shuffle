/**
 * Artist Shuffle — Sync Server
 * Einfacher REST-Server zum geräteübergreifenden Speichern von Listen
 * Läuft als Docker Container auf der Synology NAS
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const DATA_FILE  = process.env.DATA_FILE  || '/data/lists.json';
const STATS_FILE = process.env.STATS_FILE || '/data/stats.json';
const CACHE_FILE = process.env.CACHE_FILE || '/data/cache.json';

// ── DATEN LADEN / SPEICHERN ──────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Sync] Fehler beim Laden:', err.message);
  }
  return { lists: [], updatedAt: null };
}

function saveData(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Sync] Fehler beim Speichern:', err.message);
    return false;
  }
}

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Sync] Fehler beim Laden der Stats:', err.message);
  }
  return { plays: [], shuffles: 0, updatedAt: null };
}

function saveStats(data) {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Sync] Fehler beim Speichern der Stats:', err.message);
    return false;
  }
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Sync] Fehler beim Laden des Cache:', err.message);
  }
  return { cache: {}, updatedAt: null };
}

function saveCache(data) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Sync] Fehler beim Speichern des Cache:', err.message);
    return false;
  }
}

// ── HTTP HELPERS ──────────────────────────────────────────
function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ── SERVER ────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  console.log(`[Sync] ${req.method} ${pathname}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── GET /api/lists — Alle Listen laden
  if (req.method === 'GET' && pathname === '/api/lists') {
    const data = loadData();
    sendJSON(res, 200, data);
    return;
  }

  // ── POST /api/lists — Listen speichern
  if (req.method === 'POST' && pathname === '/api/lists') {
    try {
      const body = await readBody(req);
      if (!body.lists || !Array.isArray(body.lists)) {
        sendJSON(res, 400, { error: 'Invalid data — lists array required' });
        return;
      }
      const ok = saveData({ lists: body.lists });
      if (ok) {
        sendJSON(res, 200, { success: true, count: body.lists.length });
      } else {
        sendJSON(res, 500, { error: 'Speichern fehlgeschlagen' });
      }
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
    }
    return;
  }

  // ── DELETE /api/lists — Alle Listen löschen
  if (req.method === 'DELETE' && pathname === '/api/lists') {
    const ok = saveData({ lists: [] });
    sendJSON(res, 200, { success: ok });
    return;
  }

  // ── GET /api/stats — Stats laden
  if (req.method === 'GET' && pathname === '/api/stats') {
    const data = loadStats();
    sendJSON(res, 200, data);
    return;
  }

  // ── POST /api/stats — Stats speichern
  if (req.method === 'POST' && pathname === '/api/stats') {
    try {
      const body = await readBody(req);
      if (!Array.isArray(body.plays) || typeof body.shuffles !== 'number') {
        sendJSON(res, 400, { error: 'Invalid data — plays array and shuffles number required' });
        return;
      }
      const ok = saveStats({ plays: body.plays, shuffles: body.shuffles });
      if (ok) {
        sendJSON(res, 200, { success: true, plays: body.plays.length });
      } else {
        sendJSON(res, 500, { error: 'Speichern fehlgeschlagen' });
      }
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
    }
    return;
  }

  // ── GET /api/cache — Album-Cache laden
  if (req.method === 'GET' && pathname === '/api/cache') {
    const data = loadCache();
    sendJSON(res, 200, data);
    return;
  }

  // ── POST /api/cache — Einen Artist-Cache-Eintrag speichern
  if (req.method === 'POST' && pathname === '/api/cache') {
    try {
      const body = await readBody(req);
      if (!body.artistId || !Array.isArray(body.albums)) {
        sendJSON(res, 400, { error: 'Invalid data — artistId and albums required' });
        return;
      }
      const data = loadCache();
      data.cache = data.cache || {};
      data.cache[body.artistId] = { albums: body.albums, ts: body.ts || Date.now() };
      const ok = saveCache(data);
      sendJSON(res, ok ? 200 : 500, { success: ok });
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
    }
    return;
  }

  // ── GET /api/health — Health Check
  if (req.method === 'GET' && pathname === '/api/health') {
    const data  = loadData();
    const stats = loadStats();
    sendJSON(res, 200, {
      status: 'ok',
      lists: data.lists?.length || 0,
      plays: stats.plays?.length || 0,
      updatedAt: data.updatedAt,
    });
    return;
  }

  // 404
  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Sync] Artist Shuffle Sync-Server läuft auf Port ${PORT}`);
  console.log(`[Sync] Datei: ${DATA_FILE}`);
  console.log(`[Sync] Health: http://localhost:${PORT}/api/health`);
});

process.on('SIGTERM', () => {
  console.log('[Sync] Stopping...');
  server.close(() => process.exit(0));
});
