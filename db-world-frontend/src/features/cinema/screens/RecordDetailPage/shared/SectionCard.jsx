import React from 'react';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useT } from '@shared/theme/ThemeContext';

/**
 * The panel surface every detail section sits on — a barely-there tint with a
 * hairline border, so groups read as distinct blocks without heavy chrome.
 *
 * Padding and radius scale with the viewport: the same 16px that feels
 * generous on a phone looks like a cramped mistake on a television.
 */
export default function SectionCard({ children, sx, ...rest }) {
  const T = useT();
  return (
    <Box
      sx={{
        bgcolor: alpha(T.text, 0.035),
        border: `1px solid ${alpha(T.text, 0.075)}`,
        borderRadius: { xs: 2, md: 2.5 },
        p: { xs: 1.75, md: 2.25, xl: 3 },
        '@media (min-width:1920px)': { p: 4, borderRadius: 4 },
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}
