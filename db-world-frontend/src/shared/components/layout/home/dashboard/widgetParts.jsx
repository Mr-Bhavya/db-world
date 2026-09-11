import React from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { CheckCircleOutline as BulletIcon, Login as LoginIcon } from '@mui/icons-material';

import { useT } from '@shared/theme';
import { clampTextSx } from '../homeStyles';

/**
 * Shared building blocks for the dashboard widgets, so twelve tiles read as one system instead of
 * twelve one-off layouts.
 */

/** A headline figure over a small uppercase caption. Shows a skeleton while the summary loads. */
export function Stat({ value, label, color, loading, align = 'center', compact = false }) {
  const T = useT();

  return (
    <Box sx={{ minWidth: 0, flex: 1, textAlign: align }}>
      {loading ? (
        <Skeleton
          variant="text"
          width={compact ? 32 : 44}
          height={compact ? 24 : 30}
          sx={{ bgcolor: T.glassHover, mx: align === 'center' ? 'auto' : 0 }}
        />
      ) : (
        <Typography
          sx={{
            color: color ?? T.textPrimary,
            fontWeight: 900,
            fontSize: compact
              ? { xs: '1.05rem', sm: '1.2rem' }
              : { xs: '1.25rem', sm: '1.5rem', xl: '1.7rem' },
            lineHeight: 1.05,
            ...clampTextSx(1),
          }}
        >
          {value}
        </Typography>
      )}

      <Typography
        sx={{
          color: T.textMuted,
          fontSize: { xs: '0.6rem', sm: '0.66rem' },
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mt: 0.35,
          ...clampTextSx(1),
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/** Two or three `Stat`s side by side, separated by hairlines. */
export function StatRow({ children }) {
  const T = useT();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.25 }, minWidth: 0 }}>
      {items.map((child, index) => (
        <React.Fragment key={child.key ?? index}>
          {index > 0 && (
            <Box sx={{ alignSelf: 'stretch', width: '1px', bgcolor: T.glassBorder, flexShrink: 0 }} />
          )}
          {child}
        </React.Fragment>
      ))}
    </Box>
  );
}

/**
 * What a widget shows when its section is missing — the app's static description, exactly what the
 * tile said before there was live data. Never an error: a dead subsystem should look like a plain
 * tile, not a broken one.
 */
export function WidgetFallback({ text, lines = 2 }) {
  const T = useT();

  return (
    <Typography
      sx={{
        color: T.textMuted,
        fontSize: { xs: '0.73rem', sm: '0.82rem', xl: '0.9rem' },
        lineHeight: 1.45,
        ...clampTextSx(lines),
      }}
    >
      {text}
    </Typography>
  );
}

/** One line of supporting detail under the headline figures. */
export function WidgetNote({ children, color, icon: NoteIcon }) {
  const T = useT();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 1, minWidth: 0 }}>
      {NoteIcon && <NoteIcon sx={{ fontSize: 14, color: color ?? T.textMuted, flexShrink: 0 }} />}
      <Typography
        sx={{
          color: color ?? T.textMuted,
          fontSize: { xs: '0.7rem', sm: '0.76rem' },
          fontWeight: 600,
          lineHeight: 1.35,
          ...clampTextSx(1),
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

/** A small pill for a status word — "Open now", "2 expiring", "Live". */
export function WidgetChip({ label, color, filled = true }) {
  const T = useT();
  const tone = color ?? T.teal;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.85,
        py: 0.25,
        borderRadius: 1.2,
        flexShrink: 0,
        maxWidth: '100%',
        color: tone,
        bgcolor: filled ? `${tone}1f` : 'transparent',
        border: `1px solid ${tone}3d`,
        fontSize: '0.66rem',
        fontWeight: 800,
        letterSpacing: '0.02em',
        lineHeight: 1.5,
        ...clampTextSx(1),
      }}
    >
      {label}
    </Box>
  );
}

/** A thin progress bar — resume position, subscription, anything 0–100. */
export function WidgetProgress({ value, color }) {
  const T = useT();
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <Box
      sx={{
        height: 4,
        borderRadius: 2,
        bgcolor: T.glassBorder,
        overflow: 'hidden',
        mt: 0.85,
        minWidth: 0,
      }}
    >
      <Box sx={{ width: `${clamped}%`, height: '100%', bgcolor: color ?? T.teal, borderRadius: 2 }} />
    </Box>
  );
}

/**
 * What a user-scoped widget shows to a visitor who is not signed in.
 *
 * The alternative — hiding the tile, or leaving a bare sentence in a half-empty card — wastes the
 * best conversion surface the site has. Someone looking at the hub signed out is already
 * interested; this is where they are told what the app does for them and given one tap to get it.
 *
 * On anything but the smallest tile the pitch sits left and the button right, so the width a wide
 * tile has is actually used and the call to action lands where the eye finishes. A small tile has
 * neither the width nor the height for that, and falls back to a line and a text link.
 *
 * Bullet count is capped by footprint, not by the caller: three bullets plus a blurb overflow a
 * single-row tile on a phone, and the card clips rather than scrolls.
 */
export function SignedOutPanel({ widget, pitch = [], onSignIn, blurb }) {
  const T = useT();
  const compact = widget.size === 'sm';
  const lines = pitch.slice(0, widget.size === 'lg' ? 3 : 2);

  const signIn = (
    <Button
      size="small"
      variant={compact ? 'text' : 'contained'}
      startIcon={compact ? null : <LoginIcon sx={{ fontSize: 15 }} />}
      onClick={(event) => {
        event.stopPropagation();
        onSignIn?.();
      }}
      sx={{
        borderRadius: 1.8,
        px: compact ? 0.75 : 1.6,
        py: compact ? 0.2 : 0.55,
        minWidth: 0,
        flexShrink: 0,
        fontSize: '0.74rem',
        fontWeight: 850,
        textTransform: 'none',
        whiteSpace: 'nowrap',
        ...(compact
          ? { color: widget.accent, alignSelf: 'flex-start', '&:hover': { bgcolor: `${widget.accent}14` } }
          : {
              bgcolor: widget.accent,
              color: '#fff',
              boxShadow: `0 6px 16px ${widget.accent}44`,
              '&:hover': { bgcolor: widget.accent, filter: 'brightness(1.08)' },
            }),
      }}
    >
      Sign in
    </Button>
  );

  const copy = (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        sx={{
          color: T.textMuted,
          fontSize: { xs: '0.72rem', sm: '0.78rem' },
          lineHeight: 1.45,
          ...clampTextSx(2),
        }}
      >
        {blurb ?? widget.description}
      </Typography>

      {!compact && lines.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mt: 0.75 }}>
          {lines.map((line) => (
            <Box key={line} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
              <BulletIcon sx={{ fontSize: 13, color: widget.accent, flexShrink: 0 }} />
              <Typography
                sx={{ color: T.textMuted, fontSize: '0.72rem', fontWeight: 600, ...clampTextSx(1) }}
              >
                {line}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  if (compact) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        {copy}
        <Box sx={{ mt: 'auto', pt: 0.5 }}>{signIn}</Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, sm: 1.75 },
        minWidth: 0,
        height: '100%',
      }}
    >
      {copy}
      {signIn}
    </Box>
  );
}
