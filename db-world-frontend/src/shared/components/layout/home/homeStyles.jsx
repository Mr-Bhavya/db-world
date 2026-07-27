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

/**
 * Bento grid for the app tiles. A fixed 4-column track on desktop lets the two `feature` apps
 * (IPO Radar, Cinema) each span two columns and sit side-by-side on the top row, with the four
 * `standard` apps filling the row below — so product priority is felt, not just ordered. On
 * phones/tablets it collapses to a 2-column track (feature = full-width, standard = 2-up), which
 * keeps the dense app-launcher feel without any tile getting awkwardly narrow.
 */
export const appsGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'repeat(4, minmax(0, 1fr))',
  },
  gridAutoRows: '1fr',
  gap: {
    xs: 1.1,
    sm: 1.75,
    md: 2.2,
    xl: 2.6,
  },
  alignItems: 'stretch',
  minWidth: 0,
};

/**
 * The column span for one tile, keyed off its `size`. `feature` is two-wide everywhere (full width
 * on the 2-col phone/tablet track, half on the 4-col desktop track); `utility` (Admin) stretches
 * the whole row as a set-apart strip; `standard` is a single cell.
 */
export const bentoSpanSx = (size) => {
  if (size === 'feature') {
    return { gridColumn: { xs: 'span 2', sm: 'span 2', md: 'span 2' } };
  }
  if (size === 'utility') {
    return { gridColumn: { xs: 'span 2', sm: 'span 2', md: 'span 4' } };
  }
  return { gridColumn: 'span 1' };
};