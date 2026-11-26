import React from 'react';
import { alpha, Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { useT } from '@shared/theme';
import { formatBytes as fmtBytes } from '../utils/format';
import { PIPELINE, STEP_CFG } from './jobCardConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────

export function MetaChip({ icon, label, color = 'default', outlined = true }) {
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      color={color}
      variant={outlined ? 'outlined' : 'filled'}
      sx={{
        borderRadius: 999,
        fontSize: '0.68rem',
        fontWeight: 700,
        height: 23,
        '& .MuiChip-label': {
          px: 0.8,
        },
      }}
    />
  );
}

export function ProgressInfo({ left, right }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="baseline"
      spacing={1}
      mb={0.35}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.7rem', minWidth: 0 }}
      >
        {left}
      </Typography>

      {right ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {right}
        </Typography>
      ) : null}
    </Stack>
  );
}

// Downloaded / Total / Speed / ETA grid — the same at-a-glance readout as the Download Center card.
export function TransferStats({ downloaded, total, speed, eta, isSmDown }) {
  const T = useT();
  const cells = [
    ['Downloaded', fmtBytes(downloaded)],
    ['Total', Number(total) > 0 ? fmtBytes(total) : '—'],
    ['Speed', speed || '—'],
    ['ETA', eta || '—'],
  ];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: isSmDown ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
        gap: 0.6,
        mt: 0.75,
      }}
    >
      {cells.map(([label, value]) => (
        <Box key={label} sx={{ px: 0.85, py: 0.5, borderRadius: 1.5, bgcolor: alpha(T.text, 0.04),
          border: `1px solid ${T.border}`, minWidth: 0 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
            color: T.textMuted }}>
            {label}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 800, color: T.text,
            fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function StageBar({ step, status }) {
  const T = useT();
  const idx = PIPELINE.indexOf(step);
  const done = status === 'SUCCESS';
  const failed = ['FAILED', 'CANCELLED'].includes(status);

  return (
    <Stack direction="row" spacing={0.45} sx={{ my: 0.75 }}>
      {PIPELINE.map((stage, i) => {
        const active = stage === step && !done && !failed;
        const past = i < idx || done;
        const isFail = failed && stage === step;

        return (
          <Tooltip key={stage} title={STEP_CFG[stage]?.label ?? stage} placement="top">
            <Box
              sx={{
                height: 4,
                flex: 1,
                borderRadius: 999,
                bgcolor: isFail
                  ? T.error
                  : past
                    ? T.success
                    : active
                      ? T.teal
                      : alpha(T.text, 0.12),
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {active ? (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(90deg, transparent 0%, ${alpha(
                      T.teal,
                      0.9
                    )} 50%, transparent 100%)`,
                    animation: 'jobcard_shimmer 1.35s infinite linear',
                    '@keyframes jobcard_shimmer': {
                      '0%': { transform: 'translateX(-100%)' },
                      '100%': { transform: 'translateX(200%)' },
                    },
                  }}
                />
              ) : null}
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
}
