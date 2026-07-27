import React, { memo, useCallback } from 'react';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  Bookmark as BookmarkFilledIcon,
  BookmarkBorder as BookmarkIcon,
} from '@mui/icons-material';
import { useReducedMotion } from 'framer-motion';

import { useT } from '@shared/theme';
import { cardFocusSx, clampTextSx } from './homeStyles';

/**
 * One app tile in the bento hub. Three layouts, chosen by `app.size`:
 *
 *   - `feature`  → a wide two-column tile with a big gradient icon panel on the left and, on the
 *                  right, the name + description + highlight chips + an "Open" affordance.
 *   - `utility`  → the same horizontal shape but slimmer/quieter (Admin Console strip).
 *   - `standard` → the classic vertical card: gradient icon header over name + description.
 *
 * Every surface comes from the `useT()` tokens (T.glass / T.glassHover / T.glassBorder), so the
 * card reads correctly in both the AMOLED-dark and pure-white themes; only the per-app accent and
 * its gradient are fixed colours (they sit on the gradient panel / as tints, legible on both).
 */
const AppCard = memo(function AppCard({ app, isFavorite, onNavigate, onToggleFavorite }) {
  const T = useT();
  const prefersReducedMotion = useReducedMotion();
  const Icon = app.Icon;
  const horizontal = app.size === 'feature' || app.size === 'utility';
  const isFeature = app.size === 'feature';

  const handleOpen = useCallback(() => onNavigate(app), [app, onNavigate]);

  const handleToggleFavorite = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggleFavorite(app.id);
    },
    [app.id, onToggleFavorite]
  );

  const favoriteButton = (
    <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
      <IconButton
        size="small"
        onClick={handleToggleFavorite}
        aria-label={isFavorite ? `Remove ${app.label} from favorites` : `Add ${app.label} to favorites`}
        sx={{
          position: 'absolute',
          top: { xs: 8, sm: 10 },
          right: { xs: 8, sm: 10 },
          zIndex: 3,
          width: { xs: 32, sm: 34 },
          height: { xs: 32, sm: 34 },
          color: T.textMuted,
          bgcolor: T.glass,
          backdropFilter: 'blur(8px)',
          border: `1px solid ${T.glassBorder}`,
          '&:hover': { bgcolor: T.glassHover, color: app.accent },
          '&:focus-visible': { outline: `3px solid ${app.accent}`, outlineOffset: 2 },
        }}
      >
        {isFavorite
          ? <BookmarkFilledIcon sx={{ fontSize: 18, color: app.accent }} />
          : <BookmarkIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    </Tooltip>
  );

  // The gradient tile that holds the white app icon — square in horizontal layouts, a full-width
  // banner in the vertical one. The radial highlight gives it a little depth on both themes.
  const iconPanel = (size) => (
    <Box
      sx={{
        ...size,
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
          background: 'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.34), transparent 42%)',
        },
      }}
    >
      <Icon
        sx={{
          position: 'relative',
          zIndex: 1,
          color: '#fff',
          fontSize: isFeature ? { xs: 34, sm: 42, md: 48 } : { xs: 27, sm: 36, md: 40, xl: 50 },
          filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.32))',
        }}
      />
    </Box>
  );

  const cardBaseSx = {
    width: '100%',
    height: '100%',
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    borderRadius: { xs: 2.5, sm: 3, md: 3.25 },
    border: `1px solid ${T.glassBorder}`,
    bgcolor: T.glass,
    backdropFilter: 'blur(12px)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
    transform: 'translateZ(0)',
    transition: prefersReducedMotion
      ? 'border-color 0.2s ease, background-color 0.2s ease'
      : 'transform 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease, background-color 0.24s ease',
    ...cardFocusSx(app.accent),
    '&:hover': {
      transform: prefersReducedMotion ? 'none' : 'translateY(-4px)',
      borderColor: `${app.accent}AA`,
      boxShadow: `0 18px 46px ${app.accent}40`,
      bgcolor: T.glassHover,
      '& .app-card-open': { opacity: 1, transform: 'translateX(0)' },
    },
  };

  const commonProps = {
    role: 'button',
    tabIndex: 0,
    onClick: handleOpen,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleOpen();
      }
    },
    'aria-label': `Open ${app.label}`,
  };

  // ── Horizontal layout: feature + utility ────────────────────────────────────────────────────
  if (horizontal) {
    return (
      <Box
        {...commonProps}
        sx={{
          ...cardBaseSx,
          display: 'flex',
          alignItems: 'stretch',
          minHeight: isFeature
            ? { xs: 116, sm: 150, md: 168 }
            : { xs: 84, sm: 92 },
        }}
      >
        {iconPanel(
          isFeature
            ? { width: { xs: 92, sm: 132, md: 152 } }
            : { width: { xs: 72, sm: 88 } }
        )}

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: { xs: 1.5, sm: 2, md: 2.5 },
            pr: { xs: 5, sm: 5.5 },
          }}
        >
          <Typography
            sx={{
              color: T.textPrimary,
              fontWeight: 900,
              fontSize: isFeature ? { xs: '1.02rem', sm: '1.25rem', md: '1.4rem' } : { xs: '0.95rem', sm: '1.08rem' },
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              ...clampTextSx(1),
            }}
          >
            {app.label}
          </Typography>

          <Typography
            sx={{
              color: T.textMuted,
              mt: 0.5,
              fontSize: isFeature ? { xs: '0.78rem', sm: '0.9rem', md: '0.95rem' } : { xs: '0.74rem', sm: '0.84rem' },
              lineHeight: 1.45,
              ...clampTextSx(2),
            }}
          >
            {app.description}
          </Typography>

          {isFeature && app.highlights?.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: { xs: 1, sm: 1.25 } }}>
              {app.highlights.map((h) => (
                <Chip
                  key={h}
                  label={h}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: app.accent,
                    bgcolor: `${app.accent}1f`,
                    border: `1px solid ${app.accent}3d`,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              ))}
            </Box>
          )}

          {isFeature && (
            <Box
              className="app-card-open"
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 0.5,
                mt: 1.25,
                color: app.accent,
                fontWeight: 800,
                fontSize: '0.82rem',
                opacity: prefersReducedMotion ? 1 : 0,
                transform: prefersReducedMotion ? 'none' : 'translateX(-6px)',
                transition: 'opacity 0.24s ease, transform 0.24s ease',
              }}
            >
              Open <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Box>
          )}
        </Box>

        {favoriteButton}
      </Box>
    );
  }

  // ── Vertical layout: standard ────────────────────────────────────────────────────────────────
  return (
    <Box
      {...commonProps}
      sx={{
        ...cardBaseSx,
        display: 'flex',
        flexDirection: 'column',
        minHeight: { xs: 138, sm: 166, md: 184, xl: 210 },
      }}
    >
      {iconPanel({ height: { xs: 58, sm: 72, md: 84, xl: 104 } })}
      {favoriteButton}

      <Box sx={{ p: { xs: 1.2, sm: 1.7, md: 2, xl: 2.3 }, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Typography
          title={app.label}
          sx={{
            color: T.textPrimary,
            fontWeight: 900,
            fontSize: { xs: '0.88rem', sm: '1rem', md: '1.05rem', xl: '1.18rem' },
            lineHeight: 1.18,
            letterSpacing: '-0.01em',
            mb: { xs: 0.4, sm: 0.65 },
            ...clampTextSx(1),
          }}
        >
          {app.label}
        </Typography>

        <Typography
          title={app.description}
          sx={{
            color: T.textMuted,
            fontSize: { xs: '0.73rem', sm: '0.82rem', md: '0.86rem', xl: '0.95rem' },
            lineHeight: 1.45,
            ...clampTextSx(3),
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
