import React, { memo, useCallback } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  Bookmark as BookmarkFilledIcon,
  BookmarkBorder as BookmarkIcon,
} from '@mui/icons-material';
import { useReducedMotion } from 'framer-motion';

import { useT } from '@shared/theme';
import { cardFocusSx, clampTextSx } from './homeStyles';

const AppCard = memo(function AppCard({
  app,
  isFavorite,
  onNavigate,
  onToggleFavorite,
}) {
  const T = useT();
  const prefersReducedMotion = useReducedMotion();
  const Icon = app.Icon;

  const handleOpen = useCallback(() => {
    onNavigate(app);
  }, [app, onNavigate]);

  const handleToggleFavorite = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggleFavorite(app.id);
    },
    [app.id, onToggleFavorite]
  );

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpen();
        }
      }}
      aria-label={`Open ${app.label}`}
      sx={{
        width: '100%',
        minWidth: 0,
        minHeight: {
          xs: 138,
          sm: 166,
          md: 184,
          xl: 210,
        },
        '@media (min-width:1920px)': {
          minHeight: 236,
        },
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        borderRadius: {
          xs: 2.5,
          sm: 3,
          md: 3.25,
        },
        border: `1px solid ${T.glassBorder}`,
        bgcolor: T.bg,
        boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
        transform: 'translateZ(0)',
        transition: prefersReducedMotion
          ? 'border-color 0.2s ease, background-color 0.2s ease'
          : 'transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, background-color 0.22s ease',
        ...cardFocusSx(app.accent),
        '&:hover': {
          transform: prefersReducedMotion ? 'none' : 'translateY(-4px)',
          borderColor: `${app.accent}AA`,
          boxShadow: `0 18px 46px ${app.accent}44`,
          bgcolor: 'rgba(255,255,255,0.025)',
        },
      }}
    >
      <Box
        sx={{
          height: {
            xs: 58,
            sm: 72,
            md: 84,
            xl: 104,
          },
          '@media (min-width:1920px)': {
            height: 124,
          },
          background: app.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.32), transparent 34%)',
            opacity: 0.85,
          },
        }}
      >
        <Icon
          sx={{
            position: 'relative',
            zIndex: 1,
            color: '#fff',
            fontSize: {
              xs: 27,
              sm: 36,
              md: 40,
              xl: 50,
            },
            '@media (min-width:1920px)': {
              fontSize: 60,
            },
            filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.32))',
          }}
        />

        <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <IconButton
            size="small"
            onClick={handleToggleFavorite}
            aria-label={
              isFavorite
                ? `Remove ${app.label} from favorites`
                : `Add ${app.label} to favorites`
            }
            sx={{
              position: 'absolute',
              top: { xs: 8, sm: 10 },
              right: { xs: 8, sm: 10 },
              zIndex: 2,
              width: { xs: 34, sm: 36, xl: 42 },
              height: { xs: 34, sm: 36, xl: 42 },
              color: '#fff',
              bgcolor: isFavorite
                ? 'rgba(0,0,0,0.34)'
                : 'rgba(0,0,0,0.24)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.24)',
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.45)',
              },
              '&:focus-visible': {
                outline: '3px solid #fff',
                outlineOffset: 3,
              },
            }}
          >
            {isFavorite ? (
              <BookmarkFilledIcon sx={{ fontSize: { xs: 19, xl: 23 } }} />
            ) : (
              <BookmarkIcon sx={{ fontSize: { xs: 19, xl: 23 } }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          p: {
            xs: 1.2,
            sm: 1.7,
            md: 2,
            xl: 2.3,
          },
          '@media (min-width:1920px)': {
            p: 2.8,
          },
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <Typography
          title={app.label}
          sx={{
            color: T.textPrimary,
            fontWeight: 900,
            fontSize: {
              xs: '0.88rem',
              sm: '1rem',
              md: '1.05rem',
              xl: '1.18rem',
            },
            '@media (min-width:1920px)': {
              fontSize: '1.36rem',
            },
            lineHeight: 1.18,
            mb: { xs: 0.4, sm: 0.65 },
            ...clampTextSx(2),
          }}
        >
          {app.label}
        </Typography>

        <Typography
          title={app.description}
          sx={{
            color: T.textMuted,
            fontSize: {
              xs: '0.73rem',
              sm: '0.82rem',
              md: '0.86rem',
              xl: '0.95rem',
            },
            '@media (min-width:1920px)': {
              fontSize: '1.08rem',
            },
            lineHeight: 1.45,
            ...clampTextSx(3),
            // Phones: 2 lines keeps the 2-up cards short; desktop keeps 3.
            WebkitLineClamp: { xs: 2, sm: 3 },
          }}
        >
          {app.description}
        </Typography>
      </Box>
    </Box>
  );
});

AppCard.displayName = 'AppCard';

export default AppCard;