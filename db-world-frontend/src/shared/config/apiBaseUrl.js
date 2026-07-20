// src/config/network.js// * Single source of truth for API, WebSocket, and public share URLs.
 /**
 * Resolution order:
 * API base URL:
 *   1. VITE_API_BASE_URL
 *   2. Known production frontend hosts -> production API origin
 *   3. Native bundled app on localhost -> production API origin
 *   4. Same-origin fallback ('')
 *
 * WebSocket base URL:
 *   1. VITE_WEBSOCKET_BASEURL
 *   2. Derive from API base URL
 *   3. Native bundled app on localhost -> production API origin converted to ws(s)
 *   4. Same-origin ws(s) fallback
 **/

const PRODUCTION_FRONTEND_HOSTS = new Set(['db-world.in', 'www.db-world.in']);
const PRODUCTION_API_ORIGIN = 'https://api.db-world.in';
const PUBLIC_WEB_ORIGIN = 'https://db-world.in';

let cachedApiBase;
let cachedWsBase;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function trimTrailingSlash(value = '') {
  return value.replace(/\/+$/, '');
}

function normalizePath(path = '') {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function isWindowAvailable() {
  return typeof window !== 'undefined';
}

function isNativePlatform() {
  return !!window?.Capacitor?.isNativePlatform?.();
}

function isLocalhostHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function toWsOrigin(httpOrigin) {
  try {
    const url = new URL(httpOrigin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return trimTrailingSlash(url.origin);
  } catch {
    return '';
  }
}

function buildUrl(baseOrigin, path) {
  try {
    const normalizedPath = normalizePath(path);
    const url = new URL(normalizedPath, `${trimTrailingSlash(baseOrigin)}/`);
    return trimTrailingSlash(url.toString());
  } catch {
    return path;
  }
}

function getLocationInfo() {
  if (!isWindowAvailable()) {
    return {
      origin: '',
      host: '',
      hostname: '',
      pathname: '',
      search: '',
      hash: '',
      protocol: '',
    };
  }

  return {
    origin: window.location.origin,
    host: window.location.host,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    protocol: window.location.protocol,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API URL
// ─────────────────────────────────────────────────────────────────────────────

export function getApiBaseUrl() {
  if (cachedApiBase !== undefined) return cachedApiBase;

  const envUrl = trimTrailingSlash((import.meta.env.VITE_API_BASE_URL ?? '').trim());
  if (envUrl) {
    cachedApiBase = envUrl;
    return cachedApiBase;
  }

  if (isWindowAvailable()) {
    const { hostname } = getLocationInfo();

    if (PRODUCTION_FRONTEND_HOSTS.has(hostname)) {
      cachedApiBase = PRODUCTION_API_ORIGIN;
      return cachedApiBase;
    }

    // Native app serving the bundled build (Capacitor -> localhost):
    // same-origin would hit localhost instead of the backend.
    if (isNativePlatform() && isLocalhostHost(hostname)) {
      cachedApiBase = PRODUCTION_API_ORIGIN;
      return cachedApiBase;
    }
  }

  cachedApiBase = '';
  return cachedApiBase;
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket URL
// ─────────────────────────────────────────────────────────────────────────────

export function getWebSocketBaseUrl() {
  if (cachedWsBase !== undefined) return cachedWsBase;

  const envWs = trimTrailingSlash((import.meta.env.VITE_WEBSOCKET_BASEURL ?? '').trim());
  if (envWs) {
    cachedWsBase = envWs;
    return cachedWsBase;
  }

  const apiBase = getApiBaseUrl();
  if (apiBase) {
    cachedWsBase = toWsOrigin(apiBase);
    return cachedWsBase;
  }

  if (isWindowAvailable()) {
    const { hostname, protocol, host } = getLocationInfo();

    // Native bundled app fallback
    if (isNativePlatform() && isLocalhostHost(hostname)) {
      cachedWsBase = toWsOrigin(PRODUCTION_API_ORIGIN);
      return cachedWsBase;
    }

    // Same-origin fallback for dev / proxied setups
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    cachedWsBase = `${wsProtocol}//${host}`;
    return cachedWsBase;
  }

  cachedWsBase = '';
  return cachedWsBase;
}

/**
 * Resolve final WebSocket URL for a path, e.g. '/ws/status'
 */
export function resolveWsUrl(path = '/ws/status') {
  const normalizedPath = normalizePath(path);
  const wsBase = getWebSocketBaseUrl();

  if (wsBase) {
    return buildUrl(wsBase, normalizedPath);
  }

  return normalizedPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public share URL
// ─────────────────────────────────────────────────────────────────────────────

export function publicShareUrl() {
  if (!isWindowAvailable()) return PUBLIC_WEB_ORIGIN;

  const { hostname, href, pathname, search, hash } = window.location;

  // Already on the real public web host -> actual href is correct
  if (PRODUCTION_FRONTEND_HOSTS.has(hostname)) return href;

  // Native (localhost) or dev -> rebuild against the public origin
  return `${PUBLIC_WEB_ORIGIN}${pathname}${search}${hash}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional debug helpers (useful on Capacitor when logs are hard to see)
// ─────────────────────────────────────────────────────────────────────────────

export function getResolvedNetworkInfo(wsPath = '/ws/status') {
  const location = getLocationInfo();

  return {
    isNative: isWindowAvailable() ? isNativePlatform() : false,
    locationOrigin: location.origin,
    locationHost: location.host,
    locationHostname: location.hostname,
    apiBaseUrl: getApiBaseUrl(),
    wsBaseUrl: getWebSocketBaseUrl(),
    wsUrl: resolveWsUrl(wsPath),
    publicShareUrl: publicShareUrl(),
    envApiBaseUrl: trimTrailingSlash((import.meta.env.VITE_API_BASE_URL ?? '').trim()),
    envWsBaseUrl: trimTrailingSlash((import.meta.env.VITE_WEBSOCKET_BASEURL ?? '').trim()),
  };
}

/**
 * Shows popup with final resolved URLs.
 * Useful on mobile where console logs are not easy to inspect.
 */
export function showResolvedUrlsAlert(wsPath = '/ws/status') {
  if (!isWindowAvailable()) return;

  const info = getResolvedNetworkInfo(wsPath);

  window.alert(
    [
      'Resolved Network Info',
      `Native: ${String(info.isNative)}`,
      `Location Origin: ${info.locationOrigin || '(none)'}`,
      `API Base URL: ${info.apiBaseUrl || '(same-origin)'}`,
      `WS Base URL: ${info.wsBaseUrl || '(same-origin)'}`,
      `WS URL: ${info.wsUrl}`,
      `Share URL: ${info.publicShareUrl}`,
      `ENV API: ${info.envApiBaseUrl || '(empty)'}`,
      `ENV WS: ${info.envWsBaseUrl || '(empty)'}`,
    ].join('\n')
  );
}

/**
 * Optional reset helper (useful for tests or runtime env swaps)
 */
export function resetResolvedUrlCache() {
  cachedApiBase = undefined;
  cachedWsBase = undefined;
}
