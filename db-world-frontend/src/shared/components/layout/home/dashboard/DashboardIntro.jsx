import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import {
  ArrowForwardRounded as ArrowIcon,
  LoginRounded as SignInIcon,
  PersonAddAltRounded as RegisterIcon,
} from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';

import { useT } from '@shared/theme';
import { clampTextSx } from '../homeStyles';

/** One height for every control in the band, so nothing reads as accidentally misaligned. */
const ACTION_HEIGHT = 46;

/**
 * Greeting for a returning visitor. Deliberately time-based rather than "Welcome back", which is
 * wrong the first time anyone sees it.
 */
const greeting = (hour) => {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * The one-line "here is what changed" digest, assembled from whichever sections the summary
 * actually returned. Ordered by how time-sensitive each item is: something expiring beats
 * something new, which beats a standing count.
 */
const buildDigest = (summary) => {
  if (!summary) return [];

  const parts = [];
  const { ipo, cinema, wallet, admin, notifications } = summary;

  if (wallet?.expired > 0) {
    parts.push(`${wallet.expired} document${wallet.expired === 1 ? '' : 's'} expired`);
  } else if (wallet?.expiringSoon > 0) {
    parts.push(`${wallet.expiringSoon} document${wallet.expiringSoon === 1 ? '' : 's'} expiring`);
  }

  if (ipo?.open > 0) parts.push(`${ipo.open} IPO${ipo.open === 1 ? '' : 's'} open`);
  if (cinema?.continueWatching) parts.push(`resume ${cinema.continueWatching.title}`);
  if (admin?.pendingMediaRequests + admin?.pendingCatalogRequests > 0) {
    const total = admin.pendingMediaRequests + admin.pendingCatalogRequests;
    parts.push(`${total} request${total === 1 ? '' : 's'} to review`);
  }
  if (notifications?.unread > 0) {
    parts.push(`${notifications.unread} unread notification${notifications.unread === 1 ? '' : 's'}`);
  }

  return parts.slice(0, 3);
};

/**
 * The band's calls to action.
 *
 * Hand-rolled rather than MUI `Button` so the two read as a matched pair — identical height and
 * radius, an icon each, a lift on hover that the trailing chevron follows, and a press that
 * actually depresses. Every motion is dropped under `prefers-reduced-motion`: the states still
 * change, they just stop moving.
 */
function AuthButton({ label, Icon, primary, trailing, onClick, T, reduced }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.85,
        height: ACTION_HEIGHT,
        px: { xs: 2, sm: 3 },
        // Share the row on a phone, sit at their natural width once there is room.
        flex: { xs: 1, sm: '0 0 auto' },
        minWidth: 0,
        cursor: 'pointer',
        borderRadius: 2.4,
        fontFamily: 'inherit',
        fontSize: { xs: '0.9rem', sm: '0.95rem' },
        fontWeight: primary ? 900 : 800,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        transition: reduced
          ? 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease'
          : 'transform 0.22s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.22s ease, background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
        ...(primary
          ? {
              color: '#fff',
              bgcolor: T.teal,
              border: `1px solid ${T.teal}`,
              boxShadow: `0 6px 20px ${T.teal}4d`,
              '&:hover': {
                bgcolor: T.tealHover,
                borderColor: T.tealHover,
                boxShadow: `0 12px 30px ${T.teal}66`,
                transform: reduced ? 'none' : 'translateY(-2px)',
              },
            }
          : {
              color: T.textPrimary,
              bgcolor: 'transparent',
              border: `1px solid ${T.borderHover}`,
              '&:hover': {
                color: T.teal,
                borderColor: T.teal,
                bgcolor: T.tealBg,
                transform: reduced ? 'none' : 'translateY(-2px)',
              },
            }),
        '&:active': { transform: reduced ? 'none' : 'translateY(0) scale(0.985)' },
        '&:focus-visible': { outline: `3px solid ${T.teal}`, outlineOffset: 3 },
        // The chevron exists to signal direction, so it leads the movement on hover.
        '&:hover .auth-chevron': { transform: reduced ? 'none' : 'translateX(3px)', opacity: 1 },
      }}
    >
      <Icon sx={{ fontSize: 19, flexShrink: 0 }} />

      <Box component="span" sx={{ ...clampTextSx(1) }}>
        {label}
      </Box>

      {trailing && (
        <ArrowIcon
          className="auth-chevron"
          sx={{
            fontSize: 17,
            flexShrink: 0,
            opacity: 0.72,
            transition: 'transform 0.22s ease, opacity 0.22s ease',
          }}
        />
      )}
    </Box>
  );
}

/**
 * The band above the dashboard.
 *
 * It replaces the old full-viewport hero, which cost a whole screen on a phone to say hello. The
 * hub's job is launching apps, so the tiles have to be reachable without scrolling — this stays
 * compact and, crucially, carries information: the digest line is the reason to read it.
 *
 * Signed out it becomes the site's actual pitch, since this is the landing page search engines
 * index and the `<h1>` they read.
 *
 * Laid out as a named grid rather than a flex row, so the customise control sits beside the
 * heading on a desktop and drops under the calls to action on a phone — from a single instance in
 * the DOM. Sharing one action row with it stranded the buttons a thousand pixels apart on a wide
 * screen; the calls to action belong under the copy they follow from.
 */
export default function DashboardIntro({
  firstName,
  isAuthenticated,
  summary,
  onSignIn,
  onRegister,
  actions,
}) {
  const T = useT();
  const reduced = useReducedMotion();

  const digest = useMemo(() => buildDigest(summary), [summary]);
  const hello = useMemo(() => greeting(new Date().getHours()), []);

  const heading = isAuthenticated
    ? `${hello}${firstName ? `, ${firstName}` : ''}`
    : 'Everything you use, in one hub';

  const subheading = isAuthenticated
    ? null
    : 'Stream cinema, track live IPOs, guard your passwords and documents, play, and check the weather — one fast, secure place for all of it.';

  /** Entry animation shared by the band's blocks, staggered so they arrive in reading order. */
  const rise = (delay) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, type: 'spring', stiffness: 120, damping: 18 },
        };

  return (
    <Box
      component="section"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
        gridTemplateAreas: {
          xs: '"copy" "auth" "tools"',
          sm: '"copy tools" "auth auth"',
        },
        columnGap: 2,
        rowGap: { xs: 1.5, sm: 2.5 },
        alignItems: 'start',
        mb: { xs: 2.5, sm: 3.5, md: 4 },
        minWidth: 0,
      }}
    >
      <Box component={motion.div} {...rise(0)} sx={{ gridArea: 'copy', minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{
            color: T.textPrimary,
            fontWeight: 950,
            letterSpacing: '-0.03em',
            lineHeight: 1.08,
            fontSize: isAuthenticated
              ? { xs: '1.75rem', sm: '2.2rem', md: '2.6rem', xl: '3rem' }
              : { xs: '1.9rem', sm: '2.6rem', md: '3.2rem', xl: '3.8rem' },
            overflowWrap: 'anywhere',
          }}
        >
          {heading}
        </Typography>

        {subheading && (
          <Typography
            sx={{
              color: T.textMuted,
              fontSize: { xs: '0.92rem', sm: '1rem', xl: '1.12rem' },
              lineHeight: 1.6,
              mt: 1.25,
              maxWidth: 680,
            }}
          >
            {subheading}
          </Typography>
        )}

        {digest.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25, minWidth: 0 }}>
            <Box
              aria-hidden
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: T.teal,
                boxShadow: `0 0 10px ${T.teal}`,
                flexShrink: 0,
              }}
            />
            <Typography
              sx={{
                color: T.textMuted,
                fontSize: { xs: '0.8rem', sm: '0.88rem' },
                fontWeight: 700,
                ...clampTextSx(1),
              }}
            >
              {digest.join(' · ')}
            </Typography>
          </Box>
        )}
      </Box>

      {!isAuthenticated && (
        <Box
          component={motion.div}
          {...rise(0.12)}
          sx={{
            gridArea: 'auth',
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 1.25 },
            minWidth: 0,
          }}
        >
          <AuthButton
            label="Sign in"
            Icon={SignInIcon}
            primary
            trailing
            onClick={onSignIn}
            T={T}
            reduced={reduced}
          />

          <AuthButton
            label="Create account"
            Icon={RegisterIcon}
            onClick={onRegister}
            T={T}
            reduced={reduced}
          />
        </Box>
      )}

      <Box
        sx={{
          gridArea: 'tools',
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        {actions}
      </Box>
    </Box>
  );
}
