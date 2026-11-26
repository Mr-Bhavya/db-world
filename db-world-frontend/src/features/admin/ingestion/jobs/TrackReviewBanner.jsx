import React from 'react';
import { alpha, Box, Paper, Stack, Typography, Button } from '@mui/material';
import { Subtitles } from '@mui/icons-material';

// Prominent call-to-action shown while a job is parked in AWAITING_INPUT.
export function TrackReviewBanner({ onOpen }) {
  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        mt: 0.3,
        px: 1,
        py: 0.85,
        borderRadius: 2.5,
        borderColor: (t) => alpha(t.palette.secondary.main, 0.45),
        bgcolor: (t) => alpha(t.palette.secondary.main, 0.08),
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Subtitles sx={{ fontSize: 19, color: 'secondary.main', flexShrink: 0 }} />
        <Box flex={1} minWidth={0}>
          <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            Waiting for your track selection
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Pick which audio/subtitle languages to keep — other jobs keep running meanwhile.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="contained"
          color="secondary"
          onClick={onOpen}
          startIcon={<Subtitles sx={{ fontSize: 16 }} />}
          sx={{ borderRadius: 999, fontWeight: 700, flexShrink: 0 }}
        >
          Select
        </Button>
      </Stack>
    </Paper>
  );
}
