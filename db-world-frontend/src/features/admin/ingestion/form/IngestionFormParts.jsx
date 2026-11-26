import React from 'react';
import { alpha, Box, Chip, Collapse, Paper, Stack, Switch, Typography } from '@mui/material';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { sourceLabel } from './UrlDetector';

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getSourceColors(T, type) {
  switch (type) {
    case 'youtube':
      return {
        color: T.error,
        bg: alpha(T.error, 0.1),
        border: alpha(T.error, 0.28),
      };
    case 'ytdlp':
      return {
        color: T.warning,
        bg: alpha(T.warning, 0.1),
        border: alpha(T.warning, 0.28),
      };
    case 'magnet':
      return {
        color: '#9c27b0',
        bg: alpha('#9c27b0', 0.1),
        border: alpha('#9c27b0', 0.28),
      };
    case 'torrent':
      return {
        color: '#0288d1',
        bg: alpha('#0288d1', 0.1),
        border: alpha('#0288d1', 0.28),
      };
    case 'http':
      return {
        color: T.success,
        bg: alpha(T.success, 0.1),
        border: alpha(T.success, 0.28),
      };
    default:
      return {
        color: T.textMuted,
        bg: alpha(T.textFaint, 0.08),
        border: alpha(T.textFaint, 0.15),
      };
  }
}

export function SourceBadge({ type }) {
  const T = useT();
  if (!type || type === 'unknown') return null;

  const colors = getSourceColors(T, type);

  return (
    <Chip
      label={sourceLabel(type)}
      size="small"
      sx={{
        bgcolor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        fontWeight: 700,
        fontSize: '0.72rem',
        height: 24,
        borderRadius: 999,
      }}
    />
  );
}

export function SectionCard({ title, subtitle, icon, action, children, sx = {} }) {
  const T = useT();
  const S = adminSurface(T);

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderColor: S.border,
        bgcolor: S.card,
        boxShadow: 'none',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box
        sx={{
          px: { xs: 1.25, sm: 1.75, md: 2 },
          py: { xs: 1.25, sm: 1.5 },
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={1.25}
          mb={children ? 1.25 : 0}
        >
          <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
            <Box
              sx={{
                width: { xs: 34, sm: 38 },
                height: { xs: 34, sm: 38 },
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: T.tealBg,
                color: T.teal,
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>

            <Box minWidth={0}>
              <Typography
                variant="subtitle1"
                fontWeight={800}
                lineHeight={1.15}
                sx={{ fontSize: { xs: '0.97rem', sm: '1rem' } }}
              >
                {title}
              </Typography>
              {subtitle ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.25, lineHeight: 1.3 }}
                >
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          {action ? <Box flexShrink={0}>{action}</Box> : null}
        </Stack>

        {children}
      </Box>
    </Paper>
  );
}

export function OptionTile({ icon, title, subtitle, checked, onChange, children }) {
  const T = useT();
  const S = adminSurface(T);

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        px: 1.25,
        py: 1.1,
        borderColor: checked ? T.teal : S.border,
        bgcolor: checked ? T.tealBg : S.card,
        transition: 'border-color .2s ease, background-color .2s ease',
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={0.75}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: T.tealBg,
                color: T.teal,
              }}
            >
              {icon}
            </Box>

            <Box>
              <Typography variant="body2" fontWeight={700}>
                {title}
              </Typography>
              {subtitle ? (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          <Switch checked={checked} onChange={onChange} size="small" />
        </Stack>

        <Collapse in={checked}>{children}</Collapse>
      </Stack>
    </Paper>
  );
}
