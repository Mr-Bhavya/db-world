import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Cancel,
  Delete,
  Pause,
  PlayArrow,
  Replay,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';
import {
  pauseJob,
  resumeJob,
  cancelJob,
  rerunJob,
  deleteJob,
} from '../services/ingestionApi';

const TERMINAL = ['SUCCESS', 'FAILED', 'CANCELLED'];

function DesktopActionButton({
  title,
  colorKey,
  icon,
  onClick,
  disabled,
  loading,
  subtle = false,
}) {
  const theme = useTheme();

  const paletteColor = useMemo(() => {
    switch (colorKey) {
      case 'success':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'primary':
        return theme.palette.primary.main;
      default:
        return theme.palette.text.secondary;
    }
  }, [colorKey, theme]);

  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={{
            width: 30,
            height: 30,
            borderRadius: 2,
            color: paletteColor,
            border: `1px solid ${alpha(paletteColor, subtle ? 0.14 : 0.22)}`,
            bgcolor: alpha(paletteColor, subtle ? 0.04 : 0.08),
            transition: 'all 0.18s ease',
            '&:hover': {
              bgcolor: alpha(paletteColor, 0.14),
              borderColor: alpha(paletteColor, 0.3),
            },
            '&.Mui-disabled': {
              opacity: 0.55,
            },
          }}
        >
          {loading ? <CircularProgress size={14} color="inherit" /> : icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function MobileActionButton({
  label,
  colorKey,
  icon,
  onClick,
  disabled,
  loading,
  subtle = false,
  compact = false,
}) {
  const theme = useTheme();

  const paletteColor = useMemo(() => {
    switch (colorKey) {
      case 'success':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'primary':
        return theme.palette.primary.main;
      default:
        return theme.palette.text.secondary;
    }
  }, [colorKey, theme]);

  if (compact) {
    return (
      <Tooltip title={label}>
        <span>
          <IconButton
            size="small"
            onClick={onClick}
            disabled={disabled}
            sx={{
              width: 28,
              height: 28,
              borderRadius: 2,
              color: paletteColor,
              border: `1px solid ${alpha(paletteColor, subtle ? 0.14 : 0.22)}`,
              bgcolor: alpha(paletteColor, subtle ? 0.04 : 0.08),
              '&:hover': {
                bgcolor: alpha(paletteColor, 0.12),
              },
            }}
          >
            {loading ? <CircularProgress size={13} color="inherit" /> : icon}
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Button
      size="small"
      variant="text"
      startIcon={loading ? <CircularProgress size={12} color="inherit" /> : icon}
      onClick={onClick}
      disabled={disabled}
      sx={{
        minWidth: 0,
        px: 0.9,
        py: 0.35,
        borderRadius: 999,
        color: paletteColor,
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'none',
        bgcolor: subtle ? 'transparent' : alpha(paletteColor, 0.06),
        '&:hover': {
          bgcolor: alpha(paletteColor, 0.1),
        },
      }}
    >
      {label}
    </Button>
  );
}

function JobActionsComponent({ job, layout = 'desktop', compactMobile = false }) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);

  const status = job.status;
  const sourceType = job.sourceType;

  const isYt = sourceType === 'YOUTUBE' || sourceType === 'LOCAL';
  const isTerminal = TERMINAL.includes(status);
  const isPaused = status === 'PAUSED';
  const isActive = !isTerminal && !isPaused;

  const invalidateHistory = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['ingestion-history'] });
  }, [qc]);

  const act = useCallback(
    async (name, fn) => {
      setBusy(name);
      try {
        const res = await fn();

        if (res?.httpStatusCode >= 400) {
          enqueueSnackbar(res?.message || `${name} failed`, {
            variant: 'warning',
          });
        } else {
          enqueueSnackbar(res?.message || `${name} completed`, {
            variant: 'success',
          });
          invalidateHistory();
        }
      } catch (e) {
        enqueueSnackbar(
          e?.response?.data?.message ?? `${name} failed`,
          { variant: 'error' }
        );
      } finally {
        setBusy(null);
      }
    },
    [enqueueSnackbar, invalidateHistory]
  );

  const actions = useMemo(() => {
    const list = [];

    if (isActive && !isYt) {
      list.push({
        key: 'Pause',
        label: 'Pause',
        colorKey: 'warning',
        icon: <Pause fontSize="small" />,
        onClick: () => act('Pause', () => pauseJob(job.jobId)),
      });
    }

    if (isPaused) {
      list.push({
        key: 'Resume',
        label: 'Resume',
        colorKey: 'success',
        icon: <PlayArrow fontSize="small" />,
        onClick: () => act('Resume', () => resumeJob(job.jobId)),
      });
    }

    if (!isTerminal) {
      list.push({
        key: 'Cancel',
        label: 'Cancel',
        colorKey: 'error',
        icon: <Cancel fontSize="small" />,
        onClick: () => act('Cancel', () => cancelJob(job.jobId)),
      });
    }

    if (isTerminal) {
      list.push({
        key: 'Rerun',
        label: 'Rerun',
        colorKey: 'primary',
        icon: <Replay fontSize="small" />,
        onClick: () => act('Rerun', () => rerunJob(job.jobId)),
      });
    }

    list.push({
      key: 'Delete',
      label: 'Delete',
      colorKey: 'error',
      icon: <Delete fontSize="small" />,
      onClick: () => act('Delete', () => deleteJob(job.jobId)),
      subtle: true,
    });

    return list;
  }, [isActive, isYt, isPaused, isTerminal, act, job.jobId]);

  if (layout === 'mobile') {
    return (
      <Stack direction="row" spacing={0.4} alignItems="center" flexShrink={0}>
        {actions.map((action) => (
          <MobileActionButton
            key={action.key}
            label={action.label}
            colorKey={action.colorKey}
            icon={action.icon}
            onClick={action.onClick}
            disabled={!!busy}
            loading={busy === action.key}
            subtle={action.subtle}
            compact={compactMobile}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={0.35} alignItems="center">
      {actions.map((action) => (
        <DesktopActionButton
          key={action.key}
          title={action.label}
          colorKey={action.colorKey}
          icon={action.icon}
          onClick={action.onClick}
          disabled={!!busy}
          loading={busy === action.key}
          subtle={action.subtle}
        />
      ))}
    </Stack>
  );
}

const JobActions = memo(JobActionsComponent);
export default JobActions;