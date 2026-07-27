import React, { useMemo } from 'react';
import { Box, Button, Chip, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';

import { useIpos } from '@features/ipo/hooks/useIpo';
import { computeQuickStats } from '@features/ipo/utils/format';

/** One figure in the live-snapshot strip (big value over a small caption). Shows a skeleton while
 * the IPO list is still loading so the strip doesn't pop in with zeros first. */
function Stat({ T, value, label, valueColor, loading }) {
  return (
    <Box sx={{ minWidth: 0, flex: 1, textAlign: 'center' }}>
      {loading ? (
        <Skeleton variant="text" width={44} height={30} sx={{ bgcolor: T.glassHover, mx: 'auto' }} />
      ) : (
        <Typography
          sx={{
            color: valueColor ?? T.textPrimary,
            fontWeight: 900,
            fontSize: { lg: '1.5rem', xl: '1.7rem' },
            lineHeight: 1.05,
          }}
        >
          {value}
        </Typography>
      )}
      <Typography
        sx={{
          color: T.textMuted,
          fontSize: '0.68rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mt: 0.4,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/**
 * The hero's featured-app panel for the #1 app (IPO Radar). Pulls the IPO list via the feature's
 * own `useIpos` hook and renders a live snapshot — open / upcoming counts and the top GMP — using
 * the shared, tested `computeQuickStats`. Everything degrades gracefully: while loading it shows
 * skeletons; if the list is empty or the fetch fails it drops the stats strip and shows the app's
 * description instead, so the panel always looks intentional. All surfaces are `useT()` tokens
 * (light/dark safe); the app's emerald accent drives the icon, glow and CTA.
 */
export default function IpoSpotlight({ T, app, onOpen }) {
  // useIpos resolves to an IpoListResponse ({ ipos, lastUpdated }) — the array is under `.ipos`
  // (same as IpoListPage), NOT the response object itself. Depend on the stable query ref `list`
  // (not an inline `?? []`, which would be a fresh array each render → useMemo churn).
  const { data, isLoading, isError } = useIpos();
  const list = data?.ipos;
  const { openCount, upcomingCount, topGmp } = useMemo(() => computeQuickStats(list), [list]);

  const Icon = app.Icon;
  const hasData = !isError && Array.isArray(list) && list.length > 0;
  const showStats = hasData || isLoading;
  const fmtPct = (p) => `${p > 0 ? '+' : ''}${Number(p).toFixed(1)}%`;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: { lg: 2.6, xl: 3.2 },
        borderRadius: { lg: 4, xl: 5 },
        border: `1px solid ${T.glassBorder}`,
        bgcolor: T.glass,
        backdropFilter: 'blur(18px)',
        boxShadow: `0 24px 80px ${app.accent}22`,
        minWidth: 0,
      }}
    >
      {/* Soft accent bloom in the corner for depth */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: -70,
          right: -70,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: app.gradient,
          opacity: 0.16,
          filter: 'blur(26px)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.6, mb: 2.2 }}>
        <Box
          sx={{
            width: { lg: 54, xl: 62 },
            height: { lg: 54, xl: 62 },
            borderRadius: 2.4,
            background: app.gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 12px 28px ${app.accent}55`,
          }}
        >
          <Icon sx={{ color: '#fff', fontSize: { lg: 28, xl: 34 } }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.3 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: app.accent, boxShadow: `0 0 10px ${app.accent}` }} />
            <Typography sx={{ color: T.textMuted, fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              Featured
            </Typography>
          </Box>
          <Typography sx={{ color: T.textPrimary, fontWeight: 950, fontSize: { lg: '1.4rem', xl: '1.6rem' }, lineHeight: 1.05 }}>
            {app.label}
          </Typography>
        </Box>
      </Box>

      {showStats ? (
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2.2,
            py: 1.6,
            px: 2,
            borderRadius: 3,
            bgcolor: T.glassHover,
            border: `1px solid ${T.glassBorder}`,
          }}
        >
          <Stat T={T} loading={isLoading} value={openCount} label="Open now" valueColor={app.accent} />
          <Box sx={{ alignSelf: 'stretch', width: '1px', bgcolor: T.glassBorder }} />
          <Stat T={T} loading={isLoading} value={upcomingCount} label="Upcoming" />
          <Box sx={{ alignSelf: 'stretch', width: '1px', bgcolor: T.glassBorder }} />
          <Stat
            T={T}
            loading={isLoading}
            value={topGmp ? fmtPct(topGmp.gmpPct) : '—'}
            label="Top GMP"
            valueColor={topGmp ? (topGmp.gmpPct >= 0 ? T.success : T.error) : T.textMuted}
          />
        </Box>
      ) : (
        <Typography sx={{ position: 'relative', color: T.textMuted, fontSize: '0.98rem', lineHeight: 1.6, mb: 2.2 }}>
          {app.description}
        </Typography>
      )}

      {app.highlights?.length > 0 && (
        <Box sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.2 }}>
          {app.highlights.map((h) => (
            <Chip
              key={h}
              label={h}
              size="small"
              sx={{
                height: 24,
                fontSize: '0.72rem',
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

      <Button
        fullWidth
        variant="contained"
        onClick={onOpen}
        endIcon={<ArrowForwardIcon />}
        sx={{
          position: 'relative',
          bgcolor: app.accent,
          color: '#fff',
          borderRadius: 2.2,
          py: 1.25,
          fontWeight: 900,
          fontSize: '1rem',
          textTransform: 'none',
          boxShadow: `0 0 22px ${app.accent}44`,
          '&:hover': { bgcolor: app.accent, filter: 'brightness(1.08)', boxShadow: `0 0 30px ${app.accent}66` },
        }}
      >
        Open {app.label}
      </Button>
    </Box>
  );
}
