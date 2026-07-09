import React from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import settingsApi from './api';

const SettingsPanel = () => {
  const T = useT();
  const { data: categories = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: settingsApi.list,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress sx={{ color: T.teal }} />
      </Box>
    );
  }
  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">Failed to load settings.</Alert></Box>;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: T.text, mb: 0.5 }}>
        Settings
      </Typography>
      <Typography sx={{ fontSize: '0.82rem', color: T.textFaint, mb: 3 }}>
        Runtime configuration — changes apply live (no restart) unless noted.
      </Typography>
      {categories.map((cat) => (
        <Box key={cat.category} sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, color: T.text }}>{cat.category}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>
            {cat.settings.length} setting(s)
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default SettingsPanel;
