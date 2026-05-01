import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Collapse, Divider, FormControlLabel, IconButton,
  InputAdornment, Paper, Stack, Switch, TextField, Tooltip,
  Typography, CircularProgress, Chip, Alert, alpha,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Add, Delete, Link as LinkIcon, MusicNote, Lock, LockOutlined, Archive,
  Send, Clear, VideoSettings, UploadFile, Close, Tv
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSnackbar } from 'notistack';
import RecordSearch from './RecordSearch';
import YtFormatPicker from './YtFormatPicker';
import { detectUrlType, isYtDlp, sourceLabel } from './UrlDetector';
import { startIngestion } from '../services/ingestionApi';
import { useYtFormats } from '../hooks/useYtFormats';
import useIngestionStore from '../store/ingestionStore';

// ── Zod schema ─────────────────────────────────────────────────────────────

const urlSchema = z.object({
  url:        z.string().min(1, 'URL required'),
  customName: z.string().optional(),
  rename:     z.boolean().default(false),
  episode:    z.coerce.number().int().positive().optional().nullable(),
});

const schema = z.object({
  urls:      z.array(urlSchema).min(1, 'At least one URL is required'),
  record:    z.any().optional().nullable(),
  season:    z.coerce.number().int().positive().optional().nullable(),
  episode:   z.coerce.number().int().positive().optional().nullable(),
  // auth
  username:  z.string().optional(),
  password:  z.string().optional(),
  useAuth:   z.boolean().default(false),
  // zip
  extract:   z.boolean().default(false),
  zipPwd:    z.string().optional(),
  // audio
  audioOnly: z.boolean().default(false),
  // yt-dlp
  videoITag: z.string().optional().nullable(),
  audioITag: z.string().optional().nullable(),
});

// ── Source type badge ──────────────────────────────────────────────────────

function SourceBadge({ type }) {
  const T = useT();
  const colors = {
    youtube: T.error,
    ytdlp:   T.warning,
    magnet:  '#9c27b0',
    torrent: '#0288d1',
    http:    T.success,
  };
  if (type === 'unknown') return null;
  return (
    <Chip
      label={sourceLabel(type)}
      size="small"
      sx={{
        bgcolor: alpha(colors[type] || T.textFaint, 0.12),
        color:   colors[type] || T.textMuted,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
      }}
    />
  );
}

// ── Single URL row ─────────────────────────────────────────────────────────

function UrlRow({ index, control, watch, remove, isOnly, isYtMode, isTvRecord: _isTvRecord, showEpisode }) {
  const T   = useT();
  const url = watch(`urls.${index}.url`);
  const type = detectUrlType(url);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          borderColor: type !== 'unknown' ? alpha(
            type === 'youtube' ? T.error :
            type === 'magnet'  ? '#9c27b0' :
            T.teal, 0.3
          ) : undefined,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Controller
              name={`urls.${index}.url`}
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  size="small"
                  placeholder={isYtMode ? 'YouTube / streaming URL…' : 'https:// or magnet:…'}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: type !== 'unknown' && (
                      <InputAdornment position="end">
                        <SourceBadge type={type} />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Box>
          {!isOnly && !isYtMode && (
            <Tooltip title="Remove URL">
              <IconButton size="small" onClick={() => remove(index)} sx={{ mt: 0.25 }}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* Per-URL episode (TV series + multiple URLs) */}
        {showEpisode && (
          <Stack direction="row" spacing={1} alignItems="center" mt={0.75}>
            <Tv sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Controller
              name={`urls.${index}.episode`}
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
                  sx={{ width: 100 }}
                />
              )}
            />
          </Stack>
        )}

        {/* Custom rename */}
        {!isYtMode && (
          <Box sx={{ mt: 1 }}>
            <Controller
              name={`urls.${index}.rename`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} size="small" />}
                  label={<Typography variant="caption">Custom filename</Typography>}
                  sx={{ ml: 0 }}
                />
              )}
            />
            <Controller
              name={`urls.${index}.rename`}
              control={control}
              render={({ field: renameField }) =>
                renameField.value ? (
                  <Controller
                    name={`urls.${index}.customName`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        size="small"
                        fullWidth
                        placeholder="output-filename.mkv"
                        sx={{ mt: 0.75 }}
                      />
                    )}
                  />
                ) : null
              }
            />
          </Box>
        )}
      </Paper>
    </motion.div>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────

export default function IngestionForm({ onSubmitted }) {
  const { enqueueSnackbar } = useSnackbar();
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);
  const torrentInputRef = useRef(null);
  const [torrentFile,   setTorrentFile]   = useState(null);
  const [torrentBase64, setTorrentBase64] = useState(null);

  const { control, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(schema),
      defaultValues: {
        urls:      [{ url: '', customName: '', rename: false, episode: null }],
        record:    null,
        season:    null,
        episode:   null,
        username:  '',
        password:  '',
        useAuth:   false,
        extract:   false,
        zipPwd:    '',
        audioOnly: false,
        videoITag: null,
        audioITag: null,
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'urls' });

  const urls      = watch('urls');
  const useAuth   = watch('useAuth');
  const extract   = watch('extract');
  const audioOnly = watch('audioOnly');
  const videoITag = watch('videoITag');
  const audioITag = watch('audioITag');
  const record    = watch('record');

  const firstUrl  = urls?.[0]?.url ?? '';
  const firstType = detectUrlType(firstUrl);
  const isYtMode  = isYtDlp(firstType);
  const isTvRecord = record?.type === 'TV_SERIES';

  // Per-URL episode fields only when TV series + more than one URL
  const showPerUrlEpisode = isTvRecord && fields.length > 1;

  // YT formats fetch
  const [fetchUrl, setFetchUrl] = useState('');
  const fetchTimerRef = useRef(null);

  useEffect(() => {
    clearTimeout(fetchTimerRef.current);
    if (isYtMode && firstUrl) {
      fetchTimerRef.current = setTimeout(() => setFetchUrl(firstUrl), 1200);
    } else {
      setFetchUrl('');
    }
  }, [firstUrl, isYtMode]);

  const { data: formatsData, isFetching: formatsLoading, error: formatsError } =
    useYtFormats(fetchUrl);

  const handleTorrentFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTorrentFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setTorrentBase64(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Auto-increment episode when adding a new URL in TV + multi mode
  const handleAppendUrl = () => {
    const lastEpisode = fields.length > 0
      ? Number(watch(`urls.${fields.length - 1}.episode`)) || null
      : null;
    append({
      url: '', customName: '', rename: false,
      episode: lastEpisode != null ? lastEpisode + 1 : null,
    });
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const onSubmit = useCallback(async (data) => {
    const uris = data.urls.map((u) => u.url.trim()).filter(Boolean);

    if (!torrentBase64 && uris.length === 0) {
      enqueueSnackbar('Provide at least one URL or upload a .torrent file', { variant: 'warning' });
      return;
    }

    const sharedOptions = {
      recordId:        data.record?.id ?? null,
      onlyAudio:       data.audioOnly,
      extract:         data.extract,
      urlProtected:    data.useAuth,
      username:        data.useAuth ? data.username : undefined,
      password:        data.useAuth ? data.password : undefined,
      extractPassword: data.extract && data.zipPwd ? data.zipPwd : undefined,
      videoITag:       isYtMode && !data.audioOnly ? data.videoITag : undefined,
      audioITag:       isYtMode ? data.audioITag : undefined,
      ...(torrentBase64 && { torrentBase64 }),
    };

    // TV series + multiple URLs → fire one job per URL with its own episode (sequential)
    if (showPerUrlEpisode && uris.length > 1) {
      const season = data.season ? Number(data.season) : null;
      const validUrls = data.urls.filter((u) => u.url.trim());

      let ok = 0, bad = 0;
      for (const u of validUrls) {
        try {
          await startIngestion({
            ...sharedOptions,
            uris:    [u.url.trim()],
            season,
            episode: u.episode ? Number(u.episode) : null,
            rename:   u.rename || false,
            fileName: u.rename ? u.customName : undefined,
          });
          ok++;
        } catch {
          bad++;
        }
      }

      enqueueSnackbar(
        `${ok} job(s) queued${bad ? `, ${bad} failed` : ''}`,
        { variant: ok > 0 ? 'success' : 'error' }
      );
      if (ok > 0) {
        reset(); setFetchUrl(''); setTorrentFile(null); setTorrentBase64(null);
        setActiveTab(1); onSubmitted?.();
      }
      return;
    }

    // Default: single request with all URIs
    const body = {
      ...sharedOptions,
      uris,
      season:  data.season  ? Number(data.season)  : null,
      episode: data.episode ? Number(data.episode) : null,
      rename:   data.urls[0]?.rename || false,
      fileName: data.urls[0]?.rename ? data.urls[0]?.customName : undefined,
    };

    try {
      const res = await startIngestion(body);
      if (res.httpStatusCode === 200 || res.httpStatusCode === 201) {
        enqueueSnackbar(
          `${res.data?.length ?? 1} job(s) started`,
          { variant: 'success' }
        );
        reset(); setFetchUrl(''); setTorrentFile(null); setTorrentBase64(null);
        setActiveTab(1); onSubmitted?.();
      } else {
        enqueueSnackbar(res.message || 'Failed to start job', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Network error', { variant: 'error' });
    }
  }, [isYtMode, showPerUrlEpisode, enqueueSnackbar, reset, setActiveTab, onSubmitted, torrentBase64]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2.5}>

        {/* ── URLs Section ──────────────────────────────────────────────── */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2" fontWeight={600}>
              Source URL(s)
            </Typography>
            {!isYtMode && (
              <Button
                size="small"
                startIcon={<Add />}
                onClick={handleAppendUrl}
                disabled={fields.length >= 20}
              >
                Add URL
              </Button>
            )}
          </Stack>

          {showPerUrlEpisode && (
            <Alert severity="info" sx={{ mb: 1, py: 0.5 }} icon={<Tv sx={{ fontSize: 16 }} />}>
              <Typography variant="caption">
                Multiple URLs detected for a TV series — set the episode number for each URL.
              </Typography>
            </Alert>
          )}

          <AnimatePresence>
            <Stack spacing={1}>
              {fields.map((field, index) => (
                <UrlRow
                  key={field.id}
                  index={index}
                  control={control}
                  watch={watch}
                  remove={remove}
                  isOnly={fields.length === 1}
                  isYtMode={isYtMode}
                  isTvRecord={isTvRecord}
                  showEpisode={showPerUrlEpisode}
                />
              ))}
            </Stack>
          </AnimatePresence>

          {errors.urls && !torrentBase64 && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
              {errors.urls.message || errors.urls.root?.message}
            </Typography>
          )}

          {/* Torrent file upload */}
          <Box sx={{ mt: 1 }}>
            <input
              ref={torrentInputRef}
              type="file"
              accept=".torrent"
              style={{ display: 'none' }}
              onChange={handleTorrentFile}
            />
            {torrentFile ? (
              <Chip
                icon={<UploadFile sx={{ fontSize: '14px !important' }} />}
                label={torrentFile.name}
                onDelete={() => { setTorrentFile(null); setTorrentBase64(null); }}
                deleteIcon={<Close sx={{ fontSize: '14px !important' }} />}
                color="info"
                variant="outlined"
                size="small"
                sx={{ maxWidth: '100%', fontSize: '0.72rem' }}
              />
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadFile sx={{ fontSize: 15 }} />}
                onClick={() => torrentInputRef.current?.click()}
                sx={{ fontSize: '0.75rem', borderStyle: 'dashed' }}
              >
                Upload .torrent file
              </Button>
            )}
          </Box>
        </Box>

        {/* ── YouTube Format Picker ──────────────────────────────────────── */}
        {isYtMode && fetchUrl && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
              <VideoSettings sx={{ fontSize: 18, color: 'error.main' }} />
              <Typography variant="subtitle2" fontWeight={600}>Format Selection</Typography>
              {formatsLoading && <CircularProgress size={14} />}
            </Stack>

            {formatsError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                Failed to fetch formats. Check URL or try again.
              </Alert>
            )}

            <FormControlLabel
              control={
                <Controller
                  name="audioOnly"
                  control={control}
                  render={({ field }) => (
                    <Switch {...field} checked={field.value} size="small" color="secondary" />
                  )}
                />
              }
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <MusicNote sx={{ fontSize: 15 }} />
                  <Typography variant="caption">Audio only (extract audio)</Typography>
                </Stack>
              }
              sx={{ mb: 1.5 }}
            />

            <YtFormatPicker
              formatsData={formatsData}
              loading={formatsLoading}
              audioOnly={audioOnly}
              selectedVideo={videoITag}
              selectedAudio={audioITag}
              onSelectVideo={(id) => setValue('videoITag', id)}
              onSelectAudio={(id) => setValue('audioITag', id)}
            />
          </Paper>
        )}

        {/* Audio-only for non-YT */}
        {!isYtMode && (
          <Controller
            name="audioOnly"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch {...field} checked={field.value} size="small" />}
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <MusicNote sx={{ fontSize: 15 }} />
                    <Typography variant="body2">Audio only (songs)</Typography>
                  </Stack>
                }
              />
            )}
          />
        )}

        <Divider />

        {/* ── Record + Season/Episode ────────────────────────────────────── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            Record (optional)
          </Typography>
          <Controller
            name="record"
            control={control}
            render={({ field }) => (
              <RecordSearch value={field.value} onChange={field.onChange} />
            )}
          />

          {isTvRecord && (
            <Stack direction="row" spacing={1.5} mt={1.5}>
              {/* Season always shown for TV series */}
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
                    helperText={fieldState.error?.message}
                    sx={{ width: 120 }}
                  />
                )}
              />
              {/* Episode only shown for single URL — multi-URL uses per-row episode */}
              {!showPerUrlEpisode && (
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
                      helperText={fieldState.error?.message}
                      sx={{ width: 120 }}
                    />
                  )}
                />
              )}
            </Stack>
          )}
        </Box>

        <Divider />

        {/* ── Options Section ────────────────────────────────────────────── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Options</Typography>
          <Stack spacing={1.5}>

            {/* HTTP Auth */}
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Controller
                name="useAuth"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} size="small" />}
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Lock sx={{ fontSize: 15 }} />
                        <Typography variant="body2">URL requires authentication</Typography>
                      </Stack>
                    }
                  />
                )}
              />
              <Collapse in={useAuth}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1}>
                  <Controller
                    name="username"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} size="small" label="Username" fullWidth />
                    )}
                  />
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} size="small" label="Password" type="password" fullWidth />
                    )}
                  />
                </Stack>
              </Collapse>
            </Paper>

            {/* ZIP Extraction */}
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Controller
                name="extract"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} size="small" />}
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Archive sx={{ fontSize: 15 }} />
                        <Typography variant="body2">Extract ZIP / RAR / 7z after download</Typography>
                      </Stack>
                    }
                  />
                )}
              />
              <Collapse in={extract}>
                <Controller
                  name="zipPwd"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Archive password (optional)"
                      type="password"
                      size="small"
                      fullWidth
                      sx={{ mt: 1 }}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message ?? 'Leave blank if the archive has no password'}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlined sx={{ fontSize: 16, color: 'text.disabled' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Collapse>
            </Paper>
          </Stack>
        </Box>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button
            variant="outlined"
            startIcon={<Clear />}
            onClick={() => { reset(); setFetchUrl(''); }}
            disabled={isSubmitting}
          >
            Clear
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <Send />}
            disabled={isSubmitting}
            sx={{ px: 3 }}
          >
            {isSubmitting ? 'Starting…' : `Start ${fields.length > 1 ? `${fields.length} Jobs` : 'Job'}`}
          </Button>
        </Stack>

      </Stack>
    </Box>
  );
}
