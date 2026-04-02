// ═══════════════════════════════════════════════════════════════
// config.js — Artist Shuffle Configuration
//
// SETUP:
// 1. Go to https://developer.spotify.com/dashboard
// 2. Create a new app (or open existing)
// 3. Copy your Client ID
// 4. Add Redirect URI — must exactly match redirectUri below:
//      http://localhost:8080/          (local development)
//      https://your-domain.com/        (production)
// 5. Enable: Web API + Web Playback SDK
// 6. Save → paste Client ID below
//
// ⚠️  Do NOT commit this file to git (it's in .gitignore)
// ═══════════════════════════════════════════════════════════════

window.SPOTIFY_CONFIG = {

    // Your Spotify App Client ID
    clientId: 'YOUR_CLIENT_ID_HERE',

    // Must exactly match the Redirect URI in your Spotify Dashboard
    redirectUri: 'http://localhost:8080/',
    // Production examples:
    // redirectUri: 'https://shuffle.your-domain.com/',
    // redirectUri: 'https://your-domain.com/artist-shuffle/',

    // Optional: sync server URL for cross-device list sync
    // Leave as null to disable (lists stored locally only)
    // See sync-server/SYNC-SERVER.md for setup
    syncUrl: null,
    // syncUrl: 'https://sync.your-domain.com',
    // syncUrl: 'http://192.168.1.100:3001',  // local network

    // Optional: sync play statistics across devices (requires syncUrl)
    // Set to false to keep stats local-only even when syncUrl is set
    syncStats: true,

};
