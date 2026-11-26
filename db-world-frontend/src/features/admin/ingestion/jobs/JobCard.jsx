import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notify } from '@shared/notify';
import {
  alpha,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Http,
  Queue,
  PlayCircleOutline,
  Timer,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import TrackReviewDialog from './TrackReviewDialog';
import CommonServices from '@shared/services/CommonServices';
import {
  formatBytes as fmtBytes,
  formatDurationMs as fmtDurationMs,
  formatEta as fmtEta,
  formatSpeed as fmtSpeed,
} from '../utils/format';
import { injectLogTheme } from '../utils/logTheme';
import { BottomActions } from './BottomActions';
import { FileBreakdown, SingleFileSteps } from './FileBreakdown';
import { MetaChip, ProgressInfo, StageBar, TransferStats } from './JobCardParts';
import { LogPanel } from './LogPanel';
import { TrackReviewBanner } from './TrackReviewBanner';
import { PHASE_CFG, SOURCE_ICONS, safeDisplayName, timeAgo } from './jobCardConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

function JobCardComponent({ job, queuePosition = 0 }) {
  const T = useT();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const isVeryNarrow = useMediaQuery('(max-width:390px)');

  const [logOpen, setLogOpen] = useState(false);
  const [logHtml, setLogHtml] = useState(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(false);
  const [trackDlgOpen, setTrackDlgOpen] = useState(false);

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
    files,
    fileIndex,
    fileTotal,
    overallPercent,
  } = job;

  const SourceIcon = SOURCE_ICONS[sourceType] ?? Http;
  const isTerminal = ['SUCCESS', 'FAILED', 'CANCELLED'].includes(status);
  const isActive = !isTerminal && status !== 'PAUSED';

  // The chip shows the CURRENT phase (one label + colour + icon). QUEUED/STARTED/PAUSED/AWAITING and
  // terminal states map straight through; while active the phase comes from the step (never a stale
  // DOWNLOAD label while queued, since QUEUED short-circuits here).
  const phase = useMemo(() => {
    if (isTerminal || status === 'QUEUED' || status === 'STARTED'
        || status === 'PAUSED' || status === 'AWAITING_INPUT') return status;
    if (progress?.phase === 'aria2-waiting') return 'ARIA2_WAITING';
    if (progress?.phase === 'aria2-paused') return 'ARIA2_PAUSED';
    if (progress?.phase === 'merging') return 'MERGING';
    if (step === 'EXTRACT') return 'EXTRACT';
    if (step === 'FFMPEG') return 'FFMPEG';
    if (step === 'MEDIA_INFO') return 'MEDIA_INFO';
    if (step === 'DOWNLOAD' || status === 'DOWNLOADING') return 'DOWNLOADING';
    return 'PROCESSING';
  }, [isTerminal, status, step, progress?.phase]);
  const cfg = PHASE_CFG[phase] ?? PHASE_CFG.STARTED;
  const statusLabel = cfg.label;

  const pct = Math.min(100, Math.max(0, Number(progress?.percent ?? 0)));
  // Low download speeds report 0 between ticks; hold the last non-zero value so speed/ETA don't
  // flicker on and off every couple of seconds.
  const lastSpeedRef = useRef(0);
  const lastEtaRef = useRef(0);
  useEffect(() => {
    if (phase === 'ARIA2_WAITING' || phase === 'ARIA2_PAUSED' || phase === 'PAUSED') {
      lastSpeedRef.current = 0;
      lastEtaRef.current = 0;
      return;
    }
    if (Number(progress?.speed) > 0) lastSpeedRef.current = Number(progress.speed);
    if (Number(progress?.eta) > 0) lastEtaRef.current = Number(progress.eta);
  }, [phase, progress?.speed, progress?.eta]);
  const speed = useMemo(
    () => fmtSpeed(Number(progress?.speed) > 0 ? progress.speed : lastSpeedRef.current),
    [progress?.speed]
  );
  const eta = useMemo(
    () => fmtEta(Number(progress?.eta) > 0 ? progress.eta : lastEtaRef.current),
    [progress?.eta]
  );
  const isFfmpeg = step === 'FFMPEG';
  const isExtract = step === 'EXTRACT';
  const isMerging = progress?.phase === 'merging';
  // Speed + ETA are only meaningful while downloading. The backend now clears these on the
  // step transition, but gate here too so a stale download ETA can never render as "574h"
  // beside a 100% processing bar.
  const isDownload = !isFfmpeg && !isExtract && !isMerging &&
    !['ARIA2_WAITING', 'ARIA2_PAUSED', 'PAUSED'].includes(phase) &&
    (step === 'DOWNLOAD' || progress?.phase === 'downloading');

  const hasFiles = Array.isArray(files) && files.length > 0;
  const isMultiFile = Number(fileTotal) > 1;
  // Main bar shows WHOLE-JOB progress once files are registered — a clean 0-100% that can never
  // render as a time. Falls back to the download/extract byte-percent before files exist.
  const mainPct = hasFiles
    ? Math.min(100, Math.max(0, Number(overallPercent ?? pct)))
    // While extracting, only trust a processing-phase % — a stale "downloading" 100% must not bleed
    // through as a full bar; show indeterminate until real extraction progress arrives.
    : (isExtract && progress?.phase !== 'processing' ? 0 : pct);

  const showStats = isDownload && Number(progress?.downloaded) > 0;

  const progressLeft = useMemo(() => {
    // The phase word lives in the status chip now — here we show only the OVERALL metric so the two
    // don't repeat. Extract/merge have no meaningful % (indeterminate bar), so no left label.
    if (isMerging || isExtract) return '';
    if (hasFiles) return isMultiFile ? `File ${fileIndex ?? '—'} of ${fileTotal}` : 'Overall';
    if (showStats) return 'Download';
    return `${fmtBytes(progress?.downloaded)} / ${fmtBytes(progress?.total)}`;
  }, [isMerging, isExtract, hasFiles, isMultiFile, fileIndex, fileTotal, showStats, progress?.downloaded, progress?.total]);

  const progressRight = useMemo(() => {
    // Speed/ETA move into the TransferStats grid when it is visible.
    return [
      isDownload && !showStats && speed ? speed : null,
      isDownload && !showStats && eta ? `ETA ${eta}` : null,
      mainPct > 0 && !isMerging ? `${mainPct.toFixed(1)}%` : null,
    ]
      .filter(Boolean)
      .join('  ·  ');
  }, [isDownload, showStats, speed, eta, mainPct, isMerging]);

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
    if (status === 'FAILED') return alpha(T.error, 0.5);
    if (status === 'CANCELLED') return alpha(T.error, 0.3);
    if (status === 'SUCCESS') return alpha(T.success, 0.4);
    if (status === 'PAUSED') return alpha(T.warning, 0.5);
    if (status === 'AWAITING_INPUT') return alpha(theme.palette.secondary.main, 0.55);
    if (isActive) return alpha(T.teal, 0.4);
    return T.border;
  }, [status, isActive, T, theme]);

  const sourceColor = useMemo(() => {
    if (sourceType === 'YOUTUBE') return 'error.main';
    if (sourceType === 'TORRENT') return 'secondary.main';
    return 'text.secondary';
  }, [sourceType]);

  const themedLogHtml = useMemo(() => {
    if (!logHtml) return null;
    return injectLogTheme(logHtml, { isDark, T });
  }, [logHtml, isDark, T]);

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

    notify[result?.success ? 'success' : 'error'](
      result?.message || (result?.success ? 'Source URL copied' : 'Failed to copy URL')
    );
  } catch (error) {
    notify.error(error?.message || 'Failed to copy URL');
  }
}, [uri]);

  return (
    <motion.div
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
          bgcolor: theme.palette.background.paper,
          '&:hover': {
            boxShadow: `0 8px 20px ${alpha(theme.palette.common.black, isDark ? 0.24 : 0.06)}`,
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

              {status === 'QUEUED' && queuePosition > 0 ? (
                <MetaChip
                  icon={<Queue sx={{ fontSize: 13 }} />}
                  label={`#${queuePosition} in queue`}
                  color="warning"
                />
              ) : null}

              {footerTime ? (
                <MetaChip
                  icon={<Timer sx={{ fontSize: 13 }} />}
                  label={footerTime}
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
                  variant={isMerging || mainPct === 0 ? 'indeterminate' : 'determinate'}
                  value={mainPct}
                  sx={{
                    height: isSmDown ? 5 : 6,
                    borderRadius: 999,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  }}
                />
                {showStats ? (
                  <TransferStats
                    downloaded={progress?.downloaded}
                    total={progress?.total}
                    speed={speed}
                    eta={eta}
                    isSmDown={isSmDown}
                  />
                ) : null}
              </Box>
            ) : isActive && status !== 'QUEUED' && status !== 'AWAITING_INPUT' ? (
              <LinearProgress
                variant="indeterminate"
                sx={{
                  height: 3.5,
                  borderRadius: 999,
                  mt: 0.1,
                }}
              />
            ) : null}

            {/* Track-review CTA — the job is parked waiting for an audio/subtitle selection */}
            {status === 'AWAITING_INPUT' ? (
              <TrackReviewBanner onOpen={() => setTrackDlgOpen(true)} />
            ) : null}

            {/* Per-file breakdown: full list for season packs, inline sub-steps for a single file */}
            {hasFiles && isMultiFile ? (
              <FileBreakdown files={files} fileIndex={fileIndex} fileTotal={fileTotal} />
            ) : hasFiles ? (
              <SingleFileSteps file={files[0]} />
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
                  bgcolor: alpha(T.error, isDark ? 0.14 : 0.06),
                  borderColor: alpha(T.error, 0.2),
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

            {/* Bottom action row — same placement on mobile + desktop; spread across the row on desktop */}
            <BottomActions
              logOpen={logOpen}
              onToggleLogs={toggleLogs}
              onCopyUrl={handleCopyUrl}
              hasUri={!!uri}
              job={job}
              compact={isVeryNarrow}
              spread={!isSmDown}
            />

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

      {trackDlgOpen ? (
        <TrackReviewDialog
          jobId={jobId}
          open={trackDlgOpen}
          onClose={() => setTrackDlgOpen(false)}
        />
      ) : null}
    </motion.div>
  );
}

const JobCard = memo(JobCardComponent);
export default JobCard;
