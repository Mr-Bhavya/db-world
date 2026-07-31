/**
 * Password Manager — shared visual primitives
 * --------------------------------------------
 * VaultAurora  : drifting multi-layer glow background (reduced-motion aware)
 * StrengthMeter: animated 5-segment strength bar + entropy read-out
 * SecurityRing : SVG conic health ring for the dashboard
 * BackLink     : the shared "Password Manager" back button
 * GlassPanel   : gradient-border glass surface used across screens
 */
import React, { memo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Box, Button, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { Aurora, GlassPanel } from '@shared/ui/surfaces';
import { scorePassword, STRENGTH_LEVELS } from './passwordUtils';

// Aurora background + glass panel now live in the shared UI module so weather
// (and other features) share the exact same look. Re-exported here under their
// vault names so the four vault screens keep importing them unchanged.
export const VaultAurora = Aurora;
export { GlassPanel };

// ─────────────────────────────────────────────────────────────────────────────
// StrengthMeter — pass a raw password OR a pre-computed score object.
// ─────────────────────────────────────────────────────────────────────────────
export const StrengthMeter = memo(({ password, score, compact = false }) => {
  const T = useT();
  const s = score ?? scorePassword(password ?? '');
  const filled = s.level; // 0..5
  const active = filled > 0;

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', gap: 0.6, mb: compact ? 0 : 0.75 }}>
        {[1, 2, 3, 4, 5].map((seg) => {
          const on = seg <= filled;
          return (
            <Box
              key={seg}
              component={motion.div}
              initial={false}
              animate={{
                backgroundColor: on ? s.color : T.glassBorder,
                boxShadow: on ? `0 0 10px ${s.glow}` : '0 0 0 rgba(0,0,0,0)',
              }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              sx={{ flex: 1, height: 5, borderRadius: 3 }}
            />
          );
        })}
      </Box>

      {!compact && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
          <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: active ? s.color : T.textFaint, letterSpacing: 0.2 }}>
            {active ? s.label : 'Enter a password'}
          </Typography>
          {active && (
            <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, fontVariantNumeric: 'tabular-nums' }}>
              ~{s.bits} bits
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
});
StrengthMeter.displayName = 'StrengthMeter';

// ─────────────────────────────────────────────────────────────────────────────
// SecurityRing — SVG health ring (0–100). Sweeps in on mount.
// ─────────────────────────────────────────────────────────────────────────────
export const SecurityRing = memo(({ value = 100, size = 132 }) => {
  const T = useT();
  const reduce = useReducedMotion();
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c * (1 - pct / 100);

  const hue =
    pct >= 80 ? '#14b8a6' : pct >= 60 ? '#22c55e' : pct >= 40 ? '#eab308' : pct >= 20 ? '#f97316' : '#ef4444';

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Box component="svg" viewBox="0 0 120 120" sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={hue} />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke={T.glassBorder} strokeWidth="9" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? offset : c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 1.1, ease: 'easeInOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${hue}66)` }}
        />
      </Box>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: 'clamp(1.5rem, 5vw, 1.9rem)', fontWeight: 900, lineHeight: 1, color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
          {pct}
        </Typography>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: T.textMuted, mt: 0.3 }}>
          Health
        </Typography>
      </Box>
    </Box>
  );
});
SecurityRing.displayName = 'SecurityRing';

// ─────────────────────────────────────────────────────────────────────────────
// Reset window scroll on mount — SPA route changes otherwise keep the previous
// page's scroll offset. Scoped to the vault screens on purpose.
// ─────────────────────────────────────────────────────────────────────────────
export const useScrollTop = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);
};

// Go back one entry (matches the hardware/browser back button); fall back to the
// vault hub when there's no in-app history (e.g. a deep link / cold load).
export const goBackOr = (navigate) => {
  if (window.history.length > 1) navigate(-1);
  else navigate(Constants.DB_PASSWORD_MANAGER_ROUTE);
};

// ─────────────────────────────────────────────────────────────────────────────
// BackLink — history-aware back button.
// ─────────────────────────────────────────────────────────────────────────────
export const BackLink = ({ label = 'Back' }) => {
  const T = useT();
  const navigate = useNavigate();
  return (
    <Button
      startIcon={<ArrowBack />}
      onClick={() => goBackOr(navigate)}
      sx={{
        color: T.textMuted,
        fontWeight: 700,
        px: 1,
        minHeight: 44,
        borderRadius: 2,
        '&:hover': { color: T.teal, bgcolor: T.tealBg },
      }}
    >
      {label}
    </Button>
  );
};

export { STRENGTH_LEVELS };
