import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, TextField,
  MenuItem, Collapse, Skeleton, Button, Alert, InputAdornment,
  TableSortLabel, useMediaQuery, useTheme,
} from '@mui/material';
import ExpandMoreIcon  from '@mui/icons-material/ExpandMore';
import ExpandLessIcon  from '@mui/icons-material/ExpandLess';
import FilterListIcon  from '@mui/icons-material/FilterList';
import SearchIcon      from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ClearIcon       from '@mui/icons-material/Clear';
import RefreshIcon     from '@mui/icons-material/Refresh';
import { motion, AnimatePresence } from 'framer-motion';
import { useT }        from '@shared/theme/ThemeContext';
import {
  fetchApiLogs, HTTP_METHODS, METHOD_COLOR, fmtAgo, fmtDuration, statusColor,
} from './activityApi';

// ─── Status class pills ───────────────────────────────────────────────────────
const STATUS_CLASSES = [
  { id: 'all', label: 'All',     test: () => true,                          color: '#6b7280' },
  { id: '2',   label: 'Success', test: (s) => s >= 200 && s < 300,          color: '#10b981' },
  { id: '3',   label: 'Redir.',  test: (s) => s >= 300 && s < 400,          color: '#f59e0b' },
  { id: '4',   label: 'Client',  test: (s) => s >= 400 && s < 500,          color: '#ef4444' },
  { id: '5',   label: 'Server',  test: (s) => s >= 500,                     color: '#8b5cf6' },
];

function statusLabel(s) {
  if (!s) return '';
  if (s < 300) return 'OK';
  if (s < 400) return 'Redirect';
  if (s === 400) return 'Bad Request';
  if (s === 401) return 'Unauthorized';
  if (s === 403) return 'Forbidden';
  if (s === 404) return 'Not Found';
  if (s === 429) return 'Rate Limited';
  if (s < 500) return 'Client Error';
  if (s === 500) return 'Server Error';
  return 'Error';
}

// ─── Chips ────────────────────────────────────────────────────────────────────
function MethodChip({ method, sm = false }) {
  const color = METHOD_COLOR[method] ?? '#6b7280';
  return (
    <Chip size="small" label={method}
      sx={{
        bgcolor: `${color}1A`, color, fontWeight: 800,
        fontSize: sm ? 10 : 11, height: sm ? 18 : 22, minWidth: sm ? 42 : 52,
        '& .MuiChip-label': { px: 0.85 },
      }}
    />
  );
}

function StatusChip({ status, sm = false }) {
  const color = statusColor(status);
  return (
    <Chip size="small" label={status}
      sx={{
        bgcolor: `${color}1A`, color, fontWeight: 700,
        fontSize: sm ? 10 : 11, height: sm ? 18 : 22,
        '& .MuiChip-label': { px: 0.85 },
      }}
    />
  );
}

function DurChip({ ms }) {
  const T = useT();
  if (ms == null) return <Typography sx={{ fontSize: 11, color: T.textFaint }}>—</Typography>;
  const color = ms < 300 ? '#10b981' : ms < 1000 ? '#f59e0b' : '#ef4444';
  return (
    <Chip size="small" label={fmtDuration(ms)}
      sx={{ bgcolor: `${color}1A`, color, fontWeight: 600, fontSize: 10, height: 18 }}
    />
  );
}

// ─── Field label / value pair ─────────────────────────────────────────────────
function Field({ label, children, mono = false }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.3, fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12, color: T.text, fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>
        {children ?? '—'}
      </Typography>
    </Box>
  );
}

// ─── Code block with copy ─────────────────────────────────────────────────────
function CodeBlock({ label, text }) {
  const T = useT();
  if (!text || text === 'null') return null;
  const pretty = (() => { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; } })();
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
          {label}
        </Typography>
        <IconButton size="small" onClick={() => navigator.clipboard?.writeText(text).catch(() => {})}
          sx={{ color: T.textFaint, p: 0.25 }}>
          <ContentCopyIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Box>
      <Box sx={{ bgcolor: T.bg, border: `1px solid ${T.border}`, borderRadius: 1, p: 1.25, maxHeight: 160, overflowY: 'auto' }}>
        <Typography component="pre"
          sx={{ fontSize: 11, color: T.text, fontFamily: 'monospace', m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {pretty}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Expanded detail body (shared by table row + mobile card) ────────────────
function ExpandedDetails({ log }) {
  const T = useT();
  return (
    <Box sx={{
      bgcolor: T.hoverBg, px: { xs: 1.5, sm: 2.5 }, py: 1.75,
      display: 'flex', flexDirection: 'column', gap: 1.5,
      borderTop: `1px solid ${T.border}`,
    }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(auto-fit, minmax(140px, 1fr))' } }}>
        <Field label="User">{log.username}</Field>
        <Field label="IP">{log.ip}</Field>
        <Field label="Duration"><DurChip ms={log.duration} /></Field>
        <Field label="Status">
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <StatusChip status={log.status} sm />
            <Typography sx={{ fontSize: 11, color: T.textFaint }}>{statusLabel(log.status)}</Typography>
          </Box>
        </Field>
        <Field label="When">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</Field>
        {log.requestId && <Field label="Request ID" mono>{log.requestId}</Field>}
      </Box>
      <Field label="Full URI" mono>{log.uri}{log.query ? `?${log.query}` : ''}</Field>
      {log.userAgent && <Field label="User Agent">{log.userAgent}</Field>}
      <CodeBlock label="Request Body" text={log.requestBody} />
    </Box>
  );
}

// ─── Desktop log row ─────────────────────────────────────────────────────────
function LogRow({ log }) {
  const T = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen((o) => !o)}
        sx={{
          cursor: 'pointer',
          '& td': { borderColor: T.border, py: 1 },
          '&:hover': { bgcolor: T.hoverBg },
          bgcolor: open ? T.tealBg : 'transparent',
        }}
      >
        <TableCell sx={{ minWidth: 96, pl: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            <MethodChip method={log.method} />
            <StatusChip status={log.status} />
          </Box>
        </TableCell>
        <TableCell sx={{ minWidth: 180 }}>
          <Tooltip title={`${log.uri}${log.query ? '?' + log.query : ''}`}>
            <Typography sx={{
              fontSize: 12, color: T.text, fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: { md: 360, lg: 460 },
            }}>
              {log.uri}
            </Typography>
          </Tooltip>
          {log.query && (
            <Typography sx={{
              fontSize: 10, color: T.textFaint, fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: { md: 360, lg: 460 },
            }}>
              ?{log.query}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={{ minWidth: 110, maxWidth: 170 }}>
          <Tooltip title={log.username ?? ''}>
            <Typography sx={{ fontSize: 12, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {log.username ?? '—'}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell sx={{ minWidth: 78, whiteSpace: 'nowrap' }}>
          <DurChip ms={log.duration} />
        </TableCell>
        <TableCell sx={{ minWidth: 76, whiteSpace: 'nowrap', pr: 1 }}>
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>{fmtAgo(log.timestamp)}</Typography>
        </TableCell>
        <TableCell sx={{ width: 32, px: 0 }}>
          <IconButton size="small" sx={{ color: T.textFaint, p: 0.25 }}>
            {open ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? `1px solid ${T.border}` : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <ExpandedDetails log={log} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── Mobile log card ─────────────────────────────────────────────────────────
function LogCard({ log, index }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.2) }}
      sx={{
        border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden',
        bgcolor: T.glass, transition: 'border-color .15s',
        '&:active': { borderColor: T.teal },
      }}
    >
      <Box
        onClick={() => setOpen((o) => !o)}
        role="button" tabIndex={0}
        sx={{
          display: 'flex', flexDirection: 'column', gap: 0.75,
          px: 1.5, py: 1.25, cursor: 'pointer', userSelect: 'none',
          minHeight: 44,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <MethodChip method={log.method} sm />
          <StatusChip status={log.status} sm />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 10.5, color: T.textFaint }}>{fmtAgo(log.timestamp)}</Typography>
          <IconButton size="small" sx={{ color: T.textFaint, p: 0.25 }}>
            {open ? <ExpandLessIcon sx={{ fontSize: 17 }} /> : <ExpandMoreIcon sx={{ fontSize: 17 }} />}
          </IconButton>
        </Box>
        <Typography sx={{
          fontSize: 12.5, color: T.text, fontFamily: 'monospace',
          wordBreak: 'break-all', lineHeight: 1.35,
        }}>
          {log.uri}{log.query ? <Box component="span" sx={{ color: T.textFaint }}>?{log.query}</Box> : null}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
            {log.username ?? 'anonymous'}
          </Typography>
          <DurChip ms={log.duration} />
        </Box>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <ExpandedDetails log={log} />
      </Collapse>
    </Box>
  );
}

// ─── Sortable header cell ─────────────────────────────────────────────────────
function SortTH({ children, field, sort, onSort, sx = {} }) {
  const T = useT();
  const active = sort.field === field;
  return (
    <TableCell sx={{
      fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
      color: T.textFaint, bgcolor: T.glass, borderColor: T.border,
      whiteSpace: 'nowrap', userSelect: 'none',
      ...sx,
    }}>
      <TableSortLabel
        active={active}
        direction={active ? sort.dir : 'desc'}
        onClick={() => onSort(field)}
        sx={{
          color: `${T.textFaint} !important`,
          '& .MuiTableSortLabel-icon': { color: `${active ? T.teal : T.textFaint} !important` },
          '&.Mui-active': { color: `${T.teal} !important` },
        }}
      >
        {children}
      </TableSortLabel>
    </TableCell>
  );
}

// ─── Status class pill ────────────────────────────────────────────────────────
function StatusClassPill({ option, active, onClick }) {
  const T = useT();
  return (
    <Box
      onClick={onClick}
      role="button" tabIndex={0}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5,
        px: 1.25, py: 0.6, borderRadius: 999,
        cursor: 'pointer', userSelect: 'none',
        bgcolor: active ? `${option.color}22` : 'transparent',
        color:   active ? option.color : T.textMuted,
        border:  `1px solid ${active ? option.color : T.border}`,
        fontSize: 11.5, fontWeight: 700,
        transition: 'all .15s',
        '&:hover': { borderColor: option.color, color: option.color },
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: option.color, flexShrink: 0 }} />
      {option.label}
    </Box>
  );
}

// ─── ApiLogsFeed ──────────────────────────────────────────────────────────────
export default function ApiLogsFeed() {
  const T = useT();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const [page,        setPage]        = useState(0);
  const [logs,        setLogs]        = useState([]);
  const [hasMore,     setHasMore]     = useState(true);
  const [total,       setTotal]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState('');
  const [showFilters, setShowFilters] = useState(!isMobile);
  const [statusClass, setStatusClass] = useState('all');

  // Filters — draft (what user typed) vs applied (sent to API)
  const [draft,   setDraft]   = useState({ username: '', method: '', status: '', uri: '' });
  const [applied, setApplied] = useState({ username: '', method: '', status: '', uri: '' });
  const [sort,    setSort]    = useState({ field: 'timestamp', dir: 'desc' });

  const debounceRef = useRef(null);
  const debouncedApply = useCallback((newDraft) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setApplied(newDraft), 500);
  }, []);

  const updateDraft = (key, value) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (key === 'method') {
      setApplied((prev) => ({ ...prev, method: value }));
    } else {
      debouncedApply(next);
    }
  };

  const clearFilters = () => {
    clearTimeout(debounceRef.current);
    const empty = { username: '', method: '', status: '', uri: '' };
    setDraft(empty);
    setApplied(empty);
    setStatusClass('all');
  };

  const hasActiveFilters = Object.values(applied).some(Boolean) || statusClass !== 'all';

  const handleSort = (field) => {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const doFetch = useCallback(async (pg = 0, append = false) => {
    const setter = pg === 0 ? setLoading : setLoadingMore;
    setter(true);
    setError('');
    try {
      const data = await fetchApiLogs({
        page: pg, size: 50, ...applied,
        sortBy: sort.field, sortDir: sort.dir,
      });
      setLogs((prev) => (append ? [...prev, ...data.content] : data.content));
      setHasMore(!data.last);
      setTotal(data.totalElements ?? null);
      setPage(pg);
    } catch {
      setError('Failed to load API logs — check that the backend is running.');
    } finally {
      setter(false);
    }
  }, [applied, sort]);

  useEffect(() => { setLogs([]); setPage(0); doFetch(0, false); }, [applied, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side status-class filter (avoids needing backend range support)
  const visibleLogs = useMemo(() => {
    const cls = STATUS_CLASSES.find((c) => c.id === statusClass);
    if (!cls || cls.id === 'all') return logs;
    return logs.filter((l) => cls.test(l.status));
  }, [logs, statusClass]);

  // Class counts for the pills
  const classCounts = useMemo(() => {
    const c = { all: logs.length, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const l of logs) {
      if (l.status >= 200 && l.status < 300) c[2]++;
      else if (l.status >= 300 && l.status < 400) c[3]++;
      else if (l.status >= 400 && l.status < 500) c[4]++;
      else if (l.status >= 500) c[5]++;
    }
    return c;
  }, [logs]);

  return (
    <Box>
      {/* ── Toolbar (sticky) ── */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 3,
        bgcolor: T.glass,
        borderBottom: `1px solid ${T.border}`,
        backdropFilter: 'blur(8px)',
      }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: { xs: 1.25, sm: 2 }, py: { xs: 1, sm: 1.25 }, flexWrap: 'wrap',
        }}>
          <Tooltip title={showFilters ? 'Hide filters' : 'Show filters'}>
            <IconButton
              size="small" onClick={() => setShowFilters((f) => !f)}
              sx={{
                color: showFilters || hasActiveFilters ? T.teal : T.textFaint,
                border: `1px solid ${T.border}`,
                bgcolor: showFilters || hasActiveFilters ? T.tealBg : 'transparent',
                '&:hover': { borderColor: T.teal },
              }}
            >
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Quick status class pills — always visible, scrollable on narrow */}
          <Box sx={{
            display: 'flex', gap: 0.75, flex: 1, minWidth: 0,
            overflowX: 'auto', py: 0.25,
            '&::-webkit-scrollbar': { display: 'none' },
          }}>
            {STATUS_CLASSES.map((opt) => {
              const count = opt.id === 'all'
                ? classCounts.all
                : classCounts[opt.id] ?? 0;
              return (
                <StatusClassPill
                  key={opt.id}
                  option={{ ...opt, label: count > 0 ? `${opt.label} · ${count}` : opt.label }}
                  active={statusClass === opt.id}
                  onClick={() => setStatusClass(opt.id)}
                />
              );
            })}
          </Box>

          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => doFetch(0, false)}
              sx={{ color: T.textFaint, border: `1px solid ${T.border}`, '&:hover': { color: T.teal, borderColor: T.teal } }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Detailed filters — collapsible */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <Box sx={{
                display: 'grid', gap: 1,
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                px: { xs: 1.25, sm: 2 }, pb: { xs: 1.25, sm: 1.5 },
              }}>
                <TextField
                  size="small" placeholder="Username / email" value={draft.username}
                  onChange={(e) => updateDraft('username', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setApplied({ ...draft })}
                  fullWidth
                  InputProps={{ startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 14, color: T.textFaint }} />
                    </InputAdornment>
                  ) }}
                />
                <TextField
                  select size="small" label="Method" value={draft.method}
                  onChange={(e) => updateDraft('method', e.target.value)}
                  fullWidth
                >
                  <MenuItem value="">All methods</MenuItem>
                  {HTTP_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
                <TextField
                  size="small" placeholder="Exact status" value={draft.status}
                  onChange={(e) => updateDraft('status', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setApplied({ ...draft })}
                  fullWidth
                />
                <TextField
                  size="small" placeholder="URI contains…" value={draft.uri}
                  onChange={(e) => updateDraft('uri', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setApplied({ ...draft })}
                  fullWidth
                />
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active filter summary */}
        {hasActiveFilters && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            px: { xs: 1.25, sm: 2 }, py: 0.75, flexWrap: 'wrap',
            borderTop: `1px solid ${T.border}`,
          }}>
            {Object.entries(applied).filter(([, v]) => v).map(([k, v]) => (
              <Chip
                key={k} size="small" label={`${k}: ${v}`}
                onDelete={() => {
                  const next = { ...draft, [k]: '' };
                  setDraft(next); setApplied(next);
                }}
                sx={{ height: 22, fontSize: 11, bgcolor: T.tealBg, color: T.teal, '& .MuiChip-deleteIcon': { color: T.teal } }}
              />
            ))}
            {statusClass !== 'all' && (
              <Chip
                size="small" label={`class: ${statusClass}xx`}
                onDelete={() => setStatusClass('all')}
                sx={{ height: 22, fontSize: 11, bgcolor: T.tealBg, color: T.teal, '& .MuiChip-deleteIcon': { color: T.teal } }}
              />
            )}
            <Button size="small" onClick={clearFilters} startIcon={<ClearIcon sx={{ fontSize: 14 }} />}
              sx={{ ml: 'auto', color: T.textFaint, fontSize: 11, textTransform: 'none' }}>
              Clear all
            </Button>
          </Box>
        )}

        {/* Count footer */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: { xs: 1.25, sm: 2 }, py: 0.5,
          borderTop: hasActiveFilters ? 'none' : `1px solid transparent`,
        }}>
          <Typography sx={{ fontSize: 10.5, color: T.textFaint }}>
            Showing {visibleLogs.length}{logs.length !== visibleLogs.length ? ` of ${logs.length}` : ''}
            {total !== null && ` · ${total.toLocaleString()} total`}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ m: 2, borderRadius: 1.5 }}>{error}</Alert>}

      {/* ── Body ── */}
      {isMobile ? (
        <Box sx={{ p: { xs: 1.25, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={82} sx={{ bgcolor: T.glass }} />
          ))}
          {!loading && visibleLogs.length === 0 && (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ color: T.textFaint, fontSize: 13 }}>
                {hasActiveFilters ? 'No entries match the current filters' : 'No log entries found'}
              </Typography>
            </Box>
          )}
          {!loading && visibleLogs.map((log, i) => (
            <LogCard key={log.id ?? i} log={log} index={i} />
          ))}
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: { md: 620 }, overflowY: 'auto', overflowX: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <SortTH field="method"    sort={sort} onSort={handleSort} sx={{ minWidth: 96 }}>Method</SortTH>
                <SortTH field="uri"       sort={sort} onSort={handleSort} sx={{ minWidth: 200 }}>URI</SortTH>
                <SortTH field="userEmail" sort={sort} onSort={handleSort} sx={{ minWidth: 120 }}>User</SortTH>
                <SortTH field="duration"  sort={sort} onSort={handleSort} sx={{ minWidth: 78 }}>Duration</SortTH>
                <SortTH field="timestamp" sort={sort} onSort={handleSort} sx={{ minWidth: 76 }}>When</SortTH>
                <TableCell sx={{ bgcolor: T.glass, borderColor: T.border, width: 32 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}
                </TableRow>
              ))}
              {!loading && visibleLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 7, color: T.textFaint, fontSize: 13 }}>
                    {hasActiveFilters ? 'No entries match the current filters' : 'No log entries found'}
                  </TableCell>
                </TableRow>
              )}
              {visibleLogs.map((log, i) => <LogRow key={log.id ?? i} log={log} />)}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <Box sx={{
          display: 'flex', justifyContent: 'center',
          p: { xs: 1.5, sm: 2 }, borderTop: `1px solid ${T.border}`,
        }}>
          <Button
            variant="outlined" size="small" onClick={() => doFetch(page + 1, true)}
            disabled={loadingMore}
            sx={{
              color: T.teal, borderColor: T.teal,
              textTransform: 'none', fontWeight: 700,
              px: 3, minHeight: 36,
              '&:hover': { bgcolor: T.tealBg, borderColor: T.teal },
            }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
