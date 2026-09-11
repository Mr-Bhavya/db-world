import React from 'react';
import { Box, Popover, Typography } from '@mui/material';

import { useT } from '@shared/theme';
import { clampTextSx } from '@shared/components/layout/home/homeStyles';

/**
 * A one-line live status per app, from the hub's summary. The same figures the dashboard tiles
 * show, compressed to a phrase — so the menu tells you whether it is worth opening an app, not
 * just that the app exists. Falls back to the app's static tagline when there is nothing live.
 */
const liveStatus = (appId, summary) => {
  if (!summary) return null;

  switch (appId) {
    case 'ipo': {
      const open = summary.ipo?.open ?? 0;
      const upcoming = summary.ipo?.upcoming ?? 0;
      if (open > 0) return `${open} open now`;
      if (upcoming > 0) return `${upcoming} upcoming`;
      return null;
    }
    case 'cinema': {
      const resume = summary.cinema?.continueWatching;
      if (resume) return `Resume ${resume.title}`;
      const latest = summary.cinema?.latest?.length ?? 0;
      return latest > 0 ? `${latest} just added` : null;
    }
    case 'wallet': {
      const wallet = summary.wallet;
      if (!wallet) return null;
      if (wallet.expired > 0) return `${wallet.expired} expired`;
      if (wallet.expiringSoon > 0) return `${wallet.expiringSoon} expiring soon`;
      return wallet.total > 0 ? `${wallet.total} documents` : null;
    }
    case 'password': {
      const total = summary.vault?.total ?? 0;
      return total > 0 ? `${total} saved` : null;
    }
    case 'admin': {
      const admin = summary.admin;
      if (!admin) return null;
      const pending = admin.pendingMediaRequests + admin.pendingCatalogRequests;
      return pending > 0 ? `${pending} pending` : null;
    }
    default:
      return null;
  }
};

/**
 * The header's Apps panel.
 *
 * Two columns of icon + name + live status, rather than the plain text list it replaced. The two
 * `feature` apps lead, keeping the same product priority the dashboard uses.
 *
 * Rendered for signed-out visitors too: Cinema, IPO Radar, Weather and Arcade are all public
 * routes, and the protected ones bounce through the login and come back — which is a far better
 * outcome than a header that offers an anonymous visitor nowhere to go.
 */
export default function AppsMenu({ anchorEl, onClose, apps, summary, activeRoute, onNavigate }) {
  const T = useT();

  const isActive = (route) =>
    Boolean(route) && (activeRoute === route || activeRoute?.startsWith(`${route}/`));

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      transformOrigin={{ horizontal: 'left', vertical: 'top' }}
      disableScrollLock
      slotProps={{
        paper: {
          sx: {
            mt: 1,
            p: 1,
            width: 'min(520px, calc(100vw - 32px))',
            borderRadius: 3,
            bgcolor: T.sidebar ?? T.bg,
            backgroundImage: 'none',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${T.glassBorder}`,
            boxShadow: '0 24px 64px rgba(0,0,0,0.34)',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 0.5,
        }}
      >
        {apps.map((app) => {
          const AppIcon = app.Icon;
          const active = isActive(app.route);
          const status = liveStatus(app.id, summary) ?? app.tagline;

          return (
            <Box
              key={app.id}
              component="button"
              type="button"
              onClick={() => onNavigate(app.route)}
              aria-current={active ? 'page' : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                width: '100%',
                px: 1.25,
                py: 1.1,
                borderRadius: 2,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                minWidth: 0,
                border: '1px solid transparent',
                bgcolor: active ? `${app.accent}14` : 'transparent',
                borderColor: active ? `${app.accent}44` : 'transparent',
                transition: 'background-color 0.18s ease, border-color 0.18s ease',
                '&:hover': { bgcolor: `${app.accent}14`, borderColor: `${app.accent}44` },
                '&:focus-visible': { outline: `2px solid ${app.accent}`, outlineOffset: 2 },
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 2,
                  background: app.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: `0 6px 16px ${app.accent}44`,
                }}
              >
                {AppIcon && <AppIcon sx={{ color: '#fff', fontSize: 19 }} />}
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    color: active ? app.accent : T.text,
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    lineHeight: 1.25,
                    ...clampTextSx(1),
                  }}
                >
                  {app.label}
                </Typography>

                {status && (
                  <Typography
                    sx={{
                      color: T.textFaint,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      mt: 0.15,
                      ...clampTextSx(1),
                    }}
                  >
                    {status}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Popover>
  );
}
