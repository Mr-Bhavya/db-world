import React from 'react';
import { Box, Link as MuiLink } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import Constants from '@shared/constants';
import { useT } from '@shared/theme/ThemeContext';

/**
 * Privacy / Terms / Contact strip.
 *
 * AdSense requires these pages to exist AND to be reachable from the site's normal
 * navigation — a page that only a direct URL can find does not count. So this sits in
 * the shared footer and at the foot of each public browse surface, which are the pages
 * a reviewer (and a visitor) actually lands on.
 *
 * Router links rather than plain anchors, so following one does not blow away the SPA
 * and re-download the bundle.
 */
export default function LegalLinks({ sx }) {
  const T = useT();

  const items = [
    { label: 'Privacy', to: Constants.DB_PRIVACY_ROUTE },
    { label: 'Terms',   to: Constants.DB_TERMS_ROUTE },
    { label: 'Contact', to: Constants.DB_CONTACT_ROUTE },
  ];

  return (
    <Box
      component="nav"
      aria-label="Legal"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: { xs: 1.25, sm: 2 },
        ...sx,
      }}
    >
      {items.map(({ label, to }) => (
        <MuiLink
          key={to}
          component={RouterLink}
          to={to}
          underline="none"
          sx={{
            color: T.textFaint,
            fontSize: { xs: '0.72rem', sm: '0.76rem', xl: '0.9rem' },
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            '&:hover': { color: T.teal },
            '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
          }}
        >
          {label}
        </MuiLink>
      ))}
    </Box>
  );
}
