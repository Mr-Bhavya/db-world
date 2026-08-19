import React from 'react';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';

/**
 * An age rating, with enough context to be read as one.
 *
 * A bare "A" or "16+" says nothing about what it is — and sitting in a row of 4K / HDR /
 * ATMOS badges it looked like one more technical tag. So the pill carries a key, and the
 * key names the country whose board issued it: the same film is A in India, R in the US
 * and 15 in the UK, and TMDB gives us whichever country actually rated it (preferring
 * IN, then US — see TmdbCertificationResolver).
 *
 * The word RATED is hidden on phones, where the country code alone plus the tooltip is
 * enough and the row is fighting for width.
 */

/** Rating boards worth naming in the tooltip. Anything else falls back to the country. */
const BOARDS = {
  IN: 'CBFC',
  US: 'MPA',
  GB: 'BBFC',
  AU: 'ACB',
  DE: 'FSK',
  FR: 'CNC',
  JP: 'Eirin',
  KR: 'KMRB',
  BR: 'DJCTQ',
  NZ: 'OFLC',
};

/** "IN" → "India", falling back to the raw code where Intl has no data. */
function regionName(code) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export default function CertBadge({ value, country, sx }) {
  if (!value) return null;

  const code = country ? String(country).toUpperCase() : null;
  const where = regionName(code);
  const board = code ? BOARDS[code] : null;
  const title = where
    ? `Age rating in ${where}${board ? ` (${board})` : ''}: ${value}`
    : `Age rating: ${value}`;

  return (
    <Box
      title={title}
      aria-label={title}
      sx={{
        display: 'inline-flex', alignItems: 'stretch',
        borderRadius: 1, overflow: 'hidden', flexShrink: 0,
        border: `1px solid ${alpha('#fff', 0.22)}`,
        fontSize: { xs: '0.64rem', xl: '0.72rem' },
        fontWeight: 700, lineHeight: 1.7,
        ...sx,
      }}
    >
      <Box component="span" sx={{
        display: 'inline-flex', alignItems: 'center',
        px: 0.7, bgcolor: alpha('#fff', 0.06),
        color: alpha('#fff', 0.55),
        fontSize: { xs: '0.55rem', xl: '0.62rem' }, letterSpacing: 0.7,
      }}>
        {code ? (
          <>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, mr: 0.4 }}>RATED</Box>
            {code}
          </>
        ) : 'RATED'}
      </Box>
      <Box component="span" sx={{
        display: 'inline-flex', alignItems: 'center',
        px: 0.9, bgcolor: alpha('#fff', 0.12), color: '#f5f5f5',
      }}>
        {value}
      </Box>
    </Box>
  );
}
