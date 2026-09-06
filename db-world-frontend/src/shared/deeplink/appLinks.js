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
 * simply skip navigation. Only the path/query/hash is ever returned, never an
 * absolute URL, so this cannot be turned into an open redirect.
 *
 * ── THE HOST CHECK IS NOW THE WHOLE BOUNDARY ──
 * This used to also require the path to start with `/db-world`, back when every app
 * route sat under that prefix. The apps now live at the domain root, so there is no
 * prefix left to check and every path on an allowed host is a candidate route — an
 * unknown one lands on the in-app error page, which is the correct outcome for a
 * mistyped link and was already true for `/db-world/nonsense`.
 *
 * Dropping it does not weaken anything that mattered: {@link ALLOWED_HOSTS} is what
 * stops an intent carrying an arbitrary URL from steering the router, and that is
 * unchanged. Do not "restore" the prefix check — with the root-relative routes it
 * rejects every real link.
 *
 * Old prefixed links keep working: they are returned as-is and `LegacyPrefixRedirect`
 * strips the prefix once the router sees them. That is what lets a link minted by an
 * older build, or a push whose `data.link` still carries the prefix, resolve here.
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

  // `new URL('https://db-world.in')` yields '/', so a bare host lands on the hub.
  const pathname = parsed.pathname === '' ? '/' : parsed.pathname;

  return `${pathname}${parsed.search}${parsed.hash}`;
};
