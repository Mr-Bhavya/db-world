import Constants from '@shared/constants';

const HOME = Constants.DB_WORLD_HOME_ROUTE; // /db-world

/**
 * Hosts whose https links this app is allowed to claim.
 *
 * KEEP IN SYNC with the App Links intent-filter in
 * `android/app/src/main/AndroidManifest.xml`. `app.db-world.in` is the Capacitor
 * WebView's own origin (see capacitor.config.json) — included so an in-app link
 * that round-trips through the same handler still resolves.
 */
const ALLOWED_HOSTS = new Set([
  'db-world.in',
  'www.db-world.in',
  'app.db-world.in',
]);

/**
 * Resolve a tapped App Link URL to the in-app path to navigate to.
 *
 * Returns `null` when the URL is not one this app should act on, so callers can
 * simply skip navigation. Anything not on {@link ALLOWED_HOSTS} and not under
 * `/db-world` is rejected — without the host check an intent carrying an
 * arbitrary URL could push the router to an attacker-chosen path, and without
 * the prefix check a link could land the user outside the app's own routes.
 * Only the path/query/hash is ever returned, never an absolute URL, so this
 * cannot be turned into an open redirect.
 */
export const pathFromAppLink = (url) => {
  if (typeof url !== 'string' || url === '') return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null; // relative, malformed, or a custom scheme we don't handle
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  // Guard against `/db-worldsomething` matching the `/db-world` prefix.
  const { pathname } = parsed;
  if (pathname !== HOME && !pathname.startsWith(`${HOME}/`)) return null;

  return `${pathname}${parsed.search}${parsed.hash}`;
};
