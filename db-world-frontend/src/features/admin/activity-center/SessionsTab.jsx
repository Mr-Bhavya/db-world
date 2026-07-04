import React from 'react';
import { Box, Typography } from '@mui/material';
import DevicesIcon from '@mui/icons-material/Devices';
import { useT } from '@shared/theme/ThemeContext';

// STUB — replaced by Task 7 with the active-sessions table.
export default function SessionsTab() {
  const T = useT();
  return (
    <Box sx={{
      p: 2, minHeight: 280,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 1, color: T.textMuted, textAlign: 'center',
    }}>
      <DevicesIcon sx={{ fontSize: 28, color: T.textFaint }} />
      <Typography sx={{ fontSize: 13, color: T.textMuted }}>
        Sessions — coming up
      </Typography>
    </Box>
  );
}
