import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The canonical origin for every public URL.
 *
 * Hard-coded rather than read from `window.location.origin`, which is the whole point:
 * a page reached on www.db-world.in must declare the apex URL as canonical, not itself.
 * Reading the current origin would emit a self-canonical per hostname and leave the
 * duplicate exactly as unresolved as having no tag at all.
 */
const CANONICAL_ORIGIN = 'https://db-world.in';

/**
 * Keeps a self-referencing `<link rel="canonical">` on the document, per route.
 *
 * The SPA shell shipped with no canonical tag of any kind. Combined with
 * www.db-world.in serving the whole site a second time, Search Console reported
 * "Duplicate without user-selected canonical" against `https://www.db-world.in/` and
 * had to guess which host to index — on a site already being assessed for thin
 * content, where every page therefore counted twice.
 *
 * The primary fix is the 301 from www to the apex in `10-app.conf`. This covers what a
 * redirect cannot: the same route reached with tracking parameters, a trailing `?`, or
 * a fragment, each of which is a distinct URL to a crawler and none of which the
 * redirect touches.
 *
 * Query and hash are dropped deliberately. `robots.txt` already disallows `/*?*`
 * because rail and filter parameters generate unbounded permutations of the same page;
 * this states the same thing positively, for the crawlers that reach such a URL from a
 * link rather than from the sitemap.
 *
 * Mounted once, app-wide, in `App.jsx` — a per-page hook would mean every new public
 * route silently shipping without a canonical.
 */
export default function useCanonicalUrl() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Native builds run on capacitor:// and file:// where a canonical URL is
    // meaningless, and there is no crawler to read it.
    if (typeof document === 'undefined') return;

    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }

    // No trailing-slash normalisation: react-router paths are already slash-free, and
    // inventing a variant here would point the canonical at a URL nginx redirects.
    link.setAttribute('href', CANONICAL_ORIGIN + pathname);
  }, [pathname]);
}

export { CANONICAL_ORIGIN };
