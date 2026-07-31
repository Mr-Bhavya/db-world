/**
 * Shared surface primitives — the DB World "premium glass" look.
 * Promoted out of the vault so any feature (weather, …) reuses the same
 * language: a drifting aurora background + gradient-glass panels.
 */
import React, { memo } from 'react';
import { Box } from '@mui/material';
import { useT } from '@shared/theme';

// Subtle NEUTRAL depth (no colour): a soft light source at the top plus a gentle
// edge vignette, so glass cards keep some depth without sitting on flat black/white.
// Fixed + pointer-events:none so it stays behind content. (Replaced the old
// drifting teal/violet aurora at the user's request.)
export const Aurora = memo(() => {
  const T = useT();
  const dark = T.bg === '#000000';
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: dark
          ? [
              'radial-gradient(120% 75% at 50% -12%, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0) 55%)',
              'radial-gradient(120% 90% at 50% 118%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)',
            ].join(', ')
          : [
              'radial-gradient(120% 75% at 50% -12%, rgba(15,23,42,0.05) 0%, rgba(15,23,42,0) 55%)',
              'radial-gradient(120% 90% at 50% 120%, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0) 55%)',
            ].join(', '),
      }}
    />
  );
});
Aurora.displayName = 'Aurora';

// Gradient-border glass surface. `hover` adds a teal lift.
export const GlassPanel = ({ children, sx = {}, hover = false, ...rest }) => {
  const T = useT();
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: T.glass,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${T.glassBorder}`,
        borderRadius: 4,
        boxShadow: T.bg === '#000000'
          ? '0 24px 70px rgba(0,0,0,0.45)'
          : '0 20px 55px rgba(15,23,42,0.10)',
        transition: 'border-color .25s ease, box-shadow .25s ease, transform .25s ease',
        ...(hover && {
          cursor: 'pointer',
          '&:hover': {
            borderColor: T.glassBorderHover,
            boxShadow: `0 0 0 1px ${T.tealBg}, 0 26px 80px ${T.tealGlow}`,
          },
        }),
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
};
