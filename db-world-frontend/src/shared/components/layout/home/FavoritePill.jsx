import React, { memo } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Bookmark as BookmarkFilledIcon } from '@mui/icons-material';

import { useT } from '@shared/theme';
import { cardFocusSx, clampTextSx } from './homeStyles';

const FavoritePill = memo(function FavoritePill({
  app,
  onNavigate,
  onToggleFavorite,
}) {
  const T = useT();
  const Icon = app.Icon;

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
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        maxWidth: {
          xs: 260,
          sm: 320,
          xl: 420,
        },
        px: {
          xs: 1.35,
          sm: 1.7,
          xl: 2.2,
        },
        py: {
          xs: 0.9,
          xl: 1.15,
        },
        borderRadius: 999,
        border: `1.5px solid ${app.accent}`,
        bgcolor: `${app.accent}22`,
        color: app.accent,
        flexShrink: 0,
        minWidth: 0,
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
        ...cardFocusSx(app.accent),
        '&:hover': {
          boxShadow: `0 0 14px ${app.accent}77`,
          bgcolor: `${app.accent}38`,
        },
      }}
    >
      <Icon
        sx={{
          fontSize: {
            xs: 18,
            xl: 24,
          },
          flexShrink: 0,
        }}
      />

      <Typography
        sx={{
          fontSize: {
            xs: '0.82rem',
            sm: '0.88rem',
            xl: '1.02rem',
          },
          fontWeight: 800,
          lineHeight: 1.2,
          minWidth: 0,
          ...clampTextSx(1),
        }}
      >
        {app.label}
      </Typography>

      <IconButton
        size="small"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleFavorite(app.id);
        }}
        aria-label={`Remove ${app.label} from favorites`}
        sx={{
          color: app.accent,
          ml: 0.25,
          width: {
            xs: 28,
            xl: 34,
          },
          height: {
            xs: 28,
            xl: 34,
          },
          flexShrink: 0,
          '&:hover': {
            bgcolor: `${app.accent}22`,
          },
          '&:focus-visible': {
            outline: `3px solid ${app.accent}`,
            outlineOffset: 3,
          },
        }}
      >
        <BookmarkFilledIcon
          sx={{
            fontSize: {
              xs: 17,
              xl: 22,
            },
          }}
        />
      </IconButton>
    </Box>
  );
});

FavoritePill.displayName = 'FavoritePill';

export default FavoritePill;