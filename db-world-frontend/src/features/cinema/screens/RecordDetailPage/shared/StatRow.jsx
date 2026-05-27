import React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useT } from '@shared/theme/ThemeContext';

export default function StatRow({ label, value, link }) {
  const T = useT();
  if (value == null || value === '') return null;
  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 0.75, borderBottom: `1px solid ${alpha(T.text, 0.06)}` }}>
      <Typography variant="body2" sx={{ color: T.textFaint, minWidth: 130, flexShrink: 0 }}>
        {label}
      </Typography>
      {link ? (
        <Box
          component="a" href={link} target="_blank" rel="noopener noreferrer"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: T.teal, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          <Typography variant="body2" sx={{ color: T.teal }}>{value}</Typography>
          <OpenInNewIcon sx={{ fontSize: 14 }} />
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: T.textMuted }}>{String(value)}</Typography>
      )}
    </Box>
  );
}
