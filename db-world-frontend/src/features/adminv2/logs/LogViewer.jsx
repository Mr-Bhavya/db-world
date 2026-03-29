// db-world-frontend/src/features/adminv2/logs/LogViewer.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, TextField, MenuItem,
  ToggleButton, ToggleButtonGroup, CircularProgress, Button, Divider,
} from '@mui/material';
import PlayArrowIcon    from '@mui/icons-material/PlayArrow';
import PauseIcon        from '@mui/icons-material/Pause';
import RefreshIcon      from '@mui/icons-material/Refresh';
import DeleteSweepIcon  from '@mui/icons-material/DeleteSweep';
import DownloadIcon     from '@mui/icons-material/Download';
import SearchIcon       from '@mui/icons-material/Search';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import { useQuery }     from '@tanstack/react-query';
import { fetchLogs, LOG_SOURCES, LOG_TYPES } from './logApi';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

// Parse SSE event stream chunks: "event: log\ndata: <payload>\n\n"
function parseSseChunk(chunk, fmt, onEntry) {
  const blocks = chunk.split(/\n\n+/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    let name = '', data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) name = line.slice(6).trim();
      else if (line.startsWith('data:')) data = line.slice(5).trim();
    }
    if (name === 'log' && data) {
      try {
        const entry = fmt === 'JSON' ? JSON.parse(data) : { type: 'UNKNOWN', rawLine: data };
        onEntry(entry);
      } catch { /* ignore */ }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_COLOR = {
  ERROR:   { bg: 'rgba(239,68,68,0.12)',    text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  WARN:    { bg: 'rgba(245,158,11,0.12)',   text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  INFO:    { bg: 'rgba(13,148,136,0.12)',   text: '#0d9488', border: 'rgba(13,148,136,0.3)' },
  DEBUG:   { bg: 'rgba(16,185,129,0.1)',    text: '#10b981', border: 'rgba(16,185,129,0.25)' },
  REQUEST: { bg: 'rgba(59,130,246,0.1)',    text: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
  UNKNOWN: { bg: 'rgba(255,255,255,0.04)',  text: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)' },
};

const levelFor = (entry) => entry?.type?.toUpperCase() ?? 'UNKNOWN';

const extractText = (entry) => {
  if (!entry) return '';
  const d = entry.debug ?? entry.error ?? entry.info ?? entry.request;
  if (!d) return entry.rawLine ?? '';
  return [
    d.message,
    d.logger   ? `[${d.logger?.split('.').pop()}]` : null,
    d.thread   ? `(${d.thread})`                   : null,
    d.exception ? `\n${d.exception}`               : null,
  ].filter(Boolean).join(' ');
};

const extractTs = (entry) => {
  if (!entry) return '';
  const d = entry.debug ?? entry.error ?? entry.info ?? entry.request;
  const ts = d?.timestamp ?? entry.timestamp;
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
};

const selectFmt = (source) => source === 'app' ? 'JSON' : 'RAW';

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogEntry({ entry, search }) {
  const level = levelFor(entry);
  const colors = LEVEL_COLOR[level] ?? LEVEL_COLOR.UNKNOWN;
  const text = extractText(entry);
  const ts   = extractTs(entry);

  const highlight = useCallback((str) => {
    if (!search || !str) return str;
    const idx = str.toLowerCase().indexOf(search.toLowerCase());
    if (idx < 0) return str;
    return (
      <>
        {str.slice(0, idx)}
        <mark style={{ background: 'rgba(245,158,11,0.4)', color: '#fff', borderRadius: 2, padding: '0 2px' }}>
          {str.slice(idx, idx + search.length)}
        </mark>
        {str.slice(idx + search.length)}
      </>
    );
  }, [search]);

  return (
    <Box sx={{
      display: 'flex', gap: 1, px: 1.5, py: .75, alignItems: 'flex-start',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
    }}>
      <Chip
        label={level === 'UNKNOWN' ? '—' : level}
        size="small"
        sx={{
          height: 18, fontSize: 9, fontWeight: 700, flexShrink: 0, mt: .25,
          bgcolor: colors.bg, color: colors.text,
          border: `1px solid ${colors.border}`, borderRadius: .75,
        }}
      />
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', flexShrink: 0, mt: .1, fontFamily: 'monospace', minWidth: 72 }}>
        {ts}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1, lineHeight: 1.55 }}>
        {highlight(text)}
      </Typography>
    </Box>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SEL_SX = {
  minWidth: 110,
  '& .MuiOutlinedInput-root': { bgcolor:'rgba(0,0,0,0.03)', color:'#0f172a', '& fieldset':{ borderColor:'rgba(0,0,0,0.15)' }, '&:hover fieldset':{ borderColor:'rgba(0,0,0,0.3)' }, '&.Mui-focused fieldset':{ borderColor:'#0d9488' } },
  '& .MuiInputLabel-root': { color:'rgba(15,23,42,0.5)', fontSize: 12 },
  '& .MuiSelect-icon': { color:'rgba(15,23,42,0.4)' },
};

const toggleBtnSx = {
  border: '1px solid rgba(0,0,0,0.12) !important',
  borderRadius: '8px !important',
  color: 'rgba(15,23,42,0.55)',
  '&.Mui-selected': { bgcolor: 'rgba(13,148,136,0.1)', color: '#0d9488' },
  '&:hover': { bgcolor: 'rgba(13,148,136,0.06)' },
};

const MAX_LIVE = 500;

export default function LogViewer() {
  const [source,   setSource]   = useState('app');
  const [logType,  setLogType]  = useState('INFO');
  const [lines,    setLines]    = useState(100);
  const [search,   setSearch]   = useState('');
  const [dSearch,  setDSearch]  = useState('');
  const [live,     setLive]     = useState(false);
  const [liveEntries, setLiveEntries] = useState([]);
  const [connected,   setConnected]   = useState(false);

  const listRef  = useRef(null);
  const sseRef   = useRef(null);
  const searchTimer = useRef(null);
  const autoScroll  = useRef(true);

  const fmt = selectFmt(source);

  // ── Static fetch ──────────────────────────────────────────────────────────
  const { data: staticData, isLoading, refetch } = useQuery({
    queryKey: ['logs', source, logType, lines, fmt],
    queryFn:  () => fetchLogs({ source, type: logType, format: fmt, lines }),
    enabled:  !live,
    staleTime: 0,
  });

  const staticEntries = useMemo(() => {
    if (!staticData) return [];
    if (fmt === 'RAW') {
      const raw = typeof staticData === 'string' ? staticData : JSON.stringify(staticData);
      return raw.split('\n').filter(Boolean).map((line, i) => ({ type: 'UNKNOWN', rawLine: line, _key: i }));
    }
    return Array.isArray(staticData) ? staticData : [];
  }, [staticData, fmt]);

  // ── SSE live stream (fetch-based for auth header support) ────────────────
  const startSse = useCallback(() => {
    if (sseRef.current) { sseRef.current.abort(); sseRef.current = null; }
    setLiveEntries([]);
    setConnected(false);

    const controller = new AbortController();
    sseRef.current = controller;

    const url = `${BASE}/api/logs/${source}/${logType}/follow?format=${fmt}`;
    const token = localStorage.getItem('token');

    (async () => {
      try {
        const res = await fetch(url, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
          signal: controller.signal,
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
            parseSseChunk(buf.slice(0, idx + 2), fmt, (entry) => {
              setLiveEntries(prev => {
                const next = [...prev, { ...entry, _key: Date.now() + Math.random() }];
                return next.length > MAX_LIVE ? next.slice(next.length - MAX_LIVE) : next;
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
  }, [source, logType, fmt]);

  const stopSse = useCallback(() => {
    if (sseRef.current) { sseRef.current.abort(); sseRef.current = null; }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (live) startSse(); else stopSse();
    return stopSse;
  }, [live, startSse, stopSse]);

  useEffect(() => {
    setLiveEntries([]);
  }, [source, logType]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [liveEntries, staticEntries]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    autoScroll.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  // ── Search debounce ───────────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDSearch(e.target.value), 300);
  };
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  // ── Entries to display ────────────────────────────────────────────────────
  const allEntries = live ? liveEntries : staticEntries;
  const visible = useMemo(() => {
    if (!dSearch) return allEntries;
    const q = dSearch.toLowerCase();
    return allEntries.filter(e => extractText(e).toLowerCase().includes(q) || levelFor(e).toLowerCase().includes(q));
  }, [allEntries, dSearch]);

  // ── Download ──────────────────────────────────────────────────────────────
  const download = () => {
    const text = visible.map(e => `[${levelFor(e)}] ${extractTs(e)} ${extractText(e)}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${source}-${logType}.log` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleSourceChange = (_, v) => {
    if (!v) return;
    setSource(v);
    if (v !== 'app' && !['ERROR', 'INFO'].includes(logType)) setLogType('INFO');
    setLiveEntries([]);
    setLive(false);
  };

  const handleTypeChange = (_, v) => { if (v) { setLogType(v); setLiveEntries([]); setLive(false); } };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f0f9f8', color: '#0f172a', minHeight: 0 }}>

      {/* ── Header ── */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, color: '#0f172a' }}>Log Viewer</Typography>
        <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', mt: .25 }}>
          {live ? (connected ? `Live — streaming ${source}/${logType}` : 'Connecting…') : `${visible.length} of ${allEntries.length} entries`}
        </Typography>
      </Box>

      {/* ── Controls ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: { xs: 2, md: 3 }, pb: 1.5, alignItems: 'center' }}>

        {/* Source */}
        <ToggleButtonGroup size="small" value={source} exclusive onChange={handleSourceChange}>
          {LOG_SOURCES.map(s => (
            <ToggleButton key={s} value={s} sx={toggleBtnSx}>{s}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(0,0,0,0.1)' }} />

        {/* Type */}
        <ToggleButtonGroup size="small" value={logType} exclusive onChange={handleTypeChange}>
          {LOG_TYPES.map(t => (
            <ToggleButton key={t} value={t} sx={{ ...toggleBtnSx, color: LEVEL_COLOR[t]?.text ?? 'rgba(15,23,42,0.55)', '&.Mui-selected': { bgcolor: `${LEVEL_COLOR[t]?.bg ?? 'rgba(13,148,136,0.1)'}`, color: LEVEL_COLOR[t]?.text ?? '#0d9488' } }}>{t}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(0,0,0,0.1)' }} />

        {/* Lines (only for static) */}
        {!live && (
          <TextField select size="small" label="Lines" value={lines} onChange={e => setLines(Number(e.target.value))} sx={{ ...SEL_SX, minWidth: 90 }}>
            {[50, 100, 200, 500, 1000].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
        )}

        {/* Search */}
        <TextField
          size="small" placeholder="Filter…" value={search} onChange={handleSearchChange}
          sx={{ ...SEL_SX, minWidth: 180 }}
          InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 16, color: 'rgba(15,23,42,0.35)', mr: .5 }} /> }}
        />
        {search && (
          <Tooltip title="Clear filter">
            <IconButton size="small" onClick={() => { setSearch(''); setDSearch(''); }} sx={{ color: 'rgba(15,23,42,0.4)', '&:hover': { color: '#ef4444' } }}>
              <FilterListOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Live toggle */}
        <Button
          size="small"
          variant={live ? 'contained' : 'outlined'}
          startIcon={live ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={() => setLive(v => !v)}
          sx={live
            ? { bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, borderColor: 'transparent' }
            : { borderColor: 'rgba(0,0,0,0.2)', color: 'rgba(15,23,42,0.7)', '&:hover': { borderColor: '#0d9488', color: '#0d9488' } }
          }
        >
          {live ? 'Stop' : 'Live'}
        </Button>

        {!live && (
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => refetch()} disabled={isLoading} sx={{ color: 'rgba(15,23,42,0.4)', '&:hover': { color: '#0d9488' } }}>
              {isLoading ? <CircularProgress size={16} sx={{ color: '#0d9488' }} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Clear view">
          <IconButton size="small" onClick={() => live ? setLiveEntries([]) : null} disabled={!live} sx={{ color: 'rgba(15,23,42,0.4)', '&:hover': { color: '#f59e0b' } }}>
            <DeleteSweepIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Download">
          <IconButton size="small" onClick={download} sx={{ color: 'rgba(15,23,42,0.4)', '&:hover': { color: '#0d9488' } }}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Live indicator ── */}
      {live && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 2, md: 3 }, pb: .75 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: connected ? '#10b981' : '#f59e0b', animation: connected ? 'pulse 1.5s infinite' : 'none',
            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: .3 } } }} />
          <Typography sx={{ fontSize: 11, color: connected ? '#10b981' : '#f59e0b' }}>
            {connected ? `Streaming — ${liveEntries.length} entries` : 'Connecting…'}
          </Typography>
          {liveEntries.length >= MAX_LIVE && (
            <Chip label={`Capped at ${MAX_LIVE}`} size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(245,158,11,0.12)', color: '#b45309' }} />
          )}
        </Box>
      )}

      {/* ── Log list (keep dark — terminal aesthetic) ── */}
      <Box
        ref={listRef}
        onScroll={handleScroll}
        sx={{ flex: 1, overflowY: 'auto', minHeight: 0, borderTop: '1px solid rgba(0,0,0,0.08)',
          fontFamily: 'monospace', bgcolor: '#0c1117',
          borderRadius: '0 0 0 0',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3 },
        }}
      >
        {isLoading && !live ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress size={32} sx={{ color: '#0d9488' }} />
          </Box>
        ) : visible.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 8, gap: 1 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>No log entries</Typography>
            {dSearch && <Typography sx={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>Try clearing the filter</Typography>}
          </Box>
        ) : (
          visible.map((entry, i) => (
            <LogEntry key={entry._key ?? i} entry={entry} search={dSearch} />
          ))
        )}
      </Box>
    </Box>
  );
}
