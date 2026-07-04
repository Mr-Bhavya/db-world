import React from 'react';
import { Box, Typography } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import { useT } from '@shared/theme/ThemeContext';

// STUB — replaced by Task 6 with the live/real-time activity feed.
export default function LiveTab() {
  const T = useT();
  return (
    <Box sx={{
      p: 2, minHeight: 280,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 1, color: T.textMuted, textAlign: 'center',
    }}>
      <BoltIcon sx={{ fontSize: 28, color: T.textFaint }} />
      <Typography sx={{ fontSize: 13, color: T.textMuted }}>
        Live — coming up
      </Typography>
    </Box>
  );
}
