import { useCallback, useMemo } from 'react';
import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { formatDistanceToNow } from 'date-fns';
import { useT } from '@shared/theme';
import { useRecordStore } from '../stores/useRecordStore';
import RecordTagsInline from './RecordTagsInline';

const SORT_FIELD_MAP = {
  recordId: 'recordId', name: 'name', type: 'type',
  year: 'year', tmdbId: 'tmdbId', createdAt: 'createdAt', updatedAt: 'updatedAt',
};

export default function RecordTable({ rows, totalElements, loading, onDelete }) {
  const T = useT();
  const { sortModel, setSortModel, setSelectedRows, openModal, openTmdbModal, openRecordDetail, openMediaFiles } = useRecordStore();

  const gridSx = useMemo(() => ({
    // v8 CSS variables override container/pinned backgrounds
    '--DataGrid-containerBackground': T.tealBg,
    '--DataGrid-pinnedBackground':    T.sidebar,
    border: 'none',
    color: T.textPrimary,
    bgcolor: T.adminBg,

    // Column header — force background + text via !important to beat v8 CSS vars
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: `${T.tealBg} !important`,
      borderBottom: `1px solid ${T.border}`,
    },
    '& .MuiDataGrid-columnHeader': {
      backgroundColor: `${T.tealBg} !important`,
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
      backgroundColor: `${T.tealBg} !important`,
      color: T.textMuted,
    },
    '& .MuiDataGrid-selectedRowCount': { color: T.teal },
    '& .MuiTablePagination-root':       { color: T.textMuted },
    '& .MuiTablePagination-selectIcon': { color: T.textMuted },
    '& .MuiTablePagination-displayedRows': { color: T.textMuted },

    // Checkbox
    '& .MuiCheckbox-root': { color: T.textFaint },
  }), [T]);

  const handleSortChange = useCallback((model) => {
    setSortModel(model.map(s => ({ ...s, field: SORT_FIELD_MAP[s.field] ?? s.field })));
  }, [setSortModel]);

  const displaySortModel = useMemo(() =>
    sortModel.map(s => ({ field: Object.keys(SORT_FIELD_MAP).find(k => SORT_FIELD_MAP[k] === s.field) ?? s.field, sort: s.sort })),
  [sortModel]);

  const columns = useMemo(() => [
    {
      field: 'recordId', headerName: 'ID', width: 80,
      renderCell: ({ value }) => (
        <Box
          onClick={() => openRecordDetail(value)}
          sx={{ color: T.teal, fontWeight: 700, cursor: 'pointer', fontSize: 13, '&:hover': { textDecoration: 'underline' } }}
        >
          {value}
        </Box>
      ),
    },
    {
      field: 'name', headerName: 'Name', flex: 1.5, minWidth: 160,
      renderCell: ({ value, row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {row.type === 'MOVIE'
            ? <MovieIcon sx={{ fontSize: 15, color: T.teal, flexShrink: 0 }} />
            : <TvIcon    sx={{ fontSize: 15, color: T.success, flexShrink: 0 }} />}
          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.textPrimary }}>{value}</Box>
        </Box>
      ),
    },
    {
      field: 'type', headerName: 'Type', width: 95,
      renderCell: ({ value }) => (
        <Chip label={value === 'TV_SERIES' ? 'Series' : 'Movie'} size="small" sx={{
          bgcolor: value === 'MOVIE' ? T.tealBg : `${T.success}20`,
          color: value === 'MOVIE' ? T.teal : T.success,
          fontWeight: 700, fontSize: 10,
        }} />
      ),
    },
    { field: 'year', headerName: 'Year', width: 72, type: 'number' },
    {
      field: 'tmdbId', headerName: 'TMDB ID', width: 120,
      renderCell: ({ value, row }) => value ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: .5 }}>
          <Tooltip title="View TMDB data">
            <Box
              onClick={() => openTmdbModal(row)}
              sx={{ color: T.teal, fontSize: 13, cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
            >{value}</Box>
          </Tooltip>
          <Box
            component="a"
            href={`https://www.themoviedb.org/${row.type === 'MOVIE' ? 'movie' : 'tv'}/${value}`}
            target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            sx={{ color: T.textFaint, display: 'flex', alignItems: 'center', '&:hover': { color: T.teal } }}
          >
            <OpenInNewIcon sx={{ fontSize: 11 }} />
          </Box>
        </Box>
      ) : <Box sx={{ color: T.textFaint }}>—</Box>,
    },
    {
      field: 'tags', headerName: 'Tags', flex: 1.5, minWidth: 180, sortable: false,
      renderCell: ({ row }) => <RecordTagsInline record={row} />,
    },
    {
      field: 'createdAt', headerName: 'Created', width: 125,
      renderCell: ({ value }) => value
        ? <Box sx={{ fontSize: 12, color: T.textFaint }}>{formatDistanceToNow(new Date(value), { addSuffix: true })}</Box>
        : <Box sx={{ color: T.textFaint }}>—</Box>,
    },
    {
      field: 'updatedAt', headerName: 'Updated', width: 125,
      renderCell: ({ value }) => value
        ? <Box sx={{ fontSize: 12, color: T.textFaint }}>{formatDistanceToNow(new Date(value), { addSuffix: true })}</Box>
        : <Box sx={{ color: T.textFaint }}>—</Box>,
    },
    {
      field: 'mediaFiles', headerName: 'Files', width: 72, sortable: false,
      renderCell: ({ row }) => (
        <Tooltip title="View media files">
          <IconButton size="small" onClick={() => openMediaFiles(row.recordId)}
            sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
            <VideoFileIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      ),
    },
    {
      field: 'actions', headerName: '', width: 72, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: .5 }}>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal('edit', row.recordId)} sx={{ color: T.textFaint, '&:hover': { color: T.success, bgcolor: `${T.success}15` } }}><EditIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(row.recordId)} sx={{ color: T.textFaint, '&:hover': { color: T.error, bgcolor: T.errorBg } }}><DeleteIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
        </Box>
      ),
    },
  ], [T, onDelete, openModal, openTmdbModal, openRecordDetail, openMediaFiles]);

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
      onRowSelectionModelChange={ids => setSelectedRows(Array.from(ids))}
      hideFooterPagination
      sx={gridSx}
      slotProps={{ loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' } }}
      keepNonExistentRowsSelected
    />
  );
}
