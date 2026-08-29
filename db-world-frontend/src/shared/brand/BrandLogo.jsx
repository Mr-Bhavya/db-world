import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useT } from '@shared/theme';
import { resolveLogoSrc } from './logoDev';

export { resolveLogoSrc, logoDevUrl, domainFromUrl } from './logoDev';

/**
 * Circular brand logo with an initials fallback. Shared across the app (IPO
 * cards/detail, the password vault, …).
 *
 * Props:
 *   logoUrl     — a full logo URL when the caller already has one (optional)
 *   logoDomain  — a bare domain (e.g. "netflix.com"); built into a logo.dev URL
 *   companyName — used for the initials fallback + alt text
 *   size        — number OR responsive breakpoint object ({ xs: 36, sm: 44 })
 *   radius      — border-radius (defaults to a circle)
 *   sx          — extra styles merged onto the avatar
 *
 * The image is fitted with `contain`, not `cover`. For a square source the two are identical, so
 * nothing that was already square changes — but a WIDE source (an IPO company's wordmark, which
 * is most of them) was being cropped to a square by `cover`, cutting the name off at both ends.
 * A small proportional inset keeps the mark off its own border rather than letting it run into it.
 *
 * The `errored` flag flips to the initials fallback exactly once per resolved
 * src (a 404/network failure unmounts the `<img>`, so onError can't loop); the
 * effect resets it whenever the resolved src changes so a stale failure from a
 * previously-rendered brand never sticks to the next one.
 */
export default function BrandLogo({ logoUrl, logoDomain, companyName, size = 34, radius = '50%', sx = {} }) {
  const T = useT();
  const [errored, setErrored] = useState(false);

  const numericSize = typeof size === 'number' ? size : Math.max(...Object.values(size));
  const src = resolveLogoSrc(logoUrl, logoDomain);

  useEffect(() => { setErrored(false); }, [src]);

  const initials =
    (companyName || '')
      .replace(/^https?:\/\//i, '')
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';

  if (!src || errored) {
    return (
      <Box sx={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: T.tealBg, border: `1px solid ${T.border}`, ...sx,
      }}>
        <Typography sx={{ fontSize: Math.round(numericSize * 0.35), fontWeight: 800, color: T.teal, lineHeight: 1 }}>
          {initials}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={companyName ? `${companyName} logo` : ''}
      onError={() => setErrored(true)}
      sx={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        objectFit: 'contain', padding: `${Math.max(2, Math.round(numericSize * 0.08))}px`,
        border: `1px solid ${T.border}`, bgcolor: T.glassHover, ...sx,
      }}
    />
  );
}
