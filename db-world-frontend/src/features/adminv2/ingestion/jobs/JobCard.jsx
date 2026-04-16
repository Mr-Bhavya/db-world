import React, { useState } from 'react';
import {
  Box, Card, CardContent, Chip, Collapse, CircularProgress, IconButton,
  LinearProgress, Stack, Typography, Tooltip, alpha,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Download, Archive, Merge, VideoSettings, CheckCircle,
  Error as ErrorIcon, Pause, HourglassEmpty, Queue,
  YouTube, Http, Link as Magnet, Folder,
  ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import JobActions from './JobActions';
import LogViewerDrawer from './LogViewerDrawer';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (!b && b !== 0) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDurationMs(ms) {
  if (!ms && ms !== 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) return `${hh}h ${mm}m ${ss}s`;
  if (mm > 0) return `${mm}m ${ss}s`;
  return `${ss}s`;
}

function fmtSpeed(bps) {
  if (!bps) return null;
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 ** 2) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
}

function fmtEta(seconds) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ── Step/status config ─────────────────────────────────────────────────────

const STATUS_CFG = {
  QUEUED:      { label: 'Queued',      color: 'default',  Icon: Queue },
  STARTED:     { label: 'Starting',    color: 'info',     Icon: HourglassEmpty },
  DOWNLOADING: { label: 'Downloading', color: 'primary',  Icon: Download },
  PROCESSING:  { label: 'Processing',  color: 'warning',  Icon: VideoSettings },
  PAUSED:      { label: 'Paused',      color: 'warning',  Icon: Pause },
  SUCCESS:     { label: 'Completed',   color: 'success',  Icon: CheckCircle },
  FAILED:      { label: 'Failed',      color: 'error',    Icon: ErrorIcon },
  CANCELLED:   { label: 'Cancelled',   color: 'default',  Icon: ErrorIcon },
};

const STEP_LABELS = {
  DOWNLOAD:   { label: 'Downloading', Icon: Download },
  EXTRACT:    { label: 'Extracting',  Icon: Archive },
  MERGE:      { label: 'Merging',     Icon: Merge },
  FFMPEG:     { label: 'Processing',  Icon: VideoSettings },
  MEDIA_INFO: { label: 'Reading info',Icon: VideoSettings },
};

const SOURCE_ICONS = {
  YOUTUBE: YouTube,
  HTTP:    Http,
  TORRENT: Magnet,
  LOCAL:   Folder,
};

// ── Stage progress bar ────────────────────────────────────────────────────

const PIPELINE_STEPS = ['DOWNLOAD', 'EXTRACT', 'MERGE', 'FFMPEG', 'MEDIA_INFO'];

function StageBar({ step, status }) {
  const T = useT();
  const idx = PIPELINE_STEPS.indexOf(step);
  const done = status === 'SUCCESS';
  const failed = status === 'FAILED';

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
      {PIPELINE_STEPS.map((s, i) => {
        const active  = s === step && !done && !failed;
        const past    = i < idx || done;
        const isFail  = failed && s === step;
        return (
          <Tooltip key={s} title={STEP_LABELS[s]?.label ?? s}>
            <Box
              sx={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                bgcolor: isFail  ? T.error
                       : past    ? T.success
                       : active  ? T.teal
                       :           alpha(T.text, 0.1),
                transition: 'background-color 0.4s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {active && (
                <Box
                  sx={{
                    position: 'absolute', top: 0, left: '-100%',
                    width: '100%', height: '100%',
                    bgcolor: alpha(T.teal, 0.5),
                    animation: 'shimmer 1.5s infinite',
                    '@keyframes shimmer': {
                      '0%':   { left: '-100%' },
                      '100%': { left: '100%' },
                    },
                  }}
                />
              )}
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────

export default function JobCard({ job }) {
  const T = useT();
  const [logOpen, setLogOpen] = useState(false);

  const [logInlineOpen, setLogInlineOpen] = useState(false);
  const [inlineHtml, setInlineHtml]       = useState(null);
  const [inlineLoading, setInlineLoading] = useState(false);

  const fetchInlineLogs = async () => {
    if (inlineHtml) return;
    setInlineLoading(true);
    try {
      const { getJobReport } = await import('../services/ingestionApi');
      const html = await getJobReport(jobId);
      setInlineHtml(html);
    } catch {
      setInlineHtml('<p style="color:red">Failed to load logs.</p>');
    } finally {
      setInlineLoading(false);
    }
  };

  const toggleInlineLogs = () => {
    if (!logInlineOpen) fetchInlineLogs();
    setLogInlineOpen(prev => !prev);
  };

  const {
    jobId, status = 'QUEUED', step, sourceType,
    fileName, uri, progress, failReason,
    startTime, elapsedMs, recordId, recordName,
  } = job;

  const cfg     = STATUS_CFG[status] ?? STATUS_CFG.STARTED;
  const SourceIcon = SOURCE_ICONS[sourceType] ?? Http;
  const isTerminal = ['SUCCESS', 'FAILED', 'CANCELLED'].includes(status);
  const statusLabel = isTerminal
    ? cfg.label
    : (step ? (STEP_LABELS[step]?.label ?? step) : cfg.label);

  const percent   = progress?.percent   ?? 0;
  const speed     = fmtSpeed(progress?.speed);
  const eta       = fmtEta(progress?.eta);
  const downloaded = fmtBytes(progress?.downloaded);
  const total     = fmtBytes(progress?.total);
  const isFfmpegStep = step === 'FFMPEG' && status === 'PROCESSING';
  const isExtractStep = step === 'EXTRACT' && status === 'PROCESSING';
  const ffmpegDone = fmtDurationMs(progress?.downloaded);
  const ffmpegTotal = fmtDurationMs(progress?.total);
  const extractDone = progress?.percent > 0 ? `${progress.percent.toFixed(1)}%` : 'Starting…';

  const displayName = fileName ?? (uri ? uri.split('/').pop().split('?')[0] : jobId);
  const isActive    = !['SUCCESS', 'FAILED', 'CANCELLED'].includes(status);
  const showProgress = isActive && progress && (progress.downloaded > 0 || status === 'DOWNLOADING' || isFfmpegStep || isExtractStep);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          variant="outlined"
          sx={{
            borderRadius: 2,
            borderColor: status === 'FAILED'    ? alpha(T.error, 0.4)
                       : status === 'SUCCESS'   ? alpha(T.success, 0.3)
                       : status === 'PAUSED'    ? alpha(T.warning, 0.4)
                       : isActive               ? alpha(T.teal, 0.3)
                       :                          T.border,
            transition: 'border-color 0.3s',
          }}
        >
          <CardContent sx={{ p: '12px !important' }}>
            {/* ── Header row ─────────────────────────────────────────── */}
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>

              <Stack direction="row" spacing={1} alignItems="flex-start" flex={1} minWidth={0}>
                <SourceIcon
                  sx={{
                    fontSize: 18,
                    color: sourceType === 'YOUTUBE' ? 'error.main' : 'text.secondary',
                    flexShrink: 0,
                    mt: '2px',
                  }}
                />
                <Stack direction="column" spacing={0} flex={1} minWidth={0}>
                  <Tooltip title={uri ?? displayName}>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      noWrap
                    >
                      {displayName}
                    </Typography>
                  </Tooltip>
                  {recordName && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ fontSize: '0.68rem' }}
                    >
                      #{recordId} · {recordName}
                    </Typography>
                  )}
                </Stack>
              </Stack>

              <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
                <Chip
                  icon={<cfg.Icon sx={{ fontSize: '12px !important' }} />}
                  label={statusLabel}
                  color={cfg.color}
                  size="small"
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />
                <Tooltip title={logInlineOpen ? 'Collapse logs' : 'Expand logs inline'}>
                  <IconButton size="small" onClick={toggleInlineLogs} sx={{ p: 0.5 }}>
                    {logInlineOpen ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Tooltip>
                <JobActions job={job} onLogView={() => setLogOpen(true)} />
              </Stack>
            </Stack>

            {/* ── Stage bar ───────────────────────────────────────────── */}
            <StageBar step={step} status={status} />

            {/* ── Progress ────────────────────────────────────────────── */}
            {showProgress && (
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" justifyContent="space-between" mb={0.4}>
                  <Typography variant="caption" color="text.secondary">
                    {isFfmpegStep
                      ? `${ffmpegDone} / ${ffmpegTotal}`
                      : isExtractStep
                        ? extractDone
                        : `${downloaded} / ${total}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {speed && `${speed}  `}{eta && `ETA ${eta}  `}{percent > 0 && `${percent.toFixed(1)}%`}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant={percent > 0 ? 'determinate' : 'indeterminate'}
                  value={percent}
                  sx={{ height: 5, borderRadius: 3 }}
                />
              </Box>
            )}

            {/* Indeterminate bar for processing stages (no byte-level progress) */}
            {isActive && !showProgress && status !== 'QUEUED' && (
              <LinearProgress
                variant="indeterminate"
                sx={{ height: 4, borderRadius: 3, mt: 1 }}
              />
            )}

            {/* ── Fail reason ─────────────────────────────────────────── */}
            {failReason && (
              <Typography
                variant="caption"
                color="error"
                sx={{ mt: 0.75, display: 'block', wordBreak: 'break-word' }}
              >
                {failReason}
              </Typography>
            )}

            {/* ── Inline log panel ─────────────────────────────────── */}
            <Collapse in={logInlineOpen} unmountOnExit>
              <Box
                sx={{
                  mt: 1,
                  border: `1px solid ${alpha(T.text, 0.1)}`,
                  borderRadius: 1,
                  overflow: 'hidden',
                  maxHeight: 300,
                }}
              >
                {inlineLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={20} />
                  </Box>
                ) : (
                  <iframe
                    srcDoc={inlineHtml ?? ''}
                    title="Job logs"
                    style={{ width: '100%', height: 280, border: 'none' }}
                    sandbox="allow-same-origin"
                  />
                )}
              </Box>
            </Collapse>

            {/* ── Job ID ──────────────────────────────────────────────── */}
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
              {jobId.slice(0, 8)}…
              {elapsedMs != null && ` · ${fmtDurationMs(elapsedMs)}`}
              {['SUCCESS', 'FAILED', 'CANCELLED'].includes(status) && elapsedMs > 0 && ' total'}
            </Typography>
          </CardContent>
        </Card>
      </motion.div>

      <LogViewerDrawer
        jobId={jobId}
        open={logOpen}
        onClose={() => setLogOpen(false)}
      />
    </>
  );
}
