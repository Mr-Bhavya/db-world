import React from 'react';
import { Typography } from '@mui/material';
import { useT } from '@shared/theme/ThemeContext';

export default function SectionHeading({ children, sx }) {
  const T = useT();
  return (
    <Typography
      variant="h6"
      sx={{ color: T.text, fontWeight: 700, mb: 2, mt: 1, letterSpacing: 0.3, ...sx }}
    >
      {children}
    </Typography>
  );
}
