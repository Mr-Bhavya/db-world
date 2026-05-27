import React from 'react';
import { Box } from '@mui/material';
import { useT } from '@shared/theme/ThemeContext';
import RecordDetailContent from './RecordDetailContent';

/**
 * Full-page render of a record's detail.
 *
 * Used on cold loads, shared URLs, refreshes, and on mobile. When navigated
 * to in-app from CinemaPage on desktop, App.jsx routes to RecordDetailModal
 * instead via the location.state.background pattern.
 */
export default function RecordDetailPage() {
  const T = useT();
  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100vh' }}>
      <RecordDetailContent />
    </Box>
  );
}
