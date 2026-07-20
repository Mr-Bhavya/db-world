import { useCallback, useMemo, useState } from 'react';
import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SyncIcon from '@mui/icons-material/Sync';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { formatDistanceToNow } from 'date-fns';
import { useT } from '@shared/theme';
import { useRecordStore } from '../stores/useRecordStore';
import { useRecordVisibility } from './useRecordVisibility';
import { useRecordSync } from './useRecordSync';
import RecordTagsInline from './RecordTagsInline';

const SORT_FIELD_MAP = {
  recordId: 'recordId', name: 'name', type: 'type',
  year: 'year', tmdbId: 'tmdbId', createdAt: 'createdAt', updatedAt: 'updatedAt',
  lastSyncedAt: 'lastSyncedAt',
};

// Fields that exist as real, sortable DataGrid columns. The sort dropdown can
// also sort by folded fields (tmdbId, year, recordId) that have no column — those
// must NOT be handed to the grid's controlled sortModel, or it reconciles them
// away and resets the selection. They still drive the server query via the store.
const GRID_SORTABLE_FIELDS = new Set(['name', 'lastSyncedAt']);

// TMDB sync status → chip label + color (matches the sync-health strip).
const SYNC_META = {
  SUCCESS: { label: 'Synced',  color: '#10b981' },
  FAILED:  { label: 'Failed',  color: '#ef4444' },
  SKIPPED: { label: 'Skipped', color: '#6b7280' },
  RUNNING: { label: 'Running', color: '#f59e0b' },
};

const fmtSize = (b) => {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${Math.round(b / 1024)} KB`;
  if (b < 1024 ** 3) return `${Math.round(b / 1024 ** 2)} MB`;
  return `${(b / 1024 ** 3).toFixed(1)} GB`;
};

export default function RecordTable({ rows, totalElements, loading, onDelete }) {
  const T = useT();
  const { sortModel, setSortModel, selectedRows, setSelectedRows, openModal, openMediaFiles, openDrawer } = useRecordStore();

  // DataGrid v8 selection model is { type, ids:Set }. Keep it controlled off the
  // store so the bulk-action bar reflects checkbox state and clearSelection() works.
  const rowSelectionModel = useMemo(
    () => ({ type: 'include', ids: new Set(selectedRows) }),
    [selectedRows],
  );
  const handleSelectionChange = useCallback((model) => {
    // "select all" emits exclude-mode → everything on the page minus exclusions.
    const ids = model.type === 'exclude'
      ? rows.filter(r => !model.ids.has(r.recordId)).map(r => r.recordId)
      : Array.from(model.ids);
    setSelectedRows(ids);
  }, [rows, setSelectedRows]);

  // Column visibility is user-controlled via the column menu ("Manage columns" /
  // "Hide column"). Same columns on mobile and desktop — the grid scrolls
  // horizontally on small screens. Must be controlled WITH an onChange handler,
  // otherwise the panel checkboxes appear frozen (can't toggle).
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({});

  const visibilityMut = useRecordVisibility();
  const syncMut       = useRecordSync();

  const gridSx = useMemo(() => ({
    // v8 CSS variables override container/pinned backgrounds
    '--DataGrid-containerBackground': T.sidebar,
    '--DataGrid-pinnedBackground':    T.sidebar,
    border: 'none',
    color: T.textPrimary,
    bgcolor: T.adminBg,

    // Column header — neutral band (no heavy teal), force via !important to beat v8 CSS vars
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: `${T.sidebar} !important`,
      borderBottom: `1px solid ${T.border}`,
    },
    '& .MuiDataGrid-columnHeader': {
      backgroundColor: `${T.sidebar} !important`,
      color: `${T.textMuted} !important`,
      '&:focus, &:focus-within': { outline: 'none' },
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 700, color: `${T.textMuted} !important`,
      fontSize: 11, textTransform: 'uppercase', letterSpacing: .5,
    },
    '& .MuiDataGrid-columnHeaderTitleContainer': { color: T.textMuted },
    '& .MuiDataGrid-iconSeparator':  { color: T.border },
    '& .MuiDataGrid-sortIcon':       { color: T.teal },
    '& .MuiDataGrid-menuIconButton': { color: T.textMuted },

    // Rows
    '& .MuiDataGrid-row': {
      borderBottom: `1px solid ${T.border}`,
      backgroundColor: T.adminBg,
      '&:hover': { backgroundColor: `${T.tealBg} !important` },
    },
    '& .MuiDataGrid-cell': {
      borderBottom: 'none', color: T.textPrimary, fontSize: 13,
      display: 'flex', alignItems: 'center',
      '&:focus, &:focus-within': { outline: 'none' },
    },

    // Scrollable area + overlay
    '& .MuiDataGrid-virtualScroller':        { backgroundColor: T.adminBg },
    '& .MuiDataGrid-virtualScrollerContent': { backgroundColor: T.adminBg },
    '& .MuiDataGrid-overlay':                { backgroundColor: T.adminBg },

    // Footer
    '& .MuiDataGrid-footerContainer': {
      borderTop: `1px solid ${T.border}`,
      backgroundColor: `${T.sidebar} !important`,
      color: T.textMuted,
    },
    '& .MuiDataGrid-selectedRowCount': { color: T.teal },
    '& .MuiTablePagination-root':       { color: T.textMuted },
    '& .MuiTablePagination-selectIcon': { color: T.textMuted },
    '& .MuiTablePagination-displayedRows': { color: T.textMuted },

    // Checkbox
    '& .MuiCheckbox-root': { color: T.textFaint },
  }), [T]);

  // The column-menu ("Sort by / Hide / Manage columns") and the "Manage columns"
  // panel are portaled to <body>, so gridSx above can't reach them — they'd fall
  // back to the wrong MUI palette (white labels on the light theme). Theme them
  // explicitly so they're legible in both modes.
  const panelSx = useMemo(() => ({
    '& .MuiPaper-root, & .MuiDataGrid-paper': {
      backgroundColor: T.sidebar,
      color: T.textPrimary,
      border: `1px solid ${T.border}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
    },
    '& .MuiDataGrid-columnsManagement':        { color: T.textPrimary },
    '& .MuiDataGrid-columnsManagementHeader':  { color: T.textMuted },
    '& .MuiDataGrid-columnsManagementFooter':  { borderTop: `1px solid ${T.border}` },
    '& .MuiFormControlLabel-label':            { color: T.textPrimary, fontSize: 13 },
    '& .MuiCheckbox-root':                     { color: T.textFaint, '&.Mui-checked': { color: T.teal } },
    '& .MuiInputBase-input':                   { color: T.textPrimary },
    '& .MuiInput-underline:before':            { borderBottomColor: T.border },
    '& .MuiInput-underline:hover:before':      { borderBottomColor: T.borderHover },
    '& .MuiInput-underline:after':             { borderBottomColor: T.teal },
    '& .MuiSvgIcon-root':                      { color: T.textMuted },
    '& .MuiButton-root':                       { color: T.teal },
  }), [T]);

  const columnMenuSx = useMemo(() => ({
    '& .MuiPaper-root': {
      backgroundColor: T.sidebar,
      color: T.textPrimary,
      border: `1px solid ${T.border}`,
    },
    '& .MuiMenuItem-root, & .MuiListItemText-primary': { color: T.textPrimary },
    '& .MuiMenuItem-root:hover':                       { backgroundColor: T.tealBg },
    '& .MuiListItemIcon-root .MuiSvgIcon-root':        { color: T.textMuted },
    '& .MuiDivider-root':                              { borderColor: T.border },
    '& .MuiInputBase-input':                           { color: T.textPrimary },
  }), [T]);

  const handleSortChange = useCallback((model) => {
    setSortModel(model.map(s => ({ ...s, field: SORT_FIELD_MAP[s.field] ?? s.field })));
  }, [setSortModel]);

  const displaySortModel = useMemo(() =>
    sortModel
      .map(s => ({ field: Object.keys(SORT_FIELD_MAP).find(k => SORT_FIELD_MAP[k] === s.field) ?? s.field, sort: s.sort }))
      .filter(s => GRID_SORTABLE_FIELDS.has(s.field)),
  [sortModel]);

  const columns = useMemo(() => [
    {
      // Rich title cell — absorbs type (icon), name, year and TMDB id.
      // Click opens the detail drawer (Overview).
      field: 'name', headerName: 'Title', flex: 1, minWidth: 220,
      renderCell: ({ row }) => (
        <Box onClick={() => openDrawer(row.recordId)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', width: '100%', minWidth: 0, height: '100%',
            '&:hover .dbw-title': { color: T.teal } }}>
          {row.type === 'MOVIE'
            ? <MovieIcon sx={{ fontSize: 16, color: T.teal, flexShrink: 0 }} />
            : <TvIcon    sx={{ fontSize: 16, color: T.success, flexShrink: 0 }} />}
          <Box sx={{ minWidth: 0, lineHeight: 1.25 }}>
            <Box className="dbw-title" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: T.textPrimary, fontWeight: 500, fontSize: 13, lineHeight: 1.35 }}>{row.name}</Box>
            <Box sx={{ fontSize: 11, color: T.textFaint, lineHeight: 1.3 }}>
              {row.year ?? '—'}{row.tmdbId ? ` · #${row.tmdbId}` : ''}
            </Box>
          </Box>
        </Box>
      ),
    },
    {
      field: 'syncStatus', headerName: 'Sync', width: 175, sortable: false,
      renderCell: ({ value, row }) => {
        if (!value) return <Box sx={{ color: T.textFaint, fontSize: 12 }}>—</Box>;
        const m = SYNC_META[value] ?? { label: value, color: T.textMuted };
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, py: 0.5, minWidth: 0 }}>
            <Chip label={m.label} size="small"
              sx={{ alignSelf: 'flex-start', bgcolor: `${m.color}22`, color: m.color, fontWeight: 700, fontSize: 10 }} />
            {value === 'FAILED' && row.syncError && (
              <Tooltip title={row.syncError}>
                <Box sx={{ fontSize: 10, color: T.error, lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                  {row.syncError}
                </Box>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
    {
      field: 'lastSyncedAt', headerName: 'Last synced', width: 120,
      renderCell: ({ value }) => value
        ? <Box sx={{ fontSize: 12, color: T.textFaint }}>{formatDistanceToNow(new Date(value), { addSuffix: true })}</Box>
        : <Box sx={{ color: T.textFaint }}>—</Box>,
    },
    {
      field: 'tags', headerName: 'Tags', flex: 1, minWidth: 150, sortable: false,
      renderCell: ({ row }) => <RecordTagsInline record={row} />,
    },
    {
      field: 'mediaFileCount', headerName: 'Files', width: 120, sortable: false,
      renderCell: ({ row }) => {
        const count = row.mediaFileCount ?? 0;
        return (
          <Tooltip title="View / manage media files">
            <Box onClick={() => openMediaFiles(row.recordId)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                color: count > 0 ? T.textPrimary : T.textFaint, '&:hover': { color: T.teal } }}>
              <VideoFileIcon sx={{ fontSize: 15 }} />
              <Box sx={{ fontSize: 12 }}>
                {count > 0 ? `${count} · ${fmtSize(Number(row.mediaTotalSize))}` : '—'}
              </Box>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'hideFromRails', headerName: 'On Rails', width: 80, sortable: false,
      renderCell: ({ row }) => {
        const hidden = Boolean(row.hideFromRails);
        return (
          <Tooltip title={hidden ? 'Hidden from rails (click to show)' : 'Visible on rails (click to hide)'}>
            <span>
              <IconButton
                size="small"
                disabled={visibilityMut.isPending}
                onClick={() => visibilityMut.mutate({ id: row.recordId, hideFromRails: !hidden })}
                sx={{
                  color: hidden ? T.error : T.success,
                  '&:hover': { bgcolor: hidden ? T.errorBg : `${T.success}15` },
                }}
              >
                {hidden ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </span>
          </Tooltip>
        );
      },
    },
    {
      field: 'actions', headerName: '', width: 108, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: .5 }}>
          <Tooltip title="Sync from TMDB">
            <span>
              <IconButton size="small" disabled={syncMut.isPending && syncMut.variables === row.recordId}
                onClick={() => syncMut.mutate(row.recordId)}
                sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
                <SyncIcon sx={{ fontSize: 15,
                  animation: syncMut.isPending && syncMut.variables === row.recordId ? 'dbw-spin 0.8s linear infinite' : 'none',
                  '@keyframes dbw-spin': { to: { transform: 'rotate(360deg)' } } }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal('edit', row.recordId)} sx={{ color: T.textFaint, '&:hover': { color: T.success, bgcolor: `${T.success}15` } }}><EditIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(row.recordId)} sx={{ color: T.textFaint, '&:hover': { color: T.error, bgcolor: T.errorBg } }}><DeleteIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
        </Box>
      ),
    },
  ], [T, onDelete, openModal, openMediaFiles, openDrawer, visibilityMut, syncMut]);

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={r => r.recordId}
      loading={loading}
      rowCount={totalElements}
      sortingMode="server"
      sortModel={displaySortModel}
      onSortModelChange={handleSortChange}
      checkboxSelection
      disableRowSelectionOnClick
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={handleSelectionChange}
      columnVisibilityModel={columnVisibilityModel}
      onColumnVisibilityModelChange={setColumnVisibilityModel}
      rowHeight={58}
      columnHeaderHeight={44}
      hideFooter
      sx={gridSx}
      slotProps={{
        loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' },
        panel: { sx: panelSx },
        columnMenu: { sx: columnMenuSx },
      }}
      keepNonExistentRowsSelected
    />
  );
}
