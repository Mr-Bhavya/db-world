import React, { useMemo } from 'react';
import {
  alpha,
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Close, Replay } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';

import IngestionForm from '../form/IngestionForm';
import { getJobParams } from '../services/ingestionApi';

/**
 * Map the backend {@code JobParamsDto} snapshot onto the ingestion form's value shape.
 * Secrets (URL / archive passwords) are never returned, so those fields start blank.
 */
function paramsToFormValues(p) {
  if (!p) return null;
  return {
    urls: [
      {
        url: p.uri || '',
        customName: p.fileName || '',
        rename: !!p.rename,
        episode: null,
      },
    ],
    record: p.record || null,
    season: p.season ?? null,
    episode: p.episode ?? null,
    username: p.username || '',
    password: '',
    useAuth: !!p.urlProtected,
    extract: !!p.extract,
    zipPwd: '',
    audioOnly: !!p.onlyAudio,
    videoITag: p.videoITag ?? null,
    audioITag: p.audioITag ?? null,
    videoQuality: p.videoQuality || 'best',
  };
}

/**
 * Rerun-with-edit: fetch a finished/active job's original request, pre-fill the
 * ingestion form in a dialog, and let the user tweak it before starting a fresh job.
 */
export default function RerunEditDialog({ jobId, open, onClose }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ingestion-job-params', jobId],
    queryFn: () => getJobParams(jobId).then((r) => r),
    enabled: !!open && !!jobId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const params = data?.data ?? null;
  const initialValues = useMemo(() => paramsToFormValues(params), [params]);

  const errorMessage =
    (isError && (error?.response?.data?.message || 'Failed to load job params')) ||
    (data && data.httpStatusCode >= 400 && data.message) ||
    null;

  return (
    <Dialog
      open={!!open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3 } }}
    >
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
            <Replay fontSize="small" />
          </Box>
          <Box minWidth={0}>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.15}>
              Rerun with edits
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tweak the settings below, then start a fresh job.
            </Typography>
          </Box>
        </Stack>

        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 12, right: 12 }}
        >
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }} spacing={1.5}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Loading job settings…
            </Typography>
          </Stack>
        ) : errorMessage ? (
          <Alert severity="error" sx={{ borderRadius: 2.5 }}>
            {errorMessage}
          </Alert>
        ) : initialValues ? (
          <IngestionForm
            key={jobId}
            dialogMode
            initialValues={initialValues}
            onCancel={onClose}
            onSubmitted={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
