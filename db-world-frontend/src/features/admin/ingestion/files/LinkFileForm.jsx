import React, { memo, useEffect, useMemo, useState } from 'react';
import { notify } from '@shared/notify';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CheckBox,
  CheckBoxOutlineBlank,
  Clear,
  Folder as FolderIcon,
  FolderOpen,
  InsertDriveFile,
  Send,
  Theaters,
  AutoAwesome,
  Storage,
  CheckCircle,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';

import { useT } from '@shared/theme';
import RecordSearch from '../form/RecordSearch';
import FileBrowserDialog from './FileBrowserDialog';
import { linkExistingFile } from '../services/ingestionApi';
import { useFileBrowser } from '../hooks/useFileBrowser';
import useIngestionStore from '../store/ingestionStore';

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const fileSchema = z.object({
  localFilePath: z.string().min(1, 'Select a file first'),
  record: z.any().optional().nullable(),
  season: z.coerce.number().int().positive().optional().nullable(),
  episode: z.coerce.number().int().positive().optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  if (!bytes || !Number.isFinite(Number(bytes))) return null;
  const value = Number(bytes);
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function getFileName(path) {
  return path ? path.split(/[\\/]/).pop() : '';
}

function getExtension(name) {
  if (!name || !name.includes('.')) return null;
  return name.split('.').pop()?.toUpperCase() || null;
}

function boolChipColor(active) {
  return active ? 'primary' : 'default';
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, icon, action, children, sx = {} }) {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        borderRadius: { xs: 3, sm: 4 },
        overflow: 'hidden',
        borderColor: alpha(theme.palette.divider, 0.7),
        background:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.018) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 8px 26px rgba(0,0,0,0.16)'
            : '0 8px 26px rgba(15, 23, 42, 0.045)',
        ...sx,
      }}
    >
      <Box sx={{ px: { xs: 1.25, sm: 1.75, md: 2.1 }, py: { xs: 1.25, sm: 1.5 } }}>
        <Stack
          direction="row"
          spacing={1.1}
          alignItems="flex-start"
          justifyContent="space-between"
          mb={1.35}
        >
          <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2.25,
                display: 'grid',
                placeItems: 'center',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
            <Box minWidth={0}>
              <Typography variant="subtitle1" fontWeight={800} lineHeight={1.15}>
                {title}
              </Typography>
              {subtitle ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
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

function BrowserField({ label, value, placeholder, onBrowse, helperText, error, fileName }) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" fontWeight={700}>
        {label}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
        <TextField
          fullWidth
          size="small"
          value={value || ''}
          placeholder={placeholder}
          error={error}
          helperText={helperText || ' '}
          InputProps={{
            readOnly: true,
            startAdornment: value ? (
              <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                {fileName ? (
                  <InsertDriveFile sx={{ fontSize: 16, color: 'text.secondary' }} />
                ) : (
                  <FolderIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                )}
              </Box>
            ) : undefined,
          }}
          onClick={onBrowse}
          sx={{ cursor: 'pointer' }}
        />

        <Button
          variant="outlined"
          startIcon={<FolderOpen />}
          onClick={onBrowse}
          sx={{ whiteSpace: 'nowrap', borderRadius: 999, minWidth: { xs: '100%', sm: 122 } }}
        >
          Browse
        </Button>
      </Stack>
    </Stack>
  );
}

function SummaryRow({ label, value, chip, color = 'default' }) {
  return (
    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {chip ? (
        <Chip size="small" label={value} color={color} variant="outlined" sx={{ fontWeight: 700 }} />
      ) : (
        <Typography variant="body2" fontWeight={700} textAlign="right" sx={{ wordBreak: 'break-word' }}>
          {value}
        </Typography>
      )}
    </Stack>
  );
}

function FormSidebar({ title, subtitle, children, actions }) {
  return (
    <SectionCard title={title} subtitle={subtitle} icon={<AutoAwesome sx={{ fontSize: 18 }} />}>
      <Stack spacing={1.25}>
        {children}
        {actions ? (
          <>
            <Divider />
            {actions}
          </>
        ) : null}
      </Stack>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// File mode
// ─────────────────────────────────────────────────────────────────────────────

function FileModeForm() {
  const qc = useQueryClient();
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const [browserOpen, setBrowserOpen] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm({
    resolver: zodResolver(fileSchema),
    defaultValues: { localFilePath: '', record: null, season: null, episode: null },
  });

  const localFilePath = watch('localFilePath');
  const record = watch('record');
  const season = watch('season');
  const episode = watch('episode');
  const isTvRecord = record?.type === 'TV_SERIES';
  const fileName = getFileName(localFilePath);
  const extension = getExtension(fileName);

  const onSubmit = async (data) => {
    try {
      const res = await linkExistingFile({
        localFilePath: data.localFilePath,
        recordId: data.record?.id ?? null,
        season: data.season ? Number(data.season) : null,
        episode: data.episode ? Number(data.episode) : null,
      });

      if (res.httpStatusCode === 200 || res.httpStatusCode === 201) {
        notify.success('Processing job started');
        qc.invalidateQueries({ queryKey: ['ingestion-history'] });
        qc.invalidateQueries({ queryKey: ['unassigned-files'] });
        reset();
        setActiveTab(1);
      } else {
        notify.error(res.message || 'Failed to start job');
      }
    } catch (e) {
      notify.error(e?.response?.data?.message ?? 'Network error');
    }
  };

  const actions = (
    <Stack direction={{ xs: 'row', sm: 'row', lg: 'column' }} spacing={1}>
      <Button
        fullWidth
        variant="outlined"
        startIcon={<Clear />}
        onClick={() => reset()}
        disabled={isSubmitting}
        sx={{ borderRadius: 999 }}
      >
        Clear
      </Button>
      <Button
        fullWidth
        type="submit"
        variant="contained"
        startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <Send />}
        disabled={isSubmitting || !localFilePath}
        sx={{ borderRadius: 999, boxShadow: 'none', fontWeight: 700 }}
      >
        {isSubmitting ? 'Starting…' : 'Process File'}
      </Button>
    </Stack>
  );

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2 },
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(320px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={{ xs: 1.5, sm: 2 }}>
          <SectionCard
            title="Select file"
            subtitle="Choose an already-downloaded server file to process"
            icon={<InsertDriveFile sx={{ fontSize: 18 }} />}
          >
            <Controller
              name="localFilePath"
              control={control}
              render={({ field, fieldState }) => (
                <BrowserField
                  label="Server file"
                  value={field.value}
                  placeholder="Select a server file from stream or temp storage"
                  onBrowse={() => setBrowserOpen(true)}
                  helperText={fieldState.error?.message}
                  error={!!fieldState.error}
                  fileName={fileName}
                />
              )}
            />

            <AnimatePresence initial={false}>
              {fileName ? (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      mt: 0.5,
                      p: 1.15,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                    }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <Stack direction="row" spacing={1} alignItems="center" minWidth={0} sx={{ flex: 1 }}>
                        <InsertDriveFile sx={{ fontSize: 17, color: 'primary.main' }} />
                        <Typography variant="body2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                          {fileName}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {extension ? <Chip label={extension} size="small" variant="outlined" sx={{ fontWeight: 700 }} /> : null}
                        <Chip label="Server file" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                      </Stack>
                    </Stack>
                  </Paper>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </SectionCard>

          <SectionCard
            title="Record mapping"
            subtitle="Attach the file to a cinema record now, or leave it unassigned"
            icon={<Theaters sx={{ fontSize: 18 }} />}
          >
            <Stack spacing={1.25}>
              <Controller
                name="record"
                control={control}
                render={({ field }) => <RecordSearch value={field.value} onChange={field.onChange} />}
              />

              {!record ? (
                <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                  If left empty, the file stays under <strong>Unassigned Files</strong> and can be linked later.
                </Alert>
              ) : null}

              {isTvRecord ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', sm: '140px 140px' },
                    gap: 1,
                    alignItems: 'start',
                  }}
                >
                  <Controller
                    name="season"
                    control={control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Season"
                        size="small"
                        type="number"
                        inputProps={{ min: 1 }}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message || ' '}
                      />
                    )}
                  />
                  <Controller
                    name="episode"
                    control={control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Episode"
                        size="small"
                        type="number"
                        inputProps={{ min: 1 }}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message || ' '}
                      />
                    )}
                  />
                </Box>
              ) : null}
            </Stack>
          </SectionCard>
        </Stack>

        <FormSidebar
          title="Processing summary"
          subtitle={isLgUp ? 'Review the selected server file and mapping before starting the job' : 'Quick summary'}
          actions={actions}
        >
          <SummaryRow label="Mode" value="Single file" chip color="primary" />
          <SummaryRow label="File selected" value={fileName || 'No file selected'} />
          <SummaryRow label="Extension" value={extension || '—'} chip={!!extension} />
          <SummaryRow label="Record" value={record?.title || record?.name || 'Unassigned'} />
          {isTvRecord ? (
            <>
              <SummaryRow label="Season" value={season || '—'} chip={!!season} color={boolChipColor(!!season)} />
              <SummaryRow label="Episode" value={episode || '—'} chip={!!episode} color={boolChipColor(!!episode)} />
            </>
          ) : null}

          {!isLgUp ? (
            <Alert severity="info" sx={{ borderRadius: 2.5 }}>
              This flow skips download and starts processing directly on the selected server file.
            </Alert>
          ) : null}
        </FormSidebar>
      </Box>

      <FileBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        title="Select file to process"
        onSelect={(item) => {
          setValue('localFilePath', item.path, { shouldValidate: true });
          setBrowserOpen(false);
        }}
      />
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Folder mode
// ─────────────────────────────────────────────────────────────────────────────

const FileListPanel = memo(function FileListPanel({
  files,
  checked,
  checkedFiles,
  filesLoading,
  isTvRecord,
  startEp,
  onToggleAll,
  onToggleFile,
}) {
  const T = useT();

  if (filesLoading) {
    return (
      <Stack alignItems="center" py={4}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  if (!files.length) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2.5 }}>
        No files found in this folder.
      </Alert>
    );
  }

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
        <Typography variant="subtitle2" fontWeight={700}>
          {files.length} file(s) in folder
        </Typography>
        <Button size="small" onClick={onToggleAll} sx={{ borderRadius: 999 }}>
          {checked.size === files.length ? 'Deselect all' : 'Select all'}
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <List dense disablePadding sx={{ maxHeight: { xs: 380, md: 520 }, overflow: 'auto' }}>
          {files.map((file) => {
            const isChecked = checked.has(file.path);
            const checkedIdx = checkedFiles.findIndex((f) => f.path === file.path);
            const epNum = isTvRecord && isChecked && checkedIdx >= 0 ? (parseInt(startEp, 10) || 1) + checkedIdx : null;
            const ext = file.extension ? file.extension.toUpperCase() : getExtension(file.name);

            return (
              <ListItemButton
                key={file.path}
                dense
                onClick={() => onToggleFile(file.path)}
                sx={{
                  borderBottom: `1px solid ${alpha(T.border, 0.35)}`,
                  alignItems: 'flex-start',
                  bgcolor: isChecked ? alpha(T.teal, 0.06) : undefined,
                  py: 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: 34, pt: 0.15 }}>
                  <Checkbox
                    edge="start"
                    checked={isChecked}
                    size="small"
                    sx={{ p: 0.5 }}
                    icon={<CheckBoxOutlineBlank fontSize="small" />}
                    checkedIcon={<CheckBox fontSize="small" />}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>

                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={isChecked ? 700 : 500} title={file.name} sx={{ wordBreak: 'break-word' }}>
                      {file.name}
                    </Typography>
                  }
                  secondary={
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.45 }}>
                      {ext ? (
                        <Chip label={ext} size="small" variant="outlined" sx={{ fontSize: '0.66rem', height: 20, fontWeight: 700 }} />
                      ) : null}
                      {file.size ? (
                        <Chip label={fmtSize(file.size)} size="small" variant="outlined" sx={{ fontSize: '0.66rem', height: 20 }} />
                      ) : null}
                      {epNum != null ? (
                        <Chip label={`Ep.${epNum}`} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.66rem', height: 20, fontWeight: 700 }} />
                      ) : null}
                    </Stack>
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
      </Paper>
    </Stack>
  );
});

function FolderModeForm() {
  const T = useT();
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const qc = useQueryClient();
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);

  const [browserOpen, setBrowserOpen] = useState(false);
  const [folder, setFolder] = useState(null); // { root, subPath, name }
  const [record, setRecord] = useState(null);
  const [season, setSeason] = useState('');
  const [startEp, setStartEp] = useState('1');
  const [checked, setChecked] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  const isTvRecord = record?.type === 'TV_SERIES';

  const { data: rawItems = [], isLoading: filesLoading } = useFileBrowser(folder?.root ?? null, folder?.subPath ?? '');

  const files = useMemo(
    () => rawItems.filter((i) => !i.directory).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [rawItems]
  );

  useEffect(() => {
    setChecked(new Set());
  }, [folder]);

  const toggleFile = (path) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const toggleAll = () => {
    if (checked.size === files.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(files.map((f) => f.path)));
    }
  };

  const checkedFiles = useMemo(() => files.filter((f) => checked.has(f.path)), [files, checked]);

  const handleSubmit = async () => {
    if (checkedFiles.length === 0) {
      notify.warning('Select at least one file');
      return;
    }

    setSubmitting(true);
    const base = parseInt(startEp, 10) || 1;
    const seasonNum = season ? parseInt(season, 10) : null;

    let ok = 0;
    let bad = 0;

    for (let idx = 0; idx < checkedFiles.length; idx += 1) {
      const file = checkedFiles[idx];
      try {
        await linkExistingFile({
          localFilePath: file.path,
          recordId: record?.id ?? null,
          season: isTvRecord ? seasonNum : null,
          episode: isTvRecord ? base + idx : null,
        });
        ok += 1;
      } catch {
        bad += 1;
      }
    }

    setSubmitting(false);

    notify[ok > 0 ? 'success' : 'error'](`${ok} job(s) queued${bad ? `, ${bad} failed` : ''}`);

    if (ok > 0) {
      qc.invalidateQueries({ queryKey: ['ingestion-history'] });
      qc.invalidateQueries({ queryKey: ['unassigned-files'] });
      setActiveTab(1);
    }
  };

  const clearAll = () => {
    setFolder(null);
    setRecord(null);
    setSeason('');
    setStartEp('1');
    setChecked(new Set());
  };

  const actions = (
    <Stack direction={{ xs: 'row', sm: 'row', lg: 'column' }} spacing={1}>
      <Button
        fullWidth
        variant="outlined"
        startIcon={<Clear />}
        onClick={clearAll}
        disabled={submitting}
        sx={{ borderRadius: 999 }}
      >
        Clear
      </Button>
      <Button
        fullWidth
        variant="contained"
        startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Send />}
        disabled={submitting || checkedFiles.length === 0}
        onClick={handleSubmit}
        sx={{ borderRadius: 999, boxShadow: 'none', fontWeight: 700 }}
      >
        {submitting ? 'Starting…' : `Process ${checkedFiles.length} File(s)`}
      </Button>
    </Stack>
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(320px, 0.82fr)' },
        alignItems: 'start',
      }}
    >
      <Stack spacing={{ xs: 1.5, sm: 2 }}>
        <SectionCard
          title="Select folder"
          subtitle="Pick a server folder and batch-process one or more files"
          icon={<FolderIcon sx={{ fontSize: 18 }} />}
        >
          <BrowserField
            label="Server folder"
            value={folder?.name || ''}
            placeholder="Choose a folder from stream or temp storage"
            onBrowse={() => setBrowserOpen(true)}
            helperText={folder ? `${folder.root}${folder.subPath ? ` / ${folder.subPath}` : ''}` : ' '}
            error={false}
            fileName={false}
          />
          {folder ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={folder.root} sx={{ fontWeight: 700 }} />
              {folder.subPath ? <Chip size="small" variant="outlined" label={folder.subPath} /> : null}
            </Stack>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Record mapping"
          subtitle="Apply one record to all selected files in this batch"
          icon={<Theaters sx={{ fontSize: 18 }} />}
        >
          <Stack spacing={1.25}>
            <RecordSearch value={record} onChange={setRecord} />

            {isTvRecord ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', sm: '140px 180px' },
                  gap: 1,
                  alignItems: 'start',
                }}
              >
                <TextField
                  label="Season"
                  size="small"
                  type="number"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText=" "
                />
                <TextField
                  label="Start at episode"
                  size="small"
                  type="number"
                  value={startEp}
                  onChange={(e) => setStartEp(e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText="Selected files get Ep.N, N+1…"
                />
              </Box>
            ) : (
              <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                If no record is selected, files will remain unassigned after processing.
              </Alert>
            )}
          </Stack>
        </SectionCard>

        {folder ? (
          <SectionCard
            title="Folder contents"
            subtitle="Choose which files to batch-process"
            icon={<Storage sx={{ fontSize: 18 }} />}
            action={
              checkedFiles.length > 0 ? (
                <Chip size="small" color="primary" variant="outlined" label={`${checkedFiles.length} selected`} sx={{ fontWeight: 700 }} />
              ) : null
            }
          >
            <FileListPanel
              files={files}
              checked={checked}
              checkedFiles={checkedFiles}
              filesLoading={filesLoading}
              isTvRecord={isTvRecord}
              startEp={startEp}
              onToggleAll={toggleAll}
              onToggleFile={toggleFile}
            />
          </SectionCard>
        ) : null}
      </Stack>

      <FormSidebar
        title="Batch summary"
        subtitle={isLgUp ? 'Review the selected folder, files, and numbering before starting the batch' : 'Quick summary'}
        actions={actions}
      >
        <SummaryRow label="Mode" value="Folder batch" chip color="primary" />
        <SummaryRow label="Folder" value={folder?.name || 'No folder selected'} />
        <SummaryRow label="Files selected" value={checkedFiles.length || 0} chip color={checkedFiles.length ? 'primary' : 'default'} />
        <SummaryRow label="Record" value={record?.title || record?.name || 'Unassigned'} />
        {isTvRecord ? (
          <>
            <SummaryRow label="Season" value={season || '—'} chip={!!season} color={boolChipColor(!!season)} />
            <SummaryRow label="Start episode" value={startEp || 1} chip color="primary" />
          </>
        ) : null}

        {checkedFiles.length > 0 ? (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: '12px !important' }}>
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  First selected item
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                  {checkedFiles[0]?.name}
                </Typography>
                {checkedFiles.length > 1 ? (
                  <Typography variant="caption" color="text.secondary">
                    +{checkedFiles.length - 1} more
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {!isLgUp ? (
          <Alert severity="info" sx={{ borderRadius: 2.5 }}>
            Files are submitted sequentially so the backend queue receives one job at a time.
          </Alert>
        ) : null}
      </FormSidebar>

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
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function LinkFileForm() {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [mode, setMode] = useState('file');

  return (
    <Box sx={{ maxWidth: 1480, mx: 'auto', px: { xs: 0.25, sm: 0.5, lg: 1 } }}>
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          mb: { xs: 1.5, sm: 2 },
          borderRadius: { xs: 3, sm: 4 },
          borderColor: alpha(theme.palette.divider, 0.7),
          background:
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, rgba(255,255,255,0.02) 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, rgba(255,255,255,0.95) 100%)`,
        }}
      >
        <Box sx={{ p: { xs: 1.25, sm: 1.6, md: 2 } }}>
          <Stack spacing={1.2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="h6" fontWeight={900}>
                  Link existing server file
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Skip download and start processing directly with MediaInfo → FFmpeg → DB save.
                </Typography>
              </Box>

              <ToggleButtonGroup
                size="small"
                value={mode}
                exclusive
                onChange={(_, v) => v && setMode(v)}
                sx={{
                  '& .MuiToggleButton-root': {
                    px: { xs: 1.4, sm: 2 },
                    gap: 0.6,
                    textTransform: 'none',
                    borderRadius: '999px !important',
                    fontWeight: 700,
                  },
                }}
              >
                <ToggleButton value="file">
                  <InsertDriveFile sx={{ fontSize: 15 }} /> Single File
                </ToggleButton>
                <ToggleButton value="folder">
                  <FolderIcon sx={{ fontSize: 15 }} /> Folder Batch
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <Alert severity="info" sx={{ borderRadius: 2.5 }}>
              Files without a linked record will appear under <strong>Unassigned Files</strong>. {isMdUp ? 'On larger screens, use the right-side summary to review the job before starting.' : 'On mobile, the summary is compact and stays above the action buttons.'}
            </Alert>

            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Chip size="small" variant="outlined" label={mode === 'file' ? 'Single job mode' : 'Batch job mode'} sx={{ fontWeight: 700 }} />
              <Chip size="small" color="success" variant="outlined" label="Download skipped" sx={{ fontWeight: 700 }} />
              <Chip size="small" color="primary" variant="outlined" icon={<CheckCircle sx={{ fontSize: '16px !important' }} />} label="Server-side processing" sx={{ fontWeight: 700 }} />
            </Stack>
          </Stack>
        </Box>
      </Paper>

      <AnimatePresence mode="wait" initial={false}>
        {mode === 'file' ? (
          <motion.div key="file" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <FileModeForm />
          </motion.div>
        ) : (
          <motion.div key="folder" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <FolderModeForm />
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
