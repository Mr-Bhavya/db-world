import { Capacitor } from '@capacitor/core';

/**
 * AdSense wiring.
 *
 * The publisher id is public by design — it ships in the loader tag in index.html and
 * in public/ads.txt, so there is nothing secret to keep out of the bundle.
 *
 * Ad SLOT ids are not known until the units are created in the AdSense dashboard
 * (Ads → By ad unit → Display ads). Each unit there gives a 10-digit `data-ad-slot`.
 * Fill them in below or via env; any slot left empty renders nothing, so the site is
 * safe to ship before the units exist.
 */

export const AD_CLIENT = 'ca-pub-8394425716692410';

/**
 * Named placements → AdSense slot ids. Names are used in the JSX so the call sites
 * read as intent ("cinemaBrowseTop") rather than a bare number, and so a unit can be
 * re-pointed in one place.
 */
export const AD_SLOTS = {
  cinemaBrowseTop:   import.meta.env.VITE_AD_SLOT_CINEMA_BROWSE_TOP   ?? '',
  cinemaDetailBelow: import.meta.env.VITE_AD_SLOT_CINEMA_DETAIL_BELOW ?? '',
  ipoListTop:        import.meta.env.VITE_AD_SLOT_IPO_LIST_TOP        ?? '',
  ipoDetailBelow:    import.meta.env.VITE_AD_SLOT_IPO_DETAIL_BELOW    ?? '',
};

/**
 * Ads are web-only.
 *
 * AdSense's terms cover websites; serving it inside an app WebView is what AdMob is
 * for, and mixing them puts the publisher account at risk. A Capacitor build
 * therefore never renders a unit — see also the guard on the loader tag in
 * index.html, which keeps the script itself from loading natively.
 */
export const adsEnabled = () => !Capacitor?.isNativePlatform?.();
