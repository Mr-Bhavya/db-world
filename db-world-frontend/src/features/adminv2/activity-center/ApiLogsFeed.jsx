import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, TextField,
  MenuItem, Collapse, Skeleton, Button, Alert, InputAdornment,
} from '@mui/material';
import ExpandMoreIcon  from '@mui/icons-material/ExpandMore';
import ExpandLessIcon  from '@mui/icons-material/ExpandLess';
import FilterListIcon  from '@mui/icons-material/FilterList';
import SearchIcon      from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useT }        from '@shared/theme/ThemeContext';
import {
  fetchApiLogs, HTTP_METHODS, METHOD_COLOR, fmtAgo, fmtDuration, statusColor,
} from './activityApi';

// ─── Method chip ──────────────────────────────────────────────────────────────
function MethodChip({ method }) {
  const color = METHOD_COLOR[method] ?? '#6b7280';
  return (
    <Chip size="small" label={method}
      sx={{ bgcolor: `${color}18`, color, fontWeight: 800, fontSize: 10, height: 20, minWidth: 44 }} />
  );
}

// ─── Status chip ──────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const color = statusColor(status);
  return (
    <Chip size="small" label={status}
      sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: 10, height: 20 }} />
  );
}

// ─── Duration chip ────────────────────────────────────────────────────────────
function DurationChip({ ms }) {
  if (!ms) return null;
  const color = ms < 300 ? '#10b981' : ms < 1000 ? '#f59e0b' : '#ef4444';
  return (
    <Chip size="small" label={fmtDuration(ms)}
      sx={{ bgcolor: `${color}18`, color, fontWeight: 600, fontSize: 10, height: 18, ml: 0.5 }} />
  );
}

// ─── Log row ──────────────────────────────────────────────────────────────────
function LogRow({ log }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const hasBody = log.requestBody || log.query || log.userAgent;

  const copy = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <>
      <TableRow
        hover
        onClick={() => hasBody && setOpen(o => !o)}
        sx={{
          cursor: hasBody ? 'pointer' : 'default',
          '& td': { borderColor: T.border, py: 1 },
          '&:hover': { bgcolor: `${T.glassBorder}40` },
        }}
      >
        {/* Method + Status */}
        <TableCell sx={{ width: 130, pl: 2 }}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <MethodChip method={log.method} />
            <StatusChip status={log.status} />
          </Box>
        </TableCell>

        {/* URI */}
        <TableCell sx={{ maxWidth: { xs: 150, sm: 260, md: 400 } }}>
          <Tooltip title={`${log.uri}${log.query ? '?' + log.query : ''}`} placement="top">
            <Typography sx={{ fontSize: 12, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              {log.uri}
            </Typography>
          </Tooltip>
          {log.query && (
            <Typography sx={{ fontSize: 10, color: T.textFaint, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ?{log.query}
            </Typography>
          )}
        </TableCell>

        {/* User */}
        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
          <Typography sx={{ fontSize: 12, color: T.textMuted }}>{log.username ?? '—'}</Typography>
        </TableCell>

        {/* Duration */}
        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, whiteSpace: 'nowrap' }}>
          <DurationChip ms={log.duration} />
        </TableCell>

        {/* Time */}
        <TableCell sx={{ whiteSpace: 'nowrap', pr: 2 }}>
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>{fmtAgo(log.timestamp)}</Typography>
        </TableCell>

        <TableCell sx={{ width: 32, pr: 0.5 }}>
          {hasBody && (
            <IconButton size="small" sx={{ color: T.textFaint, p: 0.25 }}>
              {open ? <ExpandLessIcon sx={{ fontSize: 15 }} /> : <ExpandMoreIcon sx={{ fontSize: 15 }} />}
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      {hasBody && (
        <TableRow>
          <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? `1px solid ${T.border}` : 'none' }}>
            <Collapse in={open} timeout="auto">
              <Box sx={{ bgcolor: `${T.glassBorder}30`, px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Row 1: IP + User Agent */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {log.ip && (
                    <Box>
                      <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>IP</Typography>
                      <Typography sx={{ fontSize: 12, color: T.text }}>{log.ip}</Typography>
                    </Box>
                  )}
                  {log.requestId && (
                    <Box>
                      <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>Request ID</Typography>
                      <Typography sx={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>{log.requestId}</Typography>
                    </Box>
                  )}
                  {log.userAgent && (
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>User Agent</Typography>
                      <Typography sx={{ fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                        {log.userAgent}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Request body */}
                {log.requestBody && log.requestBody !== 'null' && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Request Body</Typography>
                      <IconButton size="small" onClick={e => { e.stopPropagation(); copy(log.requestBody); }}
                        sx={{ color: T.textFaint, p: 0.25 }}>
                        <ContentCopyIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Box>
                    <Box sx={{ bgcolor: T.bg, border: `1px solid ${T.border}`, borderRadius: 1, p: 1, maxHeight: 120, overflowY: 'auto' }}>
                      <Typography component="pre" sx={{ fontSize: 11, color: T.text, fontFamily: 'monospace', m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {(() => { try { return JSON.stringify(JSON.parse(log.requestBody), null, 2); } catch { return log.requestBody; } })()}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── ApiLogsFeed main export ──────────────────────────────────────────────────
export default function ApiLogsFeed() {
  const T = useT();

  const [page,     setPage]     = useState(0);
  const [logs,     setLogs]     = useState([]);
  const [hasMore,  setHasMore]  = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [loadMore, setLoadMore] = useState(false);
  const [error,    setError]    = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({ username: '', method: '', status: '', uri: '' });

  const doFetch = useCallback(async (pg = 0, append = false) => {
    const setter = pg === 0 ? setLoading : setLoadMore;
    setter(true);
    setError('');
    try {
      const data = await fetchApiLogs({ page: pg, size: 50, ...filters });
      setLogs(prev => append ? [...prev, ...data.content] : data.content);
      setHasMore(!data.last);
      setPage(pg);
    } catch {
      setError('Failed to load API logs. Make sure the backend endpoint is available.');
    } finally {
      setter(false);
    }
  }, [filters]);

  // Initial load + on filter change
  React.useEffect(() => { setLogs([]); doFetch(0, false); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const TH = ({ children, hide }) => (
    <TableCell sx={{
      fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
      color: T.textFaint, bgcolor: T.glass, borderColor: T.border,
      display: hide ? { xs: 'none', [hide]: 'table-cell' } : undefined,
    }}>
      {children}
    </TableCell>
  );

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, p: 2, borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap', alignItems: 'center' }}>
        <IconButton size="small" onClick={() => setShowFilters(f => !f)}
          sx={{ color: showFilters ? '#0d9488' : T.textFaint, border: `1px solid ${T.border}`, bgcolor: showFilters ? `${'#0d9488'}10` : 'transparent' }}>
          <FilterListIcon fontSize="small" />
        </IconButton>

        {showFilters && (
          <>
            <TextField size="small" placeholder="Username / email" value={filters.username}
              onChange={e => setFilters(f => ({ ...f, username: e.target.value }))}
              sx={{ width: 180 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: T.textFaint }} /></InputAdornment> }}
            />
            <TextField select size="small" label="Method" value={filters.method}
              onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}
              sx={{ minWidth: 100 }}>
              <MenuItem value=''>All</MenuItem>
              {HTTP_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
            <TextField size="small" placeholder="Status (e.g. 200)" value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              sx={{ width: 130 }} />
            <TextField size="small" placeholder="URI filter" value={filters.uri}
              onChange={e => setFilters(f => ({ ...f, uri: e.target.value }))}
              sx={{ width: 200 }} />
            <Button size="small" onClick={() => setFilters({ username: '', method: '', status: '', uri: '' })}
              sx={{ color: T.textFaint, fontSize: 11 }}>
              Clear
            </Button>
          </>
        )}

        <Button size="small" onClick={() => doFetch(0, false)} sx={{ color: '#0d9488', ml: 'auto', fontSize: 12 }}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ m: 2, borderRadius: 1.5 }}>{error}</Alert>}

      <TableContainer sx={{ maxHeight: { xs: 440, md: 600 }, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TH>Method · Status</TH>
              <TH>URI</TH>
              <TH hide="md">User</TH>
              <TH hide="sm">Duration</TH>
              <TH>When</TH>
              <TableCell sx={{ bgcolor: T.glass, borderColor: T.border }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
            ))}
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: T.textFaint, fontSize: 13 }}>
                  No log entries found
                </TableCell>
              </TableRow>
            )}
            {logs.map((log, i) => <LogRow key={log.id ?? i} log={log} />)}
          </TableBody>
        </Table>
      </TableContainer>

      {hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, borderTop: `1px solid ${T.border}` }}>
          <Button
            variant="outlined" size="small" onClick={() => doFetch(page + 1, true)}
            disabled={loadMore}
            sx={{ color: '#0d9488', borderColor: '#0d9488', '&:hover': { bgcolor: `${'#0d9488'}10` } }}
          >
            {loadMore ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
