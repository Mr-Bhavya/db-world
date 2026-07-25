import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * Circular company logo; falls back to initials on a teal tint when there's no logoUrl
 * or the image fails to load (broken URL, network error, etc). Shared between IpoCard
 * (compact, default size) and the detail page header (larger, via `size`).
 *
 * `logoUrl` is now a real Clearbit URL (`https://logo.clearbit.com/<domain>`), which 404s
 * for any company Clearbit doesn't have — the `errored` flag guards the fallback so that
 * 404/network failure flips to initials EXACTLY ONCE per `logoUrl` (once `errored` is true
 * the `<img>` unmounts, so `onError` can never fire again — no retry loop). The effect below
 * resets that flag whenever `logoUrl` changes, so a stale failure from a previously-viewed
 * company (e.g. the detail page reusing this same instance across `/ipo/:id` navigations)
 * never sticks around and wrongly forces initials for the next company.
 */
export default function CompanyLogo({ logoUrl, companyName, size = 34 }) {
  const T = useT();
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [logoUrl]);

  const initials = (companyName || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

  if (!logoUrl || errored) {
    return (
      <Box sx={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: T.tealBg, border: `1px solid ${T.border}`,
      }}>
        <Typography sx={{ fontSize: Math.round(size * 0.35), fontWeight: 800, color: T.teal, lineHeight: 1 }}>
          {initials}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={logoUrl}
      alt=""
      onError={() => setErrored(true)}
      sx={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        objectFit: 'cover', border: `1px solid ${T.border}`, bgcolor: T.glassHover,
      }}
    />
  );
}
