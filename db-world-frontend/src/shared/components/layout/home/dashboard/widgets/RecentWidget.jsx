import React from 'react';
import { Box, Typography } from '@mui/material';

import { useT } from '@shared/theme';
import { clampTextSx } from '../../homeStyles';
import { timeAgo } from '../../homeStorage';
import WidgetShell from '../WidgetShell';
import { WidgetFallback } from '../widgetParts';

/**
 * Where you were last. Reads the same localStorage trail the old hub's "Recent Activity" section
 * used, so nothing is lost by the move to widgets.
 */
export default function RecentWidget({ widget, recent = [], apps = [], onNavigate, ...shell }) {
  const T = useT();
  const rows = recent.slice(0, widget.size === 'lg' ? 5 : 3);

  if (rows.length === 0) {
    return (
      <WidgetShell widget={widget} {...shell} onOpen={undefined}>
        <WidgetFallback text="Nothing here yet — the apps you open will show up as a trail." />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell widget={widget} {...shell} onOpen={undefined}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, minWidth: 0 }}>
        {rows.map((item) => {
          const app = apps.find((candidate) => candidate.id === item.appId);
          if (!app) return null;

          const AppIcon = app.Icon;

          return (
            <Box
              key={`${item.appId}-${item.ts ?? item.timestamp}`}
              role="button"
              tabIndex={0}
              aria-label={`Open ${app.label}`}
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
                alignItems: 'center',
                gap: 0.85,
                px: 0.6,
                py: 0.45,
                borderRadius: 1.4,
                cursor: 'pointer',
                minWidth: 0,
                '&:hover': { bgcolor: T.glassHover },
                '&:focus-visible': { outline: `2px solid ${app.accent}`, outlineOffset: 1 },
              }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: 1.2,
                  background: app.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {AppIcon && <AppIcon sx={{ color: '#fff', fontSize: 13 }} />}
              </Box>

              <Typography
                sx={{
                  flex: 1,
                  color: T.textPrimary,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  ...clampTextSx(1),
                }}
              >
                {app.label}
              </Typography>

              <Typography sx={{ color: T.textFaint, fontSize: '0.65rem', fontWeight: 600, flexShrink: 0 }}>
                {timeAgo(item.ts ?? item.timestamp)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </WidgetShell>
  );
}
