import React, { useState } from 'react';
import { IconButton, Tooltip, CircularProgress, Stack } from '@mui/material';
import {
  Pause, PlayArrow, Cancel, Replay, Delete,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';
import {
  pauseJob, resumeJob, cancelJob, rerunJob, deleteJob,
} from '../services/ingestionApi';

const TERMINAL = ['SUCCESS', 'FAILED', 'CANCELLED'];

export default function JobActions({ job }) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null); // which action is loading

  const status     = job.status;
  const sourceType = job.sourceType;
  const isYt       = sourceType === 'YOUTUBE' || sourceType === 'LOCAL';
  const isTerminal = TERMINAL.includes(status);
  const isPaused   = status === 'PAUSED';
  const isActive   = !isTerminal && !isPaused;

  async function act(name, fn) {
    setBusy(name);
    try {
      const res = await fn();
      if (res.httpStatusCode >= 400) {
        enqueueSnackbar(res.message || `${name} failed`, { variant: 'warning' });
      } else {
        enqueueSnackbar(res.message || `${name} OK`, { variant: 'success' });
        qc.invalidateQueries({ queryKey: ['ingestion-history'] });
      }
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? `${name} failed`, { variant: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Stack direction="row" spacing={0.25} alignItems="center">

      {/* Pause — only for active non-YT jobs */}
      {isActive && !isYt && (
        <Tooltip title="Pause">
          <span>
            <IconButton
              size="small"
              onClick={() => act('Pause', () => pauseJob(job.jobId))}
              disabled={!!busy}
            >
              {busy === 'Pause' ? <CircularProgress size={14} /> : <Pause fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      )}

      {/* Resume — only for paused jobs */}
      {isPaused && (
        <Tooltip title="Resume">
          <span>
            <IconButton
              size="small"
              color="success"
              onClick={() => act('Resume', () => resumeJob(job.jobId))}
              disabled={!!busy}
            >
              {busy === 'Resume' ? <CircularProgress size={14} /> : <PlayArrow fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      )}

      {/* Cancel — for active/paused jobs */}
      {!isTerminal && (
        <Tooltip title="Cancel">
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => act('Cancel', () => cancelJob(job.jobId))}
              disabled={!!busy}
            >
              {busy === 'Cancel' ? <CircularProgress size={14} /> : <Cancel fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      )}

      {/* Rerun — for terminal jobs */}
      {isTerminal && (
        <Tooltip title="Rerun">
          <span>
            <IconButton
              size="small"
              color="primary"
              onClick={() => act('Rerun', () => rerunJob(job.jobId))}
              disabled={!!busy}
            >
              {busy === 'Rerun' ? <CircularProgress size={14} /> : <Replay fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      )}

      {/* Delete */}
      <Tooltip title="Delete">
        <span>
          <IconButton
            size="small"
            color="error"
            onClick={() => act('Delete', () => deleteJob(job.jobId))}
            disabled={!!busy}
          >
            {busy === 'Delete' ? <CircularProgress size={14} /> : <Delete fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>

    </Stack>
  );
}
