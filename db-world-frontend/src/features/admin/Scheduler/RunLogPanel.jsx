import React from 'react';
import { Box, Typography, CircularProgress, Button, Tooltip } from '@mui/material';
import { OpenInNewRounded, TerminalRounded } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

/** Lines pulled for the inline preview. The full run is a click away in the Log Viewer. */
const PREVIEW_LINES = 60;

/** Level → colour, matching the Log Viewer's palette so the two read as one feature. */
const LEVEL_COLOR = {
  ERROR: '#dc2626',
  WARN:  '#f59e0b',
  INFO:  '#0284c7',
  DEBUG: '#64748b',
  TRACE: '#64748b',
};

/**
 * Fetches the log lines one scheduler run produced.
 *
 * `date` is the run's own start date and is what keeps the lookup cheap — the backend uses
 * it to open that day's log files instead of scanning every rotated archive.
 */
export const fetchRunLogs = (runId, date, lines = PREVIEW_LINES) =>
  axiosInstance
    .get(`/api/admin/logs/run/${runId}`, { params: { date, lines } })
    .then(r => r.data?.data ?? { entries: [], count: 0 });

/** YYYY-MM-DD in local time — the backend indexes log archives by calendar day. */
export function runDate(startedAt) {
  if (!startedAt) return undefined;
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Deep link into the Log Viewer, pre-filtered to this run. */
export function logViewerHref(runId, date) {
  const params = new URLSearchParams({ source: 'app', type: 'info', jobRunId: runId });
  if (date) params.set('date', date);
  return `/admin/logs?${params.toString()}`;
}

const shortTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? String(ts).slice(11, 23)
    : d.toLocaleTimeString('en-IN', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
};

/** Last two dotted segments of a logger name — the full FQN is noise at this width. */
const shortLogger = (logger) => {
  if (!logger) return '';
  const parts = String(logger).split('.');
  return parts.slice(-1).join('.');
};

/**
 * The log lines a single scheduler run emitted, shown inline under its history row.
 *
 * <p>This is a preview, not the Log Viewer: no filtering, no live tail, newest last, capped
 * at {@link PREVIEW_LINES}. Anything more and you want the real viewer, which is one button
 * away and lands pre-filtered on the same run.
 */
export default function RunLogPanel({ runId, startedAt }) {
  const T = useT();
  const S = adminSurface(T);
  const date = runDate(startedAt);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['scheduler-run-logs', runId, date],
    queryFn:  () => fetchRunLogs(runId, date),
    enabled:  !!runId,
    staleTime: 60_000,
  });

  const entries = data?.entries ?? [];

  return (
    <Box sx={{ bgcolor: S.inset, borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.5, py: 0.75, borderBottom: `1px solid ${S.divider}`,
      }}>
        <TerminalRounded sx={{ fontSize: 14, color: T.textFaint }} />
        <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, flex: 1, minWidth: 0 }}>
          Run <Box component="span" sx={{ fontFamily: 'monospace', color: T.textMuted }}>{runId}</Box>
          {entries.length > 0 && ` · ${entries.length} line${entries.length === 1 ? '' : 's'}`}
        </Typography>
        <Tooltip title="Open the full log, filtered to this run">
          <Button
            component={RouterLink}
            to={logViewerHref(runId, date)}
            size="small"
            endIcon={<OpenInNewRounded sx={{ fontSize: 12 }} />}
            sx={{
              fontSize: '0.66rem', textTransform: 'none', color: T.textMuted,
              minWidth: 0, py: 0.1, px: 1,
              '&:hover': { color: T.text, bgcolor: S.cardHover },
            }}
          >
            Log Viewer
          </Button>
        </Tooltip>
      </Box>

      <Box sx={{ maxHeight: 260, overflowY: 'auto', px: 1.5, py: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={16} sx={{ color: T.textFaint }} />
          </Box>
        ) : isError ? (
          <Typography sx={{ fontSize: '0.7rem', color: T.error, fontStyle: 'italic' }}>
            Couldn&apos;t read this run&apos;s logs: {error?.response?.data?.message ?? error?.message ?? 'unknown error'}
          </Typography>
        ) : entries.length === 0 ? (
          <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, fontStyle: 'italic' }}>
            No log lines found for this run. They may have rotated out of the retention window,
            or the run pre-dates run-log correlation.
          </Typography>
        ) : (
          entries.map((e, i) => {
            // A line the parser couldn't make sense of comes back as the raw string rather
            // than a shaped entry. Show it verbatim — it still belongs to this run, and a
            // blank row would just look like the run logged nothing.
            if (typeof e === 'string') {
              return (
                <Box key={i} sx={{
                  fontFamily: 'monospace', fontSize: '0.68rem', lineHeight: 1.6,
                  py: 0.15, color: T.textFaint, wordBreak: 'break-all',
                }}>
                  {e}
                </Box>
              );
            }
            const level = String(e?.level ?? '').toUpperCase();
            return (
              <Box key={i} sx={{
                display: 'flex', gap: 1, alignItems: 'baseline',
                fontFamily: 'monospace', fontSize: '0.68rem', lineHeight: 1.6,
                py: 0.15,
              }}>
                <Box component="span" sx={{ color: T.textFaint, flexShrink: 0 }}>
                  {shortTime(e?.timestamp)}
                </Box>
                <Box component="span" sx={{
                  color: LEVEL_COLOR[level] ?? T.textMuted, flexShrink: 0, width: 40,
                  fontWeight: 700,
                }}>
                  {level}
                </Box>
                <Box component="span" sx={{ color: T.textFaint, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shortLogger(e?.logger)}
                </Box>
                <Box component="span" sx={{ color: T.textMuted, wordBreak: 'break-word', minWidth: 0 }}>
                  {e?.message}
                  {e?.exception && (
                    <Box component="span" sx={{ color: T.error, display: 'block', whiteSpace: 'pre-wrap' }}>
                      {e.exception}
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
