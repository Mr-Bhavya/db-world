import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip,
  IconButton, Tooltip, CircularProgress, LinearProgress,
  TextField, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Checkbox, Dialog,
  DialogTitle, DialogContent, DialogActions, InputAdornment, Divider,
} from '@mui/material';
import {
  Storage, Refresh, Add, Delete, DeleteSweep, Search,
  AccessTime, Memory, People, Speed, ContentCopy, Close, Save,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import {
  getRedisInfo,
  getRedisKeys,
  getRedisKey,
  setRedisKey,
  updateRedisKey,
  updateRedisTtl,
  deleteRedisKey,
  deleteRedisKeys,
  flushRedisKeys,
} from '../api/adminApi';

/* ── Type metadata ───────────────────────────────────────────── */

const TYPE_META = {
  string: { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'STR'  },
  hash:   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'HASH' },
  list:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'LIST' },
  set:    { color: '#ec4899', bg: 'rgba(236,72,153,0.12)', label: 'SET'  },
  zset:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: 'ZSET' },
  none:   { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', label: 'NONE' },
};

/* ── Helpers ─────────────────────────────────────────────────── */

const fmtTtl = (ttl) => {
  if (ttl === -1) return '∞ no expiry';
  if (ttl <= 0)   return '—';
  if (ttl < 60)   return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
  return `${Math.floor(ttl / 86400)}d`;
};

const fmtUptime = (secs) => {
  if (!secs) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

/* ── Stat card ───────────────────────────────────────────────── */

function StatCard({ label, value, icon, color }) {
  const T = useT();
  return (
    <Card sx={{ border: `1px solid ${color}22`, borderRadius: 2, bgcolor: T.glass }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          <Typography sx={{ fontSize: '0.7rem', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: T.text, lineHeight: 1, fontFamily: 'monospace' }}>
          {value ?? '—'}
        </Typography>
      </CardContent>
    </Card>
  );
}

/* ── Type chip ───────────────────────────────────────────────── */

function TypeChip({ type }) {
  const meta = TYPE_META[type] ?? TYPE_META.none;
  return (
    <Chip
      label={meta.label}
      size="small"
      sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: '0.6rem', height: 18 }}
    />
  );
}

/* ── Main page ───────────────────────────────────────────────── */

export default function RedisCachePage() {
  const T = useT();
  const queryClient = useQueryClient();

  /* ── Key browser state ── */
  const [pattern, setPattern]           = useState('*');
  const [page, setPage]                 = useState(0);
  const [rowsPerPage, setRowsPerPage]   = useState(20);
  const [selected, setSelected]         = useState(new Set());

  /* ── Editor state ── */
  const [activeKey, setActiveKey]   = useState(null);   // key being viewed/edited
  const [isNew, setIsNew]           = useState(false);   // true = new key form
  const [editKey, setEditKey]       = useState('');
  const [editValue, setEditValue]   = useState('');
  const [editTtl, setEditTtl]       = useState('');

  /* ── Flush dialog ── */
  const [flushOpen, setFlushOpen]       = useState(false);
  const [flushPattern, setFlushPattern] = useState('*');

  /* ── Queries ── */

  const { data: info, isFetching: infoLoading } = useQuery({
    queryKey: ['redis-info'],
    queryFn: getRedisInfo,
    refetchInterval: 30_000,
  });

  const { data: keysPage, isFetching: keysLoading } = useQuery({
    queryKey: ['redis-keys', pattern, page, rowsPerPage],
    queryFn:  () => getRedisKeys({ pattern, page, size: rowsPerPage }),
    keepPreviousData: true,
  });

  const { data: keyDetail, isFetching: detailLoading } = useQuery({
    queryKey: ['redis-key-detail', activeKey],
    queryFn:  () => getRedisKey(activeKey),
    enabled:  !!activeKey && !isNew,
  });

  const keys  = keysPage?.keys ?? [];
  const total = keysPage?.total ?? 0;

  /* ── Populate editor when detail loads ── */
  useEffect(() => {
    if (keyDetail) {
      setEditKey(keyDetail.key);
      setEditValue(keyDetail.value ?? '');
      setEditTtl(keyDetail.ttl > 0 ? String(keyDetail.ttl) : '');
    }
  }, [keyDetail]);

  /* ── Mutations ── */

  const invalidateKeys = () => {
    queryClient.invalidateQueries({ queryKey: ['redis-keys'] });
    queryClient.invalidateQueries({ queryKey: ['redis-info'] });
  };

  const setMutation = useMutation({
    mutationFn: setRedisKey,
    onSuccess: () => {
      notify.success('Key set successfully');
      invalidateKeys();
      setIsNew(false);
      setActiveKey(editKey);
    },
    onError: () => notify.error('Failed to set key'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }) => updateRedisKey(key, value),
    onSuccess: () => {
      notify.success('Value updated');
      queryClient.invalidateQueries({ queryKey: ['redis-key-detail', activeKey] });
    },
    onError: () => notify.error('Update failed'),
  });

  const ttlMutation = useMutation({
    mutationFn: ({ key, ttlSeconds }) => updateRedisTtl(key, ttlSeconds),
    onSuccess: () => {
      notify.success('TTL updated');
      queryClient.invalidateQueries({ queryKey: ['redis-key-detail', activeKey] });
      queryClient.invalidateQueries({ queryKey: ['redis-keys'] });
    },
    onError: () => notify.error('TTL update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRedisKey,
    onSuccess: () => {
      notify.success('Key deleted');
      setActiveKey(null);
      setEditKey(''); setEditValue(''); setEditTtl('');
      invalidateKeys();
    },
    onError: () => notify.error('Delete failed'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: deleteRedisKeys,
    onSuccess: (data) => {
      notify.success(`Deleted ${data?.data?.deleted ?? selected.size} keys`);
      setSelected(new Set());
      invalidateKeys();
    },
    onError: () => notify.error('Bulk delete failed'),
  });

  const flushMutation = useMutation({
    mutationFn: flushRedisKeys,
    onSuccess: (data) => {
      notify.success(`Flushed ${data?.data?.deleted ?? 0} keys`);
      setFlushOpen(false);
      invalidateKeys();
    },
    onError: () => notify.error('Flush failed'),
  });

  /* ── Helpers ── */

  const handlePatternChange = (e) => {
    setPattern(e.target.value);
    setPage(0);
    setSelected(new Set());
  };

  const handleKeyClick = (key) => {
    setActiveKey(key);
    setIsNew(false);
  };

  const handleNewKey = () => {
    setActiveKey(null);
    setEditKey('');
    setEditValue('');
    setEditTtl('');
    setIsNew(true);
  };

  const toggleSelect = (key) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === keys.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(keys.map(k => k.key)));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => notify.info('Copied'));
  };

  const isBusy = setMutation.isPending || updateMutation.isPending ||
                 deleteMutation.isPending || ttlMutation.isPending;

  /* ── Render ── */

  return (
    <Box sx={{ p: 3 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Storage sx={{ color: T.teal, fontSize: 28 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: T.text }}>
            Redis Cache
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>
            Browse, inspect and manage Redis keys in real-time
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Add />}
          onClick={handleNewKey}
          sx={{ borderColor: T.border, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal } }}
        >
          New Key
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DeleteSweep />}
          onClick={() => { setFlushPattern(pattern); setFlushOpen(true); }}
          sx={{ borderColor: T.border, color: T.textMuted, '&:hover': { borderColor: '#ef4444', color: '#ef4444' } }}
        >
          Flush Pattern
        </Button>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={() => { invalidateKeys(); queryClient.invalidateQueries({ queryKey: ['redis-info'] }); }}
            disabled={keysLoading || infoLoading}
            sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}
          >
            {keysLoading || infoLoading
              ? <CircularProgress size={16} />
              : <Refresh sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Memory Used',  value: info?.usedMemoryHuman,              color: T.teal,    icon: <Memory />  },
          { label: 'Total Keys',   value: info?.totalKeys?.toLocaleString(),   color: '#8b5cf6', icon: <Storage /> },
          { label: 'Clients',      value: info?.connectedClients,              color: '#f59e0b', icon: <People />  },
          { label: 'Uptime',       value: fmtUptime(info?.uptimeSeconds),      color: '#3b82f6', icon: <AccessTime /> },
          { label: 'Hit Rate',     value: info ? `${info.hitRatePercent}%` : null, color: '#10b981', icon: <Speed /> },
        ].map((s) => (
          <Grid item xs={6} sm={4} md={2.4} key={s.label}>
            <StatCard {...s} />
          </Grid>
        ))}
      </Grid>

      {/* Main content: Key Browser + Editor */}
      <Grid container spacing={2}>

        {/* ── Left: Key Browser ── */}
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ border: `1px solid ${T.border}`, borderRadius: 2, bgcolor: T.glass, overflow: 'hidden' }}>

            {/* Pattern search */}
            <Box sx={{ p: 2, borderBottom: `1px solid ${T.border}` }}>
              <TextField
                size="small"
                fullWidth
                value={pattern}
                onChange={handlePatternChange}
                placeholder="Key pattern (e.g. rail:*, interaction:*)"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 16, color: T.textMuted }} />
                    </InputAdornment>
                  ),
                  sx: { color: T.text, bgcolor: T.inputBg, fontSize: '0.82rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border } },
                }}
              />
            </Box>

            {keysLoading && (
              <LinearProgress sx={{ bgcolor: `${T.teal}22`, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
            )}

            {/* Bulk toolbar */}
            {selected.size > 0 && (
              <Box sx={{ px: 2, py: 1, bgcolor: `${T.teal}11`, borderBottom: `1px solid ${T.border}`,
                         display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '0.78rem', color: T.teal, fontWeight: 600 }}>
                  {selected.size} selected
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  startIcon={bulkDeleteMutation.isPending ? <CircularProgress size={12} color="inherit" /> : <Delete />}
                  disabled={bulkDeleteMutation.isPending}
                  onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
                  sx={{ fontSize: '0.72rem', py: 0.25 }}
                >
                  Delete {selected.size}
                </Button>
              </Box>
            )}

            {/* Keys table */}
            <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)', minHeight: 200 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: T.adminBg, color: T.textMuted, fontSize: '0.68rem',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', borderColor: T.border, py: 1 } }}>
                    <TableCell padding="checkbox" sx={{ width: 36 }}>
                      <Checkbox
                        size="small"
                        indeterminate={selected.size > 0 && selected.size < keys.length}
                        checked={keys.length > 0 && selected.size === keys.length}
                        onChange={toggleSelectAll}
                        sx={{ color: T.textMuted, '&.Mui-checked': { color: T.teal } }}
                      />
                    </TableCell>
                    <TableCell>Key</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>TTL</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {keys.map((row) => (
                    <TableRow
                      key={row.key}
                      onClick={() => handleKeyClick(row.key)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: activeKey === row.key ? `${T.teal}18` : 'transparent',
                        '& td': { borderColor: T.border, py: 0.75 },
                        '&:hover': { bgcolor: activeKey === row.key ? `${T.teal}22` : T.glassHover },
                      }}
                    >
                      <TableCell padding="checkbox" onClick={(e) => { e.stopPropagation(); toggleSelect(row.key); }}>
                        <Checkbox
                          size="small"
                          checked={selected.has(row.key)}
                          sx={{ color: T.textMuted, '&.Mui-checked': { color: T.teal } }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: T.text,
                            maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {row.key}
                        </Typography>
                      </TableCell>
                      <TableCell><TypeChip type={row.type} /></TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.68rem', color: row.ttl === -1 ? '#10b981' : T.textFaint, fontFamily: 'monospace' }}>
                          {fmtTtl(row.ttl)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!keysLoading && keys.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 5, color: T.textMuted,
                        borderBottom: 'none', fontSize: '0.85rem' }}>
                        No keys match this pattern
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]}
              sx={{
                color: T.textMuted, borderTop: `1px solid ${T.border}`, fontSize: '0.75rem',
                '& .MuiIconButton-root': { color: T.textMuted },
                '& .MuiSelect-icon': { color: T.textMuted },
              }}
            />
          </Paper>
        </Grid>

        {/* ── Right: Key Editor ── */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ border: `1px solid ${T.border}`, borderRadius: 2, bgcolor: T.glass, overflow: 'hidden' }}>

            {/* Editor header */}
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Storage sx={{ fontSize: 16, color: T.teal }} />
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: T.text, flex: 1 }}>
                {isNew ? 'New Key' : activeKey ? 'Key Editor' : 'Select a key to view'}
              </Typography>
              {activeKey && !isNew && (
                <>
                  <TypeChip type={keyDetail?.type ?? 'none'} />
                  <Tooltip title="Copy key name">
                    <IconButton size="small" onClick={() => copyToClipboard(activeKey)}
                      sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                      <ContentCopy sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Close">
                    <IconButton size="small" onClick={() => { setActiveKey(null); setIsNew(false); }}
                      sx={{ color: T.textFaint, '&:hover': { color: '#ef4444' } }}>
                      <Close sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>

            {/* Editor body */}
            {(isNew || activeKey) ? (
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

                {detailLoading && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} sx={{ color: T.teal }} />
                  </Box>
                )}

                {!detailLoading && (
                  <>
                    {/* Key name */}
                    <TextField
                      label="Key"
                      size="small"
                      fullWidth
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                      disabled={!isNew}
                      sx={editorInputSx(T)}
                    />

                    {/* TTL row */}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <TextField
                        label="TTL (seconds)"
                        size="small"
                        type="number"
                        value={editTtl}
                        onChange={(e) => setEditTtl(e.target.value)}
                        placeholder="0 = no expiry"
                        sx={{ ...editorInputSx(T), minWidth: 160 }}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><AccessTime sx={{ fontSize: 14, color: T.textMuted }} /></InputAdornment>,
                        }}
                      />
                      {activeKey && !isNew && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>
                            Current: <span style={{ color: keyDetail?.ttl === -1 ? '#10b981' : T.textMuted, fontFamily: 'monospace' }}>
                              {fmtTtl(keyDetail?.ttl ?? -1)}
                            </span>
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => ttlMutation.mutate({ key: activeKey, ttlSeconds: editTtl ? Number(editTtl) : null })}
                            disabled={ttlMutation.isPending}
                            sx={{ fontSize: '0.7rem', py: 0.4, borderColor: T.border, color: T.textMuted,
                              '&:hover': { borderColor: T.teal, color: T.teal } }}
                          >
                            {ttlMutation.isPending ? <CircularProgress size={10} /> : 'Apply TTL'}
                          </Button>
                        </Box>
                      )}
                    </Box>

                    {/* Value */}
                    <TextField
                      label="Value"
                      size="small"
                      fullWidth
                      multiline
                      rows={14}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter value..."
                      sx={{
                        ...editorInputSx(T),
                        '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.6 },
                      }}
                    />

                    <Divider sx={{ borderColor: T.border }} />

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      {isNew ? (
                        <Button
                          variant="contained"
                          startIcon={isBusy ? <CircularProgress size={14} color="inherit" /> : <Save />}
                          disabled={isBusy || !editKey}
                          onClick={() => setMutation.mutate({ key: editKey, value: editValue, ttlSeconds: editTtl ? Number(editTtl) : null })}
                          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontSize: '0.8rem' }}
                        >
                          Set Key
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="contained"
                            startIcon={updateMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <Save />}
                            disabled={isBusy}
                            onClick={() => updateMutation.mutate({ key: activeKey, value: editValue })}
                            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontSize: '0.8rem' }}
                          >
                            Update Value
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={deleteMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <Delete />}
                            disabled={isBusy}
                            onClick={() => deleteMutation.mutate(activeKey)}
                            sx={{ fontSize: '0.8rem' }}
                          >
                            Delete Key
                          </Button>
                        </>
                      )}
                      <Button
                        variant="text"
                        onClick={() => { setActiveKey(null); setIsNew(false); }}
                        sx={{ color: T.textMuted, fontSize: '0.8rem' }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                py: 10, gap: 1.5, color: T.textMuted }}>
                <Storage sx={{ fontSize: 40, opacity: 0.3 }} />
                <Typography sx={{ fontSize: '0.875rem' }}>Select a key from the list to inspect</Typography>
                <Button size="small" startIcon={<Add />} onClick={handleNewKey}
                  sx={{ color: T.teal, borderColor: T.teal, mt: 1 }} variant="outlined">
                  Create New Key
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Flush dialog */}
      <Dialog
        open={flushOpen}
        onClose={() => setFlushOpen(false)}
        PaperProps={{ sx: { bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, minWidth: 420 } }}
      >
        <DialogTitle sx={{ color: '#ef4444', fontSize: '1rem', fontWeight: 700, pb: 1 }}>
          Flush Keys by Pattern
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.82rem', color: T.textMuted, mb: 2 }}>
            All keys matching the pattern will be permanently deleted. This cannot be undone.
          </Typography>
          <TextField
            label="Pattern"
            size="small"
            fullWidth
            value={flushPattern}
            onChange={(e) => setFlushPattern(e.target.value)}
            sx={editorInputSx(T)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 14, color: T.textMuted }} /></InputAdornment>,
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setFlushOpen(false)} sx={{ color: T.textMuted, fontSize: '0.8rem' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={flushMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <DeleteSweep />}
            disabled={flushMutation.isPending || !flushPattern}
            onClick={() => flushMutation.mutate({ pattern: flushPattern, confirm: true })}
            sx={{ fontSize: '0.8rem' }}
          >
            Flush
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ── Shared input sx ─────────────────────────────────────────── */

const editorInputSx = (T) => ({
  '& .MuiOutlinedInput-root': {
    color: T.text,
    bgcolor: T.inputBg,
    '& fieldset': { borderColor: T.border },
    '&:hover fieldset': { borderColor: T.teal },
    '&.Mui-focused fieldset': { borderColor: T.teal },
  },
  '& .MuiInputLabel-root': { color: T.textMuted },
  '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: T.textFaint },
});
