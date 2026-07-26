import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useT } from '@shared/theme';
import { LOGODEV_TOKEN } from '../config';

/** Logo.dev's brand-logo-by-domain endpoint — `logoDomain` is a bare domain (e.g.
 * "swiggy.com"), not a full URL. `size`/`format` are fixed here rather than threaded
 * through as props: every call site renders this as a small circular avatar, so there's
 * no case yet that needs a different fetched size. */
const logoDevUrl = (domain) => `https://img.logo.dev/${domain}?token=${LOGODEV_TOKEN}&size=128&format=png`;

/**
 * Circular company logo; falls back to initials on a teal tint when there's no usable
 * image source or the image fails to load (broken URL, network error, etc). Shared
 * between IpoCard/MyIpoCard (compact, default size) and the detail page header (larger,
 * via `size`).
 *
 * `size` accepts either a plain number (most callers) or an MUI responsive breakpoint
 * object (e.g. `{ xs: 36, sm: 44 }`) — passed straight through to the `sx` width/height so
 * it shrinks on mobile, while the initials-fallback font size (which needs one concrete
 * number) is derived from the largest breakpoint value so the fallback avatar's text
 * still reads well at any viewport.
 *
 * Resolves the `<img>` source in this order:
 *   1. `logoUrl` — a full, ready-to-use URL, when the caller already has one.
 *   2. `logoDomain` — a bare domain (e.g. "swiggy.com"), built into a Logo.dev URL via
 *      `logoDevUrl`. Blank/whitespace-only domains are treated as absent.
 *   3. neither present → initials avatar, no `<img>` mounted at all.
 *
 * The `errored` flag guards the fallback so a 404/network failure flips to initials
 * EXACTLY ONCE per resolved src (once `errored` is true the `<img>` unmounts, so
 * `onError` can never fire again — no retry loop). The effect below resets that flag
 * whenever the resolved src changes, so a stale failure from a previously-viewed company
 * (e.g. the detail page reusing this same instance across `/ipo/:id` navigations) never
 * sticks around and wrongly forces initials for the next company.
 */
export default function CompanyLogo({ logoUrl, logoDomain, companyName, size = 34 }) {
  const T = useT();
  const [errored, setErrored] = useState(false);

  // A responsive `size` object has no single "the" number — take the largest breakpoint
  // value so the initials-fallback font never renders undersized.
  const numericSize = typeof size === 'number' ? size : Math.max(...Object.values(size));

  const trimmedDomain = typeof logoDomain === 'string' ? logoDomain.trim() : '';
  const src = logoUrl || (trimmedDomain ? logoDevUrl(trimmedDomain) : null);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  const initials = (companyName || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

  if (!src || errored) {
    return (
      <Box sx={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: T.tealBg, border: `1px solid ${T.border}`,
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
      alt=""
      onError={() => setErrored(true)}
      sx={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        objectFit: 'cover', border: `1px solid ${T.border}`, bgcolor: T.glassHover,
      }}
    />
  );
}
