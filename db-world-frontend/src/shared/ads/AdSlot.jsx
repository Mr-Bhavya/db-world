import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

import { AD_CLIENT, AD_SLOTS, adsEnabled } from './adsConfig';

/**
 * One AdSense display unit.
 *
 * Three things this handles that a bare `<ins>` does not:
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
 * 3. **Reserved height.** An unfilled slot collapses to 0px and the page jumps when
 *    the ad arrives. `minHeight` holds the space from first paint, which also keeps
 *    the layout-shift portion of Core Web Vitals honest.
 */
export default function AdSlot({
  slot,
  format = 'auto',
  responsive = true,
  minHeight = 100,
  sx,
}) {
  const { pathname } = useLocation();
  const pushed = useRef(false);

  const slotId = AD_SLOTS[slot] ?? slot;

  useEffect(() => {
    pushed.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!adsEnabled() || !slotId || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense blocked (ad blocker, offline, or the script never loaded). The
      // reserved box just stays empty — never surface this to the visitor.
    }
  }, [pathname, slotId]);

  // No slot id configured yet, ads disabled, or a native build — render nothing at
  // all rather than an empty reserved gap.
  if (!adsEnabled() || !slotId || Capacitor?.isNativePlatform?.()) return null;

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
