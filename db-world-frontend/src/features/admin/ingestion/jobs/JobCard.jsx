import React, { useState } from 'react';
import {
  Box, Card, CardContent, Chip, Collapse, CircularProgress, IconButton,
  LinearProgress, Stack, Typography, Tooltip, alpha, useTheme,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Download, Archive, Merge, VideoSettings, CheckCircle,
  Error as ErrorIcon, Pause, HourglassEmpty, Queue,
  YouTube, Http, Link as Magnet, Folder,
  ExpandMore, ExpandLess, Refresh,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import JobActions from './JobActions';

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (!b && b !== 0) return '—';
  if (b < 1024)        return `${b} B`;
  if (b < 1024 ** 2)   return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3)   return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDurationMs(ms) {
  if (!ms && ms !== 0) return '—';
  const s  = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}h ${mm}m ${ss}s`;
  if (mm > 0) return `${mm}m ${ss}s`;
  return `${ss}s`;
}

function fmtSpeed(bps) {
  if (!bps) return null;
  if (bps < 1024)      return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 ** 2) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
}

function fmtEta(s) {
  if (!s || s <= 0) return null;
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function timeAgo(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 10)   return 'Just now';
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Configs ────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  QUEUED:      { label: 'Queued',      color: 'default', Icon: Queue },
  STARTED:     { label: 'Starting',    color: 'info',    Icon: HourglassEmpty },
  DOWNLOADING: { label: 'Downloading', color: 'primary', Icon: Download },
  PROCESSING:  { label: 'Processing',  color: 'warning', Icon: VideoSettings },
  PAUSED:      { label: 'Paused',      color: 'warning', Icon: Pause },
  SUCCESS:     { label: 'Completed',   color: 'success', Icon: CheckCircle },
  FAILED:      { label: 'Failed',      color: 'error',   Icon: ErrorIcon },
  CANCELLED:   { label: 'Cancelled',   color: 'default', Icon: ErrorIcon },
};

const STEP_CFG = {
  DOWNLOAD:   { label: 'Download',   Icon: Download },
  EXTRACT:    { label: 'Extract',    Icon: Archive },
  MERGE:      { label: 'Merge',      Icon: Merge },
  FFMPEG:     { label: 'FFmpeg',     Icon: VideoSettings },
  MEDIA_INFO: { label: 'Media Info', Icon: VideoSettings },
};

const SOURCE_ICONS = {
  YOUTUBE: YouTube,
  HTTP:    Http,
  TORRENT: Magnet,
  LOCAL:   Folder,
};

const PIPELINE = ['DOWNLOAD', 'EXTRACT', 'MERGE', 'FFMPEG', 'MEDIA_INFO'];

// ── Stage bar ──────────────────────────────────────────────────────────────

function StageBar({ step, status }) {
  const T   = useT();
  const idx = PIPELINE.indexOf(step);
  const done   = status === 'SUCCESS';
  const failed = ['FAILED', 'CANCELLED'].includes(status);

  return (
    <Stack direction="row" spacing={0.5} sx={{ my: 0.75 }}>
      {PIPELINE.map((s, i) => {
        const active = s === step && !done && !failed;
        const past   = i < idx || done;
        const isFail = failed && s === step;

        return (
          <Tooltip key={s} title={STEP_CFG[s]?.label ?? s} placement="top">
            <Box
              sx={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                bgcolor: isFail ? T.error
                       : past   ? T.success
                       : active ? T.teal
                       :          alpha(T.text ?? '#888', 0.12),
                transition: 'background-color 0.35s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {active && (
                <Box sx={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(90deg, transparent 0%, ${alpha(T.teal ?? '#00bcd4', 0.8)} 50%, transparent 100%)`,
                  animation: 'shimmer 1.4s infinite linear',
                  '@keyframes shimmer': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(200%)' } },
                }} />
              )}
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
}

// ── Log HTML builder (injects theme CSS) ──────────────────────────────────

function injectTheme(html, isDark) {
  const bg  = isDark ? '#111827' : '#ffffff';
  const fg  = isDark ? '#d1d5db' : '#111827';
  const css = `
    html,body{background:${bg}!important;color:${fg}!important;
      font-family:'Consolas','Courier New',monospace;font-size:12px;
      margin:0;padding:8px;word-break:break-word}
    pre,code{white-space:pre-wrap}
    a{color:${isDark ? '#60a5fa' : '#2563eb'}!important}
    *[style*="color:red"],*[style*="color:#"],
    .error,.fail,.FAIL,.FAILED{color:#f87171!important}
    .success,.ok,.SUCCESS{color:#4ade80!important}
    .warn,.warning,.WARN{color:#fbbf24!important}
    table{border-collapse:collapse;width:100%}
    td,th{padding:2px 6px;border:1px solid ${isDark ? '#374151' : '#d1d5db'}}
  `;
  const tag = `<style>${css}</style>`;
  if (html.includes('</head>')) return html.replace('</head>', tag + '</head>');
  if (html.includes('<head>'))  return html.replace('<head>', '<head>' + tag);
  return `<html><head>${tag}</head><body>${html}</body></html>`;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function JobCard({ job }) {
  const T      = useT();
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [logOpen,    setLogOpen]    = useState(false);
  const [logHtml,    setLogHtml]    = useState(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError,   setLogError]   = useState(false);

  const {
    jobId, status = 'QUEUED', step, sourceType,
    fileName, uri, progress, failReason,
    startTime, elapsedMs, recordId, recordName,
  } = job;

  // ── Fetch logs (force=true bypasses the cache-guard) ──────────────────
  const fetchLogs = async (force = false) => {
    if (!force && logHtml) return;
    setLogError(false);
    setLogLoading(true);
    try {
      const { getJobReport } = await import('../services/ingestionApi');
      const res = await getJobReport(jobId);
      // API may return a wrapper { data: "<html>…" } or a raw string
      const rawHtml = typeof res?.data === 'string' ? res.data
                    : typeof res      === 'string'  ? res
                    : '';
      setLogHtml(injectTheme(rawHtml, isDark));
    } catch {
      setLogError(true);
    } finally {
      setLogLoading(false);
    }
  };

  const toggleLogs = () => {
    if (!logOpen) fetchLogs();
    setLogOpen(p => !p);
  };

  // ── Derived display values ─────────────────────────────────────────────
  const cfg        = STATUS_CFG[status] ?? STATUS_CFG.STARTED;
  const SourceIcon = SOURCE_ICONS[sourceType] ?? Http;
  const isTerminal = ['SUCCESS', 'FAILED', 'CANCELLED'].includes(status);
  const isActive   = !isTerminal && status !== 'PAUSED';

  const statusLabel = isTerminal || status === 'PAUSED'
    ? cfg.label
    : (step ? (STEP_CFG[step]?.label ?? cfg.label) : cfg.label);

  const pct      = progress?.percent ?? 0;
  const speed    = fmtSpeed(progress?.speed);
  const eta      = fmtEta(progress?.eta);
  const isFfmpeg = step === 'FFMPEG';
  const isExtr   = step === 'EXTRACT';

  const progressLeft =
      isFfmpeg ? `${fmtDurationMs(progress?.downloaded)} / ${fmtDurationMs(progress?.total)}`
    : isExtr    ? (pct > 0 ? `${pct.toFixed(1)}%` : 'Extracting…')
    :             `${fmtBytes(progress?.downloaded)} / ${fmtBytes(progress?.total)}`;

  const progressRight = [
    speed               && speed,
    eta                 && `ETA ${eta}`,
    pct > 0 && !isExtr  && `${pct.toFixed(1)}%`,
  ].filter(Boolean).join('  ');

  const showProgress = isActive && progress &&
    (progress.downloaded > 0 || status === 'DOWNLOADING' || isFfmpeg || isExtr);

  const displayName = fileName ?? (uri ? uri.split('/').pop().split('?')[0] : jobId);

  const borderColor =
      status === 'FAILED'    ? alpha(T.error   ?? '#f44336', 0.5)
    : status === 'CANCELLED' ? alpha(T.error   ?? '#f44336', 0.3)
    : status === 'SUCCESS'   ? alpha(T.success ?? '#4caf50', 0.4)
    : status === 'PAUSED'    ? alpha(T.warning ?? '#ff9800', 0.5)
    : isActive               ? alpha(T.teal    ?? '#00bcd4', 0.4)
    :                          (T.border ?? 'rgba(0,0,0,0.12)');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
    >
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          borderColor,
          transition: 'border-color 0.3s, box-shadow 0.2s',
          '&:hover': {
            boxShadow: isDark
              ? '0 2px 14px rgba(0,0,0,0.45)'
              : '0 2px 10px rgba(0,0,0,0.09)',
          },
        }}
      >
        <CardContent sx={{ p: '10px 12px !important' }}>

          {/* ── Header: source icon | name + record | status + expand + actions */}
          <Stack direction="row" alignItems="flex-start" spacing={1}>

            <SourceIcon
              sx={{
                fontSize: 17,
                mt: '3px',
                flexShrink: 0,
                color: sourceType === 'YOUTUBE' ? 'error.main' : 'text.secondary',
              }}
            />

            <Stack flex={1} minWidth={0}>
              <Tooltip title={uri ?? displayName} placement="top-start">
                <Typography variant="body2" fontWeight={600} noWrap>
                  {displayName}
                </Typography>
              </Tooltip>
              {recordName && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ fontSize: '0.67rem', lineHeight: 1.4 }}
                >
                  #{recordId} · {recordName}
                </Typography>
              )}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={0.25} flexShrink={0}>
              <Chip
                icon={<cfg.Icon sx={{ fontSize: '11px !important' }} />}
                label={statusLabel}
                color={cfg.color}
                size="small"
                sx={{ fontSize: '0.67rem', height: 20, '& .MuiChip-label': { px: 0.75 } }}
              />
              <Tooltip title={logOpen ? 'Collapse logs' : 'View logs'}>
                <IconButton size="small" onClick={toggleLogs} sx={{ p: 0.4 }}>
                  {logOpen
                    ? <ExpandLess sx={{ fontSize: 15 }} />
                    : <ExpandMore sx={{ fontSize: 15 }} />}
                </IconButton>
              </Tooltip>
              <JobActions job={job} />
            </Stack>
          </Stack>

          {/* ── Stage bar ───────────────────────────────────────────────── */}
          <StageBar step={step} status={status} />

          {/* ── Download / FFmpeg / Extract progress ────────────────────── */}
          {showProgress && (
            <Box sx={{ mt: 0.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={0.35}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                  {progressLeft}
                </Typography>
                {progressRight && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                    {progressRight}
                  </Typography>
                )}
              </Stack>
              <LinearProgress
                variant={pct > 0 ? 'determinate' : 'indeterminate'}
                value={pct}
                sx={{ height: 4, borderRadius: 3 }}
              />
            </Box>
          )}

          {/* Indeterminate bar for active steps that don't report byte progress */}
          {isActive && !showProgress && status !== 'QUEUED' && (
            <LinearProgress
              variant="indeterminate"
              sx={{ height: 3, borderRadius: 3, mt: 0.5 }}
            />
          )}

          {/* ── Fail reason ─────────────────────────────────────────────── */}
          {failReason && (
            <Box
              sx={{
                mt: 0.75,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: alpha(T.error ?? '#f44336', isDark ? 0.15 : 0.08),
                border: `1px solid ${alpha(T.error ?? '#f44336', 0.25)}`,
              }}
            >
              <Typography
                variant="caption"
                color="error"
                sx={{ fontSize: '0.69rem', wordBreak: 'break-word', display: 'block' }}
              >
                {failReason}
              </Typography>
            </Box>
          )}

          {/* ── Footer: job ID left, start time + elapsed right ─────────── */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 0.75 }}
          >
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.64rem' }}>
              {jobId.slice(0, 8)}…
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.64rem' }}>
              {[
                timeAgo(startTime),
                elapsedMs > 0 && fmtDurationMs(elapsedMs) + (isTerminal ? ' total' : ''),
              ].filter(Boolean).join(' · ')}
            </Typography>
          </Stack>

          {/* ── Inline log panel ────────────────────────────────────────── */}
          <Collapse in={logOpen} unmountOnExit>
            <Box
              sx={{
                mt: 1,
                border: `1px solid ${alpha(T.text ?? '#888', 0.12)}`,
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
              }}
            >
              {/* Log toolbar */}
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
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                  Job Logs
                </Typography>
                <Tooltip title="Refresh logs">
                  <IconButton
                    size="small"
                    sx={{ p: 0.4 }}
                    disabled={logLoading}
                    onClick={() => fetchLogs(true)}
                  >
                    {logLoading
                      ? <CircularProgress size={12} />
                      : <Refresh sx={{ fontSize: 13 }} />}
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* Content */}
              {logLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
                  <CircularProgress size={20} />
                </Box>
              )}

              {logError && !logLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2, gap: 1 }}>
                  <Typography variant="caption" color="error">Failed to load logs.</Typography>
                  <Typography
                    component="span"
                    variant="caption"
                    color="primary"
                    sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => fetchLogs(true)}
                  >
                    Retry
                  </Typography>
                </Box>
              )}

              {!logLoading && !logError && logHtml && (
                <iframe
                  key={isDark ? 'dark' : 'light'}
                  srcDoc={logHtml}
                  title="Job logs"
                  style={{ width: '100%', height: 320, border: 'none', display: 'block' }}
                  sandbox="allow-same-origin"
                />
              )}

              {!logLoading && !logError && !logHtml && (
                <Box sx={{ py: 2.5, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    No logs available yet.
                  </Typography>
                </Box>
              )}
            </Box>
          </Collapse>

        </CardContent>
      </Card>
    </motion.div>
  );
}
