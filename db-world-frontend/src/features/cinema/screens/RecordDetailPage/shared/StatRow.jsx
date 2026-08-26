import React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useT } from '@shared/theme/ThemeContext';

/**
 * One label/value line in a details list.
 *
 * Label and value sit at opposite ends with the value right-aligned, so a
 * column of these scans as a table without needing rules or a fixed label
 * width — which previously left a ragged gap in front of every short value.
 */
export default function StatRow({ label, value, link, onClick }) {
  const T = useT();
  if (value == null || value === '') return null;

  const valueSx = {
    fontWeight: 600,
    fontSize: { xs: '0.8rem', md: '0.82rem', xl: '0.92rem' },
    '@media (min-width:1920px)': { fontSize: '1.05rem' },
  };

  return (
    <Box sx={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: 2, py: { xs: 0.9, md: 1 },
      borderBottom: `1px solid ${alpha(T.text, 0.055)}`,
      '&:last-of-type': { borderBottom: 'none' },
    }}>
      <Typography component="span" sx={{
        color: T.textFaint, fontWeight: 600, flexShrink: 0,
        fontSize: { xs: '0.8rem', md: '0.82rem', xl: '0.92rem' },
        '@media (min-width:1920px)': { fontSize: '1.05rem' },
      }}>
        {label}
      </Typography>

      {onClick ? (
        /* In-app destination — no new tab, no external-link affordance. */
        <Box
          component="button" type="button" onClick={onClick}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.25, p: 0,
            background: 'none', border: 0, cursor: 'pointer', textAlign: 'right',
            color: T.teal, font: 'inherit', minWidth: 0,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          <Typography component="span" sx={{ ...valueSx, color: T.teal }}>{value}</Typography>
          <ChevronRightIcon sx={{ fontSize: 16, flexShrink: 0 }} />
        </Box>
      ) : link ? (
        <Box
          component="a" href={link} target="_blank" rel="noopener noreferrer"
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0,
            color: T.teal, textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          <Typography component="span" sx={{ ...valueSx, color: T.teal }}>{value}</Typography>
          <OpenInNewIcon sx={{ fontSize: 14, flexShrink: 0 }} />
        </Box>
      ) : (
        <Typography component="span" sx={{ ...valueSx, color: T.text, textAlign: 'right', minWidth: 0 }}>
          {String(value)}
        </Typography>
      )}
    </Box>
  );
}
