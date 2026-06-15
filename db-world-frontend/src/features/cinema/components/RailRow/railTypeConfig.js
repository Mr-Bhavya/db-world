// Tier values are card heights in px. Aspect ratio drives card width.
// Shape mirrors what the rail API will expose — migration = swap import for fetch.
export const RAIL_TYPE_CONFIG = {
  standard: {
    cardAspect: '2/3',
    tiers: { mobile: 110, tablet: 130, desktop: 150, tv: 200 },
    hover: 'popup',
    skeleton: 'poster',
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
