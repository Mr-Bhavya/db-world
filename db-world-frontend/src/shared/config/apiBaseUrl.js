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

  cached = '';
  return cached;
}
