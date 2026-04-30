import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, TextField,
  MenuItem, Collapse, Skeleton, Button, Alert, InputAdornment,
  TableSortLabel,
} from '@mui/material';
import ExpandMoreIcon  from '@mui/icons-material/ExpandMore';
import ExpandLessIcon  from '@mui/icons-material/ExpandLess';
import FilterListIcon  from '@mui/icons-material/FilterList';
import SearchIcon      from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ClearIcon       from '@mui/icons-material/Clear';
import { useT }        from '@shared/theme/ThemeContext';
import {
  fetchApiLogs, HTTP_METHODS, METHOD_COLOR, fmtAgo, fmtDuration, statusColor,
} from './activityApi';

// ─── Chips ────────────────────────────────────────────────────────────────────
function MethodChip({ method }) {
  const color = METHOD_COLOR[method] ?? '#6b7280';
  return (
    <Chip size="small" label={method}
      sx={{ bgcolor: `${color}18`, color, fontWeight: 800, fontSize: 10, height: 20, minWidth: 48 }} />
  );
}

function StatusChip({ status }) {
  const color = statusColor(status);
  return (
    <Chip size="small" label={status}
      sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: 10, height: 20 }} />
  );
}

function DurChip({ ms }) {
  if (!ms && ms !== 0) return <Typography sx={{ fontSize: 11, color: '#6b7280' }}>—</Typography>;
  const color = ms < 300 ? '#10b981' : ms < 1000 ? '#f59e0b' : '#ef4444';
  return (
    <Chip size="small" label={fmtDuration(ms)}
      sx={{ bgcolor: `${color}18`, color, fontWeight: 600, fontSize: 10, height: 18 }} />
  );
}

// ─── Field label / value pair ─────────────────────────────────────────────────
function Field({ label, children, mono = false }) {
  const T = useT();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.3 }}>
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
        <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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

// ─── Log row ──────────────────────────────────────────────────────────────────
function LogRow({ log }) {
  const T       = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen(o => !o)}
        sx={{
          cursor: 'pointer',
          '& td': { borderColor: T.border, py: 1 },
          '&:hover': { bgcolor: `${T.glassBorder}40` },
          bgcolor: open ? `${'#0d9488'}06` : 'transparent',
        }}
      >
        {/* Method + Status stacked */}
        <TableCell sx={{ minWidth: 90, pl: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            <MethodChip method={log.method} />
            <StatusChip status={log.status} />
          </Box>
        </TableCell>

        {/* URI — show query string below */}
        <TableCell sx={{ minWidth: 180 }}>
          <Tooltip title={`${log.uri}${log.query ? '?' + log.query : ''}`} placement="top">
            <Typography sx={{ fontSize: 12, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', maxWidth: { xs: 160, sm: 260, md: 400 } }}>
              {log.uri}
            </Typography>
          </Tooltip>
          {log.query && (
            <Typography sx={{ fontSize: 10, color: T.textFaint, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: { xs: 160, sm: 260 } }}>
              ?{log.query}
            </Typography>
          )}
        </TableCell>

        {/* User — always shown */}
        <TableCell sx={{ minWidth: 110, maxWidth: 170 }}>
          <Tooltip title={log.username ?? ''}>
            <Typography sx={{ fontSize: 12, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {log.username ?? '—'}
            </Typography>
          </Tooltip>
        </TableCell>

        {/* Duration — always shown */}
        <TableCell sx={{ minWidth: 76, whiteSpace: 'nowrap' }}>
          <DurChip ms={log.duration} />
        </TableCell>

        {/* When */}
        <TableCell sx={{ minWidth: 72, whiteSpace: 'nowrap', pr: 1 }}>
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>{fmtAgo(log.timestamp)}</Typography>
        </TableCell>

        {/* Expand indicator */}
        <TableCell sx={{ width: 28, px: 0 }}>
          <IconButton size="small" sx={{ color: T.textFaint, p: 0.25 }}>
            {open ? <ExpandLessIcon sx={{ fontSize: 15 }} /> : <ExpandMoreIcon sx={{ fontSize: 15 }} />}
          </IconButton>
        </TableCell>
      </TableRow>

      {/* ── Expanded detail ── */}
      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? `1px solid ${T.border}` : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ bgcolor: `${T.glassBorder}25`, px: { xs: 1.5, sm: 3 }, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* Row 1: identity + timing */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Field label="User">{log.username}</Field>
                <Field label="IP">{log.ip}</Field>
                <Field label="Duration"><DurChip ms={log.duration} /></Field>
                <Field label="Status">
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                    <StatusChip status={log.status} />
                    <Typography sx={{ fontSize: 11, color: T.textFaint }}>{statusLabel(log.status)}</Typography>
                  </Box>
                </Field>
                <Field label="Timestamp">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                </Field>
                {log.requestId && (
                  <Field label="Request ID" mono>{log.requestId}</Field>
                )}
              </Box>

              {/* Row 2: full URI */}
              <Field label="Full URI" mono>
                {log.uri}{log.query ? `?${log.query}` : ''}
              </Field>

              {/* Row 3: user agent */}
              {log.userAgent && (
                <Field label="User Agent">{log.userAgent}</Field>
              )}

              {/* Request body (POST/PUT/PATCH) */}
              <CodeBlock label="Request Body" text={log.requestBody} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

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

// ─── Sortable header cell ─────────────────────────────────────────────────────
function SortTH({ children, field, sort, onSort, T, sx = {} }) {
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
          '& .MuiTableSortLabel-icon': { color: `${active ? '#0d9488' : T.textFaint} !important` },
          '&.Mui-active': { color: `${'#0d9488'} !important` },
        }}
      >
        {children}
      </TableSortLabel>
    </TableCell>
  );
}

// ─── ApiLogsFeed ──────────────────────────────────────────────────────────────
export default function ApiLogsFeed() {
  const T = useT();

  const [page,        setPage]        = useState(0);
  const [logs,        setLogs]        = useState([]);
  const [hasMore,     setHasMore]     = useState(true);
  const [total,       setTotal]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filters — separate draft (what user typed) vs applied (sent to API)
  const [draft,    setDraft]    = useState({ username: '', method: '', status: '', uri: '' });
  const [applied,  setApplied]  = useState({ username: '', method: '', status: '', uri: '' });
  const [sort,     setSort]     = useState({ field: 'timestamp', dir: 'desc' });

  // Debounce: auto-apply text fields after 600 ms of no typing
  const debounceRef = useRef(null);
  const debouncedApply = useCallback((newDraft) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setApplied(newDraft), 600);
  }, []);

  const updateDraft = (key, value) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (key === 'method') {
      // Dropdowns apply immediately
      setApplied(prev => ({ ...prev, method: value }));
    } else {
      debouncedApply(next);
    }
  };

  const clearFilters = () => {
    clearTimeout(debounceRef.current);
    const empty = { username: '', method: '', status: '', uri: '' };
    setDraft(empty);
    setApplied(empty);
  };

  const hasActiveFilters = Object.values(applied).some(Boolean);

  const handleSort = (field) => {
    setSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const doFetch = useCallback(async (pg = 0, append = false) => {
    const setter = pg === 0 ? setLoading : setLoadingMore;
    setter(true);
    setError('');
    try {
      const data = await fetchApiLogs({ page: pg, size: 50, ...applied, sortBy: sort.field, sortDir: sort.dir });
      setLogs(prev => append ? [...prev, ...data.content] : data.content);
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

  return (
    <Box>
      {/* ── Toolbar ── */}
      <Box sx={{ display: 'flex', gap: 1, p: { xs: 1.25, sm: 2 }, borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tooltip title={showFilters ? 'Hide filters' : 'Show filters'}>
          <IconButton size="small" onClick={() => setShowFilters(f => !f)}
            sx={{
              color: showFilters || hasActiveFilters ? '#0d9488' : T.textFaint,
              border: `1px solid ${T.border}`,
              bgcolor: showFilters || hasActiveFilters ? `${'#0d9488'}10` : 'transparent',
            }}>
            <FilterListIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {showFilters && (
          <>
            <TextField
              size="small" placeholder="Username / email" value={draft.username}
              onChange={e => updateDraft('username', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setApplied({ ...draft })}
              sx={{ width: { xs: 140, sm: 180 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 13, color: T.textFaint }} /></InputAdornment> }}
            />
            <TextField
              select size="small" label="Method" value={draft.method}
              onChange={e => updateDraft('method', e.target.value)}
              sx={{ minWidth: 95 }}>
              <MenuItem value=''>All</MenuItem>
              {HTTP_METHODS.map(m => (
                <MenuItem key={m} value={m}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <MethodChip method={m} />
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" placeholder="Status" value={draft.status}
              onChange={e => updateDraft('status', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setApplied({ ...draft })}
              sx={{ width: 88 }} />
            <TextField
              size="small" placeholder="URI contains…" value={draft.uri}
              onChange={e => updateDraft('uri', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setApplied({ ...draft })}
              sx={{ width: { xs: 130, sm: 200 } }} />
            {hasActiveFilters && (
              <Tooltip title="Clear filters">
                <IconButton size="small" onClick={clearFilters} sx={{ color: '#ef4444' }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}

        {total !== null && (
          <Typography sx={{ fontSize: 11, color: T.textFaint, ml: 'auto' }}>
            {total.toLocaleString()} entries
          </Typography>
        )}
        <Button size="small" onClick={() => doFetch(0, false)} sx={{ color: '#0d9488', fontSize: 11 }}>
          Refresh
        </Button>
      </Box>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <Box sx={{ display: 'flex', gap: 0.75, px: 2, py: 1, flexWrap: 'wrap', borderBottom: `1px solid ${T.border}` }}>
          {Object.entries(applied).filter(([, v]) => v).map(([k, v]) => (
            <Chip
              key={k}
              size="small"
              label={`${k}: ${v}`}
              onDelete={() => { const next = { ...draft, [k]: '' }; setDraft(next); setApplied(next); }}
              sx={{ height: 20, fontSize: 11, bgcolor: `${'#0d9488'}15`, color: '#0d9488' }}
            />
          ))}
        </Box>
      )}

      {error && <Alert severity="error" sx={{ m: 2, borderRadius: 1.5 }}>{error}</Alert>}

      {/* ── Table ── */}
      <TableContainer sx={{ maxHeight: { xs: 440, md: 580 }, overflowY: 'auto', overflowX: 'auto' }}>
        <Table size="small" stickyHeader sx={{ minWidth: 620 }}>
          <TableHead>
            <TableRow>
              <SortTH field="method"    sort={sort} onSort={handleSort} T={T} sx={{ minWidth: 90 }}>Method</SortTH>
              <SortTH field="uri"       sort={sort} onSort={handleSort} T={T} sx={{ minWidth: 180 }}>URI</SortTH>
              <SortTH field="userEmail" sort={sort} onSort={handleSort} T={T} sx={{ minWidth: 110 }}>User</SortTH>
              <SortTH field="duration"  sort={sort} onSort={handleSort} T={T} sx={{ minWidth: 76 }}>Duration</SortTH>
              <SortTH field="timestamp" sort={sort} onSort={handleSort} T={T} sx={{ minWidth: 72 }}>When</SortTH>
              <TableCell sx={{ bgcolor: T.glass, borderColor: T.border, width: 28 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            ))}
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 7, color: T.textFaint, fontSize: 13 }}>
                  {hasActiveFilters ? 'No entries match the current filters' : 'No log entries found'}
                </TableCell>
              </TableRow>
            )}
            {logs.map((log, i) => <LogRow key={log.id ?? i} log={log} />)}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Load more */}
      {hasMore && !loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, borderTop: `1px solid ${T.border}` }}>
          <Button
            variant="outlined" size="small" onClick={() => doFetch(page + 1, true)}
            disabled={loadingMore}
            sx={{ color: '#0d9488', borderColor: '#0d9488', '&:hover': { bgcolor: `${'#0d9488'}10` } }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
