import { Navigate, useLocation } from 'react-router-dom';

import Constants from '@shared/constants';

/**
 * Sends an old `/db-world/...` path to the same path without the prefix.
 *
 * Every app route used to sit under `/db-world`, which repeated the hostname. nginx
 * 301s the old paths for anything arriving over HTTP, so this exists for the cases
 * nginx never sees — a path handed straight to the router in-process:
 *
 *  - a tapped App Link on an OLDER Android build, whose intent filter is
 *    `pathPrefix="/db-world"` and whose links were minted with the prefix;
 *  - a push notification whose `data.link` still carries it. That is deliberate:
 *    the backend keeps minting old-format links so a device running the previous
 *    APK still resolves them, and this is what makes the same link work here.
 *
 * `replace` so the prefixed URL does not sit in history — Back from the redirected
 * page would otherwise land on the redirect and bounce forward again.
 *
 * Query and hash are carried over: a record link can hold `?tab=watch#cast`, and
 * dropping them would land the visitor on the right page in the wrong state.
 */
export default function LegacyPrefixRedirect() {
  const { pathname, search, hash } = useLocation();

  // Strip exactly one leading occurrence, and only as a whole path segment, so a
  // hypothetical `/db-worldly` is never mangled into `/ly`.
  const stripped = pathname.startsWith(`${Constants.LEGACY_PATH_PREFIX}/`)
    ? pathname.slice(Constants.LEGACY_PATH_PREFIX.length)
    : pathname;

  // `/db-world` alone strips to an empty string, which is not a route.
  const target = stripped === '' ? Constants.DB_WORLD_HOME_ROUTE : stripped;

  return <Navigate to={`${target}${search}${hash}`} replace />;
}
