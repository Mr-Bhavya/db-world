import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Stack, TextField, InputAdornment,
  Card, CardContent, Chip, IconButton, Tooltip,
  Alert, CircularProgress, Button, Skeleton,
  Dialog, DialogTitle, DialogContent,
  DialogActions, Autocomplete,
} from '@mui/material';
import {
  Search, LinkOff, Link as LinkIcon, Download,
  InsertDriveFile, Refresh, VideoFile,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { getUnassignedFiles, linkFileToRecord, searchRecords } from '../services/ingestionApi';

function fmtSize(b) {
  if (!b) return null;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

// ── Link-to-Record dialog ─────────────────────────────────────────────────

function LinkDialog({ fileId, fileName, open, onClose }) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [record, setRecord]   = useState(null);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState(false);
  const timerRef = React.useRef(null);

  const fetchOptions = useCallback(async (q) => {
    if (!q || q.length < 2) { setOptions([]); return; }
    setLoading(true);
    try {
      const res = await searchRecords(q);
      setOptions(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const onConfirm = async () => {
    if (!record) return;
    setBusy(true);
    try {
      const res = await linkFileToRecord(fileId, record.recordId);
      if (res.httpStatusCode === 200) {
        enqueueSnackbar(`Linked to "${record.name}"`, { variant: 'success' });
        qc.invalidateQueries({ queryKey: ['unassigned-files'] });
        onClose();
      } else {
        enqueueSnackbar(res.message || 'Link failed', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Link failed', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Link to Record</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <Typography variant="body2" color="text.secondary" mb={2}>
          File: <strong>{fileName}</strong>
        </Typography>
        <Autocomplete
          value={record}
          onChange={(_, v) => setRecord(v)}
          options={options}
          loading={loading}
          getOptionLabel={(o) => o ? `${o.recordId} – ${o.name}` : ''}
          isOptionEqualToValue={(a, b) => a?.recordId === b?.recordId}
          filterOptions={(x) => x}
          onInputChange={(_, q) => {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => fetchOptions(q), 300);
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
                    {loading && <CircularProgress size={14} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={!record || busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <LinkIcon />}
        >
          Link
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── File card ──────────────────────────────────────────────────────────────

function UnassignedFileCard({ file }) {
  const [linkOpen, setLinkOpen] = useState(false);

  const general = file.tracks?.find((t) => t.type === 'General');
  const video   = file.tracks?.find((t) => t.type === 'Video');
  const audio   = file.tracks?.find((t) => t.type === 'Audio');

  return (
    <>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: '12px !important' }}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <VideoFile sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} />

            <Box flex={1} minWidth={0}>
              <Tooltip title={file.filePath ?? file.fileName}>
                <Typography variant="body2" fontWeight={500} noWrap>
                  {file.fileName}
                </Typography>
              </Tooltip>

              <Stack direction="row" spacing={0.75} flexWrap="wrap" mt={0.5}>
                {fmtSize(file.fileSize) && (
                  <Chip label={fmtSize(file.fileSize)} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                )}
                {video?.properties?.format && (
                  <Chip label={video.properties.format} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                )}
                {video?.properties?.height && (
                  <Chip label={`${video.properties.height}p`} size="small" color="info" sx={{ fontSize: '0.65rem', height: 18 }} />
                )}
                {audio?.properties?.language && (
                  <Chip label={audio.properties.language} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                )}
                <Chip
                  icon={<LinkOff sx={{ fontSize: '12px !important' }} />}
                  label="Unassigned"
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 18 }}
                />
              </Stack>
            </Box>

            <Stack direction="row" spacing={0.25} flexShrink={0}>
              <Tooltip title="Link to Record">
                <IconButton size="small" color="primary" onClick={() => setLinkOpen(true)}>
                  <LinkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <LinkDialog
        fileId={file.id}
        fileName={file.fileName}
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
      />
    </>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export default function UnassignedFiles() {
  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const timerRef = React.useRef(null);

  const handleSearch = (q) => {
    setSearch(q);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQ(q), 400);
  };

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['unassigned-files', debouncedQ],
    queryFn:  () => getUnassignedFiles(debouncedQ).then((r) => r.data ?? []),
    staleTime: 30 * 1000,
  });

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="caption">
          Files ingested <strong>without a linked record</strong>. They are stored, symlinked, and streamable
          by ID. Use <strong>Link to Record</strong> to associate them, or leave as-is for standalone playback.
        </Typography>
      </Alert>

      <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
        <TextField
          size="small"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by filename…"
          sx={{ flex: 1, maxWidth: 380 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button size="small" startIcon={<Refresh />} onClick={() => refetch()} disabled={isLoading}>
          Refresh
        </Button>
        <Typography variant="caption" color="text.secondary">
          {data.length} files
        </Typography>
      </Stack>

      {error && <Alert severity="error">Failed to load unassigned files.</Alert>}

      {isLoading ? (
        <Stack spacing={1}>
          {[1,2,3].map((n) => <Skeleton key={n} variant="rounded" height={72} />)}
        </Stack>
      ) : data.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <LinkOff sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            {search ? 'No unassigned files match your search.' : 'No unassigned files. All media is linked!'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {data.map((file) => (
            <UnassignedFileCard key={file.id} file={file} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
