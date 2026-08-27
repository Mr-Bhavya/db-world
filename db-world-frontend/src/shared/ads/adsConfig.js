import { Capacitor } from '@capacitor/core';

/**
 * AdSense wiring.
 *
 * The publisher id is public by design — it ships in the loader tag in index.html and
 * in public/ads.txt, so there is nothing secret to keep out of the bundle. The same
 * goes for the slot ids below.
 *
 * Slot ids come from AdSense → Ads → By ad unit → Display ads; each unit's snippet
 * carries a 10-digit `data-ad-slot`, and that number is the ONLY thing taken from it.
 * Client id, format, responsiveness and the push() call are all handled by AdSlot, so
 * Google's generated snippet is never pasted anywhere.
 */

export const AD_CLIENT = 'ca-pub-8394425716692410';

/**
 * Named placements → AdSense slot ids.
 *
 * One unit PER PAGE rather than one shared across the catalogue, so reporting can
 * answer which surface actually earns — movie browsing and TV browsing are different
 * audiences with different advertiser demand, and a single shared unit averages that
 * away into a number you cannot act on.
 *
 * Names describe WHERE a unit sits, never a size or position within the page: every
 * one of these renders below the page's content, and a name like "top" would go stale
 * the moment a placement moved.
 *
 * Any slot left empty renders nothing at all, so placements can be added here and
 * filled in later without touching the components.
 */
export const AD_SLOTS = {
  // DB World hub (the app launcher home page)
  home:          import.meta.env.VITE_AD_SLOT_HOME           ?? '',

  // Cinema browse surfaces — one per tab
  cinemaBrowse:  import.meta.env.VITE_AD_SLOT_CINEMA_BROWSE  ?? '',
  cinemaMovies:  import.meta.env.VITE_AD_SLOT_CINEMA_MOVIES  ?? '',
  cinemaSeries:  import.meta.env.VITE_AD_SLOT_CINEMA_SERIES  ?? '',

  // Record detail
  cinemaDetail:  import.meta.env.VITE_AD_SLOT_CINEMA_DETAIL  ?? '',

  // IPO tracker
  ipoList:       import.meta.env.VITE_AD_SLOT_IPO_LIST       ?? '',
  ipoDetail:     import.meta.env.VITE_AD_SLOT_IPO_DETAIL     ?? '',
};

/**
 * CinemaPage renders all three browse tabs from one component, so the placement is
 * chosen from its pageType rather than duplicating the markup three times.
 */
export const cinemaSlotFor = (pageType) => ({
  home:   'cinemaBrowse',
  movies: 'cinemaMovies',
  series: 'cinemaSeries',
}[pageType] ?? 'cinemaBrowse');

/**
 * Ads are web-only.
 *
 * AdSense's terms cover websites; serving it inside an app WebView is what AdMob is
 * for, and mixing them puts the publisher account at risk. A Capacitor build
 * therefore never renders a unit — see also the guard on the loader tag in
 * index.html, which keeps the script itself from loading natively.
 */
export const adsEnabled = () => !Capacitor?.isNativePlatform?.();
