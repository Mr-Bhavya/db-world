import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';

import { useT } from '@shared/theme';
import { APPS } from './homeData';
import { timeAgo } from './homeStorage';
import { cardFocusSx, clampTextSx } from './homeStyles';

const RecentCard = memo(function RecentCard({ item, onNavigate, compact }) {
  const T = useT();

  const app = APPS.find((candidate) => candidate.id === item.appId);
  if (!app) return null;

  const Icon = app.Icon;
  const timeAgoStr = timeAgo(item.ts ?? item.timestamp);

  if (compact) {
    return (
      <Box
        role="button"
        tabIndex={0}
        onClick={() => onNavigate(app)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onNavigate(app);
          }
        }}
        aria-label={`Open ${app.label}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          minWidth: 0,
          maxWidth: 280,
          px: { xs: 1.35, sm: 1.5 },
          py: 0.85,
          borderRadius: 999,
          border: `1px solid ${T.glassBorder}`,
          bgcolor: T.glass,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          ...cardFocusSx(app.accent),
          '&:hover': {
            borderColor: `${app.accent}88`,
            boxShadow: `0 0 12px ${app.accent}55`,
          },
        }}
      >
        <Icon sx={{ fontSize: 17, color: app.accent, flexShrink: 0 }} />

        <Typography
          sx={{
            color: T.textPrimary,
            fontWeight: 700,
            fontSize: '0.8rem',
            lineHeight: 1.2,
            ...clampTextSx(1),
          }}
        >
          {app.label}
        </Typography>

        <Typography
          sx={{
            color: T.textFaint,
            fontSize: '0.7rem',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {timeAgoStr}
        </Typography>
      </Box>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ type: 'spring', stiffness: 120, damping: 16 }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={() => onNavigate(app)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onNavigate(app);
          }
        }}
        aria-label={`Open ${app.label}`}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          alignItems: 'center',
          gap: 1.7,
          py: 1.35,
          px: 1,
          cursor: 'pointer',
          borderRadius: 2,
          minWidth: 0,
          transition: 'background-color 0.2s ease',
          ...cardFocusSx(app.accent),
          '&:hover': {
            bgcolor: T.glass,
          },
        }}
      >
        <Box
          sx={{
            width: { md: 42, xl: 48 },
            height: { md: 42, xl: 48 },
            borderRadius: '50%',
            bgcolor: `${app.accent}22`,
            border: `2px solid ${app.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            zIndex: 1,
          }}
        >
          <Icon sx={{ fontSize: { md: 18, xl: 22 }, color: app.accent }} />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: T.textPrimary,
              fontWeight: 800,
              fontSize: { md: '0.92rem', xl: '1.05rem' },
              lineHeight: 1.25,
              ...clampTextSx(1),
            }}
          >
            {app.label}
          </Typography>

          <Typography
            sx={{
              color: T.textFaint,
              fontSize: { md: '0.76rem', xl: '0.86rem' },
              lineHeight: 1.35,
            }}
          >
            {timeAgoStr}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
});

RecentCard.displayName = 'RecentCard';

export default RecentCard;