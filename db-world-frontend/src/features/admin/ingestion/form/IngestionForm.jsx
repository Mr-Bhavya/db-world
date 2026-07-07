import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
} from 'react-hook-form';

import {
  Add,
  Archive,
  Clear,
  Close,
  Delete,
  DriveFileRenameOutline,
  Link as LinkIcon,
  Lock,
  LockOutlined,
  PlaylistPlay,
  Send,
  Tv,
  UploadFile,
  VideoSettings,
  QueueMusic,
  AutoAwesome,
  LockReset,
} from '@mui/icons-material';

import { AnimatePresence, motion } from 'framer-motion';
import { useSnackbar } from 'notistack';

import { useT } from '@shared/theme';
import RecordSearch from './RecordSearch';
import YtFormatPicker from './YtFormatPicker';
import PlaylistPicker from './PlaylistPicker';
import { detectUrlType, isYtDlp, sourceLabel } from './UrlDetector';
import { startIngestion } from '../services/ingestionApi';
import { useYtFormats } from '../hooks/useYtFormats';
import useIngestionStore from '../store/ingestionStore';

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const positiveOptionalInt = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  })
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), {
    message: 'Must be a positive integer',
  });

const urlSchema = z.object({
  url: z.string().trim().optional().default(''),
  customName: z.string().optional().default(''),
  rename: z.boolean().default(false),
  episode: positiveOptionalInt.optional().nullable(),
});

const schema = z.object({
  urls: z.array(urlSchema).default([
    { url: '', customName: '', rename: false, episode: null },
  ]),
  record: z.any().optional().nullable(),
  season: positiveOptionalInt.optional().nullable(),
  episode: positiveOptionalInt.optional().nullable(),

  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  useAuth: z.boolean().default(false),

  extract: z.boolean().default(false),
  zipPwd: z.string().optional().default(''),

  audioOnly: z.boolean().default(false),

  videoITag: z.string().optional().nullable(),
  audioITag: z.string().optional().nullable(),
  videoQuality: z.string().optional().default('best'),
});

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getSourceColors(T, type) {
  switch (type) {
    case 'youtube':
      return {
        color: T.error,
        bg: alpha(T.error, 0.1),
        border: alpha(T.error, 0.28),
      };
    case 'ytdlp':
      return {
        color: T.warning,
        bg: alpha(T.warning, 0.1),
        border: alpha(T.warning, 0.28),
      };
    case 'magnet':
      return {
        color: '#9c27b0',
        bg: alpha('#9c27b0', 0.1),
        border: alpha('#9c27b0', 0.28),
      };
    case 'torrent':
      return {
        color: '#0288d1',
        bg: alpha('#0288d1', 0.1),
        border: alpha('#0288d1', 0.28),
      };
    case 'http':
      return {
        color: T.success,
        bg: alpha(T.success, 0.1),
        border: alpha(T.success, 0.28),
      };
    default:
      return {
        color: T.textMuted,
        bg: alpha(T.textFaint, 0.08),
        border: alpha(T.textFaint, 0.15),
      };
  }
}

function SourceBadge({ type }) {
  const T = useT();
  if (!type || type === 'unknown') return null;

  const colors = getSourceColors(T, type);

  return (
    <Chip
      label={sourceLabel(type)}
      size="small"
      sx={{
        bgcolor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        fontWeight: 700,
        fontSize: '0.72rem',
        height: 24,
        borderRadius: 999,
      }}
    />
  );
}

function SectionCard({ title, subtitle, icon, action, children, sx = {} }) {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        borderRadius: { xs: 3, sm: 4 },
        borderColor: alpha(theme.palette.divider, 0.7),
        background:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.02) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 8px 24px rgba(0,0,0,0.16)'
            : '0 8px 24px rgba(15, 23, 42, 0.045)',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box
        sx={{
          px: { xs: 1.25, sm: 1.75, md: 2.25 },
          py: { xs: 1.25, sm: 1.5, md: 1.75 },
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={1.25}
          mb={children ? 1.25 : 0}
        >
          <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
            <Box
              sx={{
                width: { xs: 34, sm: 38 },
                height: { xs: 34, sm: 38 },
                borderRadius: 2.25,
                display: 'grid',
                placeItems: 'center',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>

            <Box minWidth={0}>
              <Typography
                variant="subtitle1"
                fontWeight={800}
                lineHeight={1.15}
                sx={{ fontSize: { xs: '0.97rem', sm: '1rem' } }}
              >
                {title}
              </Typography>
              {subtitle ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.25, lineHeight: 1.3 }}
                >
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

function OptionTile({ icon, title, subtitle, checked, onChange, children }) {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        px: 1.25,
        py: 1.1,
        borderColor: checked
          ? alpha(theme.palette.primary.main, 0.35)
          : alpha(theme.palette.divider, 0.8),
        bgcolor: checked
          ? alpha(theme.palette.primary.main, 0.04)
          : 'background.paper',
        transition: '0.2s ease',
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={0.75}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                color: 'primary.main',
              }}
            >
              {icon}
            </Box>

            <Box>
              <Typography variant="body2" fontWeight={700}>
                {title}
              </Typography>
              {subtitle ? (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          <Switch checked={checked} onChange={onChange} size="small" />
        </Stack>

        <Collapse in={checked}>{children}</Collapse>
      </Stack>
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// URL Row
// ─────────────────────────────────────────────────────────────────────────────

const UrlRow = memo(function UrlRow({
  index,
  control,
  remove,
  canRemove,
  isYtMode,
  showPerUrlEpisode,
  compact = false,
}) {
  const T = useT();
  const urlValue = useWatch({ control, name: `urls.${index}.url` });
  const renameValue = useWatch({ control, name: `urls.${index}.rename` });
  const type = detectUrlType(urlValue || '');
  const sourceColors = getSourceColors(T, type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -18, scale: 0.985 }}
      transition={{ duration: 0.18 }}
    >
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: compact ? { xs: 1, sm: 1.25 } : { xs: 1.1, sm: 1.35 },
          borderRadius: 3,
          borderColor: type !== 'unknown' ? sourceColors.border : 'divider',
          bgcolor: type !== 'unknown' ? sourceColors.bg : 'background.paper',
        }}
      >
        <Stack spacing={1}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Controller
                name={`urls.${index}.url`}
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    label={index === 0 ? 'Source URL' : `Source URL ${index + 1}`}
                    placeholder={isYtMode ? 'YouTube / streaming URL…' : 'https://, magnet:, ftp:// …'}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message || ' '}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment:
                        type !== 'unknown' ? (
                          <InputAdornment position="end">
                            <SourceBadge type={type} />
                          </InputAdornment>
                        ) : undefined,
                    }}
                  />
                )}
              />
            </Box>

            {canRemove && !isYtMode ? (
              <Tooltip title="Remove URL">
                <IconButton
                  size="small"
                  onClick={() => remove(index)}
                  sx={{
                    mt: { xs: -0.25, sm: 0.5 },
                    alignSelf: { xs: 'flex-end', sm: 'unset' },
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            {showPerUrlEpisode ? (
              <Box sx={{ width: { xs: '100%', md: 120 } }}>
                <Controller
                  name={`urls.${index}.episode`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      label="Episode"
                      size="small"
                      type="number"
                      fullWidth
                      inputProps={{ min: 1 }}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || ' '}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Tv sx={{ fontSize: 16, color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Box>
            ) : null}

            {!isYtMode ? (
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Controller
                  name={`urls.${index}.rename`}
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      sx={{ ml: 0.2, mr: 0 }}
                      control={
                        <Switch
                          checked={!!field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          size="small"
                        />
                      }
                      label={
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <DriveFileRenameOutline sx={{ fontSize: 16 }} />
                          <Typography variant="caption" fontWeight={600}>
                            Custom filename
                          </Typography>
                        </Stack>
                      }
                    />
                  )}
                />
              </Box>
            ) : null}
          </Stack>

          {!isYtMode && renameValue ? (
            <Controller
              name={`urls.${index}.customName`}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  size="small"
                  label="Output filename"
                  placeholder="output-filename.mkv"
                />
              )}
            />
          ) : null}
        </Stack>
      </Paper>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Form
// ─────────────────────────────────────────────────────────────────────────────

export default function IngestionForm({ onSubmitted }) {
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const setActiveTab = useIngestionStore((s) => s.setActiveTab);

  const torrentInputRef = useRef(null);
  const fetchTimerRef = useRef(null);

  const [torrentFile, setTorrentFile] = useState(null);
  const [torrentBase64, setTorrentBase64] = useState(null);
  const [playlistSelected, setPlaylistSelected] = useState(new Set());
  const [fetchUrl, setFetchUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showZipPassword, setShowZipPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    getValues,
    formState: { isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      urls: [{ url: '', customName: '', rename: false, episode: null }],
      record: null,
      season: null,
      episode: null,
      username: '',
      password: '',
      useAuth: false,
      extract: false,
      zipPwd: '',
      audioOnly: false,
      videoITag: null,
      audioITag: null,
      videoQuality: 'best',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'urls',
  });

  const urls = useWatch({ control, name: 'urls' }) || [];
  const audioOnly = !!useWatch({ control, name: 'audioOnly' });
  const videoITag = useWatch({ control, name: 'videoITag' });
  const audioITag = useWatch({ control, name: 'audioITag' });
  const record = useWatch({ control, name: 'record' });
  const season = useWatch({ control, name: 'season' });
  const episode = useWatch({ control, name: 'episode' });

  const firstUrl = useMemo(() => (urls?.[0]?.url || '').trim(), [urls]);
  const firstType = useMemo(() => detectUrlType(firstUrl), [firstUrl]);
  const isYtMode = useMemo(() => isYtDlp(firstType), [firstType]);
  const isTvRecord = useMemo(() => record?.type === 'TV_SERIES', [record]);

  const showPerUrlEpisode = useMemo(
    () => isTvRecord && fields.length > 1,
    [isTvRecord, fields.length]
  );

  const nonEmptyUrlsCount = useMemo(
    () => urls.filter((u) => (u?.url || '').trim()).length,
    [urls]
  );

  useEffect(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);

    if (isYtMode && firstUrl) {
      fetchTimerRef.current = setTimeout(() => {
        setFetchUrl(firstUrl);
      }, 900);
    } else {
      setFetchUrl('');
    }

    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [firstUrl, isYtMode]);

  const {
    data: formatsData,
    isFetching: formatsLoading,
    error: formatsError,
  } = useYtFormats(fetchUrl);

  const isPlaylist = useMemo(
    () => isYtMode && !!formatsData?.isPlaylist,
    [isYtMode, formatsData]
  );

  useEffect(() => {
    if (formatsData?.isPlaylist && formatsData?.playlistEntries?.length) {
      setPlaylistSelected(new Set(formatsData.playlistEntries.map((e) => e.index)));
    } else {
      setPlaylistSelected(new Set());
    }
  }, [formatsData]);

  useEffect(() => {
    if (!isYtMode) {
      setValue('videoITag', null);
      setValue('audioITag', null);
      setValue('audioOnly', false);
    }
  }, [isYtMode, setValue]);

  const clearTransientState = useCallback(() => {
    setFetchUrl('');
    setPlaylistSelected(new Set());
    setTorrentFile(null);
    setTorrentBase64(null);
  }, []);

  const handleReset = useCallback(() => {
    reset({
      urls: [{ url: '', customName: '', rename: false, episode: null }],
      record: null,
      season: null,
      episode: null,
      username: '',
      password: '',
      useAuth: false,
      extract: false,
      zipPwd: '',
      audioOnly: false,
      videoITag: null,
      audioITag: null,
    });
    clearTransientState();
  }, [reset, clearTransientState]);

  const handleTorrentFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTorrentFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1];
        setTorrentBase64(base64 || null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleRemoveTorrent = useCallback(() => {
    setTorrentFile(null);
    setTorrentBase64(null);
  }, []);

  const handleAppendUrl = useCallback(() => {
    const currentUrls = getValues('urls') || [];
    const lastEpisodeValue = currentUrls.length
      ? Number(currentUrls[currentUrls.length - 1]?.episode) || null
      : null;

    append({
      url: '',
      customName: '',
      rename: false,
      episode: lastEpisodeValue != null ? lastEpisodeValue + 1 : null,
    });
  }, [append, getValues]);

  const queueJobsSequentially = useCallback(async (jobs) => {
    let ok = 0;
    let bad = 0;

    for (const job of jobs) {
      try {
        await startIngestion(job);
        ok += 1;
      } catch {
        bad += 1;
      }
    }

    return { ok, bad };
  }, []);

  const onSubmit = useCallback(
    async (data) => {
      const validUrls = (data.urls || [])
        .map((u) => ({
          ...u,
          url: (u.url || '').trim(),
          customName: (u.customName || '').trim(),
        }))
        .filter((u) => u.url);

      const uris = validUrls.map((u) => u.url);

      if (!torrentBase64 && uris.length === 0) {
        enqueueSnackbar('Provide at least one URL or upload a .torrent file', {
          variant: 'warning',
        });
        return;
      }

      const sharedOptions = {
        recordId: data.record?.id ?? null,
        onlyAudio: isYtMode ? !!data.audioOnly : false,
        extract: !!data.extract,
        urlProtected: !!data.useAuth,
        username: data.useAuth ? data.username : undefined,
        password: data.useAuth ? data.password : undefined,
        extractPassword:
          data.extract && data.zipPwd ? data.zipPwd : undefined,
        videoITag: isYtMode && !data.audioOnly ? data.videoITag : undefined,
        audioITag: isYtMode ? data.audioITag : undefined,
        // Quality preset — used by playlists (itags differ per video) and ignored by the
        // backend whenever a specific videoITag is present.
        videoQuality: isYtMode && !data.audioOnly ? (data.videoQuality || undefined) : undefined,
        ...(torrentBase64 ? { torrentBase64 } : {}),
      };

      if (isPlaylist) {
        const entries = formatsData?.playlistEntries ?? [];
        const toDownload = entries.filter((e) => playlistSelected.has(e.index));

        if (toDownload.length === 0) {
          enqueueSnackbar('Select at least one playlist item', {
            variant: 'warning',
          });
          return;
        }

        const seasonNumber = data.season ? Number(data.season) : null;
        const episodeBase = data.episode ? Number(data.episode) : null;

        const jobs = toDownload.map((entry, i) => ({
          ...sharedOptions,
          uris: [entry.url],
          // Prefer the source's real season/episode (Hotstar etc. expose these via yt-dlp);
          // fall back to your Season/Episode inputs, then to playlist order.
          season: entry.seasonNumber ?? seasonNumber,
          episode: isTvRecord
            ? (entry.episodeNumber
                ?? (episodeBase != null ? episodeBase + i : entry.index))
            : null,
        }));

        const { ok, bad } = await queueJobsSequentially(jobs);

        enqueueSnackbar(
          `${ok} job(s) queued${bad ? `, ${bad} failed` : ''}`,
          { variant: ok > 0 ? 'success' : 'error' }
        );

        if (ok > 0) {
          handleReset();
          setActiveTab(1);
          onSubmitted?.();
        }

        return;
      }

      if (showPerUrlEpisode && uris.length > 1) {
        const seasonNumber = data.season ? Number(data.season) : null;

        const jobs = validUrls.map((u) => ({
          ...sharedOptions,
          uris: [u.url],
          season: seasonNumber,
          episode: u.episode ? Number(u.episode) : null,
          rename: !!u.rename,
          fileName: u.rename ? u.customName : undefined,
        }));

        const { ok, bad } = await queueJobsSequentially(jobs);

        enqueueSnackbar(
          `${ok} job(s) queued${bad ? `, ${bad} failed` : ''}`,
          { variant: ok > 0 ? 'success' : 'error' }
        );

        if (ok > 0) {
          handleReset();
          setActiveTab(1);
          onSubmitted?.();
        }

        return;
      }

      const body = {
        ...sharedOptions,
        uris,
        season: data.season ? Number(data.season) : null,
        episode: data.episode ? Number(data.episode) : null,
        rename: !!validUrls[0]?.rename,
        fileName: validUrls[0]?.rename ? validUrls[0]?.customName : undefined,
      };

      try {
        const res = await startIngestion(body);

        if (res?.httpStatusCode === 200 || res?.httpStatusCode === 201) {
          enqueueSnackbar(`${res?.data?.length ?? 1} job(s) started`, {
            variant: 'success',
          });
          handleReset();
          setActiveTab(1);
          onSubmitted?.();
        } else {
          enqueueSnackbar(res?.message || 'Failed to start job', {
            variant: 'error',
          });
        }
      } catch (e) {
        enqueueSnackbar(
          e?.response?.data?.message ?? 'Network error',
          { variant: 'error' }
        );
      }
    },
    [
      torrentBase64,
      enqueueSnackbar,
      isYtMode,
      isPlaylist,
      formatsData,
      playlistSelected,
      isTvRecord,
      showPerUrlEpisode,
      queueJobsSequentially,
      handleReset,
      setActiveTab,
      onSubmitted,
    ]
  );

  const submitLabel = useMemo(() => {
    if (isSubmitting) return 'Starting…';
    if (isPlaylist) {
      return `Start ${playlistSelected.size} Job${playlistSelected.size !== 1 ? 's' : ''}`;
    }
    const count = Math.max(nonEmptyUrlsCount, torrentBase64 ? 1 : 0);
    return `Start ${count > 1 ? `${count} Jobs` : 'Job'}`;
  }, [isSubmitting, isPlaylist, playlistSelected, nonEmptyUrlsCount, torrentBase64]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      sx={{
        maxWidth: 1480,
        mx: 'auto',
        px: { xs: 1, sm: 1.5, lg: 2.5 },
        pt: { xs: 1, sm: 1.25 },
        pb: { xs: 10, md: 11 },
      }}
    >
      <Stack spacing={{ xs: 1.5, sm: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1.5, sm: 2 },
            gridTemplateColumns: {
              xs: '1fr',
              xl: 'minmax(0, 1.45fr) minmax(340px, 0.9fr)',
            },
          }}
        >
          {/* LEFT COLUMN */}
          <Stack spacing={{ xs: 1.5, sm: 2 }} minWidth={0}>
            {/* Record mapping FIRST */}
            <SectionCard
              title="Record mapping"
              subtitle="Choose record first so TV rules and episode handling are clear"
              icon={<Tv fontSize="small" />}
            >
              <Stack spacing={1.25}>
                <Controller
                  name="record"
                  control={control}
                  render={({ field }) => (
                    <RecordSearch value={field.value} onChange={field.onChange} />
                  )}
                />

                {isTvRecord ? (
                  <>
                    <Divider />
                    <Stack spacing={1}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        TV series details
                      </Typography>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: showPerUrlEpisode ? '1fr' : '1fr 1fr',
                            sm: showPerUrlEpisode ? '180px 1fr' : '140px 140px',
                          },
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
                              onChange={(e) => field.onChange(e.target.value)}
                              label="Season"
                              size="small"
                              type="number"
                              fullWidth
                              inputProps={{ min: 1 }}
                              error={!!fieldState.error}
                              helperText={fieldState.error?.message || ' '}
                            />
                          )}
                        />

                        {!showPerUrlEpisode ? (
                          <Controller
                            name="episode"
                            control={control}
                            render={({ field, fieldState }) => (
                              <TextField
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                label="Episode"
                                size="small"
                                type="number"
                                fullWidth
                                inputProps={{ min: 1 }}
                                error={!!fieldState.error}
                                helperText={fieldState.error?.message || ' '}
                              />
                            )}
                          />
                        ) : (
                          <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                            Episode numbers are handled per URL because you added multiple sources.
                          </Alert>
                        )}
                      </Box>
                    </Stack>
                  </>
                ) : null}
              </Stack>
            </SectionCard>

            {/* Source input */}
            <SectionCard
              title="Source input"
              subtitle="Add URLs or upload a .torrent file"
              icon={<LinkIcon fontSize="small" />}
              action={
                !isYtMode ? (
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={handleAppendUrl}
                    disabled={fields.length >= 20 || isSubmitting}
                    sx={{ borderRadius: 999, minWidth: 0, px: { xs: 1.1, sm: 1.4 } }}
                  >
                    Add URL
                  </Button>
                ) : null
              }
            >
              <Stack spacing={1.1}>
                {showPerUrlEpisode ? (
                  <Alert
                    severity="info"
                    icon={<Tv sx={{ fontSize: 18 }} />}
                    sx={{ borderRadius: 2.5 }}
                  >
                    Multiple URLs detected for a TV series — assign the episode number for each URL.
                  </Alert>
                ) : null}

                <AnimatePresence initial={false}>
                  <Stack spacing={0.9}>
                    {fields.map((field, index) => (
                      <UrlRow
                        key={field.id}
                        index={index}
                        control={control}
                        remove={remove}
                        canRemove={fields.length > 1}
                        isYtMode={isYtMode}
                        showPerUrlEpisode={showPerUrlEpisode}
                        compact={isSmDown}
                      />
                    ))}
                  </Stack>
                </AnimatePresence>

                {/* Torrent upload */}
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 0.25,
                    p: { xs: 1.2, sm: 1.5 },
                    borderRadius: 3,
                    borderStyle: 'dashed',
                    borderColor: alpha(theme.palette.divider, 0.85),
                    bgcolor: alpha(theme.palette.info.main, 0.03),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(theme.palette.info.main, 0.1),
                          color: 'info.main',
                          flexShrink: 0,
                        }}
                      >
                        <UploadFile sx={{ fontSize: 19 }} />
                      </Box>
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={700}>
                          Torrent file
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Submit a .torrent without URLs if needed.
                        </Typography>
                      </Box>
                    </Stack>

                    <Box>
                      <input
                        ref={torrentInputRef}
                        type="file"
                        accept=".torrent"
                        style={{ display: 'none' }}
                        onChange={handleTorrentFile}
                      />

                      {torrentFile ? (
                        <Chip
                          icon={<UploadFile sx={{ fontSize: '16px !important' }} />}
                          label={torrentFile.name}
                          onDelete={handleRemoveTorrent}
                          deleteIcon={<Close sx={{ fontSize: '16px !important' }} />}
                          color="info"
                          variant="outlined"
                          sx={{
                            maxWidth: { xs: '100%', sm: 280 },
                            '& .MuiChip-label': {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            },
                          }}
                        />
                      ) : (
                        <Button
                          variant="outlined"
                          startIcon={<UploadFile />}
                          onClick={() => torrentInputRef.current?.click()}
                          sx={{ borderRadius: 999 }}
                        >
                          Upload .torrent
                        </Button>
                      )}
                    </Box>
                  </Stack>
                </Paper>
              </Stack>
            </SectionCard>

            {/* YT formats / playlist */}
            {isYtMode && fetchUrl ? (
              <SectionCard
                title={isPlaylist ? 'Playlist selection' : 'Format selection'}
                subtitle={
                  isPlaylist
                    ? 'Choose playlist items to queue'
                    : 'Choose video/audio formats for yt-dlp sources'
                }
                icon={
                  isPlaylist ? (
                    <PlaylistPlay fontSize="small" />
                  ) : (
                    <VideoSettings fontSize="small" />
                  )
                }
              >
                <Stack spacing={1.25}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      {formatsLoading ? (
                        <CircularProgress size={16} />
                      ) : (
                        <AutoAwesome sx={{ fontSize: 18, color: 'primary.main' }} />
                      )}
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {isPlaylist ? 'Playlist detected' : 'Media formats ready'}
                        </Typography>
                        {formatsData?.title ? (
                          <Typography variant="caption" color="text.secondary">
                            {formatsData.title}
                          </Typography>
                        ) : null}
                      </Box>
                    </Stack>

                    {!isPlaylist ? (
                      <Controller
                        name="audioOnly"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            sx={{ m: 0 }}
                            control={
                              <Switch
                                checked={!!field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                                size="small"
                                color="secondary"
                              />
                            }
                            label={
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <QueueMusic sx={{ fontSize: 16 }} />
                                <Typography variant="caption" fontWeight={700}>
                                  Audio only
                                </Typography>
                              </Stack>
                            }
                          />
                        )}
                      />
                    ) : null}
                  </Stack>

                  {formatsError ? (
                    <Alert severity="error" sx={{ borderRadius: 2.5 }}>
                      {isPlaylist
                        ? 'Failed to fetch playlist. Check the URL and try again.'
                        : 'Failed to fetch formats. Check the URL and try again.'}
                    </Alert>
                  ) : null}

                  {isPlaylist ? (
                    <Stack spacing={1.5}>
                      <Controller
                        name="videoQuality"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? 'best'}
                            select
                            size="small"
                            fullWidth
                            label="Quality"
                            helperText="Applied to every selected item (itags differ per video, so a fixed quality is used)"
                          >
                            <MenuItem value="best">Best available</MenuItem>
                            <MenuItem value="2160">2160p (4K)</MenuItem>
                            <MenuItem value="1080">1080p</MenuItem>
                            <MenuItem value="720">720p</MenuItem>
                            <MenuItem value="480">480p</MenuItem>
                          </TextField>
                        )}
                      />
                      <PlaylistPicker
                        entries={formatsData?.playlistEntries ?? []}
                        selected={playlistSelected}
                        onChange={setPlaylistSelected}
                        loading={formatsLoading}
                      />
                    </Stack>
                  ) : (
                    <YtFormatPicker
                      formatsData={formatsData}
                      loading={formatsLoading}
                      audioOnly={audioOnly}
                      selectedVideo={videoITag}
                      selectedAudio={audioITag}
                      onSelectVideo={(id) => setValue('videoITag', id)}
                      onSelectAudio={(id) => setValue('audioITag', id)}
                    />
                  )}
                </Stack>
              </SectionCard>
            ) : null}
          </Stack>

          {/* RIGHT COLUMN */}
          <Stack spacing={{ xs: 1.5, sm: 2 }} minWidth={0}>
            <SectionCard
              title="Options"
              subtitle="Authentication, extraction and output behavior"
              icon={<LockReset fontSize="small" />}
            >
              <Stack spacing={1.1}>
                {/* HTTP Auth */}
                <Controller
                  name="useAuth"
                  control={control}
                  render={({ field }) => (
                    <OptionTile
                      icon={<Lock sx={{ fontSize: 18 }} />}
                      title="Protected URL"
                      subtitle="Use credentials for authenticated sources"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    >
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        mt={0.25}
                      >
                        <Controller
                          name="username"
                          control={control}
                          render={({ field: userField }) => (
                            <TextField
                              {...userField}
                              size="small"
                              label="Username"
                              fullWidth
                            />
                          )}
                        />

                        <Controller
                          name="password"
                          control={control}
                          render={({ field: passField }) => (
                            <TextField
                              {...passField}
                              size="small"
                              label="Password"
                              type={showPassword ? 'text' : 'password'}
                              fullWidth
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <Button
                                      size="small"
                                      onClick={() => setShowPassword((v) => !v)}
                                      sx={{ minWidth: 0, px: 1 }}
                                    >
                                      {showPassword ? 'Hide' : 'Show'}
                                    </Button>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          )}
                        />
                      </Stack>
                    </OptionTile>
                  )}
                />

                {/* Archive extraction */}
                <Controller
                  name="extract"
                  control={control}
                  render={({ field }) => (
                    <OptionTile
                      icon={<Archive sx={{ fontSize: 18 }} />}
                      title="Extract archive"
                      subtitle="Extract ZIP / RAR / 7z after download"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    >
                      <Controller
                        name="zipPwd"
                        control={control}
                        render={({ field: pwdField, fieldState }) => (
                          <TextField
                            {...pwdField}
                            label="Archive password (optional)"
                            type={showZipPassword ? 'text' : 'password'}
                            size="small"
                            fullWidth
                            error={!!fieldState.error}
                            helperText={
                              fieldState.error?.message ||
                              'Leave blank if the archive does not have a password'
                            }
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <LockOutlined sx={{ fontSize: 16, color: 'text.disabled' }} />
                                </InputAdornment>
                              ),
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Button
                                    size="small"
                                    onClick={() => setShowZipPassword((v) => !v)}
                                    sx={{ minWidth: 0, px: 1 }}
                                  >
                                    {showZipPassword ? 'Hide' : 'Show'}
                                  </Button>
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                      />
                    </OptionTile>
                  )}
                />

                {/* Summary */}
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    p: 1.25,
                    bgcolor: alpha(theme.palette.primary.main, 0.035),
                  }}
                >
                  <Stack spacing={0.75}>
                    <Typography variant="body2" fontWeight={800}>
                      Current summary
                    </Typography>

                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      <Chip
                        size="small"
                        label={`URLs: ${nonEmptyUrlsCount}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Torrent: ${torrentFile ? 'Yes' : 'No'}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Mode: ${isYtMode ? (isPlaylist ? 'Playlist' : 'yt-dlp') : 'Standard'
                          }`}
                        variant="outlined"
                      />
                      {isYtMode && !isPlaylist ? (
                        <Chip
                          size="small"
                          label={`Audio only: ${audioOnly ? 'Yes' : 'No'}`}
                          variant="outlined"
                        />
                      ) : null}
                      {isTvRecord ? (
                        <Chip
                          size="small"
                          label={`Season: ${season || '-'} / Episode: ${showPerUrlEpisode ? 'Per URL' : episode || '-'
                            }`}
                          variant="outlined"
                        />
                      ) : null}
                    </Stack>
                  </Stack>
                </Paper>
              </Stack>
            </SectionCard>
          </Stack>
        </Box>

        {/* Sticky action bar */}
        <Paper
          elevation={10}
          sx={{
            position: 'fixed',

            // ✅ MOBILE (bottom full width)
            left: { xs: 8, sm: 16 },
            right: { xs: 8, sm: 16 },

            // ✅ DESKTOP (right sidebar)
            ...(isLgUp && {
              left: 'auto',
              width: 360,
              right: {
                xl: 'calc((100vw - 1480px) / 2 + 24px)',
                lg: 32,
              },
            }),

            bottom: { xs: 8, md: 16 },

            zIndex: theme.zIndex.appBar,

            borderRadius: 3,
            px: { xs: 1, sm: 1.5 },
            py: { xs: 1, sm: 1.25 },

            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,

            bgcolor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.92)
                : alpha('#ffffff', 0.92),

            backdropFilter: 'blur(12px)',

            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 10px 36px rgba(0,0,0,0.35)'
                : '0 10px 30px rgba(15, 23, 42, 0.1)',
          }}
        >
          {isLgUp ? (
            <Stack spacing={1.25}>
              <Stack spacing={0.6}>
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={
                    isPlaylist
                      ? `${playlistSelected.size} selected`
                      : `${Math.max(nonEmptyUrlsCount, torrentBase64 ? 1 : 0)} job target${Math.max(nonEmptyUrlsCount, torrentBase64 ? 1 : 0) !== 1 ? 's' : ''
                      }`
                  }
                />

                {isYtMode && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={isPlaylist ? 'Playlist queue' : 'Format ready'}
                  />
                )}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Clear />}
                  onClick={handleReset}
                  disabled={isSubmitting}
                  sx={{ borderRadius: 999 }}
                >
                  Clear
                </Button>

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={
                    isSubmitting ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <Send />
                    )
                  }
                  disabled={isSubmitting}
                  sx={{ borderRadius: 999, fontWeight: 700 }}
                >
                  {submitLabel}
                </Button>
              </Stack>
            </Stack>
          ) : (
            /* ✅ MOBILE COMPACT (horizontal layout) */
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
            >
              {/* ✅ summary minimized */}
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                sx={{ flexShrink: 0 }}
                label={
                  isPlaylist
                    ? `${playlistSelected.size}`
                    : `${Math.max(nonEmptyUrlsCount, torrentBase64 ? 1 : 0)}`
                }
              />

              {/* ✅ actions inline */}
              <Stack direction="row" spacing={1} flex={1} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleReset}
                  disabled={isSubmitting}
                  startIcon={<Clear />}
                  sx={{
                    borderRadius: 999,
                    minWidth: 70,
                    px: 1,
                  }}
                >
                  Clear
                </Button>

                <Button
                  type="submit"
                  size="small"
                  variant="contained"
                  disabled={isSubmitting}
                  startIcon={<Send />}
                  sx={{
                    borderRadius: 999,
                    px: 1.5,
                    minWidth: 90,
                    fontWeight: 700,
                  }}
                >
                  {isSubmitting ? '...' : 'Start'}
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}