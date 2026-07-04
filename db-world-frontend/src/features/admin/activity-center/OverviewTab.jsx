import React from 'react';
import { Box, Typography } from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import { useT } from '@shared/theme/ThemeContext';

// STUB — replaced by Task 5 with the real overview dashboard (KPIs, sparklines, etc).
export default function OverviewTab() {
  const T = useT();
  return (
    <Box sx={{
      p: 2, minHeight: 280,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 1, color: T.textMuted, textAlign: 'center',
    }}>
      <InsightsIcon sx={{ fontSize: 28, color: T.textFaint }} />
      <Typography sx={{ fontSize: 13, color: T.textMuted }}>
        Overview — coming up
      </Typography>
    </Box>
  );
}
