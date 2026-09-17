import React from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { ContentCopyRounded, OpenInNewRounded, TerminalRounded } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { notify } from '@shared/notify';
import { fmtTimeShort, levelColor, shortLogger } from '@features/admin/logs/logUtils';
import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

/** Lines pulled for the inline preview. The full run is a click away in the Log Viewer. */
const PREVIEW_LINES = 60;

/** The Log Viewer's stack, so the two features render a log line identically. */
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' };

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

/**
 * How far into the run a line was written — "+0.0s", "+1.2s", "+3m07s".
 *
 * <p>Every line in this panel belongs to one run, so the wall-clock hour is identical on all of
 * them and costs about 80px of a phone's width to repeat. The offset is the part that differs,
 * and on a job you are diagnosing it is also the part you want: where the four minutes went.
 * The absolute stamp stays on the line's `title` for anyone lining it up against the Log Viewer.
 *
 * <p>Returns null when there is nothing honest to say — a missing stamp, or a line written
 * fractionally BEFORE the run row was recorded, which correlation does sweep in.
 */
export function offsetLabel(timestamp, startedAt) {
  if (!timestamp || !startedAt) return null;
  const t  = new Date(timestamp).getTime();
  const t0 = new Date(startedAt).getTime();
  if (Number.isNaN(t) || Number.isNaN(t0) || t < t0) return null;
  const ms = t - t0;
  if (ms < 60_000) return `+${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `+${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
}

/**
 * The run's lines as plain text, for the clipboard.
 *
 * Absolute stamps here, not offsets: a pasted log lands in a ticket or a chat that has no idea
 * when the run started.
 */
export function asPlainText(entries) {
  return entries
    .map((e) => (typeof e === 'string'
      ? e
      : [e?.timestamp, String(e?.level ?? '').toUpperCase(), e?.logger, '-', e?.message]
        .filter(Boolean).join(' ') + (e?.exception ? `\n${e.exception}` : '')))
    .join('\n');
}

/**
 * Copy, and say so only once it happened.
 *
 * The obvious `clipboard?.writeText(t); notify.success()` reports a copy in the two cases it is
 * most likely to fail — no Clipboard API at all, and a rejected write (denied permission, or a
 * non-secure context, which is every plain-http LAN address). Claiming success there sends
 * someone off to paste nothing.
 */
const copy = (text) => {
  if (!navigator.clipboard?.writeText) { notify.error('Clipboard unavailable here'); return; }
  navigator.clipboard.writeText(String(text)).then(
    () => notify.success('Logs copied'),
    () => notify.error('Couldn’t copy the logs'),
  );
};

/**
 * One log line.
 *
 * <p>Below `sm` the meta moves onto its own line above the message. The single-row layout wider
 * screens get pins three non-shrinking columns — stamp, level, logger — to the left of a message
 * that takes whatever is left, and what was left inside a phone-width sheet was about 70px: every
 * message wrapped two or three characters at a time. Stacking costs a line of height and hands
 * the message the panel's full width back.
 */
function LogLine({ entry, startedAt, dark, T }) {
  // A line the parser couldn't make sense of comes back as the raw string rather than a shaped
  // entry. Show it verbatim — it still belongs to this run, and a blank row would just look
  // like the run logged nothing.
  if (typeof entry === 'string') {
    return (
      <Box sx={{
        ...mono, fontSize: '0.68rem', lineHeight: 1.6,
        py: 0.15, color: T.textFaint, wordBreak: 'break-all',
      }}>
        {entry}
      </Box>
    );
  }

  const level  = String(entry?.level ?? '').toUpperCase();
  const offset = offsetLabel(entry?.timestamp, startedAt);

  return (
    <Box
      title={entry?.timestamp ? String(entry.timestamp) : undefined}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 0, sm: 1 },
        alignItems: { xs: 'stretch', sm: 'baseline' },
        ...mono, fontSize: '0.68rem', lineHeight: 1.6,
        py: { xs: 0.4, sm: 0.15 },
      }}
    >
      {/* Meta: a row of its own on a phone, three leading columns on anything wider. */}
      <Box sx={{
        display: 'flex', gap: 1, alignItems: 'baseline', minWidth: 0,
        // Only the wide layout pins this block; stacked, it owns the line and may shrink.
        flexShrink: { xs: 1, sm: 0 },
      }}>
        <Box component="span" sx={{ color: T.textFaint, flexShrink: 0, minWidth: { sm: 46 } }}>
          {offset ?? fmtTimeShort(entry?.timestamp)}
        </Box>
        <Box component="span" sx={{ color: levelColor(level, dark), flexShrink: 0, width: 40, fontWeight: 700 }}>
          {level}
        </Box>
        <Box component="span" sx={{
          color: T.textFaint, minWidth: 0, maxWidth: { sm: 120 },
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {shortLogger(entry?.logger)}
        </Box>
      </Box>

      <Box component="span" sx={{ color: T.textMuted, wordBreak: 'break-word', minWidth: 0 }}>
        {entry?.message}
        {entry?.exception && (
          <Box component="span" sx={{ color: T.error, display: 'block', whiteSpace: 'pre-wrap' }}>
            {entry.exception}
          </Box>
        )}
      </Box>
    </Box>
  );
}

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
  const dark = T.bg === '#000000';
  const date = runDate(startedAt);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['scheduler-run-logs', runId, date],
    queryFn:  () => fetchRunLogs(runId, date),
    enabled:  !!runId,
    staleTime: 60_000,
  });

  const entries = data?.entries ?? [];

  const actionSx = {
    fontSize: '0.66rem', textTransform: 'none', color: T.textMuted,
    minWidth: 0, py: 0.1, px: 1, flexShrink: 0,
    '&:hover': { color: T.text, bgcolor: S.cardHover },
  };

  return (
    <Box sx={{ bgcolor: S.inset, borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1.5, py: 0.75, borderBottom: `1px solid ${S.divider}`,
      }}>
        <TerminalRounded sx={{ fontSize: 14, color: T.textFaint, flexShrink: 0 }} />
        <Typography sx={{
          fontSize: '0.68rem', color: T.textFaint, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          Run <Box component="span" sx={{ ...mono, color: T.textMuted }}>{runId}</Box>
          {entries.length > 0 && ` · ${entries.length} line${entries.length === 1 ? '' : 's'}`}
        </Typography>
        {entries.length > 0 && (
          <Button
            size="small"
            onClick={() => copy(asPlainText(entries))}
            startIcon={<ContentCopyRounded sx={{ fontSize: 12 }} />}
            sx={actionSx}
          >
            Copy
          </Button>
        )}
        <Button
          component={RouterLink}
          to={logViewerHref(runId, date)}
          size="small"
          endIcon={<OpenInNewRounded sx={{ fontSize: 12 }} />}
          sx={actionSx}
        >
          Log Viewer
        </Button>
      </Box>

      {/*
        Capped and independently scrollable on a pointer device, where the dialog has room for
        the history AND a log window inside it. On a phone the sheet is already the scroll
        region, and a 260px window nested inside it is a scroll trap — you swipe to read the log
        and the sheet moves instead. There, the panel is simply as tall as its lines.
      */}
      <Box sx={{
        maxHeight: { xs: 'none', sm: 260 },
        overflowY: { xs: 'visible', sm: 'auto' },
        px: 1.5, py: 1,
      }}>
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
          entries.map((e, i) => (
            <LogLine key={i} entry={e} startedAt={startedAt} dark={dark} T={T} />
          ))
        )}
      </Box>
    </Box>
  );
}
