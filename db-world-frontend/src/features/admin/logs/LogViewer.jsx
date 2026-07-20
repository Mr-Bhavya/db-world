import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, TextField,
  ToggleButton, ToggleButtonGroup, CircularProgress, Button,
  Stack, Collapse, Skeleton, Fab, Drawer, Divider, Badge, Snackbar, Alert,
} from '@mui/material';
import PlayArrowIcon         from '@mui/icons-material/PlayArrow';
import PauseIcon             from '@mui/icons-material/Pause';
import RefreshIcon           from '@mui/icons-material/Refresh';
import DeleteSweepIcon       from '@mui/icons-material/DeleteSweep';
import DownloadIcon          from '@mui/icons-material/Download';
import SearchIcon            from '@mui/icons-material/Search';
import ClearIcon             from '@mui/icons-material/Clear';
import DataObjectIcon        from '@mui/icons-material/DataObject';
import SubjectIcon           from '@mui/icons-material/Subject';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon   from '@mui/icons-material/KeyboardArrowUp';
import ExpandMoreIcon        from '@mui/icons-material/ExpandMore';
import AddIcon               from '@mui/icons-material/Add';
import ErrorOutlineIcon      from '@mui/icons-material/ErrorOutline';
import ArrowDownwardIcon     from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon       from '@mui/icons-material/ArrowUpward';
import TuneIcon              from '@mui/icons-material/Tune';
import SpeedIcon             from '@mui/icons-material/Speed';
import ContentCopyIcon       from '@mui/icons-material/ContentCopy';
import FilterAltOffIcon      from '@mui/icons-material/FilterAltOff';
import { useQuery }     from '@tanstack/react-query';
import { useThemeMode } from '@shared/theme';
import {
  LOG_SOURCES_CONFIG, getSourceConfig, fetchLogs, fetchAvailableDates,
} from './logApi';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

const BASE = getApiBaseUrl();
const MAX_LIVE          = 1000;
const PRELOAD_LINES     = 150;
const LOAD_MORE_STEP    = 500;
const SLOW_THRESHOLD_MS = 2000;

// ── Level palette (terminal aesthetic, always dark) ──────────────────────────
const LC = {
  ERROR:   { bg: 'rgba(239,68,68,0.16)',   text: '#f87171', border: 'rgba(239,68,68,0.35)',   bar: '#f87171' },
  WARN:    { bg: 'rgba(245,158,11,0.14)',  text: '#fbbf24', border: 'rgba(245,158,11,0.32)',  bar: '#fbbf24' },
  INFO:    { bg: 'rgba(13,148,136,0.14)',  text: '#2dd4bf', border: 'rgba(13,148,136,0.32)',  bar: '#2dd4bf' },
  DEBUG:   { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: 'rgba(16,185,129,0.28)',  bar: '#34d399' },
  REQUEST: { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', border: 'rgba(99,102,241,0.28)',  bar: '#818cf8' },
  UNKNOWN: { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.30)', border: 'rgba(255,255,255,0.10)', bar: 'rgba(255,255,255,0.18)' },
};
const METHOD_C = { GET: '#34d399', POST: '#60a5fa', PUT: '#fbbf24', PATCH: '#c084fc', DELETE: '#f87171' };

// ── Pure helpers ─────────────────────────────────────────────────────────────
const levelOf = (e) => {
  const l = e?.level;
  const s = (typeof l === 'string' ? l : (l?.name ?? '')).toUpperCase();
  return Object.keys(LC).includes(s) ? s : 'UNKNOWN';
};

const rawLevel = (line) => {
  if (!line) return 'UNKNOWN';
  const u = line.toUpperCase();
  if (u.includes(' ERROR ') || u.includes('"LEVEL":"ERROR"')) return 'ERROR';
  if (u.includes(' WARN ')  || u.includes('"LEVEL":"WARN"'))  return 'WARN';
  if (u.includes(' DEBUG ') || u.includes('"LEVEL":"DEBUG"')) return 'DEBUG';
  if (u.includes(' INFO ')  || u.includes('"LEVEL":"INFO"'))  return 'INFO';
  return 'UNKNOWN';
};

const fmtTime = (ts) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour12: false })
         + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch { return ts; }
};

const minuteBucket = (ts) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-IN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return ''; }
};

const shortLogger = (logger) => logger?.split('.').slice(-2).join('.') ?? '';

const hlText = (text, q) => {
  if (!q || !text) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: 'rgba(251,191,36,0.4)', color: '#fff', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
};

/** md5 MDC slot is `req=<hex>;res=<hex>` — split for nicer display. */
const parseMd5 = (raw) => {
  if (!raw) return { req: null, res: null };
  const out = { req: null, res: null };
  for (const part of raw.split(';')) {
    const [k, v] = part.split('=');
    if (k === 'req' && v) out.req = v;
    if (k === 'res' && v) out.res = v;
  }
  return out;
};

const isRequestEntry = (e) =>
  e?.uri != null || e?.method != null ||
  e?.logger?.includes?.('JwtAuthenticationFilter');

const isSlow = (e) => {
  const dur = parseInt(e?.duration, 10);
  if (Number.isFinite(dur) && dur >= SLOW_THRESHOLD_MS) return true;
  return e?.message?.toLowerCase?.() === 'slow';
};

// ── SSE parser ───────────────────────────────────────────────────────────────
function parseSseChunk(chunk, onLine) {
  for (const block of chunk.split(/\n\n+/)) {
    if (!block.trim()) continue;
    let name = '', data = '';
    for (const ln of block.split('\n')) {
      if (ln.startsWith('event:')) name = ln.slice(6).trim();
      else if (ln.startsWith('data:')) data = ln.slice(5).trim();
    }
    if (name === 'log' && data) onLine(data);
  }
}

/**
 * Consecutive duplicates collapse to one row with a `× N` chip.
 * Identity = level + logger + message (for JSON) or whole line (for raw).
 * Solves the LogShipper/Aria2 "still missing" visual spam at the UI layer.
 */
function compressBursts(entries) {
  if (entries.length === 0) return entries;
  const out = [];
  let lastKey = null;
  let lastEntry = null;
  let count = 0;
  const flush = () => {
    if (!lastEntry) return;
    out.push(count > 1 ? { ...lastEntry, _burst: count } : lastEntry);
    lastEntry = null;
    count = 0;
  };
  for (const e of entries) {
    const key = e._raw
      ? `R::${e._line}`
      : `J::${levelOf(e)}::${e.logger}::${e.message}`;
    if (key === lastKey) {
      count++;
      lastEntry = e;
    } else {
      flush();
      lastKey = key;
      lastEntry = e;
      count = 1;
    }
  }
  flush();
  return out;
}

// ── Tiny copy helper (returns a fn that copies + signals snackbar) ───────────
function useCopy() {
  const [snack, setSnack] = useState({ open: false, msg: '' });
  const copy = useCallback((text, label = 'Copied') => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(String(text));
      setSnack({ open: true, msg: label });
    } catch {
      setSnack({ open: true, msg: 'Copy failed' });
    }
  }, []);
  return { copy, snack, closeSnack: () => setSnack(s => ({ ...s, open: false })) };
}

/** Small inline copy icon button. */
function CopyBtn({ value, label, size = 12 }) {
  const { copy, snack, closeSnack } = useCopy();
  return (
    <>
      <Tooltip title={`Copy ${label || 'value'}`} placement="top" arrow>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); copy(value, label ? `${label} copied` : 'Copied'); }}
          sx={{
            p: 0.25, color: 'rgba(255,255,255,0.3)',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
          }}>
          <ContentCopyIcon sx={{ fontSize: size }} />
        </IconButton>
      </Tooltip>
      <Snackbar
        open={snack.open}
        autoHideDuration={1400}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={closeSnack}>
        <Alert severity="success" variant="filled" onClose={closeSnack}
          sx={{ fontSize: 12, py: 0, '& .MuiAlert-icon': { fontSize: 18 } }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}

// ── Detail field: label + value + copy + optional filter action ──────────────
function DetailField({ label, value, mono, color, onFilter }) {
  if (value == null || value === '') return null;
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0,
      bgcolor: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 1, p: 0.75,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
          textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
          {label}
        </Typography>
        {onFilter && (
          <Tooltip title={`Filter by this ${label.toLowerCase()}`} placement="top" arrow>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onFilter(); }}
              sx={{ p: 0.25, color: 'rgba(255,255,255,0.3)',
                '&:hover': { color: '#a5b4fc' } }}>
              <TuneIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Tooltip>
        )}
        <CopyBtn value={value} label={label} />
      </Box>
      <Typography sx={{ fontSize: { xs: 11, sm: 11.5 },
        color: color ?? 'rgba(255,255,255,0.85)',
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-all',
        lineHeight: 1.4 }}>
        {value}
      </Typography>
    </Box>
  );
}

// ── Expanded entry view (rich, copyable, organised) ──────────────────────────
function ExpandedView({ entry, onAddFilter }) {
  const isReq  = isRequestEntry(entry);
  const md5    = parseMd5(entry?.md5);
  const mc     = METHOD_C[entry?.method?.toUpperCase()] ?? '#60a5fa';
  const sc     = parseInt(entry?.status, 10) || 0;
  const scCol  = sc >= 500 ? '#f87171' : sc >= 400 ? '#fbbf24' : sc >= 200 ? '#34d399' : 'rgba(255,255,255,0.4)';
  const hasExc = entry?.exception?.trim?.().length > 0;

  return (
    <Box sx={{
      mt: 0.75, ml: { xs: 0, sm: 4.25 }, mr: { xs: 0, sm: 1 },
      display: 'flex', flexDirection: 'column', gap: 1,
    }}>
      {/* Top action bar: copy entry JSON / copy line */}
      <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
        <Button
          size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
          }}
          sx={{
            fontSize: 10, py: 0.25, px: 1, textTransform: 'none',
            color: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(255,255,255,0.1)',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.2)' },
          }}>
          Copy entry (JSON)
        </Button>
        {entry?.message && (
          <Button
            size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(entry.message); }}
            sx={{
              fontSize: 10, py: 0.25, px: 1, textTransform: 'none',
              color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.1)',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.2)' },
            }}>
            Copy message
          </Button>
        )}
      </Stack>

      {/* Request grid */}
      {isReq && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(auto-fill, minmax(180px, 1fr))' },
          gap: 0.5,
        }}>
          <DetailField label="Method"   value={entry.method}   color={mc}
            onFilter={() => onAddFilter?.({ type: 'method', value: entry.method })} />
          <DetailField label="Status"   value={entry.status}   color={scCol}
            onFilter={() => onAddFilter?.({ type: 'status', value: String(entry.status) })} />
          <DetailField label="Duration" value={entry.duration ? entry.duration + ' ms' : null} />
          <DetailField label="User"     value={entry.user}
            onFilter={entry.user && entry.user !== 'anonymous'
              ? () => onAddFilter?.({ type: 'user', value: entry.user }) : null} />
          {entry.uri && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <DetailField label="URI" value={entry.uri} mono />
            </Box>
          )}
          <DetailField label="Request ID" value={entry.requestId} mono />
          <DetailField label="Trace ID"   value={entry.traceId}   mono
            onFilter={entry.traceId ? () => onAddFilter?.({ type: 'traceId', value: entry.traceId }) : null} />
          <DetailField label="Thread"     value={entry.thread}    mono />
          {(md5.req || md5.res) && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Box sx={{
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 1, p: 0.75,
              }}>
                <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
                  textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                  MD5 fingerprint
                </Typography>
                <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                  {md5.req && (
                    <Tooltip title={md5.req} arrow>
                      <Chip
                        label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ opacity: 0.55 }}>req</span>
                          <span style={{ fontFamily: 'monospace' }}>{md5.req.slice(0, 12)}…</span>
                        </span>}
                        size="small"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(md5.req); }}
                        sx={{ height: 20, fontSize: 10, cursor: 'pointer',
                          bgcolor: 'rgba(96,165,250,0.12)', color: '#93c5fd',
                          border: '1px solid rgba(96,165,250,0.25)', borderRadius: 0.75 }} />
                    </Tooltip>
                  )}
                  {md5.res && (
                    <Tooltip title={md5.res} arrow>
                      <Chip
                        label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ opacity: 0.55 }}>res</span>
                          <span style={{ fontFamily: 'monospace' }}>{md5.res.slice(0, 12)}…</span>
                        </span>}
                        size="small"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(md5.res); }}
                        sx={{ height: 20, fontSize: 10, cursor: 'pointer',
                          bgcolor: 'rgba(167,139,250,0.12)', color: '#c4b5fd',
                          border: '1px solid rgba(167,139,250,0.25)', borderRadius: 0.75 }} />
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* App-row (non-request) meta */}
      {!isReq && (entry?.thread || entry?.traceId || entry?.requestId || entry?.logger) && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(auto-fill, minmax(180px, 1fr))' },
          gap: 0.5,
        }}>
          <DetailField label="Logger"     value={entry.logger}    mono />
          <DetailField label="Thread"     value={entry.thread}    mono />
          <DetailField label="Trace ID"   value={entry.traceId}   mono
            onFilter={entry.traceId ? () => onAddFilter?.({ type: 'traceId', value: entry.traceId }) : null} />
          <DetailField label="Request ID" value={entry.requestId} mono />
        </Box>
      )}

      {/* Exception */}
      {hasExc && (
        <Box sx={{
          bgcolor: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.18)',
          borderRadius: 1, p: 1,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Typography sx={{ fontSize: 9, color: 'rgba(239,68,68,0.7)', fontFamily: 'monospace',
              fontWeight: 700, letterSpacing: '0.06em', flex: 1 }}>
              EXCEPTION
            </Typography>
            <CopyBtn value={entry.exception} label="Exception" />
          </Box>
          <Typography sx={{ fontSize: 10, color: '#fca5a5', fontFamily: 'monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 280, overflowY: 'auto' }}>
            {entry.exception}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ── JSON log row (collapsed) ─────────────────────────────────────────────────
function JsonRow({ entry, search, expanded, onToggle, onAddFilter }) {
  const level   = levelOf(entry);
  const c       = LC[level];
  const isReq   = isRequestEntry(entry);
  const slow    = isReq && isSlow(entry);
  const hasExc  = entry?.exception?.trim?.().length > 0;
  const burst   = entry._burst;
  const canExp  = hasExc || isReq || entry?.traceId || entry?.requestId;
  const mc      = METHOD_C[entry?.method?.toUpperCase()] ?? '#60a5fa';
  const sc      = parseInt(entry?.status, 10) || 0;
  const scCol   = sc >= 500 ? '#f87171' : sc >= 400 ? '#fbbf24' : sc >= 200 ? '#34d399' : 'rgba(255,255,255,0.4)';
  const hasUser = entry?.user?.trim?.().length > 0 && entry.user !== 'anonymous';
  const stop    = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <Box
      onClick={canExp ? onToggle : undefined}
      sx={{
        position: 'relative',
        cursor: canExp ? 'pointer' : 'default',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        borderLeft: `2px solid ${slow ? '#fbbf24' : 'transparent'}`,
        bgcolor: expanded ? 'rgba(99,102,241,0.04)' : 'transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.025)' },
        transition: 'background 0.12s',
        px: { xs: 1, sm: 1.5 }, py: 0.6,
      }}>
      {/* ── Compact row ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75 }, minWidth: 0 }}>
        <Chip label={level === 'UNKNOWN' ? '—' : level.slice(0, 3)} size="small"
          onClick={stop(() => onAddFilter?.({ type: 'level', value: level }))}
          sx={{ height: 17, fontSize: 8.5, fontWeight: 800, flexShrink: 0, cursor: 'pointer',
            bgcolor: c.bg, color: c.text, border: `1px solid ${c.border}`,
            borderRadius: 0.75, letterSpacing: '0.04em',
            '&:hover': { filter: 'brightness(1.2)' } }} />

        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', flexShrink: 0,
          fontFamily: 'monospace', minWidth: { xs: 56, sm: 76 } }}>
          {fmtTime(entry?.timestamp)}
        </Typography>

        {burst > 1 && (
          <Tooltip title={`${burst} identical lines collapsed`} arrow>
            <Chip label={`× ${burst}`} size="small"
              sx={{ height: 16, fontSize: 9, fontWeight: 700, flexShrink: 0,
                bgcolor: 'rgba(99,102,241,0.18)', color: '#a5b4fc',
                border: '1px solid rgba(99,102,241,0.3)', borderRadius: 0.75 }} />
          </Tooltip>
        )}

        {slow && (
          <Tooltip title={`slow (${entry.duration}ms)`} arrow>
            <SpeedIcon sx={{ fontSize: 13, color: '#fbbf24', flexShrink: 0 }} />
          </Tooltip>
        )}

        {isReq ? (
          <>
            <Chip label={entry.method ?? '?'} size="small"
              onClick={stop(() => onAddFilter?.({ type: 'method', value: entry.method }))}
              sx={{ height: 16, fontSize: 8.5, fontWeight: 700, flexShrink: 0, cursor: 'pointer',
                bgcolor: `${mc}22`, color: mc, border: 'none', borderRadius: 0.75 }} />
            {entry.status && (
              <Box
                onClick={stop(() => onAddFilter?.({ type: 'status', value: String(entry.status) }))}
                sx={{ fontSize: 10, color: scCol, flexShrink: 0, cursor: 'pointer',
                  fontFamily: 'monospace', fontWeight: 700,
                  '&:hover': { textDecoration: 'underline' } }}>
                {entry.status}
              </Box>
            )}
            {entry.duration && (
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', flexShrink: 0,
                fontFamily: 'monospace', display: { xs: 'none', sm: 'block' } }}>
                {entry.duration}ms
              </Typography>
            )}
            {hasUser && (
              <Chip label={entry.user} size="small"
                onClick={stop(() => onAddFilter?.({ type: 'user', value: entry.user }))}
                sx={{ height: 15, fontSize: 8.5, fontWeight: 600, flexShrink: 0, cursor: 'pointer',
                  display: { xs: 'none', sm: 'flex' },
                  bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                  border: '1px solid rgba(99,102,241,0.25)', borderRadius: 0.75,
                  maxWidth: 100, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', px: 0.6 } }} />
            )}
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.82)', fontFamily: 'monospace',
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              display: { xs: 'none', sm: 'block' } }}>
              {hlText(entry.uri ?? '', search)}
            </Typography>
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace',
              wordBreak: 'break-all', flex: 1, lineHeight: 1.45, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {hlText(entry.message ?? '', search)}
            </Typography>
            <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', flexShrink: 0,
              fontFamily: 'monospace', display: { xs: 'none', md: 'block' },
              maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shortLogger(entry?.logger)}
            </Typography>
          </>
        )}

        {canExp && (
          <ExpandMoreIcon sx={{
            fontSize: 16, color: 'rgba(255,255,255,0.3)', flexShrink: 0,
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        )}
      </Box>

      {/* mobile-only: uri second row for request entries */}
      {isReq && (
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'baseline',
          gap: 0.75, pl: 0.5, mt: 0.25, minWidth: 0 }}>
          {entry.duration && (
            <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.30)',
              fontFamily: 'monospace', flexShrink: 0 }}>
              {entry.duration}ms
            </Typography>
          )}
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)',
            fontFamily: 'monospace', flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hlText(entry.uri ?? '', search)}
          </Typography>
        </Box>
      )}

      <Collapse in={expanded} unmountOnExit>
        <ExpandedView entry={entry} onAddFilter={onAddFilter} />
      </Collapse>
    </Box>
  );
}

// ── Raw log row ──────────────────────────────────────────────────────────────
function RawRow({ line, search, burst }) {
  const level = rawLevel(line);
  const c     = LC[level];
  return (
    <Box sx={{
      display: 'flex', gap: 0.75, px: { xs: 1, sm: 1.25 }, py: 0.4,
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      borderLeft: `2px solid ${c.bar}`,
      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
    }}>
      {burst > 1 && (
        <Chip label={`× ${burst}`} size="small"
          sx={{ height: 16, fontSize: 9, fontWeight: 700, flexShrink: 0, alignSelf: 'flex-start',
            bgcolor: 'rgba(99,102,241,0.18)', color: '#a5b4fc',
            border: '1px solid rgba(99,102,241,0.3)', borderRadius: 0.75 }} />
      )}
      <Typography sx={{ fontSize: { xs: 10.5, sm: 11 },
        color: level === 'ERROR' ? '#fca5a5' : level === 'WARN' ? '#fde68a' : 'rgba(255,255,255,0.78)',
        fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.55, flex: 1 }}>
        {hlText(line, search)}
      </Typography>
      <Box sx={{ alignSelf: 'flex-start', opacity: 0.5, '&:hover': { opacity: 1 } }}>
        <CopyBtn value={line} label="Line" />
      </Box>
    </Box>
  );
}

// ── Sticky minute divider ────────────────────────────────────────────────────
function MinuteDivider({ label }) {
  return (
    <Box sx={{
      position: 'sticky', top: 0, zIndex: 2,
      px: { xs: 1, sm: 1.5 }, py: 0.3,
      bgcolor: 'rgba(10,14,20,0.92)', backdropFilter: 'blur(6px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      borderTop: '1px solid rgba(255,255,255,0.03)',
    }}>
      <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace',
        letterSpacing: '0.05em', fontWeight: 700 }}>
        {label}
      </Typography>
    </Box>
  );
}

// ── Live status pill ─────────────────────────────────────────────────────────
function LiveDot({ connected, count, T }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75,
      px: 1, py: 0.4, borderRadius: 1,
      bgcolor: connected ? 'rgba(34,197,94,0.10)' : 'rgba(245,158,11,0.10)',
      border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%',
        bgcolor: connected ? T.success : T.warning,
        animation: connected ? 'lv-pulse 1.5s ease-in-out infinite' : 'none',
        '@keyframes lv-pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } } }} />
      <Typography sx={{ fontSize: 10.5, color: connected ? T.success : T.warning,
        fontFamily: 'monospace', fontWeight: 600 }}>
        {connected ? `${count}` : 'connecting'}
      </Typography>
    </Box>
  );
}

// ── Active-filter pill (compact, with × to remove) ───────────────────────────
function ActivePill({ label, value, onRemove, color, T }) {
  return (
    <Chip
      size="small"
      label={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <Box component="span" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, textTransform: 'uppercase' }}>{label}</Box>
        <Box component="span" sx={{ fontWeight: 600 }}>{value}</Box>
      </Box>}
      onDelete={onRemove}
      deleteIcon={<ClearIcon sx={{ fontSize: 13 }} />}
      sx={{
        height: 22, fontSize: 10.5,
        bgcolor: color ? `${color}22` : T.tealBg,
        color: color ?? T.teal,
        border: `1px solid ${color ? color + '55' : T.teal + '55'}`,
        borderRadius: 0.75,
        '& .MuiChip-deleteIcon': { color: 'inherit', opacity: 0.6, '&:hover': { opacity: 1 } },
      }}
    />
  );
}

// ── Date chip row (history) ──────────────────────────────────────────────────
function DateChipRow({ source, subType, format, selected, onChange, disabled, T }) {
  const { data: dates, isLoading } = useQuery({
    queryKey: ['log-dates', source, subType, format],
    queryFn:  () => fetchAvailableDates({ source, type: subType, format }),
    enabled:  !disabled,
    staleTime: 60_000,
  });

  if (disabled || (!isLoading && (!dates || dates.length <= 1))) return null;

  const today = new Date().toISOString().slice(0, 10);
  const sel = (d) => selected === d || (d === today && selected === null);

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 0.75,
      display: 'flex', gap: 0.5, overflowX: 'auto', flexShrink: 0,
      '&::-webkit-scrollbar': { height: 2 } }}>
      {isLoading
        ? [1,2,3,4,5].map(i => <Skeleton key={i} variant="rounded" width={64} height={22} sx={{ flexShrink: 0, bgcolor: T.glass }} />)
        : dates?.map(d => (
            <Chip key={d} label={d === today ? 'Today' : d.slice(5)} size="small"
              onClick={() => onChange(d === today ? null : d)}
              sx={{ flexShrink: 0, height: 22, fontSize: 10.5, cursor: 'pointer',
                bgcolor: sel(d) ? T.tealBg : T.glass,
                color:   sel(d) ? T.teal   : T.textMuted,
                border:  `1px solid ${sel(d) ? T.teal + '55' : T.border}`,
                '&:hover': { bgcolor: T.tealBgHover } }} />
          ))}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function LogViewer() {
  const { T, mode } = useThemeMode();

  const termBg     = mode === 'dark' ? '#0a0e14' : '#0f1419';
  const termBorder = `1px solid ${T.border}`;

  // ── State ──
  const [sourceId, setSourceId] = useState('app');
  const [subType,  setSubType]  = useState('info');
  const [viewMode, setViewMode] = useState('json');
  const [selDate,  setSelDate]  = useState(null);
  const [search,   setSearch]   = useState('');
  const [dSearch,  setDSearch]  = useState('');
  const [lines,    setLines]    = useState(500);

  // Live stream
  const [live,        setLive]        = useState(false);
  const [livePreload, setLivePreload] = useState([]);
  const [liveLines,   setLiveLines]   = useState([]);
  const [connected,   setConnected]   = useState(false);

  // Filters
  const [levelFilter,  setLevelFilter]  = useState([]);
  const [userFilter,   setUserFilter]   = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [traceFilter,  setTraceFilter]  = useState('');
  const [slowOnly,     setSlowOnly]     = useState(false);

  // Display options
  const [sortDesc,       setSortDesc]       = useState(false);
  const [collapseBursts, setCollapseBursts] = useState(true);

  // UI state
  const [expandedId, setExpandedId] = useState(null);
  const [showFab,    setShowFab]    = useState(false);
  const [panelOpen,  setPanelOpen]  = useState(false);

  const listRef        = useRef(null);
  const searchInputRef = useRef(null);
  const sseRef         = useRef(null);
  const autoScrollRef  = useRef(true);
  const searchTimer    = useRef(null);
  const prevScrollH    = useRef(0);
  const isLoadingMore  = useRef(false);

  // ── Derived ──
  const srcCfg  = getSourceConfig(sourceId);
  const supJson = srcCfg?.supportsJson ?? false;
  const supHist = srcCfg?.supportsHistory ?? false;
  const fmt     = viewMode === 'json' && supJson ? 'JSON' : 'RAW';

  const resetFilters = useCallback(() => {
    setLevelFilter([]); setUserFilter(''); setSearch('');
    setMethodFilter(''); setStatusFilter(''); setTraceFilter('');
    setSlowOnly(false);
  }, []);

  /** Click-to-filter — toggles when value already set. */
  const addFilter = useCallback(({ type, value }) => {
    if (!value) return;
    switch (type) {
      case 'level':
        setLevelFilter(prev => prev.includes(value) ? prev.filter(l => l !== value) : [...prev, value]);
        break;
      case 'user':    setUserFilter(prev   => prev === value ? '' : value); break;
      case 'method':  setMethodFilter(prev => prev === value ? '' : value); break;
      case 'status':  setStatusFilter(prev => prev === value ? '' : value); break;
      case 'traceId': setTraceFilter(prev  => prev === value ? '' : value); break;
      default: break;
    }
  }, []);

  // ── Source / subtype change ──
  const handleSourceChange = (_, v) => {
    if (!v || v === sourceId) return;
    const cfg = getSourceConfig(v);
    setSourceId(v);
    setSubType(cfg?.subTypes[0]?.id ?? 'info');
    setViewMode(cfg?.supportsJson ? 'json' : 'raw');
    setSelDate(null);
    setLive(false); setLiveLines([]); setLivePreload([]);
    setExpandedId(null);
    setLines(500);
    resetFilters();
  };

  const handleSubTypeChange = (v) => {
    if (v === subType) return;
    setSubType(v);
    setSelDate(null);
    setLive(false); setLiveLines([]); setLivePreload([]);
    setExpandedId(null);
    setLines(500);
    resetFilters();
  };

  // ── Static query ──
  const { data: staticData, isLoading, isFetching, refetch } = useQuery({
    queryKey:  ['admin-logs', sourceId, subType, fmt, lines, selDate],
    queryFn:   () => fetchLogs({ source: sourceId, type: subType, format: fmt, lines, date: selDate }),
    enabled:   !live,
    staleTime: 0,
    select:    (d) => ({ entries: d?.entries ?? (Array.isArray(d) ? d : []), fileFound: d?.fileFound }),
  });

  const fileFound   = staticData?.fileFound;
  const rawEntries  = staticData?.entries ?? [];
  const canLoadMore = rawEntries.length >= lines;

  const staticEntries = useMemo(() => {
    if (fmt === 'RAW') return rawEntries.map((l, i) => ({ _raw: true, _line: l, _key: i }));
    return Array.isArray(rawEntries) ? rawEntries : [];
  }, [rawEntries, fmt]);

  // ── Load more (scroll anchor) ──
  const handleLoadMore = useCallback(() => {
    if (listRef.current) {
      prevScrollH.current = listRef.current.scrollHeight;
      isLoadingMore.current = true;
    }
    setLines(prev => prev + LOAD_MORE_STEP);
  }, []);

  useEffect(() => {
    if (!isLoadingMore.current || !listRef.current) return;
    const added = listRef.current.scrollHeight - prevScrollH.current;
    if (added > 0) listRef.current.scrollTop = added + 4;
    isLoadingMore.current = false;
  }, [staticEntries]);

  // ── SSE live stream ──
  const startSse = useCallback(() => {
    if (sseRef.current) { sseRef.current.abort(); sseRef.current = null; }
    setLiveLines([]);
    setConnected(false);

    const ctrl = new AbortController();
    sseRef.current = ctrl;
    const token = localStorage.getItem('token');
    const url = `${BASE}/api/admin/logs/${sourceId}/${subType}/follow?format=${fmt}`;

    (async () => {
      try {
        const res = await fetch(url, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
          signal: ctrl.signal,
        });
        if (!res.ok) { setConnected(false); return; }
        setConnected(true);

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buf     = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const idx = buf.lastIndexOf('\n\n');
          if (idx >= 0) {
            parseSseChunk(buf.slice(0, idx + 2), (rawLine) => {
              setLiveLines(prev => {
                let entry;
                if (fmt === 'JSON') {
                  try { entry = { ...JSON.parse(rawLine), _key: Date.now() + Math.random() }; }
                  catch { entry = { _raw: true, _line: rawLine, _key: Date.now() + Math.random() }; }
                } else {
                  entry = { _raw: true, _line: rawLine, _key: Date.now() + Math.random() };
                }
                const next = [...prev, entry];
                return next.length > MAX_LIVE ? next.slice(-MAX_LIVE) : next;
              });
            });
            buf = buf.slice(idx + 2);
          }
        }
        setConnected(false);
      } catch (err) {
        if (err.name !== 'AbortError') setConnected(false);
      }
    })();
  }, [sourceId, subType, fmt]);

  const stopSse = useCallback(() => {
    if (sseRef.current) { sseRef.current.abort(); sseRef.current = null; }
    setConnected(false);
  }, []);

  const startLive = useCallback(async () => {
    setLivePreload([]); setLiveLines([]);
    try {
      const prev = await fetchLogs({ source: sourceId, type: subType, format: fmt, lines: PRELOAD_LINES });
      const arr  = prev?.entries ?? (Array.isArray(prev) ? prev : []);
      if (fmt === 'RAW') {
        setLivePreload(arr.map((l, i) => ({ _raw: true, _line: l, _key: 'pre-' + i, _preload: true })));
      } else {
        setLivePreload(Array.isArray(arr) ? arr.map((e, i) => ({ ...e, _key: 'pre-' + i, _preload: true })) : []);
      }
    } catch { /* SSE anyway */ }
    startSse();
  }, [sourceId, subType, fmt, startSse]);

  useEffect(() => {
    if (live) startLive(); else stopSse();
    return stopSse;
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLiveLines([]); setLivePreload([]);
  }, [sourceId, subType]);

  // ── Auto-scroll ──
  useEffect(() => {
    if (autoScrollRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [liveLines, livePreload, staticEntries]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    autoScrollRef.current = near;
    setShowFab(!near);
  }, []);

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      autoScrollRef.current = true;
      setShowFab(false);
    }
  };

  // ── Search debounce ──
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDSearch(search), 250);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (ev) => {
      const tag = ev.target?.tagName?.toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (ev.key === '/' && !inField) {
        ev.preventDefault();
        searchInputRef.current?.focus?.();
      } else if (ev.key === 'Escape' && inField) {
        ev.target.blur?.();
      } else if (ev.key === 'Escape' && !inField) {
        if (panelOpen) setPanelOpen(false);
        else if (search || levelFilter.length || userFilter || methodFilter || statusFilter || traceFilter || slowOnly) {
          resetFilters();
        }
      } else if ((ev.key === 'l' || ev.key === 'L') && !inField && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        setLive(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [search, levelFilter, userFilter, methodFilter, statusFilter, traceFilter, slowOnly, panelOpen, resetFilters]);

  // ── Filter / sort pipeline ──
  const allLiveEntries = useMemo(() => [...livePreload, ...liveLines], [livePreload, liveLines]);
  const allEntries     = live ? allLiveEntries : staticEntries;

  const { uniqueUsers, presentLevels } = useMemo(() => {
    if (fmt !== 'JSON') return { uniqueUsers: [], presentLevels: [] };
    const users  = new Set();
    const levels = new Set();
    allEntries.forEach(e => {
      if (e._raw) return;
      if (e.user?.trim()) users.add(e.user.trim());
      const l = levelOf(e);
      if (l !== 'UNKNOWN') levels.add(l);
    });
    const LEVEL_ORDER = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'REQUEST'];
    return { uniqueUsers: [...users].sort(), presentLevels: LEVEL_ORDER.filter(l => levels.has(l)) };
  }, [allEntries, fmt]);

  const activeFilterCount =
    levelFilter.length + (userFilter ? 1 : 0) + (methodFilter ? 1 : 0) +
    (statusFilter ? 1 : 0) + (traceFilter ? 1 : 0) + (slowOnly ? 1 : 0);
  const hasActive = activeFilterCount > 0 || dSearch !== '';

  const filtered = useMemo(() => {
    let entries = allEntries;
    if (fmt === 'JSON') {
      if (levelFilter.length) entries = entries.filter(e => e._raw || levelFilter.includes(levelOf(e)));
      if (userFilter)         entries = entries.filter(e => e._raw || e.user?.trim() === userFilter);
      if (methodFilter)       entries = entries.filter(e => e._raw || e.method === methodFilter);
      if (statusFilter)       entries = entries.filter(e => e._raw || String(e.status) === statusFilter);
      if (traceFilter)        entries = entries.filter(e => e._raw || e.traceId === traceFilter);
      if (slowOnly)           entries = entries.filter(e => e._raw || isSlow(e));
    }
    if (dSearch) {
      const q = dSearch.toLowerCase();
      entries = entries.filter(e => {
        const text = e._raw ? e._line : JSON.stringify(e);
        return text?.toLowerCase().includes(q);
      });
    }
    return entries;
  }, [allEntries, dSearch, levelFilter, userFilter, methodFilter, statusFilter, traceFilter, slowOnly, fmt]);

  const compressed = useMemo(
    () => collapseBursts ? compressBursts(filtered) : filtered,
    [filtered, collapseBursts]
  );

  const displayed = useMemo(() =>
    sortDesc && !live ? [...compressed].reverse() : compressed,
  [compressed, sortDesc, live]);

  // Inject minute-divider rows
  const renderedRows = useMemo(() => {
    if (fmt !== 'JSON' || displayed.length === 0 || displayed[0]?._raw) return null;
    const out = [];
    let lastBucket = null;
    for (const entry of displayed) {
      const bucket = minuteBucket(entry?.timestamp);
      if (bucket && bucket !== lastBucket) {
        out.push({ _divider: true, _key: 'div-' + bucket + '-' + out.length, _label: bucket });
        lastBucket = bucket;
      }
      out.push(entry);
    }
    return out;
  }, [displayed, fmt]);

  // ── Download ──
  const handleDownload = () => {
    const text = displayed.map(e =>
      e._raw ? e._line : `[${levelOf(e)}] ${fmtTime(e.timestamp)} ${e.message ?? ''}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${sourceId}-${subType}-${selDate ?? 'today'}.log`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Shared sx ──
  const iconBtnSx = {
    color: T.textFaint,
    '&:hover': { color: T.teal, bgcolor: T.tealBg },
  };
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg, fontSize: 12.5, color: T.textPrimary,
      '& fieldset':             { borderColor: T.border },
      '&:hover fieldset':       { borderColor: T.borderHover },
      '&.Mui-focused fieldset': { borderColor: T.teal },
    },
    '& .MuiInputLabel-root': { fontSize: 11.5, color: T.textFaint },
    '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
    '& .MuiSvgIcon-root': { color: T.textFaint },
    colorScheme: mode === 'dark' ? 'dark' : 'light',
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      height: 'calc(100vh - 52px)',
      display: 'flex', flexDirection: 'column',
      bgcolor: T.adminBg, color: T.textPrimary,
      overflow: 'hidden',
    }}>

      {/* ╭───────────── Header ─────────────╮ */}
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pt: { xs: 1.25, md: 1.75 }, pb: 0.75,
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 15, md: 18 }, color: T.textPrimary, lineHeight: 1.2 }}>
            Log Viewer
          </Typography>
          <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.15,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {live
              ? (connected ? `Live · ${sourceId}/${subType}` : 'Connecting…')
              : <>
                  <Box component="span" sx={{ color: T.text }}>{displayed.length}</Box>
                  {` / ${allEntries.length} · ${selDate ?? 'today'}`}
                  {hasActive && <Box component="span" sx={{ color: T.teal, ml: 0.5 }}>· filtered</Box>}
                </>}
          </Typography>
        </Box>

        {/* Live status pill (when live) */}
        {live && <LiveDot connected={connected} count={allLiveEntries.length} T={T} />}

        {/* Action cluster */}
        <Stack direction="row" sx={{ gap: 0.5 }}>
          <Tooltip title={live ? 'Pause (Ctrl+L)' : 'Start live (Ctrl+L)'} arrow>
            <IconButton
              size="small"
              onClick={() => { setLive(v => !v); if (live) { setLiveLines([]); setLivePreload([]); } }}
              sx={{
                color: live ? '#fff' : T.textMuted,
                bgcolor: live ? T.error : T.glass,
                border: `1px solid ${live ? T.error : T.border}`,
                borderRadius: 1,
                '&:hover': { bgcolor: live ? '#dc2626' : T.tealBg, color: live ? '#fff' : T.teal,
                  borderColor: live ? T.error : T.teal },
              }}>
              {live ? <PauseIcon sx={{ fontSize: 16 }} /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>

          {!live ? (
            <Tooltip title="Refresh" arrow>
              <span>
                <IconButton size="small" onClick={() => refetch()}
                  disabled={isLoading || isFetching}
                  sx={{ ...iconBtnSx, border: `1px solid ${T.border}`, borderRadius: 1 }}>
                  {(isLoading || isFetching)
                    ? <CircularProgress size={14} sx={{ color: T.teal }} />
                    : <RefreshIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title="Clear live buffer" arrow>
              <IconButton size="small" onClick={() => { setLiveLines([]); setLivePreload([]); }}
                sx={{ ...iconBtnSx, border: `1px solid ${T.border}`, borderRadius: 1 }}>
                <DeleteSweepIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Download visible" arrow>
            <IconButton size="small" onClick={handleDownload}
              sx={{ ...iconBtnSx, border: `1px solid ${T.border}`, borderRadius: 1,
                display: { xs: 'none', sm: 'inline-flex' } }}>
              <DownloadIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Filters & settings" arrow>
            <IconButton size="small" onClick={() => setPanelOpen(true)}
              sx={{
                color: panelOpen || activeFilterCount > 0 ? T.teal : T.textMuted,
                bgcolor: panelOpen || activeFilterCount > 0 ? T.tealBg : T.glass,
                border: `1px solid ${panelOpen || activeFilterCount > 0 ? T.teal + '55' : T.border}`,
                borderRadius: 1,
                '&:hover': { bgcolor: T.tealBg, color: T.teal, borderColor: T.teal },
              }}>
              <Badge badgeContent={activeFilterCount} color="primary"
                sx={{ '& .MuiBadge-badge': { fontSize: 9, height: 14, minWidth: 14, fontWeight: 700 } }}>
                <TuneIcon sx={{ fontSize: 16 }} />
              </Badge>
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* ╭───────────── Source tabs ─────────────╮ */}
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pt: 0.25, pb: 0.5,
        flexShrink: 0, borderBottom: `1px solid ${T.border}`,
        overflowX: 'auto', '&::-webkit-scrollbar': { height: 2 } }}>
        <ToggleButtonGroup value={sourceId} exclusive onChange={handleSourceChange} size="small"
          sx={{ gap: 0.5, flexWrap: 'nowrap', '& .MuiToggleButtonGroup-grouped': { mx: 0 } }}>
          {LOG_SOURCES_CONFIG.map(src => (
            <ToggleButton key={src.id} value={src.id}
              sx={{
                border: `1px solid ${T.border} !important`,
                borderRadius: '8px !important',
                color: T.textMuted, fontSize: 12, fontWeight: 600,
                px: { xs: 1.5, sm: 2 }, py: 0.5,
                minWidth: 0, flexShrink: 0, textTransform: 'none',
                '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal, borderColor: `${T.teal}55 !important` },
                '&:hover': { bgcolor: T.tealBg },
              }}>
              {src.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* ╭───────────── Subtype + JSON/RAW toggle ─────────────╮ */}
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, py: 0.75,
        display: 'flex', gap: 0.75, alignItems: 'center', flexShrink: 0,
        borderBottom: `1px solid ${T.border}` }}>
        <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', flex: 1, minWidth: 0,
          '&::-webkit-scrollbar': { height: 2 } }}>
          {srcCfg?.subTypes.map(st => (
            <Chip key={st.id} label={st.label} size="small"
              onClick={() => handleSubTypeChange(st.id)}
              sx={{ flexShrink: 0, height: 26, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                bgcolor: subType === st.id ? `${st.color}22` : T.glass,
                color:   subType === st.id ? st.color         : T.textMuted,
                border:  `1px solid ${subType === st.id ? st.color + '55' : T.border}`,
                '&:hover': { bgcolor: `${st.color}18` } }} />
          ))}
        </Box>

        {/* JSON / RAW only when app source */}
        {supJson && (
          <ToggleButtonGroup value={viewMode} exclusive
            onChange={(_, v) => v && setViewMode(v)} size="small"
            sx={{ flexShrink: 0 }}>
            <ToggleButton value="json"
              sx={{ border: `1px solid ${T.border} !important`, borderRadius: '6px !important',
                fontSize: 10.5, py: 0.4, px: 1, minWidth: 0, textTransform: 'none',
                color: T.textMuted,
                '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal, borderColor: `${T.teal}55 !important` } }}>
              <DataObjectIcon sx={{ fontSize: 12, mr: 0.4 }} />JSON
            </ToggleButton>
            <ToggleButton value="raw"
              sx={{ border: `1px solid ${T.border} !important`, borderRadius: '6px !important',
                fontSize: 10.5, py: 0.4, px: 1, minWidth: 0, textTransform: 'none',
                color: T.textMuted,
                '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal, borderColor: `${T.teal}55 !important` } }}>
              <SubjectIcon sx={{ fontSize: 12, mr: 0.4 }} />RAW
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {/* ╭───────────── Date history chips ─────────────╮ */}
      <DateChipRow
        source={sourceId} subType={subType} format={fmt}
        selected={selDate}
        onChange={(d) => { setSelDate(d); setLive(false); setLines(500); }}
        disabled={!supHist || live}
        T={T}
      />

      {/* ╭───────────── Search bar ─────────────╮ */}
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 0.75, flexShrink: 0 }}>
        <TextField
          inputRef={searchInputRef}
          size="small"
          fullWidth
          placeholder="Search messages, URIs, traces…   ( / )"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={fieldSx}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 16, mr: 0.75, color: T.textFaint }} />,
            endAdornment: search ? (
              <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.25 }}>
                <ClearIcon sx={{ fontSize: 14, color: T.textFaint }} />
              </IconButton>
            ) : null,
          }} />
      </Box>

      {/* ╭───────────── Active-filter pills (only when any) ─────────────╮ */}
      {hasActive && (
        <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 0.75, flexShrink: 0,
          display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          {levelFilter.map(lvl => (
            <ActivePill key={lvl} label="level" value={lvl}
              color={LC[lvl].text}
              onRemove={() => setLevelFilter(prev => prev.filter(l => l !== lvl))} T={T} />
          ))}
          {userFilter   && <ActivePill label="user"   value={userFilter}
                              onRemove={() => setUserFilter('')} T={T} />}
          {methodFilter && <ActivePill label="method" value={methodFilter}
                              color={METHOD_C[methodFilter]}
                              onRemove={() => setMethodFilter('')} T={T} />}
          {statusFilter && <ActivePill label="status" value={statusFilter}
                              onRemove={() => setStatusFilter('')} T={T} />}
          {traceFilter  && <ActivePill label="trace"
                              value={traceFilter.length > 14 ? traceFilter.slice(0, 14) + '…' : traceFilter}
                              color="#a5b4fc"
                              onRemove={() => setTraceFilter('')} T={T} />}
          {slowOnly     && <ActivePill label="" value="slow only" color="#fbbf24"
                              onRemove={() => setSlowOnly(false)} T={T} />}
          {dSearch      && <ActivePill label="search" value={`"${dSearch}"`}
                              onRemove={() => setSearch('')} T={T} />}
          <Box sx={{ flex: 1, minWidth: 4 }} />
          <Button size="small" startIcon={<FilterAltOffIcon sx={{ fontSize: 13 }} />}
            onClick={resetFilters}
            sx={{ fontSize: 10.5, color: T.textFaint, textTransform: 'none',
              '&:hover': { color: T.error, bgcolor: `${T.error}11` } }}>
            Clear all
          </Button>
        </Box>
      )}

      {/* ╭───────────── Live cap warning ─────────────╮ */}
      {live && liveLines.length >= MAX_LIVE && (
        <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 0.5, flexShrink: 0 }}>
          <Chip label={`Capped at ${MAX_LIVE} live lines`} size="small"
            sx={{ height: 19, fontSize: 10, bgcolor: T.warningBg, color: T.warning, border: 'none' }} />
        </Box>
      )}

      {/* ╭───────────── LOG AREA (terminal) ─────────────╮ */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative',
        m: { xs: 0, sm: 1 }, mt: 0,
        bgcolor: termBg,
        borderRadius: { xs: 0, sm: 1.25 },
        border: { xs: 'none', sm: termBorder },
        overflow: 'hidden' }}>

        <Box ref={listRef} onScroll={handleScroll}
          sx={{ height: '100%', overflowY: 'auto',
            fontFamily: 'monospace',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } } }}>

          {/* Load-more strip */}
          {!live && canLoadMore && !isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.75,
              borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Button size="small"
                startIcon={isFetching ? <CircularProgress size={12} sx={{ color: T.teal }} /> : <AddIcon sx={{ fontSize: 14 }} />}
                onClick={handleLoadMore}
                disabled={isFetching}
                sx={{ fontSize: 11, color: T.teal, border: `1px solid ${T.teal}44`,
                  borderRadius: 1.5, textTransform: 'none',
                  '&:hover': { bgcolor: T.tealBg, borderColor: T.teal } }}>
                Load {LOAD_MORE_STEP} more
              </Button>
            </Box>
          )}

          {/* Live preload boundary */}
          {live && livePreload.length > 0 && liveLines.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.5,
              bgcolor: 'rgba(99,102,241,0.07)', borderBottom: '1px solid rgba(99,102,241,0.15)',
              position: 'sticky', top: 0, zIndex: 3 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(99,102,241,0.2)' }} />
              <Typography sx={{ fontSize: 9.5, color: 'rgba(99,102,241,0.75)',
                fontFamily: 'monospace', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                ── live stream starts below ──
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(99,102,241,0.2)' }} />
            </Box>
          )}

          {/* Body */}
          {isLoading && !live ? (
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
              {[...Array(16)].map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={24}
                  sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 0.5,
                    width: `${60 + Math.random() * 40}%` }} />
              ))}
            </Box>
          ) : !live && fileFound === false ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
              pt: 10, gap: 1.5, px: 2, textAlign: 'center' }}>
              <ErrorOutlineIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.18)' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                Log file not found on server
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, fontFamily: 'monospace' }}>
                {sourceId}/{subType}{fmt === 'JSON' ? '.json' : '.log'}
              </Typography>
            </Box>
          ) : displayed.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 10, gap: 1.5 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                {hasActive ? 'No entries match the filters' : 'No entries'}
              </Typography>
              {hasActive && (
                <Button size="small" onClick={resetFilters}
                  startIcon={<FilterAltOffIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontSize: 11, color: T.teal, textTransform: 'none',
                    '&:hover': { bgcolor: T.tealBg } }}>
                  Clear filters
                </Button>
              )}
            </Box>
          ) : fmt === 'JSON' && !displayed[0]?._raw ? (
            renderedRows?.map((row, i) => {
              if (row._divider) return <MinuteDivider key={row._key} label={row._label} />;
              const id = row._key ?? i;
              return (
                <JsonRow key={id} entry={row} search={dSearch}
                  expanded={expandedId === id}
                  onToggle={() => setExpandedId(p => p === id ? null : id)}
                  onAddFilter={addFilter} />
              );
            })
          ) : (
            displayed.map((entry, i) => (
              <RawRow key={entry._key ?? i}
                line={entry._raw ? entry._line : JSON.stringify(entry)}
                burst={entry._burst}
                search={dSearch} />
            ))
          )}
        </Box>

        {/* Scroll FABs */}
        {showFab && (
          <Box sx={{ position: 'absolute', bottom: 14, right: 14, zIndex: 5,
            display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Tooltip title="Top" placement="left" arrow>
              <Fab size="small"
                onClick={() => { if (listRef.current) { listRef.current.scrollTop = 0; autoScrollRef.current = false; } }}
                sx={{ bgcolor: 'rgba(30,41,59,0.92)', color: T.textMuted,
                  border: `1px solid ${T.border}`,
                  '&:hover': { bgcolor: T.tealBg, color: T.teal, borderColor: T.teal },
                  width: 34, height: 34, minHeight: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <KeyboardArrowUpIcon sx={{ fontSize: 20 }} />
              </Fab>
            </Tooltip>
            <Tooltip title="Bottom" placement="left" arrow>
              <Fab size="small" onClick={scrollToBottom}
                sx={{ bgcolor: T.teal, color: '#fff',
                  '&:hover': { bgcolor: T.tealHover },
                  width: 34, height: 34, minHeight: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
              </Fab>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* ╭───────────── Filter / settings drawer (right on md+, bottom on xs) ─────────────╮ */}
      <Drawer
        anchor="right"
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: T.adminBg, color: T.textPrimary,
            width: { xs: '100%', sm: 360 },
            borderLeft: `1px solid ${T.border}`,
          },
        }}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2.5,
          height: '100%', overflowY: 'auto' }}>

          {/* Drawer header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TuneIcon sx={{ fontSize: 18, color: T.teal }} />
            <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Filters &amp; settings</Typography>
            <IconButton size="small" onClick={() => setPanelOpen(false)} sx={iconBtnSx}>
              <ClearIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* ── Filters section ── */}
          {fmt === 'JSON' && (
            <Box>
              <Typography sx={{ fontSize: 10, color: T.textFaint, mb: 1,
                textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Filters</Typography>

              {presentLevels.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.5 }}>Level</Typography>
                  <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                    {presentLevels.map(lvl => {
                      const c = LC[lvl];
                      const on = levelFilter.includes(lvl);
                      return (
                        <Chip key={lvl} label={lvl} size="small" clickable
                          onClick={() => addFilter({ type: 'level', value: lvl })}
                          sx={{ fontSize: 11, fontWeight: 700, height: 26,
                            bgcolor: on ? c.bg : T.glass,
                            color: on ? c.text : T.textMuted,
                            border: `1px solid ${on ? c.border : T.border}` }} />
                      );
                    })}
                  </Stack>
                </Box>
              )}

              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.5 }}>Performance</Typography>
                <Chip
                  size="small" clickable
                  icon={<SpeedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setSlowOnly(v => !v)}
                  label={`Slow only (≥${SLOW_THRESHOLD_MS}ms)`}
                  sx={{ fontSize: 11, fontWeight: 600, height: 26,
                    bgcolor: slowOnly ? 'rgba(245,158,11,0.18)' : T.glass,
                    color: slowOnly ? '#fbbf24' : T.textMuted,
                    border: `1px solid ${slowOnly ? 'rgba(245,158,11,0.4)' : T.border}` }} />
              </Box>

              {uniqueUsers.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.5 }}>User</Typography>
                  <TextField select fullWidth size="small" value={userFilter}
                    onChange={e => setUserFilter(e.target.value)}
                    SelectProps={{ native: true }}
                    sx={fieldSx}>
                    <option value="">All users</option>
                    {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                  </TextField>
                </Box>
              )}

              {(methodFilter || statusFilter || traceFilter) && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.5 }}>
                    Set by clicking in rows
                  </Typography>
                  <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                    {methodFilter && <ActivePill label="method" value={methodFilter}
                                        color={METHOD_C[methodFilter]}
                                        onRemove={() => setMethodFilter('')} T={T} />}
                    {statusFilter && <ActivePill label="status" value={statusFilter}
                                        onRemove={() => setStatusFilter('')} T={T} />}
                    {traceFilter  && <ActivePill label="trace"
                                        value={traceFilter.length > 14 ? traceFilter.slice(0, 14) + '…' : traceFilter}
                                        color="#a5b4fc"
                                        onRemove={() => setTraceFilter('')} T={T} />}
                  </Stack>
                </Box>
              )}
            </Box>
          )}

          <Divider sx={{ borderColor: T.border }} />

          {/* ── Display section ── */}
          <Box>
            <Typography sx={{ fontSize: 10, color: T.textFaint, mb: 1,
              textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Display</Typography>

            {!live && (
              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.5 }}>Lines per load</Typography>
                <TextField select fullWidth size="small" value={lines}
                  onChange={e => { setLines(Number(e.target.value)); isLoadingMore.current = false; }}
                  SelectProps={{ native: true }}
                  sx={fieldSx}>
                  {[100, 250, 500, 1000, 2000, 5000].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </TextField>
              </Box>
            )}

            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.5 }}>Order</Typography>
              <ToggleButtonGroup value={sortDesc ? 'desc' : 'asc'} exclusive
                onChange={(_, v) => v && setSortDesc(v === 'desc')} size="small" fullWidth>
                <ToggleButton value="asc"
                  sx={{ fontSize: 11, py: 0.5, textTransform: 'none', color: T.textMuted,
                    border: `1px solid ${T.border} !important`,
                    '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal, borderColor: `${T.teal}55 !important` } }}>
                  <ArrowUpwardIcon sx={{ fontSize: 14, mr: 0.5 }} />Oldest first
                </ToggleButton>
                <ToggleButton value="desc"
                  sx={{ fontSize: 11, py: 0.5, textTransform: 'none', color: T.textMuted,
                    border: `1px solid ${T.border} !important`,
                    '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal, borderColor: `${T.teal}55 !important` } }}>
                  <ArrowDownwardIcon sx={{ fontSize: 14, mr: 0.5 }} />Newest first
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.5 }}>Duplicates</Typography>
              <Chip
                size="small" clickable
                onClick={() => setCollapseBursts(v => !v)}
                label={collapseBursts ? 'Collapsed (× N)' : 'Show every line'}
                sx={{ fontSize: 11, fontWeight: 600, height: 26,
                  bgcolor: collapseBursts ? T.tealBg : T.glass,
                  color: collapseBursts ? T.teal : T.textMuted,
                  border: `1px solid ${collapseBursts ? T.teal + '55' : T.border}` }} />
            </Box>
          </Box>

          {/* Footer actions */}
          <Box sx={{ mt: 'auto' }}>
            <Divider sx={{ borderColor: T.border, mb: 1.5 }} />
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button fullWidth onClick={resetFilters}
                disabled={!hasActive}
                startIcon={<FilterAltOffIcon sx={{ fontSize: 14 }} />}
                variant="outlined"
                sx={{ borderColor: T.border, color: T.textMuted, textTransform: 'none',
                  fontSize: 12,
                  '&:hover': { borderColor: T.error, color: T.error, bgcolor: `${T.error}11` } }}>
                Clear filters
              </Button>
              <Button fullWidth onClick={() => setPanelOpen(false)} variant="contained"
                sx={{ bgcolor: T.teal, textTransform: 'none', fontSize: 12,
                  '&:hover': { bgcolor: T.tealHover } }}>
                Done
              </Button>
            </Stack>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
