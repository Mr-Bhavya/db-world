import React from 'react';
import { Box, Typography } from '@mui/material';
import { useT } from '@shared/theme/ThemeContext';

/**
 * Section title, optionally with a trailing action ("See all →", a count, an
 * external link).
 *
 * An optional icon and eyebrow keep the page scannable without changing the
 * heading's semantic level. Sizes step up through the breakpoints so titles
 * remain readable from phone to television.
 */
export default function SectionHeading({ children, action, eyebrow, icon: Icon, sx }) {
  const T = useT();

  const title = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      {Icon && (
        <Box sx={{
          width: 34,
          height: 34,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1.5,
          color: T.teal,
          bgcolor: T.tealBg,
          border: `1px solid ${T.glassBorder}`,
        }}>
          <Icon sx={{ fontSize: 18 }} aria-hidden="true" />
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography sx={{
            color: T.textFaint,
            fontSize: '0.62rem',
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            mb: 0.35,
          }}>
            {eyebrow}
          </Typography>
        )}
        <Typography
          component="h2"
          sx={{
            color: T.text,
            fontWeight: 800,
            letterSpacing: -0.35,
            lineHeight: 1.2,
            fontSize: { xs: '1.08rem', md: '1.2rem', xl: '1.4rem' },
            '@media (min-width:1920px)': { fontSize: '1.65rem' },
            ...sx,
          }}
        >
          {children}
        </Typography>
      </Box>
    </Box>
  );

  if (!action) {
    return <Box sx={{ mb: { xs: 1.5, md: 2 }, mt: 1 }}>{title}</Box>;
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
