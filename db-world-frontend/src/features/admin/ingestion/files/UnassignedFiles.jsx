import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  alpha,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  Link as LinkIcon,
  LinkOff,
  Refresh,
  Search,
  Storage,
  VideoFile,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { AnimatePresence, motion } from 'framer-motion';

import { getUnassignedFiles, linkFileToRecord, searchRecords } from '../services/ingestionApi';

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

function getTrack(tracks = [], type) {
  return tracks.find((track) => track?.type === type) || null;
}

function getResolutionLabel(file) {
  const video = getTrack(file?.tracks, 'Video');
  if (video?.properties?.height) return `${video.properties.height}p`;
  if (video?.properties?.width && video?.properties?.height) {
    return `${video.properties.width}x${video.properties.height}`;
  }
  return '—';
}

function getVideoCodec(file) {
  const raw = getTrack(file?.tracks, 'Video')?.properties?.format;
  if (!raw) return '—';
  const lower = String(raw).toLowerCase();
  if (lower.includes('hevc') || lower.includes('h265')) return 'H.265 / HEVC';
  if (lower.includes('avc') || lower.includes('h264')) return 'H.264 / AVC';
  if (lower.includes('vp9')) return 'VP9';
  if (lower.includes('av1')) return 'AV1';
  return raw;
}

function getAudioLanguage(file) {
  return getTrack(file?.tracks, 'Audio')?.properties?.language || '—';
}

function getExtension(fileName) {
  if (!fileName || !fileName.includes('.')) return null;
  return fileName.split('.').pop()?.toUpperCase() || null;
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
        borderColor: alpha(theme.palette.divider, 0.72),
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
      <Box sx={{ px: { xs: 1.25, sm: 1.7, md: 2.1 }, py: { xs: 1.25, sm: 1.5 } }}>
        <Stack direction="row" spacing={1.1} alignItems="flex-start" justifyContent="space-between" mb={1.25}>
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

function SummaryRow({ label, value, chip = false, color = 'default' }) {
  return (
    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {chip ? (
        <Chip size="small" variant="outlined" color={color} label={value} sx={{ fontWeight: 700 }} />
      ) : (
        <Typography variant="body2" fontWeight={700} textAlign="right" sx={{ wordBreak: 'break-word' }}>
          {value}
        </Typography>
      )}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Link dialog
// ─────────────────────────────────────────────────────────────────────────────

function LinkDialog({ file, open, onClose }) {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const timerRef = useRef(null);

  const [record, setRecord] = useState(null);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setRecord(null);
      setOptions([]);
      setLoading(false);
      setBusy(false);
      clearTimeout(timerRef.current);
    }
  }, [open]);

  const fetchOptions = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await searchRecords(query.trim());
      setOptions(res?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const onConfirm = async () => {
    if (!record || !file?.id) return;

    setBusy(true);
    try {
      const res = await linkFileToRecord(file.id, record.id);
      if (res?.httpStatusCode === 200 || res?.httpStatusCode === 201) {
        enqueueSnackbar(`Linked to "${record.name || record.title}"`, { variant: 'success' });
        qc.invalidateQueries({ queryKey: ['unassigned-files'] });
        onClose();
      } else {
        enqueueSnackbar(res?.message || 'Link failed', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Link failed', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const fileSize = fmtSize(file?.fileSize);
  const resolution = getResolutionLabel(file);
  const audioLanguage = getAudioLanguage(file);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isSmDown}
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 4 },
          minHeight: { xs: '100dvh', sm: 460 },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.1, px: { xs: 1.25, sm: 2 } }}>
        <Stack direction="row" spacing={1.1} alignItems="center" minWidth={0}>
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
            <LinkIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box minWidth={0}>
            <Typography variant="h6" fontWeight={900} lineHeight={1.15}>
              Link to Record
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Attach this unassigned media file to a catalog record.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 1.25, sm: 2 }, pb: { xs: 1.25, sm: 2 }, pt: '8px !important' }}>
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.2fr) minmax(260px, 0.8fr)' },
            alignItems: 'start',
          }}
        >
          <SectionCard
            title="Search record"
            subtitle="Start typing at least 2 characters to find the target record"
            icon={<Search sx={{ fontSize: 18 }} />}
          >
            <Autocomplete
              value={record}
              onChange={(_, value) => setRecord(value)}
              options={options}
              loading={loading}
              filterOptions={(x) => x}
              getOptionLabel={(option) => (option ? `${option.id} – ${option.name || option.title || ''}` : '')}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              onInputChange={(_, query) => {
                clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => fetchOptions(query), 300);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search record…"
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loading ? <CircularProgress size={14} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Stack spacing={0.2}>
                    <Typography variant="body2" fontWeight={700}>
                      {option.id} – {option.name || option.title}
                    </Typography>
                    {option.type ? (
                      <Typography variant="caption" color="text.secondary">
                        {option.type}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              )}
            />

            {!record ? (
              <Alert severity="info" sx={{ mt: 1.15, borderRadius: 2.5 }}>
                Choose a record to link this file and remove it from the unassigned list.
              </Alert>
            ) : null}
          </SectionCard>

          <SectionCard
            title="File summary"
            subtitle="Review the file you are about to link"
            icon={<VideoFile sx={{ fontSize: 18 }} />}
          >
            <Stack spacing={1.1}>
              <Typography variant="body2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                {file?.fileName || '—'}
              </Typography>

              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {fileSize ? <Chip size="small" variant="outlined" label={fileSize} sx={{ fontWeight: 700 }} /> : null}
                {resolution !== '—' ? <Chip size="small" color="info" label={resolution} sx={{ fontWeight: 700 }} /> : null}
                {audioLanguage !== '—' ? <Chip size="small" label={audioLanguage} sx={{ fontWeight: 700 }} /> : null}
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  icon={<LinkOff sx={{ fontSize: '14px !important' }} />}
                  label="Unassigned"
                  sx={{ fontWeight: 700 }}
                />
              </Stack>

              <Divider />

              <SummaryRow label="Video codec" value={getVideoCodec(file)} />
              <SummaryRow label="Record selected" value={record ? `${record.id} – ${record.name || record.title}` : 'None'} />
            </Stack>
          </SectionCard>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.25, sm: 2 }, py: { xs: 1.15, sm: 1.5 }, borderTop: `1px solid ${alpha(theme.palette.divider, 0.75)}` }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ width: '100%' }}>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
            {record ? `Ready to link with ${record.name || record.title}` : 'Select a record to continue'}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button onClick={onClose} disabled={busy} sx={{ borderRadius: 999, flex: { xs: 1, sm: 'none' } }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={onConfirm}
              disabled={!record || busy}
              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <LinkIcon />}
              sx={{ borderRadius: 999, flex: { xs: 1, sm: 'none' }, boxShadow: 'none', minWidth: 110 }}
            >
              Link
            </Button>
          </Stack>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// File card
// ─────────────────────────────────────────────────────────────────────────────

const UnassignedFileCard = memo(function UnassignedFileCard({ file }) {
  const theme = useTheme();
  const [linkOpen, setLinkOpen] = useState(false);

  const video = getTrack(file?.tracks, 'Video');
  const audio = getTrack(file?.tracks, 'Audio');
  const resolution = getResolutionLabel(file);
  const codec = getVideoCodec(file);
  const audioLanguage = audio?.properties?.language || '—';
  const fileSize = fmtSize(file?.fileSize);
  const ext = getExtension(file?.fileName);

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          borderColor: alpha(theme.palette.divider, 0.72),
          transition: 'all 0.18s ease',
          '&:hover': {
            boxShadow: theme.palette.mode === 'dark' ? '0 10px 26px rgba(0,0,0,0.18)' : '0 10px 26px rgba(15, 23, 42, 0.07)',
            borderColor: alpha(theme.palette.primary.main, 0.28),
          },
        }}
      >
        <CardContent sx={{ p: '14px !important' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.35} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
            <Stack direction="row" spacing={1.1} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2.25,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  color: 'primary.main',
                  flexShrink: 0,
                  mt: 0.1,
                }}
              >
                <VideoFile sx={{ fontSize: 20 }} />
              </Box>

              <Box minWidth={0} flex={1}>
                <Tooltip title={file?.filePath ?? file?.fileName ?? ''}>
                  <Typography variant="body2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                    {file?.fileName}
                  </Typography>
                </Tooltip>

                <Stack direction="row" flexWrap="wrap" gap={0.75} mt={0.8}>
                  {fileSize ? <Chip label={fileSize} size="small" variant="outlined" sx={{ fontWeight: 700 }} /> : null}
                  {ext ? <Chip label={ext} size="small" variant="outlined" sx={{ fontWeight: 700 }} /> : null}
                  {codec !== '—' ? <Chip label={codec} size="small" variant="outlined" sx={{ fontWeight: 700 }} /> : null}
                  {resolution !== '—' ? <Chip label={resolution} size="small" color="info" sx={{ fontWeight: 700 }} /> : null}
                  {audioLanguage !== '—' ? <Chip label={audioLanguage} size="small" sx={{ fontWeight: 700 }} /> : null}
                  <Chip
                    icon={<LinkOff sx={{ fontSize: '13px !important' }} />}
                    label="Unassigned"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>

                {(video?.properties?.format || audio?.properties?.format) ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8, wordBreak: 'break-word' }}>
                    {video?.properties?.format ? `Video: ${video.properties.format}` : ''}
                    {video?.properties?.format && audio?.properties?.format ? ' • ' : ''}
                    {audio?.properties?.format ? `Audio: ${audio.properties.format}` : ''}
                  </Typography>
                ) : null}
              </Box>
            </Stack>

            <Stack direction={{ xs: 'row', sm: 'column' }} spacing={0.75} justifyContent="flex-end" flexShrink={0}>
              <Button
                variant="outlined"
                startIcon={<LinkIcon />}
                onClick={() => setLinkOpen(true)}
                sx={{ borderRadius: 999, minWidth: { xs: 'unset', sm: 120 } }}
              >
                Link
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <LinkDialog file={file} open={linkOpen} onClose={() => setLinkOpen(false)} />
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export default function UnassignedFiles() {
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const timerRef = useRef(null);
  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  const handleSearch = (query) => {
    setSearch(query);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQ(query), 400);
  };

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['unassigned-files', debouncedQ],
    queryFn: () => getUnassignedFiles(debouncedQ).then((res) => res?.data ?? []),
    staleTime: 30 * 1000,
  });

  const totalFiles = data.length;

  const summary = (
    <SectionCard
      title="Summary"
      subtitle={isLgUp ? 'Quick health check for currently visible unassigned media' : 'Quick summary'}
      icon={<AutoAwesome sx={{ fontSize: 18 }} />}
    >
      <Stack spacing={1.15}>
        <SummaryRow label="Visible files" value={totalFiles} chip color={totalFiles ? 'warning' : 'success'} />
        <SummaryRow label="Search" value={debouncedQ || 'All files'} />
        <SummaryRow label="State" value={totalFiles ? 'Needs linking' : 'All linked'} chip color={totalFiles ? 'warning' : 'success'} />
        <Divider />
        <Typography variant="caption" color="text.secondary">
          Use <strong>Link</strong> to associate media files with records. Linked files are removed from this list after refresh.
        </Typography>
      </Stack>
    </SectionCard>
  );

  return (
    <Box sx={{ maxWidth: 1480, mx: 'auto', px: { xs: 0.25, sm: 0.5, lg: 1 } }}>
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          mb: { xs: 1.5, sm: 2 },
          borderRadius: { xs: 3, sm: 4 },
          borderColor: alpha(theme.palette.divider, 0.72),
          background:
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, rgba(255,255,255,0.02) 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, rgba(255,255,255,0.95) 100%)`,
        }}
      >
        <Box sx={{ p: { xs: 1.25, sm: 1.6, md: 2 } }}>
          <Stack spacing={1.2}>
            <Typography variant="h6" fontWeight={900}>
              Unassigned files
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Files ingested without a linked record. They are already stored and streamable; use <strong>Link</strong> to associate them with a catalog record.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Chip size="small" color="warning" variant="outlined" icon={<LinkOff sx={{ fontSize: '16px !important' }} />} label="Needs record mapping" sx={{ fontWeight: 700 }} />
              <Chip size="small" color="primary" variant="outlined" label="Standalone playback supported" sx={{ fontWeight: 700 }} />
            </Stack>
          </Stack>
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2 },
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(300px, 0.82fr)' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={{ xs: 1.5, sm: 2 }}>
          <SectionCard
            title="Browse unassigned media"
            subtitle="Search by filename and link files to records from the list"
            icon={<Storage sx={{ fontSize: 18 }} />}
            action={
              <Button size="small" startIcon={<Refresh />} onClick={() => refetch()} disabled={isLoading} sx={{ borderRadius: 999 }}>
                Refresh
              </Button>
            }
          >
            <Stack spacing={1.25}>
              <TextField
                size="small"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by filename…"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip size="small" variant="outlined" label={`${totalFiles} file${totalFiles !== 1 ? 's' : ''}`} sx={{ fontWeight: 700 }} />
                {debouncedQ ? <Chip size="small" variant="outlined" label={`Search: ${debouncedQ}`} sx={{ fontWeight: 700 }} /> : null}
              </Stack>

              {error ? <Alert severity="error" sx={{ borderRadius: 2.5 }}>Failed to load unassigned files.</Alert> : null}

              {isLoading ? (
                <Stack spacing={1}>
                  {[1, 2, 3, 4].map((n) => (
                    <Skeleton key={n} variant="rounded" height={88} sx={{ borderRadius: 3 }} />
                  ))}
                </Stack>
              ) : totalFiles === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <LinkOff sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">
                    {search ? 'No unassigned files match your search.' : 'No unassigned files. All media is linked!'}
                  </Typography>
                </Box>
              ) : (
                <AnimatePresence initial={false}>
                  <Stack spacing={1}>
                    {data.map((file) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.16 }}
                      >
                        <UnassignedFileCard file={file} />
                      </motion.div>
                    ))}
                  </Stack>
                </AnimatePresence>
              )}
            </Stack>
          </SectionCard>
        </Stack>

        {summary}
      </Box>
    </Box>
  );
}
