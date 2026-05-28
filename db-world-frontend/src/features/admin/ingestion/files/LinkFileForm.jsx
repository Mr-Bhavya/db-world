import React, { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Stack, TextField, Typography,
  Alert, CircularProgress, Chip, Divider,
  Checkbox, List, ListItem, ListItemIcon,
  ListItemText, ToggleButton, ToggleButtonGroup,
  alpha, Paper,
} from '@mui/material';
import {
  FolderOpen, Send, Clear, InsertDriveFile,
  Folder as FolderIcon, CheckBox, CheckBoxOutlineBlank,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import RecordSearch from '../form/RecordSearch';
import FileBrowserDialog from './FileBrowserDialog';
import { linkExistingFile } from '../services/ingestionApi';
import { useFileBrowser } from '../hooks/useFileBrowser';
import useIngestionStore from '../store/ingestionStore';

// ── Schema (file mode) ─────────────────────────────────────────────────────

const fileSchema = z.object({
  localFilePath: z.string().min(1, 'Select a file first'),
  record:        z.any().optional().nullable(),
  season:        z.coerce.number().int().positive().optional().nullable(),
  episode:       z.coerce.number().int().positive().optional().nullable(),
});

function fmtSize(b) {
  if (!b) return null;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

// ── File mode ──────────────────────────────────────────────────────────────

function FileModeForm({ onDone: _onDone }) {
  const { enqueueSnackbar } = useSnackbar();
  const qc           = useQueryClient();
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);
  const [browserOpen, setBrowserOpen] = useState(false);

  const { control, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } =
    useForm({
      resolver: zodResolver(fileSchema),
      defaultValues: { localFilePath: '', record: null, season: null, episode: null },
    });

  const localFilePath = watch('localFilePath');
  const record        = watch('record');
  const isTvRecord    = record?.type === 'TV_SERIES';
  const fileName      = localFilePath ? localFilePath.split(/[\\/]/).pop() : null;

  const onSubmit = async (data) => {
    try {
      const res = await linkExistingFile({
        localFilePath: data.localFilePath,
        recordId:  data.record?.id ?? null,
        season:    data.season  ? Number(data.season)  : null,
        episode:   data.episode ? Number(data.episode) : null,
      });
      if (res.httpStatusCode === 200 || res.httpStatusCode === 201) {
        enqueueSnackbar('Processing job started', { variant: 'success' });
        qc.invalidateQueries({ queryKey: ['ingestion-history'] });
        qc.invalidateQueries({ queryKey: ['unassigned-files'] });
        reset();
        setActiveTab(1);
      } else {
        enqueueSnackbar(res.message || 'Failed to start job', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Network error', { variant: 'error' });
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2.5}>
        {/* File picker */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>Select File</Typography>
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
            <Button variant="outlined" startIcon={<FolderOpen />} onClick={() => setBrowserOpen(true)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              Browse
            </Button>
          </Stack>

          {fileName && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                <InsertDriveFile sx={{ fontSize: 16, color: 'primary.main' }} />
                <Typography variant="caption" color="primary.main" fontWeight={600}>{fileName}</Typography>
                <Chip label={fileName.split('.').pop()?.toUpperCase()} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
              </Stack>
            </motion.div>
          )}
        </Box>

        <Divider />

        {/* Record */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>Link to Record (optional)</Typography>
          <Controller
            name="record"
            control={control}
            render={({ field }) => <RecordSearch value={field.value} onChange={field.onChange} />}
          />
          {!record && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              If left empty the file will be saved as &quot;unassigned&quot; and can be linked later.
            </Typography>
          )}
          {isTvRecord && (
            <Stack direction="row" spacing={1.5} mt={1.5}>
              <Controller name="season" control={control}
                render={({ field, fieldState }) => (
                  <TextField {...field} value={field.value ?? ''} label="Season" size="small" type="number" inputProps={{ min: 1 }} error={!!fieldState.error} helperText={fieldState.error?.message} sx={{ width: 120 }} />
                )}
              />
              <Controller name="episode" control={control}
                render={({ field, fieldState }) => (
                  <TextField {...field} value={field.value ?? ''} label="Episode" size="small" type="number" inputProps={{ min: 1 }} error={!!fieldState.error} helperText={fieldState.error?.message} sx={{ width: 120 }} />
                )}
              />
            </Stack>
          )}
        </Box>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" startIcon={<Clear />} onClick={() => reset()} disabled={isSubmitting}>Clear</Button>
          <Button type="submit" variant="contained"
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
        onSelect={(item) => { setValue('localFilePath', item.path); setBrowserOpen(false); }}
      />
    </Box>
  );
}

// ── Folder mode ────────────────────────────────────────────────────────────

function FolderModeForm() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc           = useQueryClient();
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);

  const [browserOpen, setBrowserOpen] = useState(false);
  const [folder,      setFolder]      = useState(null); // { root, subPath, name }
  const [record,      setRecord]      = useState(null);
  const [season,      setSeason]      = useState('');
  const [startEp,     setStartEp]     = useState('1');
  const [checked,     setChecked]     = useState(new Set());
  const [submitting,  setSubmitting]  = useState(false);

  const isTvRecord = record?.type === 'TV_SERIES';

  // Fetch folder contents
  const { data: rawItems = [], isLoading: filesLoading } = useFileBrowser(
    folder?.root ?? null,
    folder?.subPath ?? ''
  );

  // Only non-directory items, sorted by name
  const files = useMemo(() =>
    rawItems
      .filter((i) => !i.directory)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [rawItems]
  );

  // Reset checkbox selection whenever a new folder is picked
  React.useEffect(() => { setChecked(new Set()); }, [folder]);

  const toggleFile = (path) => setChecked((prev) => {
    const next = new Set(prev);
    next.has(path) ? next.delete(path) : next.add(path);
    return next;
  });

  const toggleAll = () => {
    if (checked.size === files.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(files.map((f) => f.path)));
    }
  };

  // Sorted checked files
  const checkedFiles = files.filter((f) => checked.has(f.path));

  const handleSubmit = async () => {
    if (checkedFiles.length === 0) {
      enqueueSnackbar('Select at least one file', { variant: 'warning' });
      return;
    }
    setSubmitting(true);
    const base = parseInt(startEp, 10) || 1;
    const seasonNum = season ? parseInt(season, 10) : null;

    // Submit sequentially so the backend queue receives one job at a time
    let ok = 0, bad = 0;
    for (let idx = 0; idx < checkedFiles.length; idx++) {
      const file = checkedFiles[idx];
      try {
        await linkExistingFile({
          localFilePath: file.path,
          recordId: record?.id ?? null,
          season:   isTvRecord ? seasonNum : null,
          episode:  isTvRecord ? base + idx : null,
        });
        ok++;
      } catch {
        bad++;
      }
    }

    setSubmitting(false);
    enqueueSnackbar(
      `${ok} job(s) queued${bad ? `, ${bad} failed` : ''}`,
      { variant: ok > 0 ? 'success' : 'error' }
    );
    if (ok > 0) {
      qc.invalidateQueries({ queryKey: ['ingestion-history'] });
      qc.invalidateQueries({ queryKey: ['unassigned-files'] });
      setActiveTab(1);
    }
  };

  return (
    <Stack spacing={2.5}>
      {/* Folder picker */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} mb={1}>Select Folder</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Paper
            variant="outlined"
            sx={{ flex: 1, px: 1.5, py: 0.75, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}
            onClick={() => setBrowserOpen(true)}
          >
            <FolderIcon sx={{ fontSize: 18, color: 'warning.main' }} />
            <Typography variant="body2" color={folder ? 'text.primary' : 'text.disabled'} noWrap>
              {folder ? folder.name : 'Click to browse server folders…'}
            </Typography>
          </Paper>
          <Button variant="outlined" startIcon={<FolderOpen />} onClick={() => setBrowserOpen(true)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            Browse
          </Button>
        </Stack>
      </Box>

      <Divider />

      {/* Record + season/episode config */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} mb={1}>Link to Record (optional)</Typography>
        <RecordSearch value={record} onChange={setRecord} />

        {isTvRecord && (
          <Stack direction="row" spacing={1.5} mt={1.5}>
            <TextField
              label="Season"
              size="small"
              type="number"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              inputProps={{ min: 1 }}
              sx={{ width: 120 }}
            />
            <TextField
              label="Start at episode"
              size="small"
              type="number"
              value={startEp}
              onChange={(e) => setStartEp(e.target.value)}
              inputProps={{ min: 1 }}
              helperText="Files assigned Ep.N, N+1…"
              sx={{ width: 160 }}
            />
          </Stack>
        )}
      </Box>

      {/* File list */}
      {folder && (
        <>
          <Divider />
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" fontWeight={600}>
                {filesLoading ? 'Loading…' : `${files.length} file(s) in folder`}
              </Typography>
              {files.length > 0 && (
                <Button size="small" onClick={toggleAll}>
                  {checked.size === files.length ? 'Deselect all' : 'Select all'}
                </Button>
              )}
            </Stack>

            {filesLoading && (
              <Stack alignItems="center" py={3}>
                <CircularProgress size={24} />
              </Stack>
            )}

            {!filesLoading && files.length === 0 && (
              <Typography variant="caption" color="text.secondary">No files found in this folder.</Typography>
            )}

            {!filesLoading && files.length > 0 && (
              <Paper variant="outlined" sx={{ maxHeight: 320, overflow: 'auto', borderRadius: 1.5 }}>
                <List dense disablePadding>
                  {files.map((file) => {
                    const isChecked = checked.has(file.path);
                    const checkedIdx = checkedFiles.findIndex((f) => f.path === file.path);
                    const epNum = isTvRecord && isChecked && checkedIdx >= 0
                      ? (parseInt(startEp, 10) || 1) + checkedIdx
                      : null;

                    return (
                      <ListItem
                        key={file.path}
                        dense
                        button
                        onClick={() => toggleFile(file.path)}
                        sx={{
                          borderBottom: `1px solid ${alpha(T.border, 0.4)}`,
                          bgcolor: isChecked ? alpha(T.teal, 0.06) : undefined,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Checkbox
                            edge="start"
                            checked={isChecked}
                            size="small"
                            sx={{ p: 0.5 }}
                            icon={<CheckBoxOutlineBlank fontSize="small" />}
                            checkedIcon={<CheckBox fontSize="small" />}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" noWrap title={file.name}>
                              {file.name}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" spacing={1} component="span">
                              {file.extension && (
                                <Chip label={file.extension.toUpperCase()} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 16 }} />
                              )}
                              {file.size && (
                                <Typography variant="caption" color="text.secondary">{fmtSize(file.size)}</Typography>
                              )}
                            </Stack>
                          }
                        />
                        {epNum != null && (
                          <Chip
                            label={`Ep.${epNum}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontSize: '0.68rem', height: 20, ml: 1 }}
                          />
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>
            )}
          </Box>
        </>
      )}

      {/* Submit */}
      <Stack direction="row" spacing={1.5} justifyContent="flex-end">
        <Button variant="outlined" startIcon={<Clear />} onClick={() => { setFolder(null); setRecord(null); setSeason(''); setStartEp('1'); setChecked(new Set()); }} disabled={submitting}>
          Clear
        </Button>
        <Button
          variant="contained"
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Send />}
          disabled={submitting || checkedFiles.length === 0}
          onClick={handleSubmit}
        >
          {submitting ? 'Starting…' : `Process ${checkedFiles.length} File(s)`}
        </Button>
      </Stack>

      <FileBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        folderMode
        title="Select folder to batch-process"
        onSelect={(item) => {
          setFolder({ root: item.root, subPath: item.subPath, name: item.name });
          setBrowserOpen(false);
        }}
      />
    </Stack>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export default function LinkFileForm() {
  const [mode, setMode] = useState('file');

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="caption">
          Browse files already on the server. The pipeline skips download and runs{' '}
          <strong>MediaInfo → FFmpeg → DB save</strong>.
          Files without a linked record appear in <strong>Unassigned Files</strong>.
        </Typography>
      </Alert>

      <ToggleButtonGroup
        size="small"
        value={mode}
        exclusive
        onChange={(_, v) => v && setMode(v)}
        sx={{ mb: 2.5 }}
      >
        <ToggleButton value="file" sx={{ gap: 0.5, px: 2 }}>
          <InsertDriveFile sx={{ fontSize: 15 }} /> Single File
        </ToggleButton>
        <ToggleButton value="folder" sx={{ gap: 0.5, px: 2 }}>
          <FolderIcon sx={{ fontSize: 15 }} /> Folder (Batch)
        </ToggleButton>
      </ToggleButtonGroup>

      {mode === 'file'   && <FileModeForm />}
      {mode === 'folder' && <FolderModeForm />}
    </Box>
  );
}
