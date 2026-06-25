export const clampTextSx = (lines = 1) => ({
  minWidth: 0,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
});

export const cardFocusSx = (accent) => ({
  '&:focus-visible': {
    outline: `3px solid ${accent}`,
    outlineOffset: 3,
  },
});

export const horizontalScrollSx = {
  overflowX: 'auto',
  overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'thin',
  pb: 1,
  mx: {
    xs: -1.5,
    sm: 0,
  },
  px: {
    xs: 1.5,
    sm: 0,
  },
};

export const appsGridSx = {
  display: 'grid',

  /*
   * Responsive layout:
   * - Small mobile: 1 column
   * - Big mobile/tablet: 2 columns when space allows
   * - Desktop/monitor/TV: more columns automatically
   */
  gridTemplateColumns: {
    xs: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
    sm: 'repeat(auto-fit, minmax(220px, 1fr))',
    md: 'repeat(auto-fit, minmax(230px, 1fr))',
    lg: 'repeat(auto-fit, minmax(240px, 1fr))',
    xl: 'repeat(auto-fit, minmax(250px, 1fr))',
  },

  '@media (min-width:1920px)': {
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  },

  gap: {
    xs: 1.5,
    sm: 1.75,
    md: 2.2,
    xl: 2.6,
  },

  alignItems: 'stretch',
  minWidth: 0,
};