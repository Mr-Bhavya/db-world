import { describe, it, expect, beforeEach, vi } from 'vitest';

// The suite runs in node. A stub keeps this file dependency-free rather than pulling jsdom in
// for the handful of Web Storage calls the store makes.
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();
globalThis.window = { localStorage: globalThis.localStorage };

// Default to a web client; individual tests override to exercise the native branches.
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => globalThis.__platform ?? 'web',
    isNativePlatform: () => (globalThis.__platform ?? 'web') !== 'web',
    isPluginAvailable: () => false,
    registerPlugin: () => ({}),
  },
  registerPlugin: () => ({}),
}));

const {
  accessTokenExpiringSoon,
  clearSession,
  clientPlatform,
  decodeAccessToken,
  getAccessToken,
  hasStoredSession,
  setAccessToken,
  setStoredIdentity,
  setStoredRole,
  getStoredRole,
} = await import('./tokenStore');

/**
 * Builds an unsigned JWT — only the payload is ever read on the client.
 * btoa rather than Buffer so the file stays free of node globals the lint config does not allow.
 */
const makeToken = (claims) => {
  const b64 = (obj) => btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'RS256' })}.${b64(claims)}.sig`;
};

beforeEach(async () => {
  globalThis.__platform = 'web';
  localStorage.clear();
  await clearSession();
});

describe('the access token', () => {
  it('round-trips in memory', () => {
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
  });

  /**
   * The whole point of the change: an XSS that reads Web Storage must not find a usable
   * credential there.
   */
  it('is never written to localStorage', () => {
    setAccessToken('super-secret-token');
    const stored = JSON.stringify([...localStorage.map.entries()]);
    expect(stored).not.toContain('super-secret-token');
  });

  it('is cleared by clearSession', async () => {
    setAccessToken('abc');
    await clearSession();
    expect(getAccessToken()).toBeNull();
  });
});

describe('the session marker', () => {
  it('is false before anything signs in', () => {
    expect(hasStoredSession()).toBe(false);
  });

  it('is set when an access token is stored', () => {
    setAccessToken('abc');
    expect(hasStoredSession()).toBe(true);
  });

  /**
   * This is what lets a page reload tell "signed in, token lost with the tab" apart from
   * "never signed in". Without it, boot could not know whether a refresh was worth attempting.
   */
  it('survives the access token being lost, as it would on a reload', () => {
    setAccessToken('abc');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
    expect(hasStoredSession()).toBe(true);
  });

  it('is cleared on sign-out', async () => {
    setAccessToken('abc');
    await clearSession();
    expect(hasStoredSession()).toBe(false);
  });
});

describe('the cached role', () => {
  /**
   * The role used to be written once at login and never again, so a demoted admin kept seeing
   * the admin UI until they signed out by hand.
   */
  it('can be updated in place after a role change', () => {
    setStoredIdentity({ email: 'a@b.com' }, 'ADMIN');
    expect(getStoredRole()).toBe('ADMIN');

    setStoredRole('VIEWER');
    expect(getStoredRole()).toBe('VIEWER');
  });
});

describe('token claim reading', () => {
  it('decodes the payload', () => {
    setAccessToken(makeToken({ userId: 7, role: 'ADMIN', exp: 9_999_999_999 }));
    expect(decodeAccessToken()).toMatchObject({ userId: 7, role: 'ADMIN' });
  });

  it('returns null rather than throwing on a malformed token', () => {
    setAccessToken('not-a-jwt');
    expect(decodeAccessToken()).toBeNull();
  });

  it('treats a token expiring inside the threshold as needing a refresh', () => {
    setAccessToken(makeToken({ exp: Math.floor(Date.now() / 1000) + 30 }));
    expect(accessTokenExpiringSoon(120_000)).toBe(true);
  });

  it('leaves a comfortably valid token alone', () => {
    setAccessToken(makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    expect(accessTokenExpiringSoon(120_000)).toBe(false);
  });

  /** No token at all counts as expiring, so boot mints one instead of proceeding without. */
  it('reports no token as expiring', () => {
    expect(accessTokenExpiringSoon()).toBe(true);
  });

  /** A token with no exp is unverifiable client-side — refresh rather than assume it is good. */
  it('reports a token with no exp claim as expiring', () => {
    setAccessToken(makeToken({ userId: 1 }));
    expect(accessTokenExpiringSoon()).toBe(true);
  });
});

describe('the platform header', () => {
  it('is WEB in a browser', () => {
    globalThis.__platform = 'web';
    expect(clientPlatform()).toBe('WEB');
  });

  it('maps Capacitor platforms to what the backend expects', () => {
    globalThis.__platform = 'android';
    expect(clientPlatform()).toBe('ANDROID');
    globalThis.__platform = 'ios';
    expect(clientPlatform()).toBe('IOS');
  });
});
