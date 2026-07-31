import Constants from '@shared/constants';

const HOME  = Constants.DB_WORLD_HOME_ROUTE;   // /db-world
const ADMIN = Constants.DB_ADMIN_BASE_ROUTE;   // /db-world/admin

/**
 * Route-key → in-app path map for pushes that carry a `data.route` (the admin
 * request/ingestion pushes). Pushes that need an id/slug (records, IPOs) instead
 * send a ready-made full `data.link`, which wins over any route key.
 *
 * NOTE: keep this in sync with the inline copy in
 * `public/firebase-messaging-sw.js` — the service worker can't import this ESM.
 */
const ROUTE_MAP = {
  'admin/requests':  `${ADMIN}/requests`,
  'admin/ingestion': `${ADMIN}/ingestion`,
};

/**
 * Resolve a tapped push notification's data payload to the in-app path to open.
 * Priority: explicit `data.link` (a full path) → a known `data.route` key →
 * app home. Always returns a safe path.
 */
export const resolveDeepLink = (data) => {
  if (!data || typeof data !== 'object') return HOME;
  if (typeof data.link === 'string' && data.link.charAt(0) === '/') return data.link;
  if (typeof data.route === 'string' && ROUTE_MAP[data.route]) return ROUTE_MAP[data.route];
  return HOME;
};
