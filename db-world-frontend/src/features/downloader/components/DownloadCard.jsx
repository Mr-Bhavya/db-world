import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Alert, Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { ImageNotSupported } from '@mui/icons-material';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi/theme';
import { formatBytes, formatEta } from '../downloaderApi';
import { transferStats } from '../downloadCenterModel';

// Tokens like teal/warning are tuned for black; on white they fall under 4.5:1 for small text.
const LIGHT_TEXT_TONES = {
  teal: '#0f766e', success: '#047857', warning: '#b45309', info: '#0369a1', error: '#b91c1c',
};

function surfaceFor(T, surface) {
  if (surface === 'admin') {
    const S = adminSurface(T);
    return { card: S.card, cardHover: S.cardHover, border: S.border, borderHover: T.bg === '#000000' ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.20)', inset: S.inset };
  }
  return { card: T.glass, cardHover: T.glassHover, border: T.glassBorder, borderHover: T.borderHover, inset: T.hoverBg };
}

function Stat({ label, value, inset, T }) {
  return (
    <Box sx={{ minWidth: 0, px: 1.25, py: 1, borderRadius: 2, bgcolor: inset }}>
      <Typography component="dt" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: T.textMuted }}>{label}</Typography>
      <Typography component="dd" sx={{ m: 0, mt: 0.25, fontSize: 15, fontWeight: 750, color: T.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Typography>
    </Box>
  );
}

function TransferPanel({ progress, title, tone, inset, T }) {
  const stats = transferStats(progress);
  const hasNumbers = stats.downloaded > 0 || stats.total != null || stats.speed != null;
  const determinate = !progress.indeterminate && stats.percent != null;
  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1} sx={{ mb: 0.75 }}>
        <Box sx={{ minWidth: 0 }} aria-live="polite">
          {determinate ? (
            <Typography component="span" sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: tone, fontVariantNumeric: 'tabular-nums' }}>{stats.percent}%</Typography>
          ) : (
            <Typography component="span" sx={{ fontSize: 14, fontWeight: 700, color: tone }}>{progress.message || 'Preparing…'}</Typography>
          )}
          {determinate && stats.remaining != null && (
            <Typography component="span" sx={{ ml: 1, fontSize: 13, color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>{formatBytes(stats.remaining) === '--' ? 'Finishing…' : `${formatBytes(stats.remaining)} left`}</Typography>
          )}
        </Box>
        {determinate && stats.eta != null && (
          <Typography sx={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{formatEta(stats.eta)} left</Typography>
        )}
      </Stack>
      <LinearProgress
        variant={determinate ? 'determinate' : 'indeterminate'}
        value={stats.percent ?? 0}
        aria-label={`${title || 'Download'} progress`}
        aria-valuetext={determinate ? `${stats.percent}%` : progress.message || 'In progress'}
        sx={{ height: 8, borderRadius: 5, bgcolor: inset, '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: tone } }}
      />
      {determinate && !!progress.message && <Typography sx={{ mt: 0.75, fontSize: 12, color: T.textMuted }}>{progress.message}</Typography>}
      {hasNumbers && (
        <Box component="dl" sx={{ m: 0, mt: 1.25, display: 'grid', gap: 0.75, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: `repeat(${determinate ? 4 : 2}, minmax(0, 1fr))` } }}>
          <Stat T={T} inset={inset} label="Downloaded" value={stats.downloaded != null ? formatBytes(stats.downloaded) : '--'} />
          <Stat T={T} inset={inset} label="Total size" value={stats.total != null ? formatBytes(stats.total) : 'Calculating…'} />
          {determinate && <Stat T={T} inset={inset} label="Speed" value={stats.speed != null ? `${formatBytes(stats.speed)}/s` : progress.paused ? 'Paused' : 'Waiting…'} />}
          {determinate && <Stat T={T} inset={inset} label="Time left" value={stats.eta != null ? formatEta(stats.eta) : '--'} />}
        </Box>
      )}
    </Box>
  );
}

export default function DownloadCard({
  title, subtitle, thumbnail, statusLabel, statusIcon: StatusIcon, tone = 'teal', toneBg = 'tealBg',
  progress, detail, error, selection, actions, children, surface = 'glass', compact = false,
}) {
  const T = useT();
  const reduce = useReducedMotion();
  const light = T.bg !== '#000000';
  const look = surfaceFor(T, surface);
  const toneColor = (light && LIGHT_TEXT_TONES[tone]) || T[tone] || T.teal;
  const toneSurface = T[toneBg] || look.inset;
  return (
    <Box
      component={motion.article}
      initial={reduce ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.18 }}
      sx={{
        minWidth: 0, p: compact ? { xs: 1.1, sm: 1.35 } : { xs: 1.5, sm: 2 }, borderRadius: compact ? 2.5 : 3,
        border: `1px solid ${look.border}`, bgcolor: look.card,
        transition: 'border-color 180ms ease, background-color 180ms ease',
        '&:hover': { borderColor: look.borderHover, bgcolor: look.cardHover },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Stack direction="row" alignItems="flex-start" gap={{ xs: 1, sm: 1.5 }}>
        {selection && <Box sx={{ flexShrink: 0, mt: -0.75 }}>{selection}</Box>}
        {thumbnail ? (
          <Box component="img" src={thumbnail} alt="" loading="lazy" sx={{ width: compact ? { xs: 52, sm: 64 } : { xs: 64, sm: 88 }, height: compact ? { xs: 38, sm: 44 } : { xs: 44, sm: 56 }, flexShrink: 0, objectFit: 'cover', borderRadius: 1.5, bgcolor: look.inset }} />
        ) : (
          <Box aria-hidden="true" sx={{ width: compact ? { xs: 52, sm: 64 } : { xs: 64, sm: 88 }, height: compact ? { xs: 38, sm: 44 } : { xs: 44, sm: 56 }, flexShrink: 0, borderRadius: 1.5, bgcolor: look.inset, color: T.textMuted, display: 'grid', placeItems: 'center' }}>
            <ImageNotSupported sx={{ fontSize: 20 }} />
          </Box>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 750, fontSize: compact ? 14 : undefined, lineHeight: 1.3, overflowWrap: 'anywhere', color: T.text }}>
            {title || 'Download'}
          </Typography>
          {!!subtitle && <Typography sx={{ mt: compact ? 0.2 : 0.4, fontSize: compact ? 11 : 12, color: T.textMuted, overflowWrap: 'anywhere' }}>{subtitle}</Typography>}
          <Chip
            icon={StatusIcon ? <StatusIcon sx={{ color: `${toneColor} !important` }} /> : undefined}
            label={statusLabel}
            size="small"
            sx={{
              mt: compact ? 0.65 : 1, height: compact ? 24 : undefined, maxWidth: '100%', bgcolor: toneSurface, color: toneColor, fontWeight: 700,
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
            }}
          />
        </Box>
      </Stack>
      {progress && <TransferPanel progress={progress} title={title} tone={toneColor} inset={look.inset} T={T} />}
      {detail}
      {error && <Alert severity="error" sx={{ mt: 1.25, overflowWrap: 'anywhere' }}>{error}</Alert>}
      {children}
      {!!actions && (
        <Stack
          direction="row" gap={0.75} flexWrap="wrap" justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
          sx={{ mt: compact ? 0.85 : 1.25, '& .MuiButton-root, & .MuiIconButton-root': { minHeight: compact ? 38 : 44 }, '& .MuiIconButton-root': { minWidth: compact ? 38 : 44 }, '& .MuiButton-root:focus-visible, & .MuiIconButton-root:focus-visible': { outline: `3px solid ${T.teal}`, outlineOffset: 2 } }}
        >
          {actions}
        </Stack>
      )}
    </Box>
  );
}
