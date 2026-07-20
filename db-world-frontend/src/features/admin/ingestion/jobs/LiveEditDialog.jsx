import React, { useEffect, useState } from 'react';
import {
  alpha,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Close, Save, Tv } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { notify } from '@shared/notify';

import { getJobParams, editJobParams } from '../services/ingestionApi';

/**
 * Live-edit safe fields (season/episode) on a still-running job. The edit is applied to the
 * in-memory request and takes effect when the pipeline reaches the processing stage — so it's
 * only useful before processing starts (e.g. while downloading).
 */
export default function LiveEditDialog({ jobId, open, onClose, onSaved }) {
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ingestion-job-params', jobId],
    queryFn: () => getJobParams(jobId).then((r) => r),
    enabled: !!open && !!jobId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const params = data?.data ?? null;

  // Seed the inputs once params arrive.
  useEffect(() => {
    if (params) {
      setSeason(params.season != null ? String(params.season) : '');
      setEpisode(params.episode != null ? String(params.episode) : '');
    }
  }, [params]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        season: season === '' ? null : Number(season),
        episode: episode === '' ? null : Number(episode),
      };
      const res = await editJobParams(jobId, body);
      if (res?.httpStatusCode >= 400) {
        notify.warning(res?.message || 'Edit failed');
      } else {
        notify.success('Job updated — applies when processing runs');
        onSaved?.();
        onClose?.();
      }
    } catch (e) {
      notify.error(e?.response?.data?.message ?? 'Edit failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              color: 'primary.main',
              flexShrink: 0,
            }}
          >
            <Tv fontSize="small" />
          </Box>
          <Box minWidth={0}>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.15}>
              Edit running job
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Season / episode — applied when processing runs.
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', top: 12, right: 12 }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 4 }} spacing={1.5}>
            <CircularProgress size={26} />
            <Typography variant="body2" color="text.secondary">
              Loading current values…
            </Typography>
          </Stack>
        ) : isError ? (
          <Alert severity="error" sx={{ borderRadius: 2.5 }}>
            Failed to load current job settings.
          </Alert>
        ) : (
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Alert severity="info" sx={{ borderRadius: 2.5 }}>
              Only affects TV episode naming and the target folder. Best set before processing begins.
            </Alert>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Season"
                type="number"
                size="small"
                fullWidth
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                inputProps={{ min: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Tv sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Episode"
                type="number"
                size="small"
                fullWidth
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                inputProps={{ min: 1 }}
              />
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: 999 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || isLoading || isError}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ borderRadius: 999, fontWeight: 700 }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
