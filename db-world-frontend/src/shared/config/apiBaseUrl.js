// Single source of truth for the API base URL.
//
// Resolution order (first match wins):
//   1. VITE_API_BASE_URL build-time env var      → explicit override
//   2. Known production frontend host             → derive api.<bare>
//   3. Same origin (empty string)                 → dev / proxied setups
//
// The hostname fallback exists so that a production build without
// VITE_API_BASE_URL still points at the right API host instead of
// silently calling the SPA host and getting the index.html fallback.

const PRODUCTION_FRONTEND_HOSTS = new Set(['db-world.in', 'www.db-world.in']);
const PRODUCTION_API_URL        = 'https://api.db-world.in';

let cached;

export function getApiBaseUrl() {
  if (cached !== undefined) return cached;

  const envUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  if (envUrl) {
    cached = envUrl.replace(/\/$/, '');
    return cached;
  }

  if (typeof window !== 'undefined'
      && PRODUCTION_FRONTEND_HOSTS.has(window.location.hostname)) {
    cached = PRODUCTION_API_URL;
    return cached;
  }

  // Native app serving the BUNDLED build (capacitor → https://localhost): there's no
  // dev proxy, so an empty (same-origin) base would hit localhost. Point at prod API.
  if (typeof window !== 'undefined'
      && window.Capacitor?.isNativePlatform?.()
      && window.location.hostname === 'localhost') {
    cached = PRODUCTION_API_URL;
    return cached;
  }

  cached = '';
  return cached;
}

// Resolve a WebSocket URL for the given path (e.g. '/ws/status').
//
// WebSockets do NOT go through the CapacitorHttp plugin (it patches
// fetch/XHR only), and on a native build the page origin is
// https://localhost — not the backend. So we reuse getApiBaseUrl()
// (which already redirects native localhost → the prod API) and just
// swap the scheme: http→ws, https→wss.
//
// Resolution order (first match wins):
//   1. VITE_WEBSOCKET_BASEURL build-time env var → explicit override
//   2. getApiBaseUrl() non-empty                 → derive ws(s) from it
//   3. Same origin                               → dev / proxied setups
export function resolveWsUrl(path) {
  const envWs = (import.meta.env.VITE_WEBSOCKET_BASEURL ?? '').trim();
  if (envWs) return `${envWs.replace(/\/$/, '')}${path}`;

  const apiBase = getApiBaseUrl();
  if (apiBase) return `${apiBase.replace(/^http/, 'ws')}${path}`;

  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}${path}`;
  }

  return path;
}
