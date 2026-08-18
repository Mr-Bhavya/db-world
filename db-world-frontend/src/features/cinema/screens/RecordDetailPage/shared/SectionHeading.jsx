import React from 'react';
import { Box, Typography } from '@mui/material';
import { useT } from '@shared/theme/ThemeContext';

/**
 * Section title, optionally with a trailing action ("See all →", a count, an
 * external link).
 *
 * Sizes step up through the breakpoints rather than staying fixed: on a TV the
 * viewer is metres away, and a 1.15rem heading that reads as a title on a phone
 * reads as body copy from a sofa.
 */
export default function SectionHeading({ children, action, sx }) {
  const T = useT();

  const title = (
    <Typography
      variant="h6"
      sx={{
        color: T.text,
        fontWeight: 800,
        letterSpacing: -0.3,
        lineHeight: 1.2,
        fontSize: { xs: '1.05rem', md: '1.15rem', xl: '1.35rem' },
        '@media (min-width:1920px)': { fontSize: '1.6rem' },
        ...sx,
      }}
    >
      {children}
    </Typography>
  );

  if (!action) {
    return <Box sx={{ mb: { xs: 1.5, md: 2 }, mt: 1 }}>{title}</Box>;
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: 1.5, mb: { xs: 1.5, md: 2 }, mt: 1,
    }}>
      {title}
      <Typography component="span" sx={{
        color: T.textFaint, fontWeight: 600, whiteSpace: 'nowrap',
        fontSize: { xs: '0.72rem', md: '0.78rem', xl: '0.9rem' },
      }}>
        {action}
      </Typography>
    </Box>
  );
}
