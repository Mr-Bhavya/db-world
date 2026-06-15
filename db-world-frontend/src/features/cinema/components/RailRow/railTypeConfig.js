// Tier values are card heights in px. Aspect ratio drives card width.
// Shape mirrors what the rail API will expose — migration = swap import for fetch.
export const RAIL_TYPE_CONFIG = {
  standard: {
    cardAspect: '16/9',
    tiers: { mobile: 110, tablet: 135, desktop: 170, tv: 220 },
    hover: 'popup',
    skeleton: 'backdrop',
    scroll: 'horizontal',
  },
  wide: {
    cardAspect: '16/9',
    tiers: { mobile: 200, tablet: 240, desktop: 280, tv: 380 },
    hover: 'popup',
    skeleton: 'backdrop',
    scroll: 'horizontal',
    showProgress: true,
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
    tiers: { mobile: 130, tablet: 170, desktop: 210, tv: 280 },
    hover: 'popup',
    skeleton: 'top10',
    scroll: 'horizontal',
    showRank: true,
  },
  jumbo: {
    cardAspect: '2/3',
    tiers: { mobile: 160, tablet: 200, desktop: 260, tv: 340 },
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
  },
};

export const RAIL_TYPE_DEFAULT = 'standard';

// Infers rail display type from rail metadata when rail.type is not provided by the API.
// Title keyword matching is intentionally loose (case-insensitive, partial).
export function inferRailType(rail) {
  if (!rail) return RAIL_TYPE_DEFAULT;
  if (rail.type && RAIL_TYPE_CONFIG[rail.type]) return rail.type;

  const title = (rail.title ?? '').toLowerCase();
  if (/top\s*10|top ten|trending/i.test(title))           return 'top10';
  if (/continue|resume|watching/i.test(title))             return 'continue';
  if (/cast|actor|director|person|people/i.test(title))    return 'person';
  if (/featured|prime|spotlight/i.test(title))             return 'prime';
  if (/billboard/i.test(title))                            return 'billboard';
  if (/jumbo|big|large/i.test(title))                      return 'jumbo';
  if (/wide|backdrop/i.test(title))                        return 'wide';
  return RAIL_TYPE_DEFAULT;
}
