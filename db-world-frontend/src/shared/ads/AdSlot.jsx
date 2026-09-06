import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

import { AD_CLIENT, AD_SLOTS, adsEnabled } from './adsConfig';

/**
 * One AdSense display unit.
 *
 * Four things this handles that a bare `<ins>` does not:
 *
 * 1. **SPA route changes.** AdSense fills a slot by scanning for unfilled `<ins>`
 *    elements when you push to `adsbygoogle`. React keeps the same DOM node across a
 *    client-side navigation, so the already-filled slot is never re-filled and the
 *    visitor sees a stale ad for the previous page. Keying the element on pathname
 *    forces a fresh node per route, and the push below fills it.
 *
 * 2. **Native builds.** The loader in index.html is web-only by policy — AdSense may
 *    not be served inside an app WebView (that is what AdMob is for), and doing it
 *    anyway risks the whole publisher account. Capacitor builds render nothing here.
 *
 * 3. **Reserved height, but only while it might be used.** An unfilled slot that still
 *    holds `minHeight` is just a blank gap in the page. AdSense marks a unit it could
 *    not fill with `data-ad-status="unfilled"`, so the observer below watches for that
 *    and collapses the slot to nothing.
 *
 *    This matters more than it sounds. Fill rate is never 100%, so unfilled slots
 *    happen on a perfectly healthy account — and before a site is approved NOTHING
 *    fills, so without this every page carries a blank band where the ad would be.
 *
 * 4. **Unconfigured slots.** A placement whose env var is unset renders nothing at all,
 *    so the site is safe to ship before the units exist in AdSense.
 *
 * 5. **No ad without content — `ready`.** AdSense rejected this site in September 2026
 *    for "Google-served ads on screens without publisher content", and the mechanism
 *    was this component rendering unconditionally: a unit appeared while the page was
 *    still loading, when the fetch returned nothing, and on the empty-state card. The
 *    host page must now assert that it has painted real content, and the default is
 *    `false` so a call site that forgets fails CLOSED — a missing ad costs a few
 *    impressions, an ad on a blank screen costs the account.
 *
 *    "Content" means what a reader came for, not chrome: rails with titles in them, a
 *    loaded record, a non-empty IPO list. A heading and a spinner do not count.
 */
export default function AdSlot({
  slot,
  ready = false,
  format = 'auto',
  responsive = true,
  minHeight = 100,
  sx,
}) {
  const { pathname } = useLocation();
  const insRef = useRef(null);
  const pushed = useRef(false);
  const [unfilled, setUnfilled] = useState(false);

  const slotId = AD_SLOTS[slot] ?? slot;

  useEffect(() => {
    pushed.current = false;
    setUnfilled(false);
  }, [pathname]);

  useEffect(() => {
    if (!ready || !adsEnabled() || !slotId || pushed.current) return undefined;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense blocked (ad blocker, offline, or the script never loaded). Treat it
      // as unfilled so the reserved space collapses rather than leaving a gap.
      setUnfilled(true);
      return undefined;
    }

    // AdSense stamps data-ad-status asynchronously, once it knows whether it had an
    // ad to serve. Observing the attribute is more reliable than a timeout, which
    // would race the network on a slow connection.
    const el = insRef.current;
    if (!el) return undefined;

    const read = () => {
      const status = el.getAttribute('data-ad-status');
      if (status === 'unfilled') setUnfilled(true);
    };
    read();

    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, [pathname, slotId, ready]);

  // The page has not painted content worth putting an ad next to — see `ready` above.
  if (!ready) return null;

  // No slot id configured yet, ads disabled, or a native build — render nothing at
  // all rather than an empty reserved gap.
  if (!adsEnabled() || !slotId || Capacitor?.isNativePlatform?.()) return null;
  if (unfilled) return null;

  return (
    <Box
      sx={{
        display: 'block',
        width: '100%',
        minHeight,
        overflow: 'hidden',
        my: 2,
        ...sx,
      }}
    >
      <ins
        ref={insRef}
        key={pathname}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </Box>
  );
}
