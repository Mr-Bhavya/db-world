/**
 * Shared geometry and colour for the record page's call-to-action buttons.
 *
 * Watch, Request, Download and Trailer occupy the same two slots in the hero in
 * different combinations, and the sticky bar repeats Watch once the hero scrolls
 * away. Every one of them used to carry its own copy of the padding, radius, weight
 * and teal — so the row changed shape depending on which pair a record got, and the
 * sticky bar drifted a shade away from the hero it was standing in for.
 *
 * Anything CTA-shaped on this page should spread these instead of restating them.
 */

/**
 * The brand teal. Deliberately a constant and not derived from the artwork: a
 * per-poster dominant colour used to resolve a beat late and visibly recoloured the
 * Watch button under the user (see the ACCENT note in Hero).
 */
export const HERO_ACCENT = '#0d9488';

/**
 * Size and layout.
 *
 * @param isTv    1920px+ living-room sizing
 * @param compact the sticky bar's inline variant — it shares a row with a poster and
 *                a title, so it must stay small and never claim a width floor
 */
export const ctaShape = ({ isTv = false, compact = false } = {}) => (compact
  ? {
    textTransform: 'none',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    minWidth: 0,
    px: 2,
    py: 0.75,
    fontSize: '0.8rem',
  }
  : {
    textTransform: 'none',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    // Phones lay the CTA row out as equal grid columns, so here this only has to
    // allow shrinking. From tablet up the buttons size to content, where a shared
    // floor is what keeps them looking like one size class.
    flex: { sm: '0 0 auto' },
    minWidth: { xs: 0, sm: 152, xl: 188 },
    px: { xs: 1.5, sm: 2.5, xl: 3.5 },
    py: { xs: 1.05, xl: 1.2 },
    fontSize: { xs: '0.9rem', sm: '0.88rem', xl: '1.05rem' },
    ...(isTv && { fontSize: '1.2rem', px: 4.5, py: 1.5, minWidth: 240 }),
  });

/** Filled teal: the one action the page wants you to take. */
export const ctaPrimary = (accent = HERO_ACCENT) => ({
  bgcolor: accent,
  color: '#fff',
  fontWeight: 800,
  boxShadow: `0 8px 24px ${alphaHex(accent, 0.4)}`,
  '&:hover': { bgcolor: accent, filter: 'brightness(0.85)' },
});

/** Frosted glass: everything else in the row, so only one button reads as primary. */
export const ctaSecondary = () => ({
  color: '#fff',
  fontWeight: 700,
  bgcolor: 'rgba(255,255,255,0.12)',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.2)',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
});

/**
 * Local rgba() from a hex, so this module stays free of MUI's theme imports and can
 * be used from anywhere on the page without pulling a provider in.
 */
function alphaHex(hex, opacity) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
