import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Paper, Stack, TextField, Typography,
  Alert, CircularProgress, Chip, Divider, useTheme, alpha,
} from '@mui/material';
import { FolderOpen, Send, Clear, InsertDriveFile } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import RecordSearch from '../form/RecordSearch';
import FileBrowserDialog from './FileBrowserDialog';
import { linkExistingFile } from '../services/ingestionApi';
import useIngestionStore from '../store/ingestionStore';

const schema = z.object({
  localFilePath: z.string().min(1, 'Select a file first'),
  record:        z.any().optional().nullable(),
  season:        z.coerce.number().int().positive().optional().nullable(),
  episode:       z.coerce.number().int().positive().optional().nullable(),
});

/**
 * Form to run the ingestion pipeline on a file already on the server.
 * Skips the download step — runs MEDIAINFO + FFMPEG + saves to DB.
 *
 * The plan for unassigned files:
 *   - Files ingested without a record are saved with record_id = null
 *   - They appear in the "Unassigned Files" tab (searchable by filename)
 *   - Users can link them later via "Link to Record" on each card
 *   - They are downloadable via the same /api/stream/{mediaFileId} endpoint
 */
export default function LinkFileForm() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);
  const [browserOpen, setBrowserOpen] = useState(false);

  const { control, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(schema),
      defaultValues: {
        localFilePath: '',
        record:        null,
        season:        '',
        episode:       '',
      },
    });

  const localFilePath = watch('localFilePath');
  const record        = watch('record');
  const isTvRecord    = record?.type === 'TV_SERIES';

  const fileName = localFilePath ? localFilePath.split(/[\\/]/).pop() : null;

  const onSubmit = async (data) => {
    const body = {
      localFilePath: data.localFilePath,
      recordId:  data.record?.recordId ?? null,
      season:    data.season  ? Number(data.season)  : null,
      episode:   data.episode ? Number(data.episode) : null,
    };
    try {
      const res = await linkExistingFile(body);
      if (res.httpStatusCode === 200 || res.httpStatusCode === 201) {
        enqueueSnackbar('Processing job started', { variant: 'success' });
        qc.invalidateQueries({ queryKey: ['ingestion-history'] });
        qc.invalidateQueries({ queryKey: ['unassigned-files'] });
        reset();
        setActiveTab(1); // go to live jobs
      } else {
        enqueueSnackbar(res.message || 'Failed to start job', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Network error', { variant: 'error' });
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>

      {/* Info banner */}
      <Alert severity="info" sx={{ mb: 2.5 }}>
        <Typography variant="caption">
          Browse a file already present on the server (stream-path or temp).
          The pipeline will skip download and run <strong>MediaInfo → FFmpeg → DB save → Symlink</strong>.
          If no record is linked, the file will appear in <strong>Unassigned Files</strong> and can be linked later.
        </Typography>
      </Alert>

      <Stack spacing={2.5}>

        {/* File picker */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            Select File
          </Typography>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Controller
              name="localFilePath"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  size="small"
                  placeholder="/path/to/file.mkv"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    startAdornment: fileName ? (
                      <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                        <InsertDriveFile sx={{ fontSize: 16, color: 'text.secondary' }} />
                      </Box>
                    ) : undefined,
                    readOnly: true,
                  }}
                  onClick={() => setBrowserOpen(true)}
                  sx={{ cursor: 'pointer' }}
                />
              )}
            />
            <Button
              variant="outlined"
              startIcon={<FolderOpen />}
              onClick={() => setBrowserOpen(true)}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Browse
            </Button>
          </Stack>

          {fileName && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                <InsertDriveFile sx={{ fontSize: 16, color: 'primary.main' }} />
                <Typography variant="caption" color="primary.main" fontWeight={600}>
                  {fileName}
                </Typography>
                <Chip
                  label={fileName.split('.').pop()?.toUpperCase()}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 18 }}
                />
              </Stack>
            </motion.div>
          )}
        </Box>

        <Divider />

        {/* Record */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            Link to Record (optional)
          </Typography>
          <Controller
            name="record"
            control={control}
            render={({ field }) => (
              <RecordSearch value={field.value} onChange={field.onChange} />
            )}
          />
          {!record && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              If left empty the file will be saved as "unassigned" and can be linked later.
            </Typography>
          )}

          {isTvRecord && (
            <Stack direction="row" spacing={1.5} mt={1.5}>
              <Controller
                name="season"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Season"
                    size="small"
                    type="number"
                    inputProps={{ min: 1 }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    sx={{ width: 120 }}
                  />
                )}
              />
              <Controller
                name="episode"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Episode"
                    size="small"
                    type="number"
                    inputProps={{ min: 1 }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    sx={{ width: 120 }}
                  />
                )}
              />
            </Stack>
          )}
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" startIcon={<Clear />} onClick={() => reset()} disabled={isSubmitting}>
            Clear
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <Send />}
            disabled={isSubmitting || !localFilePath}
          >
            {isSubmitting ? 'Starting…' : 'Process File'}
          </Button>
        </Stack>
      </Stack>

      <FileBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        title="Select file to process"
        onSelect={(item) => {
          setValue('localFilePath', item.path);
          setBrowserOpen(false);
        }}
      />
    </Box>
  );
}
