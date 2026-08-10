import React, { useEffect, useState } from 'react';
import {
  alpha, Alert, Box, Button, CircularProgress, Collapse, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, MenuItem,
  Stack, Switch, TextField, Typography,
} from '@mui/material';
import { Close, Save, Tune, Lock } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { notify } from '@shared/notify';

import { getJobParams, editJobParams } from '../services/ingestionApi';
import RecordSearch from '../form/RecordSearch';

const TERMINAL = ['SUCCESS', 'FAILED', 'CANCELLED', 'COMPLETED'];

/**
 * Phase-aware live editor for an in-flight ingestion job. Which fields you can change depends on how
 * far the pipeline has gone (it consumes each field at a specific stage):
 *   • Processing-tier (record link, TV season/episode, extract, custom filename) — editable until the
 *     download FINISHES (Queued / Started / Downloading / Paused). Applied when processing runs.
 *   • Download-tier (source URL, folder, audio-only, quality, login) — editable only while still
 *     QUEUED, since the download consumes them the moment it starts.
 * Once the job is processing or terminal there's nothing safe to change — use "Edit & rerun" instead
 * (the button that opens this is disabled in those phases).
 */
export default function LiveEditDialog({ jobId, status, open, onClose, onSaved }) {
  const [record, setRecord] = useState(null);
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [extract, setExtract] = useState(false);
  const [extractPassword, setExtractPassword] = useState('');
  const [rename, setRename] = useState(false);
  const [fileName, setFileName] = useState('');
  const [uri, setUri] = useState('');
  const [folderName, setFolderName] = useState('');
  const [onlyAudio, setOnlyAudio] = useState(false);
  const [videoQuality, setVideoQuality] = useState('best');
  const [urlProtected, setUrlProtected] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const beforeProcessing = !!status && status !== 'PROCESSING' && !TERMINAL.includes(status);
  const queued = status === 'QUEUED';
  const isTv = record?.type === 'TV_SERIES';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ingestion-job-params', jobId],
    queryFn: () => getJobParams(jobId),
    enabled: !!open && !!jobId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const params = data?.data ?? null;

  // Seed the inputs once params arrive.
  useEffect(() => {
    if (!params) return;
    setRecord(params.record ?? (params.recordId ? { id: params.recordId } : null));
    setSeason(params.season != null ? String(params.season) : '');
    setEpisode(params.episode != null ? String(params.episode) : '');
    setExtract(!!params.extract);
    setExtractPassword('');
    setRename(!!params.rename);
    setFileName(params.fileName ?? '');
    setUri(params.uri ?? '');
    setFolderName(params.folderName ?? '');
    setOnlyAudio(!!params.onlyAudio);
    setVideoQuality(params.videoQuality ?? 'best');
    setUrlProtected(!!params.urlProtected);
    setUsername(params.username ?? '');
    setPassword('');
  }, [params]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        recordId: record?.id ?? null,
        season: isTv && season !== '' ? Number(season) : null,
        episode: isTv && episode !== '' ? Number(episode) : null,
        extract,
        extractPassword: extract && extractPassword ? extractPassword : null,
        rename,
        fileName: rename && fileName ? fileName : null,
      };
      if (queued) {
        body.uri = uri || null;
        body.folderName = folderName || null;
        body.onlyAudio = onlyAudio;
        body.videoQuality = videoQuality || null;
        body.urlProtected = urlProtected;
        body.username = urlProtected ? (username || null) : null;
        body.password = urlProtected ? (password || null) : null;
      }
      const res = await editJobParams(jobId, body);
      if (res?.httpStatusCode >= 400) {
        notify.warning(res?.message || 'Edit failed');
      } else {
        notify.success('Job updated — changes apply when the relevant stage runs');
        onSaved?.();
        onClose?.();
      }
    } catch (e) {
      notify.error(e?.response?.data?.message ?? 'Edit failed');
    } finally {
      setSaving(false);
    }
  };

  const labelSx = { fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 };

  return (
    <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1), color: 'primary.main', flexShrink: 0 }}>
            <Tune fontSize="small" />
          </Box>
          <Box minWidth={0}>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.15}>Edit running job</Typography>
            <Typography variant="caption" color="text.secondary">
              {queued ? 'Queued — everything is still editable.'
                : beforeProcessing ? 'Downloading — processing settings only (source & format are locked).'
                : 'This job can no longer be live-edited.'}
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
            <Typography variant="body2" color="text.secondary">Loading current settings…</Typography>
          </Stack>
        ) : isError ? (
          <Alert severity="error" sx={{ borderRadius: 2.5 }}>Failed to load current job settings.</Alert>
        ) : !beforeProcessing ? (
          <Alert severity="warning" sx={{ borderRadius: 2.5 }}>
            This job is already processing or finished — use <b>Edit &amp; rerun</b> to change it.
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Alert severity="info" sx={{ borderRadius: 2.5 }}>
              {queued
                ? 'The download hasn’t started yet, so every setting below can still be changed.'
                : 'The download is in progress — you can still change how it’s processed (record link, episode, extract, filename). The source and format are locked.'}
            </Alert>

            {/* ── Processing settings (editable until the download finishes) ── */}
            <Stack spacing={1.25}>
              <Typography sx={labelSx}>Record &amp; processing</Typography>

              <RecordSearch value={record} onChange={setRecord} />

              {isTv && (
                <Stack direction="row" spacing={1}>
                  <TextField label="Season" type="number" size="small" fullWidth value={season}
                    onChange={(e) => setSeason(e.target.value)} inputProps={{ min: 1 }} />
                  <TextField label="Episode" type="number" size="small" fullWidth value={episode}
                    onChange={(e) => setEpisode(e.target.value)} inputProps={{ min: 1 }} />
                </Stack>
              )}

              <Box>
                <FormControlLabel
                  control={<Switch size="small" checked={extract} onChange={(e) => setExtract(e.target.checked)} />}
                  label={<Typography variant="body2" fontWeight={600}>Password-protected archive</Typography>}
                />
                <Collapse in={extract}>
                  <TextField label="Archive password" type="password" size="small" fullWidth
                    sx={{ mt: 1 }} value={extractPassword} onChange={(e) => setExtractPassword(e.target.value)}
                    placeholder="Archives auto-extract — set only if password-protected" />
                </Collapse>
              </Box>

              <Box>
                <FormControlLabel
                  control={<Switch size="small" checked={rename} onChange={(e) => setRename(e.target.checked)} />}
                  label={<Typography variant="body2" fontWeight={600}>Custom output filename</Typography>}
                />
                <Collapse in={rename}>
                  <TextField label="Output filename" size="small" fullWidth sx={{ mt: 1 }}
                    value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="output-filename.mkv" />
                </Collapse>
              </Box>
            </Stack>

            <Divider />

            {/* ── Download settings (editable only while QUEUED) ── */}
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography sx={labelSx}>Download &amp; source</Typography>
                {!queued && <Lock sx={{ fontSize: 14, color: 'text.disabled' }} />}
              </Stack>

              {!queued && (
                <Typography variant="caption" color="text.secondary">
                  Locked — the download has already started, so the source, folder and format can’t change.
                </Typography>
              )}

              <TextField label="Source URL" size="small" fullWidth disabled={!queued}
                value={uri} onChange={(e) => setUri(e.target.value)} />
              <Stack direction="row" spacing={1}>
                <TextField label="Target folder" size="small" fullWidth disabled={!queued}
                  value={folderName} onChange={(e) => setFolderName(e.target.value)} />
                <TextField label="Quality" size="small" select fullWidth disabled={!queued}
                  value={videoQuality} onChange={(e) => setVideoQuality(e.target.value)} sx={{ maxWidth: 160 }}>
                  <MenuItem value="best">Best</MenuItem>
                  <MenuItem value="2160">2160p</MenuItem>
                  <MenuItem value="1080">1080p</MenuItem>
                  <MenuItem value="720">720p</MenuItem>
                  <MenuItem value="480">480p</MenuItem>
                </TextField>
              </Stack>
              <FormControlLabel
                control={<Switch size="small" checked={onlyAudio} disabled={!queued}
                  onChange={(e) => setOnlyAudio(e.target.checked)} />}
                label={<Typography variant="body2" fontWeight={600}>Audio only</Typography>}
              />
              <Box>
                <FormControlLabel
                  control={<Switch size="small" checked={urlProtected} disabled={!queued}
                    onChange={(e) => setUrlProtected(e.target.checked)} />}
                  label={<Typography variant="body2" fontWeight={600}>Protected URL (login)</Typography>}
                />
                <Collapse in={urlProtected && queued}>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <TextField label="Username" size="small" fullWidth disabled={!queued}
                      value={username} onChange={(e) => setUsername(e.target.value)} />
                    <TextField label="Password" type="password" size="small" fullWidth disabled={!queued}
                      value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Stack>
                </Collapse>
              </Box>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: 999 }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}
          disabled={saving || isLoading || isError || !beforeProcessing}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ borderRadius: 999, fontWeight: 700 }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
