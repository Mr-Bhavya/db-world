// Tier values are card heights in px. Aspect ratio drives card width.
// Shape mirrors what the rail API will expose — migration = swap import for fetch.
export const RAIL_TYPE_CONFIG = {
  standard: {
    cardAspect: '16/9',       // desktop/tv: landscape backdrop card
    mobileAspect: '2/3',      // mobile/tablet: portrait poster card
    tiers: { mobile: 160, tablet: 170, desktop: 170, tv: 220 },
    hover: 'popup',
    skeleton: 'backdrop',
    scroll: 'horizontal',
    useTextBackdrop: true,
    titleStyle: 'fade',      // frosted-glass compact bar
  },
  wide: {
    cardAspect: '16/9',
    tiers: { mobile: 200, tablet: 240, desktop: 280, tv: 380 },
    hover: 'popup',
    skeleton: 'backdrop',
    scroll: 'horizontal',
    showProgress: true,
    useTextBackdrop: true,
    titleStyle: 'fade',       // deep gradient when image has no burned-in title
  },
  prime: {
    cardAspect: '9/16',
    tiers: { mobile: 140, tablet: 180, desktop: 380, tv: 500 },
    hover: 'expand',
    skeleton: 'portrait',
    scroll: 'horizontal',
    expandOnHover: true,
  },
  top10: {
    cardAspect: '2/3',
    tiers: { mobile: 170, tablet: 200, desktop: 250, tv: 340 },
    hover: 'popup',
    skeleton: 'top10',
    scroll: 'horizontal',
    showRank: true,
  },
  jumbo: {
    cardAspect: '2/3',
    tiers: { mobile: 220, tablet: 240, desktop: 260, tv: 340 },
    hover: 'popup',
    skeleton: 'poster',
    scroll: 'horizontal',
  },
  poster: {
    cardAspect: '2/3',
    tiers: { mobile: 160, tablet: 180, desktop: 230, tv: 300 },
    hover: 'popup',
    skeleton: 'poster',
    scroll: 'horizontal',
    showPosterTitle: true,    // title caption bar at the bottom of the portrait poster
  },
  // Same portrait poster, but no title caption — a clean wall of artwork.
  posterPlain: {
    cardAspect: '2/3',
    tiers: { mobile: 160, tablet: 180, desktop: 230, tv: 300 },
    hover: 'popup',
    skeleton: 'poster',
    scroll: 'horizontal',
  },
  continue: {
    cardAspect: '16/9',
    tiers: { mobile: 200, tablet: 240, desktop: 280, tv: 380 },
    hover: 'popup',
    skeleton: 'backdrop',
    scroll: 'horizontal',
    showProgress: true,
    showResume: true,
    // useTextBackdrop: true,
    titleStyle: 'glass',        // floating pill badge, title only
  },
  person: {
    cardAspect: '1/1',
    tiers: { mobile: 100, tablet: 120, desktop: 140, tv: 190 },
    hover: 'name',
    skeleton: 'circle',
    scroll: 'horizontal',
  },
  billboard: {
    cardAspect: '16/9',
    tiers: { mobile: 200, tablet: 300, desktop: 420, tv: 600 },
    hover: 'none',
    skeleton: 'backdrop',
    scroll: 'snap',
    snapCount: 1,
    useTextBackdrop: true,
  },
};

export const RAIL_TYPE_DEFAULT = 'standard';

// Infers the display type for a rail when the API hasn't shipped rail.type yet.
// Rules are ordered most-specific → least-specific so a title like
// "Top 10 New Releases" correctly resolves to top10, not wide.
// When the backend adds rail.type, the first guard short-circuits everything.
export function inferRailType(rail) {
  if (!rail) return RAIL_TYPE_DEFAULT;
  // 1. Explicit admin-set display type from the API wins.
  if (rail.type && RAIL_TYPE_CONFIG[rail.type]) return rail.type;

  // 2. Derive from the rail's rule type (reliable) before guessing from the title.
  const ruleType = rail.rule?.type;
  if (ruleType === 'continueWatching') return 'continue';
  if (ruleType === 'person')           return 'person';

  // 3. Legacy fallback: guess from the title.
  const t = (rail.title ?? '').toLowerCase();

  // ── top10 ── ranked / trending rows
  if (/top\s*10|top\s*ten|trending|most.?popular|popular.?now|popular.?this|what.?s.?hot|charting|ranked|hot.?now|this.?week.?top/i.test(t))
    return 'top10';

  // ── continue ── resume-watching rows
  if (/continue|resume|keep.?watch|recently.?watch|pick.?up|watching/i.test(t))
    return 'continue';

  // ── person ── cast / crew / director rows
  if (/cast|actor|actress|director|person|people|crew|star|celebrity|talent/i.test(t))
    return 'person';

  // ── prime ── editorial / curated / recommendation rows  (portrait expand-on-hover)
  if (/featured|spotlight|editor.?s?.?choice|editor.?pick|staff.?pick|recommended|because.?you|you.?might|similar.?to|if.?you.?like|fans.?also|based.?on/i.test(t))
    return 'prime';

  // ── billboard ── full-width showcase / theatrical rows
  if (/billboard|showcase|now.?playing|in.?theatres?|coming.?soon|opening.?this/i.test(t))
    return 'billboard';

  // ── wide ── new-release / recently-added rows  (tall backdrop cards)
  if (/new.?release|latest|recently.?added|new.?this.?week|new.?arrival|just.?added|new.?&.?popular|new.?on|arriving.?soon|leaving.?soon/i.test(t))
    return 'wide';

  // ── jumbo ── award / prestige / blockbuster rows  (oversized poster)
  if (/award|oscar|emmy|bafta|blockbuster|must.?watch|critically.?acclaim|best.?of|top.?rated|highest.?rated/i.test(t))
    return 'jumbo';

  // ── poster ── explicit poster rail
  if (/poster/i.test(t))
    return 'poster';

  // ── wide (legacy keyword) ──
  if (/wide|backdrop/i.test(t))
    return 'wide';

  return RAIL_TYPE_DEFAULT;
}
