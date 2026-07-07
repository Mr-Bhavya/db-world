import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  Button,
} from '@mui/material';
import { useT } from '@shared/theme';
import { useSnackbar } from 'notistack';
import {
  Archive,
  CheckCircle,
  ContentCopy,
  Download,
  Error as ErrorIcon,
  ExpandLess,
  ExpandMore,
  Folder,
  HourglassEmpty,
  Http,
  Link as Magnet,
  Merge,
  Pause,
  Queue,
  Refresh,
  VideoSettings,
  YouTube,
  PlayCircleOutline,
  Timer,
  Speed,
  Notes,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import JobActions from './JobActions';
import CommonServices from '@shared/services/CommonServices';

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function fmtBytes(value) {
  if (value === null || value === undefined) return '—';
  const b = Number(value);
  if (!Number.isFinite(b)) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDurationMs(ms) {
  if (ms === null || ms === undefined) return '—';
  const total = Number(ms);
  if (!Number.isFinite(total)) return '—';

  const s = Math.floor(total / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;

  if (hh > 0) return `${hh}h ${mm}m ${ss}s`;
  if (mm > 0) return `${mm}m ${ss}s`;
  return `${ss}s`;
}

function fmtSpeed(bps) {
  if (!bps) return null;
  const n = Number(bps);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return `${n.toFixed(0)} B/s`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB/s`;
  return `${(n / 1024 ** 2).toFixed(1)} MB/s`;
}

function fmtEta(seconds) {
  if (!seconds || seconds <= 0) return null;
  const s = Math.floor(Number(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function timeAgo(ts) {
  if (!ts) return null;
  const diff = Date.now() - Number(ts);
  if (!Number.isFinite(diff)) return null;

  const s = Math.floor(diff / 1000);
  if (s < 10) return 'Just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function safeDisplayName(fileName, uri, jobId) {
  if (fileName) return fileName;
  if (uri) {
    try {
      const raw = uri.split('/').pop()?.split('?')[0];
      return raw || jobId;
    } catch {
      return jobId;
    }
  }
  return jobId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  QUEUED: { label: 'Queued', color: 'default', Icon: Queue },
  STARTED: { label: 'Starting', color: 'info', Icon: HourglassEmpty },
  DOWNLOADING: { label: 'Downloading', color: 'primary', Icon: Download },
  PROCESSING: { label: 'Processing', color: 'warning', Icon: VideoSettings },
  PAUSED: { label: 'Paused', color: 'warning', Icon: Pause },
  SUCCESS: { label: 'Completed', color: 'success', Icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'error', Icon: ErrorIcon },
  CANCELLED: { label: 'Cancelled', color: 'default', Icon: ErrorIcon },
};

const STEP_CFG = {
  DOWNLOAD: { label: 'Download', Icon: Download },
  EXTRACT: { label: 'Extract', Icon: Archive },
  MERGE: { label: 'Merge', Icon: Merge },
  FFMPEG: { label: 'FFmpeg', Icon: VideoSettings },
  MEDIA_INFO: { label: 'Media Info', Icon: VideoSettings },
};

const SOURCE_ICONS = {
  YOUTUBE: YouTube,
  HTTP: Http,
  TORRENT: Magnet,
  LOCAL: Folder,
};

const PIPELINE = ['DOWNLOAD', 'EXTRACT', 'MERGE', 'FFMPEG', 'MEDIA_INFO'];

// ─────────────────────────────────────────────────────────────────────────────
// Theme-aware HTML log injection
// ─────────────────────────────────────────────────────────────────────────────

function injectTheme(html, isDark) {
  const bg = isDark ? '#111827' : '#ffffff';
  const fg = isDark ? '#d1d5db' : '#111827';

  const css = `
    html, body {
      background: ${bg} !important;
      color: ${fg} !important;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 12px;
      margin: 0;
      padding: 8px;
      word-break: break-word;
    }
    pre, code { white-space: pre-wrap; }
    a { color: ${isDark ? '#60a5fa' : '#2563eb'} !important; }
    *[style*="color:red"], *[style*="color:#"], .error, .fail, .FAIL, .FAILED {
      color: #f87171 !important;
    }
    .success, .ok, .SUCCESS { color: #4ade80 !important; }
    .warn, .warning, .WARN { color: #fbbf24 !important; }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    td, th {
      padding: 2px 6px;
      border: 1px solid ${isDark ? '#374151' : '#d1d5db'};
    }
  `;

  const styleTag = `<style>${css}</style>`;

  if (html.includes('</head>')) return html.replace('</head>', `${styleTag}</head>`);
  if (html.includes('<head>')) return html.replace('<head>', `<head>${styleTag}`);
  return `<html><head>${styleTag}</head><body>${html}</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function MetaChip({ icon, label, color = 'default', outlined = true }) {
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      color={color}
      variant={outlined ? 'outlined' : 'filled'}
      sx={{
        borderRadius: 999,
        fontSize: '0.68rem',
        fontWeight: 700,
        height: 23,
        '& .MuiChip-label': {
          px: 0.8,
        },
      }}
    />
  );
}

function ProgressInfo({ left, right }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="baseline"
      spacing={1}
      mb={0.35}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.7rem', minWidth: 0 }}
      >
        {left}
      </Typography>

      {right ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {right}
        </Typography>
      ) : null}
    </Stack>
  );
}

function StageBar({ step, status }) {
  const T = useT();
  const idx = PIPELINE.indexOf(step);
  const done = status === 'SUCCESS';
  const failed = ['FAILED', 'CANCELLED'].includes(status);

  return (
    <Stack direction="row" spacing={0.45} sx={{ my: 0.75 }}>
      {PIPELINE.map((stage, i) => {
        const active = stage === step && !done && !failed;
        const past = i < idx || done;
        const isFail = failed && stage === step;

        return (
          <Tooltip key={stage} title={STEP_CFG[stage]?.label ?? stage} placement="top">
            <Box
              sx={{
                height: 4,
                flex: 1,
                borderRadius: 999,
                bgcolor: isFail
                  ? T.error
                  : past
                    ? T.success
                    : active
                      ? T.teal
                      : alpha(T.text ?? '#888', 0.12),
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {active ? (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(90deg, transparent 0%, ${alpha(
                      T.teal ?? '#00bcd4',
                      0.9
                    )} 50%, transparent 100%)`,
                    animation: 'jobcard_shimmer 1.35s infinite linear',
                    '@keyframes jobcard_shimmer': {
                      '0%': { transform: 'translateX(-100%)' },
                      '100%': { transform: 'translateX(200%)' },
                    },
                  }}
                />
              ) : null}
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
}

function MobileBottomActions({
  logOpen,
  onToggleLogs,
  onCopyUrl,
  hasUri,
  job,
  compact,
}) {
  return (
    <Box
      sx={{
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        pb: 0.1,
        mx: -0.15,
      }}
    >
      <Stack
        direction="row"
        spacing={0.45}
        alignItems="center"
        sx={{
          width: 'max-content',
          minWidth: '100%',
          flexWrap: 'nowrap',
        }}
      >
        {compact ? (
          <>
            <Tooltip title={logOpen ? 'Hide logs' : 'Logs'}>
              <IconButton
                size="small"
                onClick={onToggleLogs}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 2,
                }}
              >
                {logOpen ? <ExpandLess sx={{ fontSize: 17 }} /> : <ExpandMore sx={{ fontSize: 17 }} />}
              </IconButton>
            </Tooltip>

            {hasUri ? (
              <Tooltip title="Copy source URL">
                <IconButton
                  size="small"
                  onClick={onCopyUrl}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 2,
                  }}
                >
                  <ContentCopy sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            ) : null}

            <JobActions job={job} layout="mobile" compactMobile />
          </>
        ) : (
          <>
            <Button
              size="small"
              variant="text"
              startIcon={logOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              onClick={onToggleLogs}
              sx={{
                minWidth: 0,
                px: 0.9,
                py: 0.35,
                borderRadius: 999,
                textTransform: 'none',
                fontSize: '0.7rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {logOpen ? 'Hide Logs' : 'Logs'}
            </Button>

            {hasUri ? (
              <Button
                size="small"
                variant="text"
                startIcon={<ContentCopy fontSize="small" />}
                onClick={onCopyUrl}
                sx={{
                  minWidth: 0,
                  px: 0.9,
                  py: 0.35,
                  borderRadius: 999,
                  textTransform: 'none',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                Copy URL
              </Button>
            ) : null}

            <JobActions job={job} layout="mobile" compactMobile={false} />
          </>
        )}
      </Stack>
    </Box>
  );
}

function LogPanel({
  logOpen,
  logLoading,
  logError,
  logHtml,
  onRefresh,
  isDark,
  T,
  isSmDown,
}) {
  return (
    <Collapse in={logOpen} unmountOnExit>
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          mt: 0.8,
          borderRadius: 2.5,
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.02)',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 1,
            py: 0.5,
            borderBottom: `1px solid ${alpha(T.text ?? '#888', 0.08)}`,
          }}
        >
          <Stack direction="row" spacing={0.65} alignItems="center">
            <Notes sx={{ fontSize: 15, color: 'text.secondary' }} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.72rem', fontWeight: 700 }}
            >
              Job Logs
            </Typography>
          </Stack>

          <Tooltip title="Refresh logs">
            <span>
              <IconButton
                size="small"
                sx={{ p: 0.45 }}
                disabled={logLoading}
                onClick={onRefresh}
              >
                {logLoading ? (
                  <CircularProgress size={13} />
                ) : (
                  <Refresh sx={{ fontSize: 15 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {logLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 2.1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Loading logs…
              </Typography>
            </Stack>
          </Box>
        ) : logError ? (
          <Box sx={{ py: 2.1, textAlign: 'center', px: 2 }}>
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.65 }}>
              Failed to load logs.
            </Typography>
            <Button size="small" onClick={onRefresh}>
              Retry
            </Button>
          </Box>
        ) : logHtml ? (
          <iframe
            key={isDark ? 'dark' : 'light'}
            srcDoc={logHtml}
            title="Job logs"
            style={{
              width: '100%',
              height: isSmDown ? 260 : 320,
              border: 'none',
              display: 'block',
            }}
            sandbox="allow-same-origin"
          />
        ) : (
          <Box sx={{ py: 2.1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              No logs available yet.
            </Typography>
          </Box>
        )}
      </Paper>
    </Collapse>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

function JobCardComponent({ job }) {
  const T = useT();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const isVeryNarrow = useMediaQuery('(max-width:390px)');
  const { enqueueSnackbar } = useSnackbar();

  const [logOpen, setLogOpen] = useState(false);
  const [logHtml, setLogHtml] = useState(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(false);

  const {
    jobId,
    status = 'QUEUED',
    step,
    sourceType,
    fileName,
    uri,
    progress,
    failReason,
    startTime,
    elapsedMs,
    recordId,
    recordName,
  } = job;

  const cfg = STATUS_CFG[status] ?? STATUS_CFG.STARTED;
  const SourceIcon = SOURCE_ICONS[sourceType] ?? Http;
  const isTerminal = ['SUCCESS', 'FAILED', 'CANCELLED'].includes(status);
  const isActive = !isTerminal && status !== 'PAUSED';

  const statusLabel = useMemo(() => {
    if (isTerminal || status === 'PAUSED') return cfg.label;
    return step ? (STEP_CFG[step]?.label ?? cfg.label) : cfg.label;
  }, [cfg.label, isTerminal, status, step]);

  const pct = Math.min(100, Math.max(0, Number(progress?.percent ?? 0)));
  const speed = useMemo(() => fmtSpeed(progress?.speed), [progress?.speed]);
  const eta = useMemo(() => fmtEta(progress?.eta), [progress?.eta]);
  const isFfmpeg = step === 'FFMPEG';
  const isExtract = step === 'EXTRACT';
  const isMerging = progress?.phase === 'merging';
  // Speed + ETA are only meaningful while downloading. The backend now clears these on the
  // step transition, but gate here too so a stale download ETA can never render as "574h"
  // beside a 100% processing bar.
  const isDownload = !isFfmpeg && !isExtract && !isMerging &&
    (step === 'DOWNLOAD' || progress?.phase === 'downloading');

  const progressLeft = useMemo(() => {
    if (isMerging) return 'Merging audio + video…';
    if (isFfmpeg) {
      return `${fmtDurationMs(progress?.downloaded)} / ${fmtDurationMs(progress?.total)}`;
    }
    if (isExtract) {
      return pct > 0 ? `${pct.toFixed(1)}%` : 'Extracting…';
    }
    return `${fmtBytes(progress?.downloaded)} / ${fmtBytes(progress?.total)}`;
  }, [isMerging, isFfmpeg, isExtract, pct, progress?.downloaded, progress?.total]);

  const progressRight = useMemo(() => {
    return [
      isDownload && speed ? speed : null,
      isDownload && eta ? `ETA ${eta}` : null,
      pct > 0 && !isExtract && !isMerging ? `${pct.toFixed(1)}%` : null,
    ]
      .filter(Boolean)
      .join('  ·  ');
  }, [isDownload, speed, eta, pct, isExtract, isMerging]);

  const showProgress = useMemo(() => {
    return (
      isActive &&
      !!progress &&
      (
        Number(progress?.downloaded) > 0 ||
        status === 'DOWNLOADING' ||
        isFfmpeg ||
        isExtract ||
        isMerging
      )
    );
  }, [isActive, progress, status, isFfmpeg, isExtract, isMerging]);

  const displayName = useMemo(
    () => safeDisplayName(fileName, uri, jobId),
    [fileName, uri, jobId]
  );

  const footerTime = useMemo(() => {
    return [
      timeAgo(startTime),
      elapsedMs > 0 ? `${fmtDurationMs(elapsedMs)}${isTerminal ? ' total' : ''}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }, [startTime, elapsedMs, isTerminal]);

  const borderColor = useMemo(() => {
    if (status === 'FAILED') return alpha(T.error ?? '#f44336', 0.5);
    if (status === 'CANCELLED') return alpha(T.error ?? '#f44336', 0.3);
    if (status === 'SUCCESS') return alpha(T.success ?? '#4caf50', 0.4);
    if (status === 'PAUSED') return alpha(T.warning ?? '#ff9800', 0.5);
    if (isActive) return alpha(T.teal ?? '#00bcd4', 0.4);
    return T.border ?? 'rgba(0,0,0,0.12)';
  }, [status, isActive, T]);

  const sourceColor = useMemo(() => {
    if (sourceType === 'YOUTUBE') return 'error.main';
    if (sourceType === 'TORRENT') return 'secondary.main';
    return 'text.secondary';
  }, [sourceType]);

  const themedLogHtml = useMemo(() => {
    if (!logHtml) return null;
    return injectTheme(logHtml, isDark);
  }, [logHtml, isDark]);

  const fetchLogs = useCallback(
    async (force = false) => {
      if (!force && logHtml) return;

      setLogError(false);
      setLogLoading(true);

      try {
        const { getJobReport } = await import('../services/ingestionApi');
        const res = await getJobReport(jobId);

        const rawHtml =
          typeof res?.data === 'string'
            ? res.data
            : typeof res === 'string'
              ? res
              : '';

        setLogHtml(rawHtml || null);
      } catch {
        setLogError(true);
      } finally {
        setLogLoading(false);
      }
    },
    [jobId, logHtml]
  );

  const toggleLogs = useCallback(() => {
    if (!logOpen) {
      fetchLogs();
    }
    setLogOpen((prev) => !prev);
  }, [logOpen, fetchLogs]);

  const refreshLogs = useCallback(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  const handleCopyUrl = useCallback(async () => {
  if (!uri) return;

  try {
    const result = await CommonServices.handleCopy(uri, {
      enableFallback: true,
      enableShare: true,
      showToast: false,
    });

    enqueueSnackbar(
      result?.message || (result?.success ? 'Source URL copied' : 'Failed to copy URL'),
      { variant: result?.success ? 'success' : 'error' }
    );
  } catch (error) {
    enqueueSnackbar(
      error?.message || 'Failed to copy URL',
      { variant: 'error' }
    );
  }
}, [uri, enqueueSnackbar]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.99 }}
      transition={{ duration: 0.14 }}
    >
      <Card
        variant="outlined"
        sx={{
          borderRadius: isSmDown ? 3 : 4,
          borderColor,
          transition: 'border-color 0.25s ease, box-shadow 0.2s ease',
          overflow: 'hidden',
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.012) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
          '&:hover': {
            boxShadow: isDark
              ? '0 8px 20px rgba(0,0,0,0.24)'
              : '0 8px 18px rgba(15,23,42,0.06)',
          },
        }}
      >
        <CardContent
          sx={{
            p: isSmDown ? '10px 10px !important' : '14px 14px !important',
          }}
        >
          <Stack spacing={0.85}>
            {/* Header */}
            <Stack
              direction="row"
              spacing={0.8}
              alignItems="flex-start"
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={0.8} minWidth={0} flex={1}>
                <Box
                  sx={{
                    width: isSmDown ? 30 : 34,
                    height: isSmDown ? 30 : 34,
                    borderRadius: isSmDown ? 2 : 2.25,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: sourceColor,
                    flexShrink: 0,
                    mt: 0.1,
                  }}
                >
                  <SourceIcon sx={{ fontSize: isSmDown ? 17 : 18 }} />
                </Box>

                <Stack minWidth={0} flex={1} spacing={0.18}>
                  <Tooltip title={displayName} placement="top-start">
                    <Typography
                      variant="body2"
                      fontWeight={800}
                      noWrap
                      sx={{ lineHeight: 1.22 }}
                    >
                      {displayName}
                    </Typography>
                  </Tooltip>

                  {recordName ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{
                        fontSize: isSmDown ? '0.68rem' : '0.72rem',
                        lineHeight: 1.3,
                      }}
                    >
                      #{recordId} · {recordName}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>

              <Stack direction="row" spacing={0.35} alignItems="center" flexShrink={0}>
                <MetaChip
                  icon={<cfg.Icon sx={{ fontSize: '13px !important' }} />}
                  label={statusLabel}
                  color={cfg.color}
                  outlined={false}
                />

                {!isSmDown ? (
                  <>
                    {uri ? (
                      <Tooltip title="Copy source URL">
                        <IconButton size="small" onClick={handleCopyUrl} sx={{ p: 0.4 }}>
                          <ContentCopy sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null}

                    <Tooltip title={logOpen ? 'Collapse logs' : 'View logs'}>
                      <IconButton size="small" onClick={toggleLogs} sx={{ p: 0.4 }}>
                        {logOpen ? (
                          <ExpandLess sx={{ fontSize: 17 }} />
                        ) : (
                          <ExpandMore sx={{ fontSize: 17 }} />
                        )}
                      </IconButton>
                    </Tooltip>

                    <JobActions job={job} layout="desktop" />
                  </>
                ) : null}
              </Stack>
            </Stack>

            {/* Stage bar */}
            <StageBar step={step} status={status} />

            {/* Meta row */}
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              <MetaChip
                icon={<PlayCircleOutline sx={{ fontSize: 13 }} />}
                label={sourceType || 'Source'}
              />

              {footerTime ? (
                <MetaChip
                  icon={<Timer sx={{ fontSize: 13 }} />}
                  label={footerTime}
                />
              ) : null}

              {speed && !isMerging ? (
                <MetaChip
                  icon={<Speed sx={{ fontSize: 13 }} />}
                  label={speed}
                />
              ) : null}

              {!isSmDown ? (
                <MetaChip
                  icon={<DotIcon sx={{ fontSize: 10 }} />}
                  label={`${jobId.slice(0, 8)}…`}
                />
              ) : null}
            </Stack>

            {/* Progress */}
            {showProgress ? (
              <Box sx={{ pt: 0.02 }}>
                <ProgressInfo left={progressLeft} right={progressRight} />

                <LinearProgress
                  variant={isMerging || pct === 0 ? 'indeterminate' : 'determinate'}
                  value={pct}
                  sx={{
                    height: isSmDown ? 5 : 6,
                    borderRadius: 999,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  }}
                />
              </Box>
            ) : isActive && status !== 'QUEUED' ? (
              <LinearProgress
                variant="indeterminate"
                sx={{
                  height: 3.5,
                  borderRadius: 999,
                  mt: 0.1,
                }}
              />
            ) : null}

            {/* Failure block */}
            {failReason ? (
              <Paper
                elevation={0}
                variant="outlined"
                sx={{
                  mt: 0.05,
                  px: 0.9,
                  py: 0.6,
                  borderRadius: 2,
                  bgcolor: alpha(T.error ?? '#f44336', isDark ? 0.14 : 0.06),
                  borderColor: alpha(T.error ?? '#f44336', 0.2),
                }}
              >
                <Typography
                  variant="caption"
                  color="error"
                  sx={{
                    fontSize: isSmDown ? '0.7rem' : '0.74rem',
                    wordBreak: 'break-word',
                    display: 'block',
                    lineHeight: 1.38,
                  }}
                >
                  {failReason}
                </Typography>
              </Paper>
            ) : null}

            {/* Mobile ID */}
            {isSmDown ? (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ fontSize: '0.66rem', lineHeight: 1.1 }}
              >
                {jobId.slice(0, 8)}…
              </Typography>
            ) : null}

            {/* Mobile bottom action row */}
            {isSmDown ? (
              <MobileBottomActions
                logOpen={logOpen}
                onToggleLogs={toggleLogs}
                onCopyUrl={handleCopyUrl}
                hasUri={!!uri}
                job={job}
                compact={isVeryNarrow}
              />
            ) : null}

            {/* Logs */}
            <LogPanel
              logOpen={logOpen}
              logLoading={logLoading}
              logError={logError}
              logHtml={themedLogHtml}
              onRefresh={refreshLogs}
              isDark={isDark}
              T={T}
              isSmDown={isSmDown}
            />
          </Stack>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const JobCard = memo(JobCardComponent);
export default JobCard;