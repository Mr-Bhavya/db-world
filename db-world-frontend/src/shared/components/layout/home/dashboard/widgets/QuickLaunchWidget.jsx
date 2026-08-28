import React from 'react';
import { Box, Typography } from '@mui/material';

import { useT } from '@shared/theme';
import { clampTextSx } from '../../homeStyles';
import WidgetShell from '../WidgetShell';

/**
 * Every app as an icon dock.
 *
 * This is the dashboard's safety net: widgets can be hidden and reordered, so there has to be one
 * tile that always reaches every app. It is also the fastest way to launch something when you
 * already know where you are going and do not care about the live figures.
 *
 * A scrolling row, not a wrapping grid. The tile is one grid row tall (128px on a phone) which
 * fits exactly one row of icons: at four columns, six apps wrapped and the second row was clipped
 * clean off, and squeezing seven columns into 343px left every label truncated to three letters.
 * Items grow to fill a wide tile and scroll on a narrow one, so the same code works at every size
 * and no app is ever unreachable.
 */
export default function QuickLaunchWidget({ widget, apps = [], onNavigate, ...shell }) {
  const T = useT();

  return (
    <WidgetShell widget={widget} {...shell} onOpen={undefined}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: { xs: 0.25, sm: 0.5 },
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          // Hidden, not styled: a scrollbar inside a 128px tile eats a quarter of the icons.
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          // Bleed to the tile edges so a scrolled row reads as continuing rather than as cut off.
          mx: { xs: -1.25, sm: -1.75 },
          px: { xs: 1.25, sm: 1.75 },
        }}
      >
        {apps.map((app) => {
          const AppIcon = app.Icon;

          return (
            <Box
              key={app.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${app.label}`}
              title={app.label}
              onClick={(event) => {
                event.stopPropagation();
                onNavigate?.(app);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                onNavigate?.(app);
              }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.4,
                py: 0.6,
                px: 0.25,
                borderRadius: 1.6,
                cursor: 'pointer',
                // Grow into a wide tile, but never below a width the label can live in.
                flex: '1 0 auto',
                minWidth: { xs: 54, sm: 60 },
                maxWidth: 96,
                transition: 'background-color 0.2s ease',
                '&:hover': { bgcolor: T.glassHover },
                '&:focus-visible': { outline: `2px solid ${app.accent}`, outlineOffset: 1 },
              }}
            >
              <Box
                sx={{
                  width: { xs: 30, sm: 36 },
                  height: { xs: 30, sm: 36 },
                  borderRadius: 1.6,
                  background: app.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {AppIcon && <AppIcon sx={{ color: '#fff', fontSize: { xs: 17, sm: 20 } }} />}
              </Box>

              <Typography
                sx={{
                  color: T.textMuted,
                  fontSize: { xs: '0.56rem', sm: '0.6rem' },
                  fontWeight: 700,
                  lineHeight: 1.2,
                  textAlign: 'center',
                  width: '100%',
                  ...clampTextSx(2),
                }}
              >
                {app.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </WidgetShell>
  );
}
