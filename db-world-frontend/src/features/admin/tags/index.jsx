import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box, Typography, Button, Chip, CircularProgress, LinearProgress,
  IconButton, Tooltip, Select, MenuItem, Skeleton, useTheme, useMediaQuery,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Checkbox,
  Alert, Tabs, Tab, Switch, FormControl, InputLabel, Divider,
} from '@mui/material';
import RefreshIcon            from '@mui/icons-material/Refresh';
import SyncIcon               from '@mui/icons-material/Sync';
import AddIcon                from '@mui/icons-material/Add';
import DeleteIcon             from '@mui/icons-material/Delete';
import LockIcon               from '@mui/icons-material/Lock';
import CheckBoxIcon           from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import ArrowBackIcon          from '@mui/icons-material/ArrowBack';
import FirstPageIcon          from '@mui/icons-material/FirstPage';
import LastPageIcon           from '@mui/icons-material/LastPage';
import ChevronLeftIcon        from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon       from '@mui/icons-material/ChevronRight';
import EditIcon               from '@mui/icons-material/Edit';
import PlaylistPlayIcon       from '@mui/icons-material/PlaylistPlay';
import DragIndicatorIcon      from '@mui/icons-material/DragIndicator';
import CloseIcon              from '@mui/icons-material/Close';
import TuneIcon               from '@mui/icons-material/Tune';
import SettingsIcon           from '@mui/icons-material/Settings';
import { Reorder, useDragControls, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT, getSelectMenuProps } from '@shared/theme';
import {
  getTagSummary, getRecordsByTag, getRecordsTable,
  bulkAddTag, bulkRemoveTag, recalculateTag, recalculateAllTags,
  getRails, createRail, updateRail, deleteRail, reorderRails,
  getTagDefinitions, updateTagDefinition, getRailMetadata,
} from '../api/adminApi';
import { TAG_COLORS, TAG_LABELS, AUTO_TAGS, ALL_TAGS } from '../records/tagConstants';

const PAGE_TYPES  = ['HOME', 'MOVIES', 'SERIES'];
const RULE_TYPES  = [
  { value: 'tag',       label: 'Tag'              },
  { value: 'genre',     label: 'Genre'            },
  { value: 'language',  label: 'Language'         },
  { value: 'filter',    label: 'Filter'           },
  { value: 'manual',    label: 'Manual'           },
  { value: 'watchlist', label: 'My List (Watchlist)' },
];
const BLANK_RULE = { type: 'tag', tag: 'TRENDING', genreId: null, languages: [], field: '', value: '', recordType: '', sort: 'popularity', direction: 'DESC' };
const BLANK_RAIL = { title: '', priority: 0, limitSize: 20, infiniteScroll: true, active: true, pageType: 'HOME', rule: { ...BLANK_RULE } };

// ── Pagination bar ────────────────────────────────────────────────────────────
function PaginationBar({ page, totalPages, totalElements, pageSize, onPage, onPageSize, isFetching }) {
  const T     = useT();
  const start = totalElements === 0 ? 0 : page * pageSize + 1;
  const end   = Math.min((page + 1) * pageSize, totalElements);
  const _pageButtons = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const set    = new Set([0, totalPages - 1, page, page - 1, page + 1].filter(p => p >= 0 && p < totalPages));
    const sorted = [...set].sort((a, b) => a - b);
    const result = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
      result.push(p);
    });
    return result;
  }, [page, totalPages]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: { xs: 0.5, sm: 1 },
      px: { xs: 1.5, sm: 2.5 }, py: 1, borderTop: `1px solid ${T.border}`, bgcolor: T.adminBg, flexShrink: 0 }}>
      <Typography sx={{ fontSize: 12, color: T.textMuted }}>{start}–{end} of {totalElements}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: T.textFaint }}>per page</Typography>
        <Select value={pageSize} size="small"
          onChange={e => { onPageSize(Number(e.target.value)); onPage(0); }}
          sx={{ height: 28, fontSize: 11, color: T.textPrimary,
            '.MuiOutlinedInput-notchedOutline': { borderColor: T.border }, bgcolor: T.inputBg,
            '.MuiSvgIcon-root': { color: T.textFaint } }}>
          {[10, 25, 50].map(n => <MenuItem key={n} value={n} sx={{ fontSize: 12 }}>{n}</MenuItem>)}
        </Select>
      </Box>
      <Box sx={{ flex: 1 }} />
      {isFetching && <CircularProgress size={14} sx={{ color: T.teal }} />}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {[
          { icon: <FirstPageIcon sx={{ fontSize: 18 }} />, disabled: page === 0,              onClick: () => onPage(0),            title: 'First' },
          { icon: <ChevronLeftIcon sx={{ fontSize: 18 }} />, disabled: page === 0,            onClick: () => onPage(page - 1),     title: 'Prev'  },
          { icon: <ChevronRightIcon sx={{ fontSize: 18 }} />, disabled: page >= totalPages-1, onClick: () => onPage(page + 1),     title: 'Next'  },
          { icon: <LastPageIcon sx={{ fontSize: 18 }} />, disabled: page >= totalPages-1,     onClick: () => onPage(totalPages-1), title: 'Last'  },
        ].map(({ icon, disabled, onClick, title }) => (
          <Tooltip key={title} title={title}>
            <span>
              <IconButton size="small" disabled={disabled} onClick={onClick}
                sx={{ color: T.textFaint, '&:not(:disabled):hover': { color: T.teal, bgcolor: T.tealBg } }}>
                {icon}
              </IconButton>
            </span>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}

// ── Tag summary card ──────────────────────────────────────────────────────────
function TagCard({ summary, selected, onClick, recalculating, onRecalc }) {
  const T     = useT();
  const color = TAG_COLORS[summary.tagType] ?? T.teal;
  const label = TAG_LABELS[summary.tagType] ?? summary.tagType;
  return (
    <Box onClick={onClick}
      sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, border: `1px solid ${selected ? color : T.glassBorder}`,
        bgcolor: selected ? `${color}12` : T.glass, cursor: 'pointer', transition: 'all .15s',
        '&:hover': { borderColor: color, bgcolor: `${color}10` },
        display: 'flex', flexDirection: 'column', gap: 1, position: 'relative', minHeight: 90 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: { xs: 12, sm: 13 }, fontWeight: 700, color: T.textPrimary }}>{label}</Typography>
          </Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{summary.count}</Typography>
          <Typography sx={{ fontSize: 10, color: T.textFaint }}>records</Typography>
        </Box>
        <Chip label={summary.automatic ? 'AUTO' : 'MANUAL'} size="small"
          icon={summary.automatic ? <LockIcon sx={{ fontSize: '10px !important' }} /> : undefined}
          sx={{ height: 18, fontSize: 9, fontWeight: 700,
            bgcolor: summary.automatic ? `${T.teal}18` : `${T.success}18`,
            color: summary.automatic ? T.teal : T.success,
            border: `1px solid ${summary.automatic ? T.teal : T.success}44`,
            '& .MuiChip-icon': { ml: '3px', color: `${T.teal} !important` } }} />
      </Box>
      {summary.automatic && (
        <Tooltip title={`Recalculate ${label}`}>
          <IconButton size="small" onClick={e => { e.stopPropagation(); onRecalc(); }}
            disabled={recalculating}
            sx={{ position: 'absolute', bottom: 6, right: 6, width: 24, height: 24,
              color: T.textFaint, '&:hover': { color, bgcolor: `${color}18` } }}>
            {recalculating ? <CircularProgress size={12} color="inherit" /> : <SyncIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ── Bulk add dialog ───────────────────────────────────────────────────────────
function BulkAddDialog({ tagType, open, onClose, onDone }) {
  const T                       = useT();
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(0);
  const [selected, setSelected] = useState([]);
  const [priority, setPriority] = useState(50);
  const { enqueueSnackbar }     = useSnackbar();
  const qc                      = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ['tagBulkSearch', search, page],
    queryFn:  () => getRecordsTable({ name: search || undefined, page, size: 10 }),
    enabled: open,
    placeholderData: prev => prev,
  });
  const rows = data?.content ?? [];

  const { mutate: doAdd, isPending: adding } = useMutation({
    mutationFn: () => bulkAddTag(tagType, selected, priority),
    onSuccess: (res) => {
      enqueueSnackbar(`Added tag to ${res.added} record(s)`, { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['tagRecords', tagType] });
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
      onDone();
    },
    onError: () => enqueueSnackbar('Bulk add failed', { variant: 'error' }),
  });

  const toggle = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const fieldSx = {
    '& .MuiOutlinedInput-root': { bgcolor: T.inputBg, color: T.textPrimary,
      '& fieldset': { borderColor: T.glassBorder }, '&:hover fieldset': { borderColor: T.teal } },
    '& .MuiInputBase-input::placeholder': { color: T.textFaint },
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
        Bulk Add — <Box component="span" sx={{ color: TAG_COLORS[tagType], fontWeight: 800 }}>{TAG_LABELS[tagType]}</Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <TextField placeholder="Search records…" size="small" fullWidth value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }} sx={fieldSx} />
        {isFetching && <LinearProgress sx={{ height: 2, bgcolor: T.tealBg, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />}
        <Box sx={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: .5,
          '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
          {rows.map(r => (
            <Box key={r.recordId} onClick={() => toggle(r.recordId)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, cursor: 'pointer',
                bgcolor: selected.includes(r.recordId) ? T.tealBg : 'transparent',
                border: `1px solid ${selected.includes(r.recordId) ? T.teal + '44' : T.glassBorder}`,
                '&:hover': { bgcolor: T.tealBg } }}>
              <Checkbox size="small" checked={selected.includes(r.recordId)}
                icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 16, color: T.textFaint }} />}
                checkedIcon={<CheckBoxIcon sx={{ fontSize: 16, color: T.teal }} />} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
                <Typography sx={{ fontSize: 10, color: T.textFaint }}>{r.type} · {r.year ?? '—'}</Typography>
              </Box>
            </Box>
          ))}
          {rows.length === 0 && !isFetching && (
            <Typography sx={{ fontSize: 12, color: T.textFaint, textAlign: 'center', py: 2 }}>No records found</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>Priority:</Typography>
          <TextField type="number" size="small" value={priority} onChange={e => setPriority(Number(e.target.value))}
            inputProps={{ min: 0, max: 999, step: 10 }}
            sx={{ width: 80, '& .MuiOutlinedInput-root': { bgcolor: T.inputBg, color: T.textPrimary,
              '& fieldset': { borderColor: T.glassBorder }, '&:hover fieldset': { borderColor: T.teal } } }} />
          <Typography sx={{ fontSize: 11, color: T.textMuted }}>{selected.length} selected</Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" disabled={selected.length === 0 || adding} onClick={() => doAdd()}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
          {adding ? <CircularProgress size={18} color="inherit" /> : `Add to ${selected.length} Record${selected.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Tag record table ──────────────────────────────────────────────────────────
function TagRecordTable({ tagType }) {
  const T        = useT();
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState([]);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const { enqueueSnackbar }     = useSnackbar();
  const qc                      = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tagRecords', tagType, page, pageSize],
    queryFn:  () => getRecordsByTag(tagType, { page, size: pageSize }),
    placeholderData: prev => prev,
  });
  const rows       = data?.content ?? [];
  const totalEl    = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const { mutate: doRemove, isPending: removing } = useMutation({
    mutationFn: (ids) => bulkRemoveTag(tagType, ids),
    onSuccess: (res) => {
      enqueueSnackbar(`Removed from ${res.removed} record(s)`, { variant: 'success' });
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['tagRecords', tagType] });
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
    },
    onError: () => enqueueSnackbar('Remove failed', { variant: 'error' }),
  });

  const isAuto      = AUTO_TAGS.has(tagType);
  const color       = TAG_COLORS[tagType];
  const allSelected = rows.length > 0 && rows.every(r => selected.includes(r.recordId));
  const toggleAll   = () => setSelected(allSelected ? [] : rows.map(r => r.recordId));
  const toggleOne   = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, mt: 2,
      border: `1px solid ${T.glassBorder}`, borderRadius: 2, overflow: 'hidden', bgcolor: T.glass }}>
      {/* Table toolbar */}
      <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color, flex: 1 }}>
          {TAG_LABELS[tagType]} · {totalEl} records
        </Typography>
        {!isAuto && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => setBulkAddOpen(true)}
            sx={{ fontSize: 11, color: T.teal, border: `1px solid ${T.teal}44`, '&:hover': { bgcolor: T.tealBg } }}>
            Add Records
          </Button>
        )}
        {selected.length > 0 && !isAuto && (
          <Button size="small" startIcon={removing ? <CircularProgress size={12} color="inherit" /> : <DeleteIcon />}
            disabled={removing} onClick={() => doRemove(selected)}
            sx={{ fontSize: 11, color: T.error, border: `1px solid ${T.error}44`, '&:hover': { bgcolor: T.errorBg } }}>
            Remove {selected.length}
          </Button>
        )}
        {isAuto && (
          <Chip label="Auto-managed" size="small" icon={<LockIcon sx={{ fontSize: '10px !important' }} />}
            sx={{ height: 20, fontSize: 10, color: T.textFaint, bgcolor: T.glass,
              border: `1px solid ${T.glassBorder}`, '& .MuiChip-icon': { color: `${T.textFaint} !important` } }} />
        )}
      </Box>

      {isFetching && !isLoading && (
        <LinearProgress sx={{ height: 2, flexShrink: 0, bgcolor: T.tealBg, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
      )}

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0,
        '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 3 } }}>
        {isLoading ? (
          <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: .5 }}>
            {[...Array(8)].map((_, i) => <Skeleton key={i} variant="rectangular" height={38} sx={{ borderRadius: 1, bgcolor: T.glass }} />)}
          </Box>
        ) : isMobile ? (
          <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {rows.map(r => (
              <Box key={r.recordId} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${T.glassBorder}`, bgcolor: T.adminBg }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.25 }}>
                      <Typography sx={{ fontSize: 10, color: T.textFaint }}>#{r.recordId}</Typography>
                      <Typography sx={{ fontSize: 10, color: T.textFaint }}>{r.type}</Typography>
                      {r.year && <Typography sx={{ fontSize: 10, color: T.textFaint }}>{r.year}</Typography>}
                    </Box>
                  </Box>
                  {!isAuto && (
                    <IconButton size="small" onClick={() => doRemove([r.recordId])}
                      sx={{ color: T.textFaint, '&:hover': { color: T.error, bgcolor: T.errorBg }, ml: 1 }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>
              </Box>
            ))}
            {rows.length === 0 && (
              <Typography sx={{ fontSize: 13, color: T.textFaint, textAlign: 'center', py: 3 }}>No records with this tag</Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Box sx={{ minWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: isAuto ? '48px 1fr 100px 80px 160px 160px' : '48px 48px 1fr 100px 80px 160px 160px',
                px: 2, py: 0.75, borderBottom: `1px solid ${T.border}`, bgcolor: T.adminBg }}>
                {!isAuto && (
                  <Checkbox size="small" checked={allSelected} indeterminate={selected.length > 0 && !allSelected}
                    onChange={toggleAll}
                    icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 16, color: T.textFaint }} />}
                    checkedIcon={<CheckBoxIcon sx={{ fontSize: 16, color: T.teal }} />}
                    indeterminateIcon={<CheckBoxIcon sx={{ fontSize: 16, color: T.teal }} />} />
                )}
                {['#', 'Name', 'Type', 'Year', 'Added', 'Updated'].map(h => (
                  <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: .5 }}>{h}</Typography>
                ))}
              </Box>
              {rows.map(r => (
                <Box key={r.recordId}
                  sx={{ display: 'grid', gridTemplateColumns: isAuto ? '48px 1fr 100px 80px 160px 160px' : '48px 48px 1fr 100px 80px 160px 160px',
                    px: 2, py: 1, borderBottom: `1px solid ${T.border}`, alignItems: 'center', '&:hover': { bgcolor: T.tealBg } }}>
                  {!isAuto && (
                    <Checkbox size="small" checked={selected.includes(r.recordId)} onChange={() => toggleOne(r.recordId)}
                      icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 16, color: T.textFaint }} />}
                      checkedIcon={<CheckBoxIcon sx={{ fontSize: 16, color: T.teal }} />} />
                  )}
                  <Typography sx={{ fontSize: 11, color: T.textFaint }}>{r.recordId}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
                  <Chip label={r.type} size="small"
                    sx={{ height: 18, fontSize: 9, fontWeight: 700,
                      bgcolor: r.type === 'MOVIE' ? `${T.teal}18` : `${T.success}18`,
                      color: r.type === 'MOVIE' ? T.teal : T.success,
                      border: `1px solid ${r.type === 'MOVIE' ? T.teal : T.success}44` }} />
                  <Typography sx={{ fontSize: 11, color: T.textMuted }}>{r.year ?? '—'}</Typography>
                  <Typography sx={{ fontSize: 11, color: T.textFaint }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</Typography>
                  <Typography sx={{ fontSize: 11, color: T.textFaint }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}</Typography>
                </Box>
              ))}
              {rows.length === 0 && (
                <Typography sx={{ fontSize: 13, color: T.textFaint, textAlign: 'center', py: 4 }}>No records with this tag</Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {totalEl > 0 && (
        <PaginationBar page={page} totalPages={totalPages} totalElements={totalEl}
          pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} isFetching={isFetching} />
      )}

      <BulkAddDialog tagType={tagType} open={bulkAddOpen}
        onClose={() => setBulkAddOpen(false)} onDone={() => setBulkAddOpen(false)} />
    </Box>
  );
}

// ── Tag definitions panel ─────────────────────────────────────────────────────
const SORT_FIELD_LABELS = {
  tagPriority: 'tagPriority ★ (computed score)',
  popularity: 'popularity',
  voteAverage: 'voteAverage',
  voteCount: 'voteCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  releaseDate: 'releaseDate',
  firstAirDate: 'firstAirDate',
  name: 'name',
  id: 'id',
};

function TagDefinitionsPanel() {
  const T = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [editDef, setEditDef] = useState(null); // { tagType, displayName, ... }

  const { data: defs = [], isLoading: defsLoading } = useQuery({
    queryKey: ['tagDefinitions'],
    queryFn:  getTagDefinitions,
    staleTime: 60_000,
  });

  const { data: meta } = useQuery({
    queryKey: ['railMetadata'],
    queryFn:  getRailMetadata,
    staleTime: Infinity,
  });
  const sortFields = meta?.sortFields ?? Object.keys(SORT_FIELD_LABELS);

  const { mutate: doSaveDef, isPending: savingDef } = useMutation({
    mutationFn: ({ tagType, ...body }) => updateTagDefinition(tagType, body),
    onSuccess: () => {
      enqueueSnackbar('Tag config saved', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['tagDefinitions'] });
      setEditDef(null);
    },
    onError: () => enqueueSnackbar('Save failed', { variant: 'error' }),
  });

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg, color: T.textPrimary,
      '& fieldset': { borderColor: T.glassBorder },
      '&:hover fieldset': { borderColor: T.borderHover },
      '&.Mui-focused fieldset': { borderColor: T.teal },
    },
    '& .MuiInputLabel-root': { color: T.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
    '& .MuiSelect-icon': { color: T.textMuted },
    '& .MuiFormHelperText-root': { color: T.textFaint, mt: '2px' },
  };

  if (defsLoading) return null;

  return (
    <Box sx={{ mt: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <TuneIcon sx={{ fontSize: 16, color: T.teal }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Tag Configurations
        </Typography>
        <Typography sx={{ fontSize: 11, color: T.textFaint }}>
          — define default sort, pool size, and active state for each tag
        </Typography>
      </Box>

      <Box sx={{ border: `1px solid ${T.glassBorder}`, borderRadius: 2, overflow: 'hidden', bgcolor: T.glass }}>
        <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Box sx={{ minWidth: 520 }}>
            {/* Header row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 64px 56px 48px', gap: 1,
              px: 2, py: 0.75, bgcolor: T.inputBg, borderBottom: `1px solid ${T.border}` }}>
              {['Tag', 'Default Sort', 'Direction', 'Pool', 'Active', ''].map(h => (
                <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {h}
                </Typography>
              ))}
            </Box>

            {defs.map((def, i) => {
              const color = TAG_COLORS[def.tagType] ?? T.teal;
              const label = TAG_LABELS[def.tagType] ?? def.tagType;
              return (
                <Box key={def.tagType}>
                  {i > 0 && <Divider sx={{ borderColor: T.border }} />}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 64px 56px 48px', gap: 1,
                    px: 2, py: 1, alignItems: 'center', '&:hover': { bgcolor: T.hoverBg } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, color: T.textMuted, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {def.defaultSort ?? '—'}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: T.textMuted }}>
                      {def.defaultDirection ?? '—'}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: T.textMuted }}>{def.poolSize}</Typography>
                    <Chip
                      label={def.active ? 'ON' : 'OFF'}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.6rem', fontWeight: 700,
                        bgcolor: def.active ? `${T.teal}22` : `${T.error}18`,
                        color: def.active ? T.teal : T.error,
                        border: `1px solid ${def.active ? T.teal : T.error}44`,
                      }}
                    />
                    <Tooltip title="Edit config">
                      <IconButton size="small" onClick={() => setEditDef({ ...def })}
                        sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
                        <SettingsIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Edit dialog */}
      {editDef && (
        <Dialog open onClose={() => setEditDef(null)} maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, borderRadius: 2 } }}>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontWeight: 700, fontSize: '0.95rem', pb: 1, borderBottom: `1px solid ${T.border}` }}>
            Configure: {TAG_LABELS[editDef.tagType] ?? editDef.tagType}
            <IconButton size="small" onClick={() => setEditDef(null)} sx={{ color: T.textMuted }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField label="Display Name" size="small" fullWidth sx={inputSx}
              value={editDef.displayName ?? ''} onChange={e => setEditDef(p => ({ ...p, displayName: e.target.value }))} />

            <TextField label="Description" size="small" fullWidth multiline rows={2} sx={inputSx}
              value={editDef.description ?? ''} onChange={e => setEditDef(p => ({ ...p, description: e.target.value }))} />

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <FormControl size="small" fullWidth sx={inputSx}>
                <InputLabel>Default Sort Field</InputLabel>
                <Select value={editDef.defaultSort ?? ''} label="Default Sort Field"
                  onChange={e => setEditDef(p => ({ ...p, defaultSort: e.target.value }))}
                  MenuProps={getSelectMenuProps(T)}>
                  {sortFields.map(f => (
                    <MenuItem key={f} value={f}>
                      <Typography sx={{ fontSize: 13, fontFamily: 'monospace' }}>
                        {f === 'tagPriority' ? 'tagPriority ★ (computed score)' : f}
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 110, ...inputSx }}>
                <InputLabel>Direction</InputLabel>
                <Select value={editDef.defaultDirection ?? 'DESC'} label="Direction"
                  onChange={e => setEditDef(p => ({ ...p, defaultDirection: e.target.value }))}
                  MenuProps={getSelectMenuProps(T)}>
                  <MenuItem value="DESC">DESC</MenuItem>
                  <MenuItem value="ASC">ASC</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="Pool Size" type="number" size="small" sx={{ minWidth: 120, ...inputSx }}
                value={editDef.poolSize ?? 30} inputProps={{ min: 1, max: 500 }}
                onChange={e => setEditDef(p => ({ ...p, poolSize: Number(e.target.value) }))}
                helperText="Max records tagged per scheduler run" />
              <TextField label="Refresh Cron" size="small" fullWidth sx={inputSx}
                value={editDef.refreshCron ?? ''} placeholder="0 0 */6 * * *"
                onChange={e => setEditDef(p => ({ ...p, refreshCron: e.target.value }))}
                helperText="Spring cron (sec min hr dom mon dow)" />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Switch size="small" checked={editDef.active ?? true}
                onChange={e => setEditDef(p => ({ ...p, active: e.target.checked }))}
                sx={{ '& .MuiSwitch-thumb': { bgcolor: editDef.active ? T.teal : undefined },
                  '& .MuiSwitch-track': { bgcolor: editDef.active ? `${T.teal}66 !important` : undefined } }} />
              <Typography sx={{ fontSize: 13, color: T.textMuted }}>Active</Typography>
              {!editDef.active && (
                <Typography sx={{ fontSize: 11, color: T.error, ml: 1 }}>
                  Inactive tags are skipped by the scheduler and hidden from rails.
                </Typography>
              )}
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2, borderTop: `1px solid ${T.border}`, pt: 1.5 }}>
            <Button onClick={() => setEditDef(null)} sx={{ color: T.textMuted }}>Cancel</Button>
            <Button variant="contained" disabled={savingDef}
              onClick={() => doSaveDef(editDef)}
              sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
              {savingDef ? <CircularProgress size={18} color="inherit" /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

// ── Tags tab ──────────────────────────────────────────────────────────────────
function TagsTab() {
  const T                                   = useT();
  const { enqueueSnackbar }                 = useSnackbar();
  const qc                                  = useQueryClient();
  const [selectedTag, setSelectedTag]       = useState(null);
  const [recalcingTag, setRecalcingTag]     = useState(null);

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['tagSummary'],
    queryFn:  getTagSummary,
    staleTime: 30_000,
  });

  const { mutate: doRecalcAll, isPending: recalcingAll } = useMutation({
    mutationFn: recalculateAllTags,
    onSuccess: () => {
      enqueueSnackbar('All tags recalculated', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
      if (selectedTag) qc.invalidateQueries({ queryKey: ['tagRecords', selectedTag] });
    },
    onError: () => enqueueSnackbar('Recalculation failed', { variant: 'error' }),
  });

  const handleRecalcOne = useCallback(async (tagType) => {
    setRecalcingTag(tagType);
    try {
      await recalculateTag(tagType);
      enqueueSnackbar(`${TAG_LABELS[tagType]} recalculated`, { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
      qc.invalidateQueries({ queryKey: ['tagRecords', tagType] });
    } catch {
      enqueueSnackbar('Recalculation failed', { variant: 'error' });
    } finally {
      setRecalcingTag(null);
    }
  }, [enqueueSnackbar, qc]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sub-toolbar */}
      <Box sx={{ px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 1,
        flexShrink: 0, borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
        {selectedTag && (
          <IconButton size="small" onClick={() => setSelectedTag(null)}
            sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
        <Typography sx={{ fontSize: 12, color: T.textMuted, flex: 1 }}>
          {selectedTag
            ? `${TAG_LABELS[selectedTag]} — ${AUTO_TAGS.has(selectedTag) ? 'Auto-managed · recalculated by scheduler' : 'Manually managed'}`
            : 'Click a tag card to view and manage its records'}
        </Typography>
        <Tooltip title="Refresh counts">
          <IconButton size="small" onClick={() => refetch()} sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Button variant="contained" size="small"
          startIcon={recalcingAll ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
          disabled={recalcingAll} onClick={() => doRecalcAll()}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600, fontSize: 12 }}>
          Recalculate All
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, p: { xs: 1.5, md: 2.5 },
        '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 3 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' }, gap: { xs: 1, sm: 1.5 } }}>
          {isLoading
            ? [...Array(6)].map((_, i) => <Skeleton key={i} variant="rectangular" height={90} sx={{ borderRadius: 2, bgcolor: T.glass }} />)
            : (summary ?? []).map(s => (
              <TagCard key={s.tagType} summary={s} selected={selectedTag === s.tagType}
                onClick={() => setSelectedTag(prev => prev === s.tagType ? null : s.tagType)}
                recalculating={recalcingTag === s.tagType}
                onRecalc={() => handleRecalcOne(s.tagType)} />
            ))
          }
        </Box>

        {!selectedTag && !isLoading && (
          <>
            <Alert severity="info" sx={{ mt: 2, bgcolor: `${T.teal}12`, color: T.textMuted,
              border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
              <strong>Auto tags</strong> (Trending, Top 10, Featured, Recently Added, Available for Download)
              are recalculated every 6 hours by the scheduler. Click a card to inspect its records, or use{' '}
              <strong>Recalculate All</strong> to refresh immediately.{' '}
              <strong>Editor Pick</strong> is manual — assign it freely to curate content.
            </Alert>
            <TagDefinitionsPanel />
          </>
        )}

        {selectedTag && <TagRecordTable tagType={selectedTag} />}
      </Box>
    </Box>
  );
}

// ── Rail row ──────────────────────────────────────────────────────────────────
function RailRow({ rail, onEdit, onDelete, onToggle, dragControls }) {
  const T   = useT();
  const rule = rail.rule ?? {};

  const ruleChip = () => {
    switch (rule.type) {
      case 'tag':       return TAG_LABELS[rule.tag] ?? rule.tag ?? '—';
      case 'genre':     return `Genre ${rule.genreId ?? '?'}`;
      case 'language':  return (rule.languages ?? []).join(', ') || '—';
      case 'filter':    return `${rule.field ?? '?'} ${rule.value ?? ''}`.trim();
      case 'manual':    return 'Manual list';
      case 'watchlist': return 'User watchlist';
      default:          return rule.type ?? '—';
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.2, px: 1.5,
      '&:hover': { bgcolor: T.hoverBg } }}>
      <DragIndicatorIcon
        onPointerDown={dragControls ? e => dragControls.start(e) : undefined}
        sx={{ fontSize: 16, color: T.textFaint, cursor: 'grab', flexShrink: 0, touchAction: 'none',
          '&:active': { cursor: 'grabbing' } }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: T.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rail.title}
          </Typography>
          {!(rail.active ?? true) && (
            <Chip label="Off" size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: T.glass, color: T.textFaint }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.3, flexWrap: 'wrap' }}>
          <Chip label={rule.type ?? '?'} size="small"
            sx={{ height: 16, fontSize: '0.6rem', bgcolor: `${T.teal}18`, color: T.teal, fontWeight: 700 }} />
          <Chip label={ruleChip()} size="small"
            sx={{ height: 16, fontSize: '0.6rem', bgcolor: T.glass, color: T.textMuted }} />
          {rail.pageType && (
            <Chip label={rail.pageType} size="small"
              sx={{ height: 16, fontSize: '0.6rem', bgcolor: T.glass, color: T.textFaint }} />
          )}
          {rule.sort && (
            <Chip label={`${rule.sort} ${rule.direction ?? 'DESC'}`} size="small"
              sx={{ height: 16, fontSize: '0.6rem', bgcolor: T.glass, color: T.textFaint }} />
          )}
          {rail.limitSize && (
            <Chip label={`×${rail.limitSize}`} size="small"
              sx={{ height: 16, fontSize: '0.6rem', bgcolor: T.glass, color: T.textFaint }} />
          )}
        </Box>
      </Box>
      <Switch size="small" checked={rail.active ?? true} onChange={() => onToggle(rail)}
        sx={{ '& .MuiSwitch-thumb': { bgcolor: (rail.active ?? true) ? T.teal : undefined },
          '& .MuiSwitch-track': { bgcolor: (rail.active ?? true) ? `${T.teal}66 !important` : undefined } }} />
      <Tooltip title="Edit rail">
        <IconButton size="small" onClick={() => onEdit(rail)}
          sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
          <EditIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete rail">
        <IconButton size="small" onClick={() => onDelete(rail)}
          sx={{ color: T.textFaint, '&:hover': { color: T.error, bgcolor: T.errorBg } }}>
          <DeleteIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Rail dialog ───────────────────────────────────────────────────────────────
function RailDialog({ open, data, onClose, onSave, saving }) {
  const T = useT();
  const [form, setForm]       = useState({ ...BLANK_RAIL });
  const [langInput, setLangInput] = useState('');

  const { data: meta } = useQuery({
    queryKey: ['railMetadata'],
    queryFn:  getRailMetadata,
    staleTime: Infinity,
  });
  const sortFields = meta?.sortFields ?? ['popularity', 'voteAverage', 'voteCount', 'createdAt', 'updatedAt', 'releaseDate', 'firstAirDate', 'name', 'id', 'tagPriority'];

  useEffect(() => {
    if (data) {
      setForm({
        ...BLANK_RAIL,
        ...data,
        rule: { ...BLANK_RULE, ...(data.rule ?? {}) },
      });
      setLangInput('');
    }
  }, [data]);

  const setField = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setCheck = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.checked }));
  const setRule  = (k) => (e) => setForm(p => ({ ...p, rule: { ...p.rule, [k]: e.target.value } }));
  const setRuleV = (k, v)     => setForm(p => ({ ...p, rule: { ...p.rule, [k]: v } }));

  const addLang = () => {
    const lang = langInput.trim().toLowerCase();
    if (!lang) return;
    const langs = form.rule?.languages ?? [];
    if (!langs.includes(lang)) setRuleV('languages', [...langs, lang]);
    setLangInput('');
  };
  const removeLang = (l) => setRuleV('languages', (form.rule?.languages ?? []).filter(x => x !== l));

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: T.inputBg, color: T.textPrimary,
      '& fieldset':             { borderColor: T.glassBorder },
      '&:hover fieldset':       { borderColor: T.borderHover },
      '&.Mui-focused fieldset': { borderColor: T.teal },
    },
    '& .MuiInputLabel-root':             { color: T.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
    '& .MuiSelect-icon':                 { color: T.textMuted },
    '& .MuiFormHelperText-root':         { color: T.textFaint, mt: '2px' },
  };

  const rule = form.rule ?? {};

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, borderRadius: 2, maxHeight: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontWeight: 700, fontSize: '1rem', pb: 1, borderBottom: `1px solid ${T.border}` }}>
        {form.id ? 'Edit Rail' : 'New Rail'}
        <IconButton size="small" onClick={onClose} sx={{ color: T.textMuted }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important',
        overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>

        {/* ── Basic ─────────────────────────────────────────── */}
        <TextField label="Title" value={form.title ?? ''} onChange={setField('title')}
          fullWidth size="small" sx={inputSx} />

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>Page</InputLabel>
            <Select value={form.pageType ?? 'HOME'} onChange={setField('pageType')} label="Page"
              MenuProps={getSelectMenuProps(T)}>
              {PAGE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Priority" type="number" value={form.priority ?? 0} onChange={setField('priority')}
            size="small" inputProps={{ min: 0 }} sx={{ minWidth: 88, ...inputSx }} />
          <TextField label="Limit" type="number" value={form.limitSize ?? 20} onChange={setField('limitSize')}
            size="small" inputProps={{ min: 1, max: 200 }} sx={{ minWidth: 88, ...inputSx }} />
        </Box>

        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Switch size="small" checked={form.active ?? true} onChange={setCheck('active')}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: (form.active ?? true) ? T.teal : undefined },
                '& .MuiSwitch-track': { bgcolor: (form.active ?? true) ? `${T.teal}66 !important` : undefined } }} />
            <Typography sx={{ fontSize: 12, color: T.textMuted }}>Active</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Switch size="small" checked={form.infiniteScroll ?? true} onChange={setCheck('infiniteScroll')}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: (form.infiniteScroll ?? true) ? T.teal : undefined },
                '& .MuiSwitch-track': { bgcolor: (form.infiniteScroll ?? true) ? `${T.teal}66 !important` : undefined } }} />
            <Typography sx={{ fontSize: 12, color: T.textMuted }}>Infinite Scroll</Typography>
          </Box>
        </Box>

        <Divider sx={{ borderColor: T.border }} />

        {/* ── Rule ──────────────────────────────────────────── */}
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Rule — how records are selected
        </Typography>

        <FormControl size="small" fullWidth sx={inputSx}>
          <InputLabel>Rule Type</InputLabel>
          <Select value={rule.type ?? 'tag'} label="Rule Type"
            onChange={e => setRuleV('type', e.target.value)} MenuProps={getSelectMenuProps(T)}>
            {RULE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </Select>
        </FormControl>

        {/* TAG */}
        {rule.type === 'tag' && (
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>Tag</InputLabel>
            <Select value={rule.tag ?? ''} label="Tag"
              onChange={e => setRuleV('tag', e.target.value)} MenuProps={getSelectMenuProps(T)}>
              {ALL_TAGS.map(t => (
                <MenuItem key={t} value={t}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: TAG_COLORS[t], flexShrink: 0 }} />
                    {TAG_LABELS[t] ?? t}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* GENRE */}
        {rule.type === 'genre' && (
          <TextField label="Genre ID" type="number" size="small" fullWidth
            value={rule.genreId ?? ''}
            onChange={e => setRuleV('genreId', e.target.value ? Number(e.target.value) : null)}
            helperText="Numeric TMDB genre ID — e.g. 28 = Action, 18 = Drama, 35 = Comedy"
            sx={inputSx} />
        )}

        {/* LANGUAGE */}
        {rule.type === 'language' && (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField placeholder="Language code (hi, en, ta, te, ml…)" size="small"
                value={langInput} onChange={e => setLangInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLang(); } }}
                sx={{ flex: 1, ...inputSx }} />
              <Button size="small" variant="outlined" onClick={addLang}
                sx={{ borderColor: T.teal, color: T.teal, '&:hover': { bgcolor: T.tealBg }, px: 1.5 }}>
                <AddIcon sx={{ fontSize: 16 }} />
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minHeight: 28 }}>
              {(rule.languages ?? []).map(l => (
                <Chip key={l} label={l} size="small" onDelete={() => removeLang(l)}
                  sx={{ bgcolor: `${T.teal}18`, color: T.teal, border: `1px solid ${T.teal}44`,
                    '& .MuiChip-deleteIcon': { color: T.teal, '&:hover': { color: T.tealHover } } }} />
              ))}
              {(rule.languages ?? []).length === 0 && (
                <Typography sx={{ fontSize: 11, color: T.textFaint, lineHeight: '28px' }}>Add at least one language code</Typography>
              )}
            </Box>
          </Box>
        )}

        {/* FILTER */}
        {rule.type === 'filter' && (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField label="Field" size="small" value={rule.field ?? ''} onChange={setRule('field')}
              fullWidth sx={inputSx} helperText="e.g. popularity, voteAverage" />
            <TextField label="Value" size="small" value={rule.value ?? ''} onChange={setRule('value')}
              fullWidth sx={inputSx} helperText="e.g. 7.5" />
          </Box>
        )}

        {/* MANUAL */}
        {rule.type === 'manual' && (
          <Alert severity="info" sx={{ bgcolor: `${T.teal}12`, color: T.textMuted,
            border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
            Manual rails show records from the rail&apos;s curated item list. Save the rail first, then add records via the rail items API.
          </Alert>
        )}

        {/* WATCHLIST */}
        {rule.type === 'watchlist' && (
          <Alert severity="info" sx={{ bgcolor: `${T.teal}12`, color: T.textMuted,
            border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
            <strong>My List</strong> shows each user their own watchlisted records, sorted most-recently-added first.
            No additional configuration needed — sorting and record type are determined by the user&apos;s list.
          </Alert>
        )}

        {rule.type !== 'watchlist' && (<>
          <Divider sx={{ borderColor: T.border }} />

          {/* ── Sorting & record type ─────────────────────────── */}
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Sorting &amp; Record Type
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <FormControl size="small" fullWidth sx={inputSx}>
              <InputLabel>Sort Field</InputLabel>
              <Select value={rule.sort ?? ''} label="Sort Field"
                onChange={e => setRuleV('sort', e.target.value)} MenuProps={getSelectMenuProps(T)}>
                <MenuItem value=""><em>Default (from Tag Config)</em></MenuItem>
                {sortFields.map(f => (
                  <MenuItem key={f} value={f}>
                    {f === 'tagPriority' ? 'tagPriority — computed score ★' : f}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110, ...inputSx }}>
              <InputLabel>Direction</InputLabel>
              <Select value={rule.direction ?? 'DESC'} label="Direction"
                onChange={e => setRuleV('direction', e.target.value)} MenuProps={getSelectMenuProps(T)}>
                <MenuItem value="DESC">DESC — newest/highest first</MenuItem>
                <MenuItem value="ASC">ASC — oldest/lowest first</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>Record Type Override</InputLabel>
            <Select value={rule.recordType ?? ''} label="Record Type Override"
              onChange={e => setRuleV('recordType', e.target.value)} MenuProps={getSelectMenuProps(T)}>
              <MenuItem value="">Auto (infer from page type)</MenuItem>
              <MenuItem value="MOVIE">Movie only</MenuItem>
              <MenuItem value="TV_SERIES">Series only</MenuItem>
            </Select>
          </FormControl>
        </>)}

      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, borderTop: `1px solid ${T.border}`, pt: 1.5 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.title || saving}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
          {saving ? <CircularProgress size={18} color="inherit" /> : (form.id ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Draggable rail row wrapper ────────────────────────────────────────────────
function DraggableRailRow({ rail, onEdit, onDelete, onToggle }) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item value={rail} dragListener={false} dragControls={dragControls} style={{ listStyle: 'none' }} layout>
      <RailRow rail={rail} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} dragControls={dragControls} />
    </Reorder.Item>
  );
}

// ── Rails tab ─────────────────────────────────────────────────────────────────
function RailsTab() {
  const T                   = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc                  = useQueryClient();
  const [railDialog,   setRailDialog]   = useState({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, rail: null });

  const { data: rails = [], isLoading } = useQuery({
    queryKey: ['adminRails'],
    queryFn:  getRails,
    staleTime: 30_000,
  });

  // Local ordered state for drag-to-reorder
  const [orderedRails, setOrderedRails] = useState([]);
  const [orderDirty,   setOrderDirty]   = useState(false);

  useEffect(() => {
    if (rails.length > 0 && !orderDirty) {
      setOrderedRails([...rails].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)));
    }
  }, [rails, orderDirty]);

  const handleReorder = (newOrder) => {
    setOrderedRails(newOrder);
    setOrderDirty(true);
  };

  const { mutate: doSave, isPending: saving } = useMutation({
    mutationFn: (d) => d.id ? updateRail(d.id, d) : createRail(d),
    onSuccess: (_, vars) => {
      enqueueSnackbar(`Rail ${vars.id ? 'updated' : 'created'}`, { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['adminRails'] });
      setRailDialog({ open: false, data: null });
    },
    onError: () => enqueueSnackbar('Save failed', { variant: 'error' }),
  });

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (rail) => deleteRail(rail.id),
    onSuccess: () => {
      enqueueSnackbar('Rail deleted', { variant: 'success' });
      setOrderDirty(false);
      qc.invalidateQueries({ queryKey: ['adminRails'] });
      setDeleteDialog({ open: false, rail: null });
    },
    onError: () => enqueueSnackbar('Delete failed', { variant: 'error' }),
  });

  const { mutate: doToggle } = useMutation({
    mutationFn: (rail) => updateRail(rail.id, { ...rail, active: !rail.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminRails'] }),
    onError: () => enqueueSnackbar('Toggle failed', { variant: 'error' }),
  });

  const { mutate: doReorder, isPending: reordering } = useMutation({
    mutationFn: () => reorderRails(orderedRails),
    onSuccess: () => {
      enqueueSnackbar('Order saved', { variant: 'success', autoHideDuration: 1500 });
      setOrderDirty(false);
      qc.invalidateQueries({ queryKey: ['adminRails'] });
    },
    onError: () => enqueueSnackbar('Failed to save order', { variant: 'error' }),
  });

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sub-toolbar */}
      <Box sx={{ px: { xs: 2, md: 3 }, py: 1.25, display: 'flex', alignItems: 'center', gap: 1,
        flexShrink: 0, borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
        <PlaylistPlayIcon sx={{ color: T.teal, fontSize: 18 }} />
        <Typography sx={{ fontSize: 12, color: T.textMuted, flex: 1 }}>
          Configure homepage rails — drag handle to reorder, toggle to show/hide
        </Typography>
        {orderDirty && (
          <Button size="small" variant="contained" disabled={reordering}
            onClick={() => doReorder()}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 700, fontSize: 12 }}>
            {reordering ? <CircularProgress size={14} color="inherit" /> : 'Save Order'}
          </Button>
        )}
        <Button size="small" variant="contained" startIcon={<AddIcon />}
          onClick={() => setRailDialog({ open: true, data: { ...BLANK_RAIL } })}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600, fontSize: 12 }}>
          New Rail
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, p: { xs: 1, md: 1.5 },
        '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 3 } }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1 }}>
            {[...Array(5)].map((_, i) => <Skeleton key={i} variant="rectangular" height={52} sx={{ borderRadius: 1.5, bgcolor: T.glass }} />)}
          </Box>
        ) : orderedRails.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <PlaylistPlayIcon sx={{ fontSize: 48, color: T.textFaint, mb: 1 }} />
            <Typography sx={{ color: T.textFaint, fontSize: '0.85rem' }}>No rails configured</Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />}
              onClick={() => setRailDialog({ open: true, data: { ...BLANK_RAIL } })}
              sx={{ mt: 2, borderColor: T.teal, color: T.teal, '&:hover': { bgcolor: T.tealBg } }}>
              Create first rail
            </Button>
          </Box>
        ) : (
          <Box sx={{ border: `1px solid ${T.glassBorder}`, borderRadius: 2, overflow: 'hidden', bgcolor: T.glass }}>
            <Reorder.Group axis="y" values={orderedRails} onReorder={handleReorder}
              style={{ padding: 0, margin: 0 }}>
              <AnimatePresence>
                {orderedRails.map((rail, i) => (
                  <Box key={rail.id ?? i}>
                    {i > 0 && <Divider sx={{ borderColor: T.border }} />}
                    <DraggableRailRow
                      rail={rail}
                      onEdit={(r) => setRailDialog({ open: true, data: { ...r } })}
                      onDelete={(r) => setDeleteDialog({ open: true, rail: r })}
                      onToggle={doToggle}
                    />
                  </Box>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          </Box>
        )}
      </Box>

      <RailDialog open={railDialog.open} data={railDialog.data}
        onClose={() => setRailDialog({ open: false, data: null })}
        onSave={doSave} saving={saving} />

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, rail: null })}
        PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 2 } }}>
        <DialogTitle sx={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 700 }}>Delete Rail</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted, fontSize: '0.9rem' }}>
            Delete <Box component="strong" sx={{ color: T.textPrimary }}>{deleteDialog.rail?.title}</Box>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog({ open: false, rail: null })} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleting}
            onClick={() => doDelete(deleteDialog.rail)}>
            {deleting ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TagsAndRailsPage() {
  const T         = useT();
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column',
      bgcolor: T.adminBg, color: T.textPrimary, overflow: 'hidden' }}>

      {/* Page header + tabs */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 1.5, md: 2 }, flexShrink: 0, borderBottom: `1px solid ${T.border}` }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, color: T.textPrimary }}>
          Tags &amp; Rails
        </Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ mt: 0.5,
            '& .MuiTab-root': { fontSize: 13, color: T.textMuted, textTransform: 'none', minHeight: 40, px: 2 },
            '& .Mui-selected': { color: T.teal },
            '& .MuiTabs-indicator': { bgcolor: T.teal },
          }}>
          <Tab label="Tag Management" />
          <Tab label="Rails" />
        </Tabs>
      </Box>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {tab === 0 && <TagsTab />}
        {tab === 1 && <RailsTab />}
      </Box>
    </Box>
  );
}
