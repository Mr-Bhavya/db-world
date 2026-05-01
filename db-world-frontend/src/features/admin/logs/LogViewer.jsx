import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, TextField,
  ToggleButton, ToggleButtonGroup, CircularProgress, Button,
  Stack, Collapse, Skeleton, Fab,
} from '@mui/material';
import PlayArrowIcon           from '@mui/icons-material/PlayArrow';
import PauseIcon               from '@mui/icons-material/Pause';
import RefreshIcon             from '@mui/icons-material/Refresh';
import DeleteSweepIcon         from '@mui/icons-material/DeleteSweep';
import DownloadIcon            from '@mui/icons-material/Download';
import SearchIcon              from '@mui/icons-material/Search';
import ClearIcon               from '@mui/icons-material/Clear';
import UnfoldMoreIcon          from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon          from '@mui/icons-material/UnfoldLess';
import DataObjectIcon          from '@mui/icons-material/DataObject';
import SubjectIcon             from '@mui/icons-material/Subject';
import KeyboardArrowDownIcon   from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon     from '@mui/icons-material/KeyboardArrowUp';
import AddIcon                 from '@mui/icons-material/Add';
import ErrorOutlineIcon        from '@mui/icons-material/ErrorOutline';
import ArrowDownwardIcon       from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon         from '@mui/icons-material/ArrowUpward';
import { useQuery }         from '@tanstack/react-query';
import { useThemeMode }     from '@shared/theme';
import {
  LOG_SOURCES_CONFIG, getSourceConfig, fetchLogs, fetchAvailableDates
} from './logApi';

const BASE = import.meta.env.VITE_API_BASE_URL || '';
const MAX_LIVE      = 1000;
const PRELOAD_LINES = 150;
const LOAD_MORE_STEP = 500;

// ── Terminal level colours (always dark — terminal aesthetic) ─────────────────
const LC = {
  ERROR:   { bg: 'rgba(239,68,68,0.16)',   text: '#f87171', border: 'rgba(239,68,68,0.35)',   bar: '#f87171' },
  WARN:    { bg: 'rgba(245,158,11,0.14)',  text: '#fbbf24', border: 'rgba(245,158,11,0.32)',   bar: '#fbbf24' },
  INFO:    { bg: 'rgba(13,148,136,0.14)',  text: '#2dd4bf', border: 'rgba(13,148,136,0.32)',   bar: '#2dd4bf' },
  DEBUG:   { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.28)',   bar: '#34d399' },
  REQUEST: { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', border: 'rgba(99,102,241,0.28)',   bar: '#818cf8' },
  UNKNOWN: { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.1)', bar: 'rgba(255,255,255,0.18)' },
};

const METHOD_C = {
  GET:    '#34d399', POST:  '#60a5fa',
  PUT:    '#fbbf24', PATCH: '#c084fc', DELETE: '#f87171',
};

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
    return d.toLocaleTimeString('en-IN', { hour12: false }) +
      '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch { return ts; }
};

const shortLogger = (logger) => logger?.split('.').slice(-2).join('.') ?? '';

const hlText = (text, q) => {
  if (!q || !text) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (<>{text.slice(0, i)}<mark style={{ background: 'rgba(251,191,36,0.4)', color: '#fff', borderRadius: 2, padding: '0 1px' }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>);
};

// ── SSE parser ────────────────────────────────────────────────────────────────
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

// ── JSON log entry ─────────────────────────────────────────────────────────────
function JsonEntry({ entry, search, expanded, onToggle }) {
  const level     = levelOf(entry);
  const c         = LC[level];
  const isReq     = entry?.method != null || entry?.uri != null;
  const hasExc    = entry?.exception?.trim?.().length > 0;
  const canExpand = hasExc || isReq;
  const mc        = METHOD_C[entry?.method?.toUpperCase()] ?? '#60a5fa';
  const sc        = parseInt(entry?.status, 10) || 0;
  const scCol     = sc >= 500 ? '#f87171' : sc >= 400 ? '#fbbf24' : sc >= 200 ? '#34d399' : 'rgba(255,255,255,0.4)';
  const hasUser   = entry?.user?.trim?.().length > 0;

  return (
    <Box onClick={canExpand ? onToggle : undefined}
      sx={{
        display: 'flex', flexDirection: 'column',
        px: { xs: 1, sm: 1.5 }, py: 0.65,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: canExpand ? 'pointer' : 'default',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.025)' },
        transition: 'background 0.1s',
      }}>
      {/* ── Main row ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>

        {/* Badge row (always single line) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75 },
          flexWrap: 'nowrap', minWidth: 0 }}>

          {/* Level chip */}
          <Chip label={level === 'UNKNOWN' ? '—' : level.slice(0, 3)} size="small"
            sx={{ height: 16, fontSize: 8.5, fontWeight: 800, flexShrink: 0,
              bgcolor: c.bg, color: c.text, border: `1px solid ${c.border}`,
              borderRadius: 0.75, letterSpacing: '0.04em' }} />

          {/* Time */}
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', flexShrink: 0,
            fontFamily: 'monospace', minWidth: { xs: 56, sm: 72 } }}>
            {fmtTime(entry?.timestamp)}
          </Typography>

          {/* Request badges: method + status always visible; duration + user hidden on xs */}
          {isReq && (<>
            <Chip label={entry.method ?? '?'} size="small"
              sx={{ height: 15, fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                bgcolor: `${mc}22`, color: mc, border: 'none', borderRadius: 0.75 }} />
            {entry.status && (
              <Typography sx={{ fontSize: 10, color: scCol, flexShrink: 0,
                fontFamily: 'monospace', fontWeight: 700 }}>
                {entry.status}
              </Typography>
            )}
            {/* duration — hidden on xs, shown sm+ */}
            {entry.duration && (
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', flexShrink: 0,
                fontFamily: 'monospace', display: { xs: 'none', sm: 'block' } }}>
                {entry.duration}ms
              </Typography>
            )}
            {/* user chip — hidden on xs, shown sm+ */}
            {hasUser && (
              <Chip label={entry.user} size="small"
                sx={{ height: 14, fontSize: 8, fontWeight: 600, flexShrink: 0,
                  display: { xs: 'none', sm: 'flex' },
                  bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                  border: '1px solid rgba(99,102,241,0.25)', borderRadius: 0.75,
                  maxWidth: 90, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
            )}
            {/* URI — inline on sm+, moved to second row on xs */}
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', fontFamily: 'monospace',
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              display: { xs: 'none', sm: 'block' } }}>
              {hlText(entry.uri ?? entry.message ?? '', search)}
            </Typography>
          </>)}

          {/* Non-request message (single-line, always visible) */}
          {!isReq && (
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.82)', fontFamily: 'monospace',
              wordBreak: 'break-all', flex: 1, lineHeight: 1.5, minWidth: 0 }}>
              {hlText(entry.message ?? '', search)}
            </Typography>
          )}

          {/* Logger — sm+ non-request only */}
          {!isReq && (
            <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.18)', flexShrink: 0,
              fontFamily: 'monospace', display: { xs: 'none', md: 'block' },
              maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shortLogger(entry?.logger)}
            </Typography>
          )}

          {canExpand && (
            <IconButton size="small" sx={{ p: 0.25, color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>
              {expanded ? <UnfoldLessIcon sx={{ fontSize: 13 }} /> : <UnfoldMoreIcon sx={{ fontSize: 13 }} />}
            </IconButton>
          )}
        </Box>

        {/* URI second row — xs only for request logs */}
        {isReq && (
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'baseline',
            gap: 0.75, pl: 0.25, minWidth: 0 }}>
            {entry.duration && (
              <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)',
                fontFamily: 'monospace', flexShrink: 0 }}>
                {entry.duration}ms
              </Typography>
            )}
            <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.70)',
              fontFamily: 'monospace', flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hlText(entry.uri ?? entry.message ?? '', search)}
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Expanded details ── */}
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ mt: 0.5, pl: { xs: 0, sm: 4.5 }, display: 'flex', flexDirection: 'column', gap: 0.75 }}>

          {/* Request detail grid — 1 col on xs, auto-fill on sm+ */}
          {isReq && (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(auto-fill, minmax(170px, 1fr))' },
              gap: { xs: 0.75, sm: 0.5 },
              bgcolor: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.14)',
              borderRadius: 1,
              p: { xs: 0.75, sm: 1 },
            }}>
              {entry.method    && <ReqField label="Method"    value={entry.method}     color={mc} />}
              {entry.status    && <ReqField label="Status"    value={entry.status}     color={scCol} />}
              {entry.duration  && <ReqField label="Duration"  value={`${entry.duration}ms`} />}
              {entry.user?.trim()      && <ReqField label="User"      value={entry.user} />}
              {/* URI full-width row */}
              {entry.uri && (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <ReqField label="URI" value={entry.uri} mono />
                </Box>
              )}
              {entry.requestId?.trim() && <ReqField label="Request ID" value={entry.requestId} mono />}
              {entry.traceId?.trim()   && <ReqField label="Trace ID"   value={entry.traceId}   mono />}
              {entry.md5?.trim()       && <ReqField label="MD5"        value={entry.md5}        mono />}
              {entry.thread            && <ReqField label="Thread"     value={entry.thread}     mono />}
              {entry.message?.trim() && entry.message !== entry.uri &&
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <ReqField label="Message" value={entry.message} mono />
                </Box>
              }
            </Box>
          )}

          {/* Exception block */}
          {hasExc && (
            <Box sx={{ bgcolor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 1, p: 1 }}>
              <Typography sx={{ fontSize: 9, color: 'rgba(239,68,68,0.5)', fontFamily: 'monospace',
                fontWeight: 700, letterSpacing: '0.06em', mb: 0.5 }}>
                EXCEPTION
              </Typography>
              <Typography sx={{ fontSize: 10, color: '#fca5a5', fontFamily: 'monospace',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {entry.exception}
              </Typography>
            </Box>
          )}

          {/* Meta badges for non-request logs */}
          {!isReq && (
            <Stack direction="row" flexWrap="wrap" sx={{ gap: 1 }}>
              {entry?.thread          && <MetaBadge label="thread" value={entry.thread} />}
              {entry?.traceId?.trim() && <MetaBadge label="trace"  value={entry.traceId} />}
              {entry?.requestId?.trim() && <MetaBadge label="req"  value={entry.requestId} />}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function ReqField({ label, value, color, mono }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.15, minWidth: 0 }}>
      <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace',
        textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: { xs: 10, sm: 10.5 }, color: color ?? 'rgba(255,255,255,0.72)',
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: mono ? 'break-all' : 'normal',
        overflow: 'hidden', textOverflow: mono ? 'unset' : 'ellipsis',
        whiteSpace: mono ? 'normal' : 'nowrap',
        lineHeight: 1.4 }}>
        {value}
      </Typography>
    </Box>
  );
}

function MetaBadge({ label, value }) {
  return (
    <Typography sx={{ fontSize: 9.5, fontFamily: 'monospace', color: 'rgba(255,255,255,0.28)' }}>
      <span style={{ color: 'rgba(255,255,255,0.16)' }}>{label}=</span>
      <span style={{ color: 'rgba(255,255,255,0.42)' }}>{value}</span>
    </Typography>
  );
}

// ── RAW line ──────────────────────────────────────────────────────────────────
function RawLine({ line, search }) {
  const level = rawLevel(line);
  const c     = LC[level];
  return (
    <Box sx={{ display: 'flex', gap: 0.75, px: { xs: 1, sm: 1.25 }, py: 0.4,
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
      <Box sx={{ width: 2.5, flexShrink: 0, borderRadius: 1, bgcolor: c.bar,
        opacity: level === 'UNKNOWN' ? 0.2 : 0.7, alignSelf: 'stretch', minHeight: 14 }} />
      <Typography sx={{ fontSize: { xs: 10, sm: 11 },
        color: level === 'ERROR' ? '#fca5a5' : level === 'WARN' ? '#fde68a' : 'rgba(255,255,255,0.72)',
        fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.55, flex: 1 }}>
        {hlText(line, search)}
      </Typography>
    </Box>
  );
}

// ── Date chip row ─────────────────────────────────────────────────────────────
function DateChipRow({ source, subType, format, selected, onChange, disabled, T }) {
  const { data: dates, isLoading } = useQuery({
    queryKey: ['log-dates', source, subType, format],
    queryFn:  () => fetchAvailableDates({ source, type: subType, format }),
    enabled:  !disabled,
    staleTime: 60_000,
  });

  if (disabled || (!isLoading && (!dates || dates.length <= 1))) return null;

  const today = new Date().toISOString().slice(0, 10);
  const isSelected = (d) => selected === d || (d === today && selected === null);

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 0.75,
      display: 'flex', gap: 0.6, overflowX: 'auto', flexShrink: 0,
      '&::-webkit-scrollbar': { height: 3 },
      '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
      {isLoading
        ? [1,2,3,4,5].map(i => <Skeleton key={i} variant="rounded" width={66} height={22} sx={{ flexShrink: 0, bgcolor: T.glass }} />)
        : dates?.map(d => (
            <Chip key={d} label={d === today ? 'Today' : d.slice(5)} size="small"
              onClick={() => onChange(d === today ? null : d)}
              sx={{ flexShrink: 0, height: 22, fontSize: 10.5, cursor: 'pointer',
                bgcolor: isSelected(d) ? T.tealBg : T.glass,
                color:   isSelected(d) ? T.teal   : T.textMuted,
                border:  `1px solid ${isSelected(d) ? T.teal + '55' : T.border}`,
                '&:hover': { bgcolor: T.tealBgHover } }} />
          ))
      }
    </Box>
  );
}

// ── Live pulse dot ─────────────────────────────────────────────────────────────
function LiveDot({ connected, count, T }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%',
        bgcolor: connected ? T.success : T.warning,
        animation: connected ? 'lv-pulse 1.5s ease-in-out infinite' : 'none',
        '@keyframes lv-pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } } }} />
      <Typography sx={{ fontSize: 11, color: connected ? T.success : T.warning, fontFamily: 'monospace' }}>
        {connected ? `${count} lines` : 'Connecting…'}
      </Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function LogViewer() {
  const { T, mode } = useThemeMode();

  // Terminal bg is always dark regardless of admin theme
  const termBg     = mode === 'dark' ? '#0a0e14' : '#111827';
  const termBorder = `1px solid ${T.border}`;

  // ── State ──
  const [sourceId,    setSourceId]    = useState('app');
  const [subType,     setSubType]     = useState('info');
  const [viewMode,    setViewMode]    = useState('json');
  const [selDate,     setSelDate]     = useState(null);
  const [search,      setSearch]      = useState('');
  const [dSearch,     setDSearch]     = useState('');
  const [lines,       setLines]       = useState(500);
  const [live,        setLive]        = useState(false);
  const [livePreload, setLivePreload] = useState([]);
  const [liveLines,   setLiveLines]   = useState([]);
  const [connected,   setConnected]   = useState(false);
  const [expandedId,  setExpandedId]  = useState(null);
  const [showFab,     setShowFab]     = useState(false);
  const [sortDesc,    setSortDesc]    = useState(false); // newest first
  const [levelFilter, setLevelFilter] = useState([]);   // [] = all levels
  const [userFilter,  setUserFilter]  = useState('');   // '' = all users

  const listRef         = useRef(null);
  const sseRef          = useRef(null);
  const autoScrollRef   = useRef(true);
  const searchTimer     = useRef(null);
  // For scroll-anchor when loading more
  const prevScrollH     = useRef(0);
  const isLoadingMore   = useRef(false);

  // ── Derived ──
  const srcCfg  = getSourceConfig(sourceId);
  const supJson = srcCfg?.supportsJson ?? false;
  const supHist = srcCfg?.supportsHistory ?? false;
  const fmt     = viewMode === 'json' && supJson ? 'JSON' : 'RAW';

  // ── Source change ──
  const resetFilters = () => { setLevelFilter([]); setUserFilter(''); setSearch(''); };

  const handleSourceChange = (_, v) => {
    if (!v || v === sourceId) return;
    const cfg = getSourceConfig(v);
    setSourceId(v);
    setSubType(cfg?.subTypes[0]?.id ?? 'info');
    setViewMode(cfg?.supportsJson ? 'json' : 'raw');
    setSelDate(null);
    setLive(false);
    setLiveLines([]);
    setLivePreload([]);
    setExpandedId(null);
    setLines(500);
    resetFilters();
  };

  const handleSubTypeChange = (v) => {
    if (v === subType) return;
    setSubType(v);
    setSelDate(null);
    setLive(false);
    setLiveLines([]);
    setLivePreload([]);
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

  const fileFound     = staticData?.fileFound;
  const rawEntries    = staticData?.entries ?? [];
  const canLoadMore   = rawEntries.length >= lines;

  const staticEntries = useMemo(() => {
    if (fmt === 'RAW') {
      return rawEntries.map((l, i) => ({ _raw: true, _line: l, _key: i }));
    }
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

  // After new entries rendered, restore relative scroll position
  useEffect(() => {
    if (!isLoadingMore.current || !listRef.current) return;
    const added = listRef.current.scrollHeight - prevScrollH.current;
    if (added > 0) listRef.current.scrollTop = added + 4;
    isLoadingMore.current = false;
  }, [staticEntries]);

  // ── SSE ──
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

  // ── Start live: preload last N lines then begin SSE ──
  const startLive = useCallback(async () => {
    setLivePreload([]);
    setLiveLines([]);
    try {
      const prev = await fetchLogs({ source: sourceId, type: subType, format: fmt, lines: PRELOAD_LINES });
      const arr  = prev?.entries ?? (Array.isArray(prev) ? prev : []);
      if (fmt === 'RAW') {
        setLivePreload(arr.map((l, i) => ({ _raw: true, _line: l, _key: 'pre-' + i, _preload: true })));
      } else {
        setLivePreload(Array.isArray(arr) ? arr.map((e, i) => ({ ...e, _key: 'pre-' + i, _preload: true })) : []);
      }
    } catch { /* start SSE regardless */ }
    startSse();
  }, [sourceId, subType, fmt, startSse]);

  useEffect(() => {
    if (live) startLive(); else stopSse();
    return stopSse;
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset live entries on source/type change
  useEffect(() => {
    setLiveLines([]);
    setLivePreload([]);
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
    searchTimer.current = setTimeout(() => setDSearch(search), 280);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // ── Entries to display ──
  const allLiveEntries = useMemo(() => [...livePreload, ...liveLines], [livePreload, liveLines]);
  const allEntries     = live ? allLiveEntries : staticEntries;

  // ── Derived filter options (only for JSON app logs) ──
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
    return {
      uniqueUsers:  [...users].sort(),
      presentLevels: LEVEL_ORDER.filter(l => levels.has(l)),
    };
  }, [allEntries, fmt]);

  const hasActiveFilters = levelFilter.length > 0 || userFilter !== '' || dSearch !== '';

  const visible = useMemo(() => {
    let entries = allEntries;

    // Level filter (JSON only)
    if (levelFilter.length > 0 && fmt === 'JSON') {
      entries = entries.filter(e => e._raw || levelFilter.includes(levelOf(e)));
    }

    // User filter (JSON only)
    if (userFilter && fmt === 'JSON') {
      entries = entries.filter(e => e._raw || e.user?.trim() === userFilter);
    }

    // Search
    if (dSearch) {
      const q = dSearch.toLowerCase();
      entries = entries.filter(e => {
        const text = e._raw ? e._line : JSON.stringify(e);
        return text?.toLowerCase().includes(q);
      });
    }

    return entries;
  }, [allEntries, dSearch, levelFilter, userFilter, fmt]);

  // Sort direction: newest-first only in static mode (live always appends at bottom)
  const displayed = useMemo(() =>
    sortDesc && !live ? [...visible].reverse() : visible,
  [visible, sortDesc, live]);

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

  // ── Shared sx helpers (theme-aware) ──
  const toggleBtnSx = {
    border: `1px solid ${T.border} !important`,
    borderRadius: '8px !important',
    color: T.textMuted,
    fontSize: 12, fontWeight: 600,
    px: 1.25, py: 0.5, minWidth: 0,
    '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal },
    '&:hover': { bgcolor: T.tealBg },
  };

  const iconBtnSx = {
    color: T.textFaint,
    '&:hover': { color: T.teal, bgcolor: T.tealBg },
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg, fontSize: 12, color: T.textPrimary,
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
      // calc(100vh - 52px): 52px = AdminLayout topbar height
      // This pins the component to the viewport so only the terminal box scrolls
      height: 'calc(100vh - 52px)',
      display: 'flex', flexDirection: 'column',
      bgcolor: T.adminBg, color: T.textPrimary,
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <Box sx={{ px: { xs: 2, sm: 2.5, md: 3 }, pt: { xs: 1.5, md: 2 }, pb: 0.5, flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 16, md: 20 }, color: T.textPrimary, lineHeight: 1.2 }}>
              Log Viewer
            </Typography>
            <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.2 }}>
              {live
                ? (connected ? `Live · ${sourceId}/${subType}` : 'Connecting…')
                : `${displayed.length} / ${allEntries.length} entries · ${selDate ?? 'today'}${hasActiveFilters ? ' · filtered' : ''}`}
            </Typography>
          </Box>
          {live && <LiveDot connected={connected} count={allLiveEntries.length} T={T} />}
        </Stack>
      </Box>

      {/* ── Source tabs ── */}
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pt: 0.75, flexShrink: 0,
        borderBottom: `1px solid ${T.border}` }}>
        <ToggleButtonGroup value={sourceId} exclusive onChange={handleSourceChange} size="small"
          sx={{ gap: 0.5, '& .MuiToggleButtonGroup-grouped': { mx: 0 } }}>
          {LOG_SOURCES_CONFIG.map(src => (
            <ToggleButton key={src.id} value={src.id}
              sx={{ ...toggleBtnSx, px: { xs: 1.25, sm: 1.75 } }}>
              {src.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* ── Subtype chips ── */}
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, py: 0.75, display: 'flex', gap: 0.6,
        overflowX: 'auto', flexShrink: 0, flexWrap: 'nowrap',
        '&::-webkit-scrollbar': { height: 2 } }}>
        {srcCfg?.subTypes.map(st => (
          <Chip key={st.id} label={st.label} size="small"
            onClick={() => handleSubTypeChange(st.id)}
            sx={{ flexShrink: 0, height: 24, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              bgcolor: subType === st.id ? `${st.color}22` : T.glass,
              color:   subType === st.id ? st.color         : T.textMuted,
              border:  `1px solid ${subType === st.id ? st.color + '55' : T.border}`,
              '&:hover': { bgcolor: `${st.color}18` } }} />
        ))}
      </Box>

      {/* ── Date history row ── */}
      <DateChipRow
        source={sourceId} subType={subType} format={fmt}
        selected={selDate}
        onChange={(d) => { setSelDate(d); setLive(false); setLines(500); }}
        disabled={!supHist || live}
        T={T}
      />

      {/* ── Toolbar ── */}
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 1,
        display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', flexShrink: 0 }}>

        {/* Lines selector (static only) */}
        {!live && (
          <TextField select size="small" label="Lines" value={lines}
            onChange={e => { setLines(Number(e.target.value)); isLoadingMore.current = false; }}
            SelectProps={{ native: true }}
            sx={{ minWidth: 80, ...fieldSx }}>
            {[100, 250, 500, 1000, 2000, 5000].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </TextField>
        )}

        {/* JSON / RAW toggle (app source only) */}
        {supJson && (
          <ToggleButtonGroup value={viewMode} exclusive
            onChange={(_, v) => v && setViewMode(v)} size="small">
            <ToggleButton value="json" sx={toggleBtnSx}>
              <DataObjectIcon sx={{ fontSize: 13, mr: 0.5 }} />JSON
            </ToggleButton>
            <ToggleButton value="raw" sx={toggleBtnSx}>
              <SubjectIcon sx={{ fontSize: 13, mr: 0.5 }} />RAW
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        {/* Sort direction (static only) */}
        {!live && (
          <Tooltip title={sortDesc ? 'Newest first (click for oldest first)' : 'Oldest first (click for newest first)'}>
            <IconButton size="small" onClick={() => setSortDesc(v => !v)} sx={{
              ...iconBtnSx,
              color: sortDesc ? T.teal : T.textFaint,
              bgcolor: sortDesc ? T.tealBg : 'transparent',
              border: `1px solid ${sortDesc ? T.teal + '55' : T.border}`,
              borderRadius: 1,
            }}>
              {sortDesc
                ? <ArrowDownwardIcon sx={{ fontSize: 15 }} />
                : <ArrowUpwardIcon   sx={{ fontSize: 15 }} />}
            </IconButton>
          </Tooltip>
        )}

        {/* Search */}
        <TextField size="small" placeholder="Search…" value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flex: '1 1 140px', maxWidth: 280, ...fieldSx }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 15, mr: 0.5, color: T.textFaint }} />,
            endAdornment: search ? (
              <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.25 }}>
                <ClearIcon sx={{ fontSize: 13, color: T.textFaint }} />
              </IconButton>
            ) : null,
          }} />

        <Box sx={{ flex: 1, minWidth: 4 }} />

        {/* Live */}
        <Button size="small"
          variant={live ? 'contained' : 'outlined'}
          startIcon={live ? <PauseIcon sx={{ fontSize: 14 }} /> : <PlayArrowIcon sx={{ fontSize: 14 }} />}
          onClick={() => { setLive(v => !v); if (live) { setLiveLines([]); setLivePreload([]); } }}
          sx={live
            ? { bgcolor: T.error, '&:hover': { bgcolor: '#dc2626' }, fontSize: 12, px: 1.5, color: '#fff', border: 'none' }
            : { borderColor: T.border, color: T.textMuted,
                '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: T.tealBg }, fontSize: 12, px: 1.5 }}>
          {live ? 'Stop' : 'Live'}
        </Button>

        {!live && (
          <Tooltip title="Refresh">
            <span>
              <IconButton size="small" onClick={() => refetch()}
                disabled={isLoading || isFetching} sx={iconBtnSx}>
                {(isLoading || isFetching)
                  ? <CircularProgress size={14} sx={{ color: T.teal }} />
                  : <RefreshIcon sx={{ fontSize: 17 }} />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        {live && (
          <Tooltip title="Clear live">
            <IconButton size="small" onClick={() => { setLiveLines([]); setLivePreload([]); }} sx={iconBtnSx}>
              <DeleteSweepIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Download">
          <IconButton size="small" onClick={handleDownload} sx={iconBtnSx}>
            <DownloadIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Active-filter bar (JSON only) ── */}
      {fmt === 'JSON' && (presentLevels.length > 0 || uniqueUsers.length > 0) && (
        <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 0.75, flexShrink: 0,
          display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75 }, alignItems: 'center',
          borderBottom: `1px solid ${T.border}` }}>

          {/* Level filter chips */}
          {presentLevels.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 10, color: T.textFaint, mr: 0.25 }}>Level</Typography>
              {presentLevels.map(lvl => {
                const c   = LC[lvl];
                const on  = levelFilter.includes(lvl);
                return (
                  <Chip key={lvl} label={lvl} size="small"
                    onClick={() => setLevelFilter(prev =>
                      on ? prev.filter(l => l !== lvl) : [...prev, lvl]
                    )}
                    sx={{ height: 20, fontSize: 9.5, fontWeight: 700, cursor: 'pointer',
                      bgcolor: on ? c.bg : T.glass,
                      color:   on ? c.text : T.textFaint,
                      border:  `1px solid ${on ? c.border : T.border}`,
                      borderRadius: 0.75,
                      '&:hover': { bgcolor: c.bg, color: c.text, borderColor: c.border } }} />
                );
              })}
            </Box>
          )}

          {/* Divider dot */}
          {presentLevels.length > 0 && uniqueUsers.length > 0 && (
            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: T.border,
              display: { xs: 'none', sm: 'block' } }} />
          )}

          {/* User filter */}
          {uniqueUsers.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 10, color: T.textFaint }}>User</Typography>
              <Box
                component="select"
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                sx={{
                  bgcolor: userFilter ? T.tealBg : T.inputBg,
                  color: userFilter ? T.teal : T.textMuted,
                  border: `1px solid ${userFilter ? T.teal + '55' : T.border}`,
                  borderRadius: 1,
                  fontSize: 11,
                  px: 0.75, py: 0.25,
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  '& option': { bgcolor: T.sidebar, color: T.text },
                }}>
                <option value="">All users</option>
                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </Box>
            </Box>
          )}

          {/* Clear all filters */}
          {hasActiveFilters && (
            <Chip label="Clear filters" size="small"
              onClick={() => resetFilters()}
              sx={{ height: 20, fontSize: 9.5, cursor: 'pointer', ml: 'auto',
                bgcolor: T.errorBg, color: T.error,
                border: `1px solid ${T.error}33`,
                borderRadius: 0.75,
                '&:hover': { bgcolor: `${T.error}22` } }} />
          )}
        </Box>
      )}

      {/* ── Live cap chip ── */}
      {live && liveLines.length >= MAX_LIVE && (
        <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, pb: 0.5, flexShrink: 0 }}>
          <Chip label={`Capped at ${MAX_LIVE} live lines`} size="small"
            sx={{ height: 18, fontSize: 10, bgcolor: T.warningBg, color: T.warning, border: 'none' }} />
        </Box>
      )}

      {/* ── LOG AREA (only this scrolls) ── */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative',
        border: termBorder, borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>

        {/* Scrollable terminal */}
        <Box ref={listRef} onScroll={handleScroll}
          sx={{ height: '100%', overflowY: 'auto', bgcolor: termBg,
            fontFamily: 'monospace',
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3 } }}>

          {/* ── Load More ── */}
          {!live && canLoadMore && !isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1,
              borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Button size="small"
                startIcon={isFetching ? <CircularProgress size={12} sx={{ color: T.teal }} /> : <AddIcon sx={{ fontSize: 14 }} />}
                onClick={handleLoadMore}
                disabled={isFetching}
                sx={{ fontSize: 11, color: T.teal, borderColor: `${T.teal}44`,
                  border: `1px solid ${T.teal}44`, borderRadius: 1.5,
                  '&:hover': { bgcolor: T.tealBg, borderColor: T.teal } }}>
                Load {LOAD_MORE_STEP} more
              </Button>
            </Box>
          )}

          {/* ── Preload separator ── */}
          {live && livePreload.length > 0 && liveLines.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.5,
              bgcolor: 'rgba(99,102,241,0.07)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(99,102,241,0.2)' }} />
              <Typography sx={{ fontSize: 9.5, color: 'rgba(99,102,241,0.7)', fontFamily: 'monospace',
                whiteSpace: 'nowrap' }}>
                ── live stream starts below ──
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(99,102,241,0.2)' }} />
            </Box>
          )}

          {/* ── Content ── */}
          {isLoading && !live ? (
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
              {[...Array(16)].map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={24}
                  sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 0.5,
                    width: `${60 + Math.random() * 40}%` }} />
              ))}
            </Box>
          ) : !live && fileFound === false ? (
            /* File not found state */
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 10, gap: 1.5 }}>
              <ErrorOutlineIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.15)' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.22)', fontSize: 13 }}>
                Log file not found on server
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.12)', fontSize: 11, fontFamily: 'monospace' }}>
                {sourceId}/{subType}{fmt === 'JSON' ? '.json' : '.log'}
              </Typography>
            </Box>
          ) : displayed.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 10, gap: 1 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No entries</Typography>
              {dSearch && (
                <Typography sx={{ color: 'rgba(255,255,255,0.12)', fontSize: 11 }}>
                  Try clearing the search filter
                </Typography>
              )}
            </Box>
          ) : fmt === 'JSON' && !displayed[0]?._raw ? (
            displayed.map((entry, i) => {
              const id = entry._key ?? i;
              return (
                <JsonEntry key={id} entry={entry} search={dSearch}
                  expanded={expandedId === id}
                  onToggle={() => setExpandedId(p => p === id ? null : id)} />
              );
            })
          ) : (
            displayed.map((entry, i) => (
              <RawLine key={entry._key ?? i}
                line={entry._raw ? entry._line : JSON.stringify(entry)}
                search={dSearch} />
            ))
          )}
        </Box>

        {/* ── Scroll nav FABs (top / bottom) ── */}
        {showFab && (
          <Box sx={{ position: 'absolute', bottom: 14, right: 14, zIndex: 5,
            display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Tooltip title="Scroll to top" placement="left">
              <Fab size="small"
                onClick={() => { if (listRef.current) { listRef.current.scrollTop = 0; autoScrollRef.current = false; } }}
                sx={{ bgcolor: 'rgba(30,41,59,0.92)', color: T.textMuted,
                  border: `1px solid ${T.border}`,
                  '&:hover': { bgcolor: T.tealBg, color: T.teal, borderColor: T.teal },
                  width: 34, height: 34, minHeight: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <KeyboardArrowUpIcon sx={{ fontSize: 20 }} />
              </Fab>
            </Tooltip>
            <Tooltip title="Scroll to bottom" placement="left">
              <Fab size="small" onClick={scrollToBottom}
                sx={{ bgcolor: T.teal, color: '#fff',
                  '&:hover': { bgcolor: T.tealHover },
                  width: 34, height: 34, minHeight: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
              </Fab>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
}
