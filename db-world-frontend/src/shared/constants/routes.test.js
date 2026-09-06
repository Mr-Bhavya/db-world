import { describe, it, expect } from 'vitest';

import * as namedExports from './index';
import Constants, { DB_WORLD_HOME_ROUTE, LEGACY_PATH_PREFIX } from './index';

/** Every named export except the module's own default. */
const NAMED_EXPORT_NAMES = Object.keys(namedExports).filter((n) => n !== 'default');

/**
 * Guards on the route table after the `/db-world` prefix was removed.
 *
 * Every app route used to sit under `/db-world`, repeating the hostname. The prefix is
 * built from one `APP_BASE` constant, so putting it back — or half-removing it — is a
 * one-character mistake with a large blast radius: ~300 indexed URLs, every link
 * already shared in a chat, and the Android App Links intent filter.
 *
 * It is also invisible to a smoke test. The routes are template literals, which the
 * minifier does not fold, so grepping a built bundle for `/db-cinema/browse` finds
 * nothing whether or not the prefix is there. These assertions read the resolved
 * values instead.
 */

/** Everything on the default export that looks like a path rather than an API or a pattern. */
const routeEntries = Object.entries(Constants).filter(
  ([name, value]) =>
    typeof value === 'string'
    && value.startsWith('/')
    && name.endsWith('ROUTE')
    && name !== 'LEGACY_PATH_PREFIX',
);

describe('route table', () => {
  it('exposes a non-trivial number of routes, so the filter is not matching nothing', () => {
    expect(routeEntries.length).toBeGreaterThan(20);
  });

  it('has the hub at the root', () => {
    expect(DB_WORLD_HOME_ROUTE).toBe('/');
  });

  it.each(routeEntries)('%s does not carry the retired prefix', (_name, value) => {
    expect(value.startsWith('/db-world/')).toBe(false);
    expect(value).not.toBe('/db-world');
  });

  it('never produces a double slash from the empty APP_BASE', () => {
    // `${APP_BASE}/x` is correct; `${DB_WORLD_HOME_ROUTE}/x` would yield `//x`, which
    // a browser reads as a protocol-relative URL to the host `x`.
    for (const [name, value] of routeEntries) {
      expect(value, `${name} = ${value}`).not.toContain('//');
    }
  });

  it('still exposes the old prefix for the legacy redirect to use', () => {
    // LegacyPrefixRedirect and the App Links tests both name it; removing it would
    // silently drop the redirect that keeps old URLs and old APKs working.
    expect(LEGACY_PATH_PREFIX).toBe('/db-world');
  });

  it('exports every named constant on the default export too', () => {
    // RESET_PASSWORD_ROUTE and VERIFY_EMAIL_ROUTE were named exports only, so every
    // `Constants.RESET_PASSWORD_ROUTE` read returned undefined: App.jsx registered
    // both routes with `path: undefined` and the forgot-password handler called
    // `navigate(undefined)`, which resolves to the current location — the link fired
    // and nothing moved. Nothing failed loudly, which is why it survived.
    const missing = NAMED_EXPORT_NAMES.filter((name) => Constants[name] === undefined);
    expect(missing, `named exports absent from the default export: ${missing.join(', ')}`)
      .toEqual([]);
  });

  it('keeps the emailed token routes at the top level', () => {
    // These are linkified by mail clients, so they were always short. Unchanged by
    // the prefix removal, and worth asserting because they look like candidates for it.
    expect(Constants.RESET_PASSWORD_ROUTE).toBe('/reset-password');
    expect(Constants.VERIFY_EMAIL_ROUTE).toBe('/verify-email');
  });

  it('resolves the routes the sitemap and robots.txt name', () => {
    // These exact strings are duplicated in SitemapController and public/robots.txt.
    // If a route moves and those are not updated, the sitemap advertises a 404.
    expect(Constants.DB_CINEMA_BROWSE_ROUTE).toBe('/db-cinema/browse');
    expect(Constants.DB_CINEMA_MOVIES_ROUTE).toBe('/db-cinema/movie');
    expect(Constants.DB_CINEMA_SERIES_ROUTE).toBe('/db-cinema/tv-shows');
    expect(Constants.DB_IPO_ROUTE).toBe('/db-ipo');
    expect(Constants.DB_WEATHER_ROUTE).toBe('/db-weather');
    expect(Constants.DB_GAMES_ROUTE).toBe('/db-games');
    expect(Constants.DB_ABOUT_ROUTE).toBe('/about');
    expect(Constants.DB_PRIVACY_ROUTE).toBe('/privacy');
    expect(Constants.DB_TERMS_ROUTE).toBe('/terms');
    expect(Constants.DB_CONTACT_ROUTE).toBe('/contact');
    expect(Constants.DB_GENERATE_PASSWORD_ROUTE)
      .toBe('/db-password-manager/generate-password');
  });
});
