# adminv2 — Record Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade Record Management page inside `db-world-frontend/src/features/adminv2/records/` with server-side pagination, filtering, sorting, and inline tag management.

**Architecture:** Server-side — every filter/sort/page change fires `GET /api/cinema/admin/catalog/table`. Zustand holds all filter/pagination/UI state. TanStack Query caches pages and handles optimistic tag mutations.

**Tech Stack:** React 18, MUI v7, TanStack Query v5, Zustand 5, React Hook Form v7, Zod, Framer Motion, Notistack, Axios

**Prerequisites:** Tasks 1–6 from `2026-03-28-adminv2-setup-users-plan.md` must be completed first (deps, adminApi.js, schemas, stores, routes).

---

## Task 16: RecordFilters component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/records/RecordFilters.jsx`

- [ ] **Step 1: Create RecordFilters.jsx**

```jsx
// db-world-frontend/src/features/adminv2/records/RecordFilters.jsx
import { useRef } from 'react';
import { Box, TextField, ToggleButton, ToggleButtonGroup, InputAdornment, IconButton, Tooltip, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import AddIcon from '@mui/icons-material/Add';
import { useRecordStore } from '../stores/useRecordStore';

const inputSx = {
  minWidth:120,
  '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', color:'#fff', borderRadius:1.5,
    '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' }, '&:hover fieldset':{ borderColor:'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset':{ borderColor:'#6366f1' },
  },
  '& .MuiInputLabel-root':{ color:'rgba(255,255,255,0.4)', fontSize:12 },
  '& .MuiSelect-icon':{ color:'rgba(255,255,255,0.4)' },
};
const toggleSx = { bgcolor:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1) !important', borderRadius:'8px !important', color:'rgba(255,255,255,0.5)', '&.Mui-selected':{ bgcolor:'rgba(99,102,241,0.2)', color:'#6366f1' } };

export default function RecordFilters({ onAdd }) {
  const { filters, setFilter, clearFilters, viewMode, setViewMode } = useRecordStore();
  const searchTimer = useRef(null);

  const debouncedSet = (key, val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilter(key, val), 350);
  };

  const hasFilters = Object.values(filters).some(v => v !== '');

  return (
    <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, p:{ xs:'8px 12px', md:'10px 16px' }, borderBottom:'1px solid rgba(255,255,255,0.06)', alignItems:'center' }}>
      {/* Name search */}
      <TextField size="small" placeholder="Search name…" defaultValue={filters.name}
        onChange={e => debouncedSet('name', e.target.value)} sx={{ ...inputSx, flex:'1 1 180px' }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color:'rgba(255,255,255,0.3)', fontSize:16 }} /></InputAdornment>,
        }} />

      {/* Type filter */}
      <TextField select size="small" label="Type" value={filters.type} onChange={e => setFilter('type', e.target.value)} sx={{ ...inputSx, minWidth:130 }}>
        <MenuItem value="">All</MenuItem>
        <MenuItem value="MOVIE">Movie</MenuItem>
        <MenuItem value="SERIES">Series</MenuItem>
      </TextField>

      {/* Year */}
      <TextField size="small" label="Year" type="number" defaultValue={filters.year}
        onChange={e => debouncedSet('year', e.target.value)} sx={{ ...inputSx, width:100 }}
        inputProps={{ min:1900, max:2100 }} />

      {/* TMDB ID */}
      <TextField size="small" label="TMDB ID" type="number" defaultValue={filters.tmdbId}
        onChange={e => debouncedSet('tmdbId', e.target.value)} sx={{ ...inputSx, width:110 }} />

      {/* Clear filters */}
      {hasFilters && (
        <Tooltip title="Clear filters">
          <IconButton onClick={clearFilters} size="small" sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#ef4444' } }}>
            <FilterListOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Spacer */}
      <Box sx={{ flex:1 }} />

      {/* View toggle */}
      <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
        <ToggleButton value="table" sx={toggleSx}><Tooltip title="Table"><TableRowsIcon fontSize="small" /></Tooltip></ToggleButton>
        <ToggleButton value="grid"  sx={toggleSx}><Tooltip title="Grid"><GridViewIcon fontSize="small" /></Tooltip></ToggleButton>
      </ToggleButtonGroup>

      {/* Add record */}
      <Tooltip title="Add Record">
        <IconButton onClick={onAdd} sx={{ bgcolor:'#6366f1', color:'#fff', borderRadius:2, '&:hover':{ bgcolor:'#5254cc' } }}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/records/RecordFilters.jsx
git commit -m "feat(adminv2): add RecordFilters component"
```

---

## Task 17: RecordTagsInline component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/records/RecordTagsInline.jsx`

- [ ] **Step 1: Create RecordTagsInline.jsx**

```jsx
// db-world-frontend/src/features/adminv2/records/RecordTagsInline.jsx
import { useState } from 'react';
import { Box, Chip, Popover, MenuItem, MenuList, Typography, IconButton, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { addRecordTag, removeRecordTag } from '../api/adminApi';

const ALL_TAGS = ['FEATURED','NEW_RELEASE','TRENDING','EDITOR_PICK','SHOW_ON_TOP','RECENTLY_ADDED','TOP_10'];

const TAG_COLORS = {
  FEATURED:       '#f59e0b',
  NEW_RELEASE:    '#10b981',
  TRENDING:       '#ef4444',
  EDITOR_PICK:    '#8b5cf6',
  SHOW_ON_TOP:    '#6366f1',
  RECENTLY_ADDED: '#06b6d4',
  TOP_10:         '#ec4899',
};

export default function RecordTagsInline({ record, queryKey }) {
  const [anchor, setAnchor] = useState(null);
  const [pendingTag, setPendingTag] = useState(null);
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const currentTagTypes = (record.tags ?? []).map(t => t.tagType);
  const availableTags = ALL_TAGS.filter(t => !currentTagTypes.includes(t));

  const addMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => addRecordTag(recordId, { tagType }),
    onMutate: ({ tagType }) => {
      setPendingTag(tagType);
      // Optimistic update
      qc.setQueryData(queryKey, old => {
        if (!old) return old;
        return {
          ...old,
          content: old.content.map(r => r.id === record.id
            ? { ...r, tags: [...(r.tags ?? []), { tagType, priority: 0 }] }
            : r
          ),
        };
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); enqueueSnackbar('Tag added', { variant:'success', autoHideDuration:1500 }); },
    onError: (_, { tagType }) => {
      // Rollback
      qc.setQueryData(queryKey, old => ({
        ...old,
        content: old.content.map(r => r.id === record.id
          ? { ...r, tags: (r.tags ?? []).filter(t => t.tagType !== tagType) }
          : r
        ),
      }));
      enqueueSnackbar('Failed to add tag', { variant:'error' });
    },
    onSettled: () => { setPendingTag(null); setAnchor(null); },
  });

  const removeMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => removeRecordTag(recordId, tagType),
    onMutate: ({ tagType }) => {
      qc.setQueryData(queryKey, old => ({
        ...old,
        content: old.content.map(r => r.id === record.id
          ? { ...r, tags: (r.tags ?? []).filter(t => t.tagType !== tagType) }
          : r
        ),
      }));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); },
    onError: () => { qc.invalidateQueries({ queryKey }); enqueueSnackbar('Failed to remove tag', { variant:'error' }); },
  });

  return (
    <Box sx={{ display:'flex', flexWrap:'wrap', gap:.5, alignItems:'center' }}>
      {(record.tags ?? []).map(tag => (
        <Chip
          key={tag.tagType}
          label={tag.tagType.replace(/_/g,' ')}
          size="small"
          onDelete={() => removeMutation.mutate({ recordId: record.id, tagType: tag.tagType })}
          sx={{ height:18, fontSize:10, fontWeight:700, bgcolor:`${TAG_COLORS[tag.tagType] ?? '#6366f1'}22`, color: TAG_COLORS[tag.tagType] ?? '#6366f1', border:`1px solid ${TAG_COLORS[tag.tagType] ?? '#6366f1'}44`, '& .MuiChip-deleteIcon':{ color: TAG_COLORS[tag.tagType] ?? '#6366f1', fontSize:12 } }}
        />
      ))}

      {availableTags.length > 0 && (
        <>
          <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}
            sx={{ width:18, height:18, bgcolor:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', '&:hover':{ bgcolor:'rgba(99,102,241,0.2)', color:'#6366f1' } }}>
            {pendingTag ? <CircularProgress size={10} color="inherit" /> : <AddIcon sx={{ fontSize:12 }} />}
          </IconButton>
          <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
            PaperProps={{ sx:{ bgcolor:'#1a1a2e', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', minWidth:160 } }}>
            <MenuList dense>
              {availableTags.map(t => (
                <MenuItem key={t} onClick={() => addMutation.mutate({ recordId: record.id, tagType: t })}
                  sx={{ fontSize:12, '&:hover':{ bgcolor:'rgba(99,102,241,0.15)' } }}>
                  <Box sx={{ width:8, height:8, borderRadius:'50%', bgcolor: TAG_COLORS[t], mr:1, flexShrink:0 }} />
                  {t.replace(/_/g,' ')}
                </MenuItem>
              ))}
            </MenuList>
          </Popover>
        </>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/records/RecordTagsInline.jsx
git commit -m "feat(adminv2): add RecordTagsInline with optimistic add/remove"
```

---

## Task 18: RecordTable component (server-side paginated)

**Files:**
- Create: `db-world-frontend/src/features/adminv2/records/RecordTable.jsx`

- [ ] **Step 1: Create RecordTable.jsx**

```jsx
// db-world-frontend/src/features/adminv2/records/RecordTable.jsx
import { useMemo } from 'react';
import { Box, Chip, IconButton, Tooltip, Link } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { formatDistanceToNow } from 'date-fns';
import { useRecordStore } from '../stores/useRecordStore';
import RecordTagsInline from './RecordTagsInline';

// Map DataGrid sort field → Spring Pageable sort param
const SORT_FIELD_MAP = {
  recordId: 'recordId', name: 'name', type: 'type',
  year: 'year', tmdbId: 'tmdbId', createdAt: 'createdAt', updatedAt: 'updatedAt',
};

const gridSx = {
  bgcolor:'transparent', border:'none', color:'#fff',
  '& .MuiDataGrid-columnHeaders':{ bgcolor:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.5)', fontSize:11, textTransform:'uppercase', letterSpacing:.5 },
  '& .MuiDataGrid-row':{ borderBottom:'1px solid rgba(255,255,255,0.04)', '&:hover':{ bgcolor:'rgba(255,255,255,0.025)' } },
  '& .MuiDataGrid-cell':{ borderBottom:'none', color:'rgba(255,255,255,0.85)', fontSize:13, display:'flex', alignItems:'center' },
  '& .MuiDataGrid-footerContainer':{ borderTop:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)' },
  '& .MuiCheckbox-root':{ color:'rgba(255,255,255,0.3)' },
};

export default function RecordTable({ data, loading, onDelete, queryKey }) {
  const { page, pageSize, sortModel, setPage, setPageSize, setSortModel, setSelectedRows, openDrawer, openModal } = useRecordStore();

  // Convert DataGrid sort to Spring sort param for store
  const handleSortChange = (model) => {
    setSortModel(model.map(s => ({ ...s, field: SORT_FIELD_MAP[s.field] ?? s.field })));
  };

  const columns = useMemo(() => [
    { field:'recordId', headerName:'ID', width:80, type:'number' },
    {
      field:'name', headerName:'Name', flex:1.5, minWidth:160,
      renderCell: ({ value, row }) => (
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          {row.type === 'MOVIE'
            ? <MovieIcon sx={{ fontSize:16, color:'#6366f1', flexShrink:0 }} />
            : <TvIcon    sx={{ fontSize:16, color:'#10b981', flexShrink:0 }} />}
          <Box sx={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</Box>
        </Box>
      ),
    },
    {
      field:'type', headerName:'Type', width:100,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" sx={{ bgcolor: value === 'MOVIE' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: value === 'MOVIE' ? '#6366f1' : '#10b981', fontWeight:700, fontSize:10 }} />
      ),
    },
    { field:'year', headerName:'Year', width:80, type:'number' },
    {
      field:'tmdbId', headerName:'TMDB ID', width:110,
      renderCell: ({ value, row }) => value ? (
        <Link href={`https://www.themoviedb.org/${row.type === 'MOVIE' ? 'movie' : 'tv'}/${value}`} target="_blank" sx={{ color:'#6366f1', fontSize:13 }}>{value}</Link>
      ) : '—',
    },
    {
      field:'tags', headerName:'Tags', flex:1.5, minWidth:180, sortable:false,
      renderCell: ({ row }) => <RecordTagsInline record={row} queryKey={queryKey} />,
    },
    {
      field:'createdAt', headerName:'Created', width:130,
      renderCell: ({ value }) => value ? <Box sx={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>{formatDistanceToNow(new Date(value), { addSuffix:true })}</Box> : '—',
    },
    {
      field:'updatedAt', headerName:'Updated', width:130,
      renderCell: ({ value }) => value ? <Box sx={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>{formatDistanceToNow(new Date(value), { addSuffix:true })}</Box> : '—',
    },
    {
      field:'actions', headerName:'', width:120, sortable:false,
      renderCell: ({ row }) => (
        <Box sx={{ display:'flex', gap:.5 }}>
          <Tooltip title="View"><IconButton size="small" onClick={() => openDrawer(row.recordId)} sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#6366f1' } }}><VisibilityIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal('edit', row.recordId)} sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#10b981' } }}><EditIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(row.recordId)} sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#ef4444' } }}><DeleteIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
        </Box>
      ),
    },
  ], [onDelete, openDrawer, openModal, queryKey]);

  return (
    <DataGrid
      rows={data?.content ?? []}
      columns={columns}
      getRowId={r => r.recordId}
      loading={loading}
      rowCount={data?.totalElements ?? 0}
      paginationMode="server"
      sortingMode="server"
      paginationModel={{ page, pageSize }}
      onPaginationModelChange={({ page: p, pageSize: s }) => { setPage(p); setPageSize(s); }}
      sortModel={sortModel.map(s => ({ field: Object.keys(SORT_FIELD_MAP).find(k => SORT_FIELD_MAP[k] === s.field) ?? s.field, sort: s.sort }))}
      onSortModelChange={handleSortChange}
      pageSizeOptions={[10, 25, 50, 100]}
      checkboxSelection
      disableRowSelectionOnClick
      onRowSelectionModelChange={ids => setSelectedRows(Array.from(ids))}
      sx={gridSx}
      slotProps={{ loadingOverlay:{ variant:'skeleton', noRowsVariant:'skeleton' } }}
      keepNonExistentRowsSelected
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/records/RecordTable.jsx
git commit -m "feat(adminv2): add server-side RecordTable with 7 sortable columns"
```

---

## Task 19: RecordGrid component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/records/RecordGrid.jsx`

- [ ] **Step 1: Create RecordGrid.jsx**

```jsx
// db-world-frontend/src/features/adminv2/records/RecordGrid.jsx
import { Box, Skeleton, IconButton, Tooltip, Typography, Pagination } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { motion } from 'framer-motion';
import { useRecordStore } from '../stores/useRecordStore';
import RecordTagsInline from './RecordTagsInline';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';

function RecordCard({ record, onDelete, index, queryKey }) {
  const { openDrawer, openModal } = useRecordStore();
  const poster = record.tmdb?.posterPath ?? record.tmdb?.backdropPath;

  return (
    <motion.div initial={{ opacity:0, scale:.97 }} animate={{ opacity:1, scale:1 }} transition={{ delay: index * 0.03 }}>
      <Box sx={{ bgcolor:'#131320', border:'1px solid rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden', display:'flex', flexDirection:'column', '&:hover':{ borderColor:'rgba(99,102,241,0.3)' }, transition:'border-color .2s' }}>
        {/* Poster */}
        <Box sx={{ position:'relative', aspectRatio:'2/3', bgcolor:'rgba(255,255,255,0.04)', overflow:'hidden' }}>
          {poster
            ? <Box component="img" src={`${TMDB_IMG}${poster}`} alt={record.name} sx={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" />
            : <Box sx={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {record.type === 'MOVIE' ? <MovieIcon sx={{ fontSize:40, color:'rgba(255,255,255,0.15)' }} /> : <TvIcon sx={{ fontSize:40, color:'rgba(255,255,255,0.15)' }} />}
              </Box>
          }
          {/* Type badge */}
          <Box sx={{ position:'absolute', top:8, left:8, px:1, py:.25, borderRadius:1, bgcolor: record.type === 'MOVIE' ? 'rgba(99,102,241,0.85)' : 'rgba(16,185,129,0.85)', fontSize:10, fontWeight:700, color:'#fff' }}>
            {record.type}
          </Box>
          {/* Hover actions */}
          <Box sx={{ position:'absolute', top:8, right:8, display:'flex', flexDirection:'column', gap:.5, opacity:0, '.MuiBox-root:hover > &':{ opacity:1 }, transition:'opacity .2s' }}>
            <Tooltip title="View" placement="left"><IconButton size="small" onClick={() => openDrawer(record.recordId)} sx={{ bgcolor:'rgba(0,0,0,0.6)', color:'#fff','&:hover':{ bgcolor:'#6366f1' } }}><VisibilityIcon sx={{ fontSize:14 }} /></IconButton></Tooltip>
            <Tooltip title="Edit" placement="left"><IconButton size="small" onClick={() => openModal('edit', record.recordId)} sx={{ bgcolor:'rgba(0,0,0,0.6)', color:'#fff','&:hover':{ bgcolor:'#10b981' } }}><EditIcon sx={{ fontSize:14 }} /></IconButton></Tooltip>
            <Tooltip title="Delete" placement="left"><IconButton size="small" onClick={() => onDelete(record.recordId)} sx={{ bgcolor:'rgba(0,0,0,0.6)', color:'#fff','&:hover':{ bgcolor:'#ef4444' } }}><DeleteIcon sx={{ fontSize:14 }} /></IconButton></Tooltip>
          </Box>
        </Box>
        {/* Info */}
        <Box sx={{ p:1.5, flex:1, display:'flex', flexDirection:'column', gap:.75 }}>
          <Typography sx={{ fontSize:13, fontWeight:600, color:'#fff', lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{record.name}</Typography>
          <Box sx={{ display:'flex', gap:1, fontSize:11, color:'rgba(255,255,255,0.4)' }}>
            {record.year && <span>{record.year}</span>}
            {record.tmdbId && <span>TMDB: {record.tmdbId}</span>}
          </Box>
          <RecordTagsInline record={record} queryKey={queryKey} />
        </Box>
      </Box>
    </motion.div>
  );
}

export default function RecordGrid({ data, loading, onDelete, queryKey }) {
  const { page, pageSize, setPage } = useRecordStore();
  const totalPages = data?.totalPages ?? 0;

  if (loading) return (
    <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:2, p:2 }}>
      {Array.from({ length: pageSize }).map((_, i) => (
        <Box key={i}>
          <Skeleton variant="rounded" sx={{ aspectRatio:'2/3', bgcolor:'rgba(255,255,255,0.05)' }} />
          <Skeleton height={20} sx={{ bgcolor:'rgba(255,255,255,0.05)', mt:.5 }} />
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2, p:2 }}>
      <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:2 }}>
        {(data?.content ?? []).map((r, i) => (
          <RecordCard key={r.recordId} record={r} onDelete={onDelete} index={i} queryKey={queryKey} />
        ))}
      </Box>
      {totalPages > 1 && (
        <Box sx={{ display:'flex', justifyContent:'center' }}>
          <Pagination count={totalPages} page={page + 1} onChange={(_, p) => setPage(p - 1)}
            sx={{ '& .MuiPaginationItem-root':{ color:'rgba(255,255,255,0.5)' }, '& .Mui-selected':{ bgcolor:'rgba(99,102,241,0.3) !important', color:'#6366f1' } }} />
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/records/RecordGrid.jsx
git commit -m "feat(adminv2): add RecordGrid poster card view"
```

---

## Task 20: RecordMobileList component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/records/RecordMobileList.jsx`

- [ ] **Step 1: Create RecordMobileList.jsx**

```jsx
// db-world-frontend/src/features/adminv2/records/RecordMobileList.jsx
import { Box, Chip, IconButton, Menu, MenuItem, ListItemIcon, Skeleton, Typography, Pagination } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { useState } from 'react';
import { useRecordStore } from '../stores/useRecordStore';
import { formatDistanceToNow } from 'date-fns';

const TMDB_THUMB = 'https://image.tmdb.org/t/p/w92';

function RecordRow({ record, onDelete }) {
  const { openDrawer, openModal } = useRecordStore();
  const [anchor, setAnchor] = useState(null);
  const poster = record.tmdb?.posterPath;

  return (
    <Box sx={{ display:'flex', alignItems:'center', gap:1.5, p:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      {/* Thumbnail */}
      <Box sx={{ width:36, height:52, borderRadius:1, overflow:'hidden', flexShrink:0, bgcolor:'rgba(255,255,255,0.06)' }}>
        {poster
          ? <Box component="img" src={`${TMDB_THUMB}${poster}`} alt={record.name} sx={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <Box sx={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {record.type === 'MOVIE' ? <MovieIcon sx={{ fontSize:16, color:'rgba(255,255,255,0.2)' }} /> : <TvIcon sx={{ fontSize:16, color:'rgba(255,255,255,0.2)' }} />}
            </Box>
        }
      </Box>
      {/* Info */}
      <Box sx={{ flex:1, minWidth:0 }}>
        <Box sx={{ fontWeight:600, fontSize:14, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{record.name}</Box>
        <Box sx={{ display:'flex', gap:1, mt:.25, flexWrap:'wrap' }}>
          <Chip label={record.type} size="small" sx={{ height:16, fontSize:9, fontWeight:700, bgcolor: record.type === 'MOVIE' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: record.type === 'MOVIE' ? '#6366f1' : '#10b981' }} />
          {record.year && <Box sx={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{record.year}</Box>}
        </Box>
        {record.updatedAt && <Box sx={{ fontSize:11, color:'rgba(255,255,255,0.3)', mt:.25 }}>{formatDistanceToNow(new Date(record.updatedAt), { addSuffix:true })}</Box>}
      </Box>
      {/* Menu */}
      <IconButton size="small" sx={{ color:'rgba(255,255,255,0.4)' }} onClick={e => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        PaperProps={{ sx:{ bgcolor:'#1a1a2e', border:'1px solid rgba(255,255,255,0.08)', color:'#fff' } }}>
        <MenuItem onClick={() => { openDrawer(record.recordId); setAnchor(null); }}>
          <ListItemIcon><VisibilityIcon fontSize="small" sx={{ color:'#6366f1' }} /></ListItemIcon>View
        </MenuItem>
        <MenuItem onClick={() => { openModal('edit', record.recordId); setAnchor(null); }}>
          <ListItemIcon><EditIcon fontSize="small" sx={{ color:'#10b981' }} /></ListItemIcon>Edit
        </MenuItem>
        <MenuItem onClick={() => { onDelete(record.recordId); setAnchor(null); }}>
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color:'#ef4444' }} /></ListItemIcon>
          <Box sx={{ color:'#ef4444' }}>Delete</Box>
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default function RecordMobileList({ data, loading, onDelete }) {
  const { page, setPage } = useRecordStore();
  const totalPages = data?.totalPages ?? 0;

  if (loading) return (
    <Box>{Array.from({ length:8 }).map((_, i) => <Skeleton key={i} height={72} sx={{ bgcolor:'rgba(255,255,255,0.04)', mx:2, mb:.5 }} />)}</Box>
  );

  return (
    <Box>
      {(data?.content ?? []).map(r => <RecordRow key={r.recordId} record={r} onDelete={onDelete} />)}
      {totalPages > 1 && (
        <Box sx={{ display:'flex', justifyContent:'center', py:2 }}>
          <Pagination count={totalPages} page={page + 1} onChange={(_, p) => setPage(p - 1)} size="small"
            sx={{ '& .MuiPaginationItem-root':{ color:'rgba(255,255,255,0.5)' }, '& .Mui-selected':{ bgcolor:'rgba(99,102,241,0.3) !important', color:'#6366f1' } }} />
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/records/RecordMobileList.jsx
git commit -m "feat(adminv2): add RecordMobileList for mobile view"
```

---

## Task 21: RecordDetailDrawer component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/records/RecordDetailDrawer.jsx`

- [ ] **Step 1: Create RecordDetailDrawer.jsx**

```jsx
// db-world-frontend/src/features/adminv2/records/RecordDetailDrawer.jsx
import { Drawer, Box, Typography, Chip, Divider, IconButton, Skeleton, Rating } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useRecordStore } from '../stores/useRecordStore';

const TMDB_IMG   = 'https://image.tmdb.org/t/p/w500';
const TMDB_SMALL = 'https://image.tmdb.org/t/p/w185';

const InfoRow = ({ label, value }) => value ? (
  <Box sx={{ display:'flex', justifyContent:'space-between', py:.75, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
    <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{label}</Typography>
    <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.8)', textAlign:'right', maxWidth:'60%' }}>{value}</Typography>
  </Box>
) : null;

export default function RecordDetailDrawer({ data }) {
  const { drawerRecordId, closeDrawer } = useRecordStore();
  const open = Boolean(drawerRecordId);

  // Find record in current page data
  const record = data?.content?.find(r => r.recordId === drawerRecordId);
  const tmdb   = record?.tmdb;

  const backdrop = tmdb?.backdropPath ?? tmdb?.posterPath;
  const genres   = tmdb?.genres?.map(g => g.name).join(', ');
  const providers = tmdb?.providers?.flatMap(p => p.providerName ? [p.providerName] : []).join(', ');

  return (
    <Drawer anchor="right" open={open} onClose={closeDrawer}
      PaperProps={{ sx:{ width:{ xs:'100vw', sm:460 }, bgcolor:'#0d0d18', borderLeft:'1px solid rgba(255,255,255,0.06)', color:'#fff', display:'flex', flexDirection:'column' } }}>

      {/* Backdrop */}
      {backdrop && (
        <Box sx={{ position:'relative', height:180, overflow:'hidden', flexShrink:0 }}>
          <Box component="img" src={`${TMDB_IMG}${backdrop}`} alt="" sx={{ width:'100%', height:'100%', objectFit:'cover', filter:'brightness(.55)' }} />
          <Box sx={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 40%, #0d0d18 100%)' }} />
          <IconButton onClick={closeDrawer} sx={{ position:'absolute', top:8, right:8, color:'#fff', bgcolor:'rgba(0,0,0,0.5)' }}><CloseIcon /></IconButton>
        </Box>
      )}

      {/* Header (when no backdrop) */}
      {!backdrop && (
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', p:2, borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          <Typography sx={{ fontWeight:700, fontSize:16 }}>Record Details</Typography>
          <IconButton onClick={closeDrawer} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
        </Box>
      )}

      <Box sx={{ p:2, overflowY:'auto', flex:1 }}>
        {!record ? (
          <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
            {Array.from({ length:10 }).map((_, i) => <Skeleton key={i} height={28} sx={{ bgcolor:'rgba(255,255,255,0.05)' }} />)}
          </Box>
        ) : (
          <>
            <Typography sx={{ fontWeight:700, fontSize:20, mb:.5 }}>{record.name}</Typography>
            <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', mb:1.5 }}>
              <Chip label={record.type} size="small" sx={{ bgcolor: record.type === 'MOVIE' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: record.type === 'MOVIE' ? '#6366f1' : '#10b981', fontWeight:700 }} />
              {record.year && <Chip label={record.year} size="small" sx={{ bgcolor:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)' }} />}
            </Box>

            {tmdb?.voteAverage > 0 && (
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1.5 }}>
                <Rating value={tmdb.voteAverage / 2} precision={0.5} readOnly size="small" sx={{ color:'#f59e0b' }} />
                <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>{tmdb.voteAverage?.toFixed(1)} / 10</Typography>
              </Box>
            )}

            {tmdb?.overview && (
              <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.65)', lineHeight:1.6, mb:2 }}>{tmdb.overview}</Typography>
            )}

            <InfoRow label="TMDB ID"  value={record.tmdbId} />
            <InfoRow label="Genres"   value={genres} />
            <InfoRow label="Runtime"  value={tmdb?.runtime ? `${tmdb.runtime} min` : null} />
            <InfoRow label="Status"   value={tmdb?.status} />
            <InfoRow label="Language" value={tmdb?.originalLanguage?.toUpperCase()} />
            <InfoRow label="Providers" value={providers} />

            {/* Tags */}
            {record.tags?.length > 0 && (
              <>
                <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.06)' }} />
                <Typography sx={{ fontSize:11, textTransform:'uppercase', letterSpacing:.8, color:'rgba(255,255,255,0.3)', mb:1 }}>Tags</Typography>
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:.75 }}>
                  {record.tags.map(t => (
                    <Chip key={t.tagType} label={t.tagType.replace(/_/g,' ')} size="small" sx={{ fontSize:11, fontWeight:700, bgcolor:'rgba(99,102,241,0.15)', color:'#6366f1' }} />
                  ))}
                </Box>
              </>
            )}

            {/* Cast */}
            {tmdb?.credits?.cast?.length > 0 && (
              <>
                <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.06)' }} />
                <Typography sx={{ fontSize:11, textTransform:'uppercase', letterSpacing:.8, color:'rgba(255,255,255,0.3)', mb:1 }}>Cast</Typography>
                <Box sx={{ display:'flex', gap:1.5, overflowX:'auto', pb:1 }}>
                  {tmdb.credits.cast.slice(0,10).map(c => (
                    <Box key={c.id} sx={{ flexShrink:0, textAlign:'center', width:60 }}>
                      <Box sx={{ width:52, height:52, borderRadius:'50%', overflow:'hidden', bgcolor:'rgba(255,255,255,0.08)', mx:'auto' }}>
                        {c.profilePath
                          ? <Box component="img" src={`${TMDB_SMALL}${c.profilePath}`} alt={c.name} sx={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <Box sx={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'rgba(255,255,255,0.4)' }}>{c.name?.[0]}</Box>
                        }
                      </Box>
                      <Typography sx={{ fontSize:10, color:'rgba(255,255,255,0.6)', mt:.5, lineHeight:1.2, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{c.name}</Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/records/RecordDetailDrawer.jsx
git commit -m "feat(adminv2): add RecordDetailDrawer with TMDB metadata, cast, tags"
```

---

## Task 22: RecordCreateModal component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/records/RecordCreateModal.jsx`

- [ ] **Step 1: Create RecordCreateModal.jsx**

```jsx
// db-world-frontend/src/features/adminv2/records/RecordCreateModal.jsx
import { useState, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Typography, CircularProgress, IconButton, Chip, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { createRecord, searchTmdb } from '../api/adminApi';
import { useRecordStore } from '../stores/useRecordStore';

const TMDB_IMG   = 'https://image.tmdb.org/t/p/w185';
const inputSx    = { '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', color:'#fff', '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' }, '&:hover fieldset':{ borderColor:'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset':{ borderColor:'#6366f1' } }, '& .MuiInputLabel-root':{ color:'rgba(255,255,255,0.5)' } };

export default function RecordCreateModal({ open, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { filters } = useRecordStore();

  const [type,        setType]        = useState('MOVIE');
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchTimer = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true); setSearchError('');
    try { setResults(await searchTmdb(type, q)); }
    catch { setSearchError('TMDB search failed'); }
    finally { setSearching(false); }
  };

  const handleQueryChange = (e) => {
    const v = e.target.value; setQuery(v); setSelected(null);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(v), 500);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => createRecord({ type, tmdbId: selected.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['records'] });
      enqueueSnackbar('Record created', { variant:'success' });
      handleClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Create failed', { variant:'error' }),
  });

  const handleClose = () => {
    setType('MOVIE'); setQuery(''); setResults([]); setSelected(null); setSearchError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx:{ bgcolor:'#0d0d18', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', width:'100%', maxWidth:580 } }}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        Add Record
        <IconButton onClick={handleClose} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
        {/* Type select */}
        <TextField select label="Type" value={type} onChange={e => { setType(e.target.value); setResults([]); setSelected(null); }} size="small" sx={inputSx}>
          <MenuItem value="MOVIE">Movie</MenuItem>
          <MenuItem value="SERIES">Series</MenuItem>
        </TextField>

        {/* TMDB search */}
        <TextField size="small" label="Search TMDB" value={query} onChange={handleQueryChange} sx={inputSx}
          InputProps={{ endAdornment: searching ? <CircularProgress size={16} sx={{ color:'rgba(255,255,255,0.4)' }} /> : <SearchIcon sx={{ color:'rgba(255,255,255,0.3)', fontSize:18 }} /> }} />

        {searchError && <Alert severity="error" sx={{ bgcolor:'rgba(239,68,68,0.1)', color:'#ef4444' }}>{searchError}</Alert>}

        {/* Results */}
        {results.length > 0 && (
          <Box sx={{ display:'flex', flexDirection:'column', gap:1, maxHeight:320, overflowY:'auto' }}>
            {results.slice(0,10).map(r => {
              const isSelected = selected?.id === r.id;
              return (
                <Box key={r.id} onClick={() => setSelected(isSelected ? null : r)}
                  sx={{ display:'flex', gap:1.5, p:1.5, borderRadius:1.5, border:`1px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.06)'}`, bgcolor: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)', cursor:'pointer', '&:hover':{ borderColor:'rgba(99,102,241,0.4)' }, transition:'all .15s' }}>
                  <Box sx={{ width:46, height:68, borderRadius:1, overflow:'hidden', flexShrink:0, bgcolor:'rgba(255,255,255,0.06)' }}>
                    {r.posterPath && <Box component="img" src={`${TMDB_IMG}${r.posterPath}`} alt={r.title ?? r.name} sx={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                  </Box>
                  <Box sx={{ flex:1, minWidth:0 }}>
                    <Typography sx={{ fontWeight:600, fontSize:14, color:'#fff' }}>{r.title ?? r.name}</Typography>
                    <Box sx={{ display:'flex', gap:1, mt:.25 }}>
                      {(r.releaseDate ?? r.firstAirDate) && <Chip label={(r.releaseDate ?? r.firstAirDate).slice(0,4)} size="small" sx={{ height:18, fontSize:10, bgcolor:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)' }} />}
                      {r.voteAverage > 0 && <Chip label={`★ ${r.voteAverage.toFixed(1)}`} size="small" sx={{ height:18, fontSize:10, bgcolor:'rgba(245,158,11,0.15)', color:'#f59e0b' }} />}
                    </Box>
                    <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.45)', mt:.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{r.overview}</Typography>
                  </Box>
                  {isSelected && <CheckCircleIcon sx={{ color:'#6366f1', flexShrink:0 }} />}
                </Box>
              );
            })}
          </Box>
        )}

        {selected && (
          <Alert severity="info" icon={<CheckCircleIcon />} sx={{ bgcolor:'rgba(99,102,241,0.1)', color:'#6366f1', '& .MuiAlert-icon':{ color:'#6366f1' } }}>
            Selected: <b>{selected.title ?? selected.name}</b> (TMDB ID: {selected.id})
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px:3, pb:2 }}>
        <Button onClick={handleClose} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancel</Button>
        <Button onClick={() => mutate()} disabled={!selected || isPending} variant="contained" sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Add Record'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/records/RecordCreateModal.jsx
git commit -m "feat(adminv2): add RecordCreateModal with TMDB search flow"
```

---

## Task 23: RecordEditModal component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/records/RecordEditModal.jsx`

- [ ] **Step 1: Create RecordEditModal.jsx**

```jsx
// db-world-frontend/src/features/adminv2/records/RecordEditModal.jsx
import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Typography, CircularProgress, IconButton, Chip, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { updateRecord, createTag, deleteTag } from '../api/adminApi';
import { updateRecordSchema } from '../schemas/recordSchemas';

const ALL_TAGS   = ['FEATURED','NEW_RELEASE','TRENDING','EDITOR_PICK','SHOW_ON_TOP','RECENTLY_ADDED','TOP_10'];
const TAG_COLORS = { FEATURED:'#f59e0b', NEW_RELEASE:'#10b981', TRENDING:'#ef4444', EDITOR_PICK:'#8b5cf6', SHOW_ON_TOP:'#6366f1', RECENTLY_ADDED:'#06b6d4', TOP_10:'#ec4899' };
const inputSx    = { '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', color:'#fff', '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' }, '&:hover fieldset':{ borderColor:'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset':{ borderColor:'#6366f1' } }, '& .MuiInputLabel-root':{ color:'rgba(255,255,255,0.5)' }, '& .MuiFormHelperText-root':{ color:'#ef4444' } };

export default function RecordEditModal({ open, record, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { control, handleSubmit, reset, formState:{ errors } } = useForm({
    resolver: zodResolver(updateRecordSchema),
    defaultValues: { type:'MOVIE', tmdbId:'' },
  });

  useEffect(() => {
    if (record) reset({ type: record.type, tmdbId: record.tmdbId ?? '' });
  }, [record, reset]);

  // Update record details
  const { mutate: doUpdate, isPending: updating } = useMutation({
    mutationFn: (d) => updateRecord(record.recordId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); enqueueSnackbar('Record updated', { variant:'success' }); onClose(); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Update failed', { variant:'error' }),
  });

  // Add tag
  const { mutate: doAddTag, isPending: addingTag } = useMutation({
    mutationFn: ({ tagType }) => createTag(record.recordId, { tagType, priority: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); enqueueSnackbar('Tag added', { variant:'success', autoHideDuration:1500 }); },
    onError: () => enqueueSnackbar('Failed to add tag', { variant:'error' }),
  });

  // Remove tag
  const { mutate: doRemoveTag } = useMutation({
    mutationFn: (tagId) => deleteTag(tagId),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); },
    onError: () => enqueueSnackbar('Failed to remove tag', { variant:'error' }),
  });

  const currentTags    = record?.tags ?? [];
  const currentTypes   = currentTags.map(t => t.tagType);
  const availableTags  = ALL_TAGS.filter(t => !currentTypes.includes(t));

  if (!record) return null;

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx:{ bgcolor:'#0d0d18', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', width:'100%', maxWidth:520 } }}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        Edit Record — <Box component="span" sx={{ color:'rgba(255,255,255,0.5)', fontSize:14, fontWeight:400, ml:.5 }}>{record.name}</Box>
        <IconButton onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(d => doUpdate(d))}>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
          {/* Type */}
          <Controller name="type" control={control} render={({ field }) => (
            <TextField {...field} select label="Type" size="small" sx={inputSx} error={!!errors.type} helperText={errors.type?.message}>
              <MenuItem value="MOVIE">Movie</MenuItem>
              <MenuItem value="SERIES">Series</MenuItem>
            </TextField>
          )} />

          {/* TMDB ID */}
          <Controller name="tmdbId" control={control} render={({ field }) => (
            <TextField {...field} label="TMDB ID" type="number" size="small" sx={inputSx} error={!!errors.tmdbId} helperText={errors.tmdbId?.message} />
          )} />

          <Divider sx={{ borderColor:'rgba(255,255,255,0.06)' }} />

          {/* Tags section */}
          <Box>
            <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:.6, mb:1 }}>Tags</Typography>
            <Box sx={{ display:'flex', flexWrap:'wrap', gap:.75 }}>
              {currentTags.map(tag => (
                <Chip
                  key={tag.id ?? tag.tagType}
                  label={tag.tagType.replace(/_/g,' ')}
                  size="small"
                  onDelete={() => doRemoveTag(tag.id)}
                  deleteIcon={<DeleteIcon sx={{ fontSize:'12px !important' }} />}
                  sx={{ bgcolor:`${TAG_COLORS[tag.tagType] ?? '#6366f1'}22`, color: TAG_COLORS[tag.tagType] ?? '#6366f1', border:`1px solid ${TAG_COLORS[tag.tagType] ?? '#6366f1'}44`, fontWeight:700, fontSize:11 }}
                />
              ))}
              {currentTags.length === 0 && (
                <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>No tags assigned</Typography>
              )}
            </Box>

            {/* Add tag */}
            {availableTags.length > 0 && (
              <Box sx={{ mt:1.5 }}>
                <Typography sx={{ fontSize:11, color:'rgba(255,255,255,0.35)', mb:.75 }}>Add tag:</Typography>
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:.5 }}>
                  {availableTags.map(t => (
                    <Box key={t} onClick={() => doAddTag({ tagType: t })}
                      sx={{ px:1.25, py:.35, borderRadius:99, border:`1px solid ${TAG_COLORS[t]}44`, color:TAG_COLORS[t], fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:.5, '&:hover':{ bgcolor:`${TAG_COLORS[t]}22` }, transition:'all .15s' }}>
                      {addingTag ? <CircularProgress size={10} color="inherit" /> : <AddIcon sx={{ fontSize:12 }} />}
                      {t.replace(/_/g,' ')}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2 }}>
          <Button onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={updating} sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
            {updating ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/records/RecordEditModal.jsx
git commit -m "feat(adminv2): add RecordEditModal with tag management section"
```

---

## Task 24: RecordManagementV2 orchestrator (index.jsx)

**Files:**
- Create: `db-world-frontend/src/features/adminv2/records/index.jsx`

- [ ] **Step 1: Create index.jsx**

```jsx
// db-world-frontend/src/features/adminv2/records/index.jsx
import { useCallback, useMemo } from 'react';
import { Box, Typography, Fab, useMediaQuery, useTheme, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import ListIcon from '@mui/icons-material/List';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { getRecordsTable, deleteRecord } from '../api/adminApi';
import { useRecordStore } from '../stores/useRecordStore';
import RecordFilters from './RecordFilters';
import RecordTable from './RecordTable';
import RecordGrid from './RecordGrid';
import RecordMobileList from './RecordMobileList';
import RecordDetailDrawer from './RecordDetailDrawer';
import RecordCreateModal from './RecordCreateModal';
import RecordEditModal from './RecordEditModal';

export default function RecordManagementV2() {
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const { viewMode, filters, page, pageSize, sortModel, modalState, editRecordId, openModal, closeModal } = useRecordStore();

  // Build query params for server-side request
  const queryParams = useMemo(() => {
    const params = {
      page,
      size: pageSize,
      ...(filters.name    && { name:    filters.name }),
      ...(filters.type    && { type:    filters.type }),
      ...(filters.year    && { year:    Number(filters.year) }),
      ...(filters.tmdbId  && { tmdbId:  Number(filters.tmdbId) }),
      ...(filters.recordId && { recordId: Number(filters.recordId) }),
    };
    if (sortModel.length > 0) {
      params.sort = sortModel.map(s => `${s.field},${s.sort}`).join('&sort=');
    }
    return params;
  }, [filters, page, pageSize, sortModel]);

  const queryKey = ['records', queryParams];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getRecordsTable(queryParams),
    placeholderData: (prev) => prev,   // keepPreviousData equivalent in v5
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['records'] }); enqueueSnackbar('Record deleted', { variant:'success' }); },
    onError:   () => enqueueSnackbar('Delete failed', { variant:'error' }),
  });

  const handleDelete = useCallback((id) => {
    if (window.confirm('Delete this record?')) doDelete(id);
  }, [doDelete]);

  const editRecord = useMemo(() =>
    data?.content?.find(r => r.recordId === editRecordId) ?? null,
  [data, editRecordId]);

  const stats = useMemo(() => ({
    total:   data?.totalElements ?? 0,
    movies:  data?.content?.filter(r => r.type === 'MOVIE').length ?? 0,
    series:  data?.content?.filter(r => r.type === 'SERIES').length ?? 0,
  }), [data]);

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column', bgcolor:'#0d0d18', color:'#fff', minHeight:0 }}>
      {/* Page header */}
      <Box sx={{ px:{ xs:2, md:3 }, pt:{ xs:2, md:3 }, pb:1, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Box>
          <Typography sx={{ fontWeight:700, fontSize:{ xs:18, md:22 } }}>Records</Typography>
          <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.4)', mt:.25 }}>Manage movies and series catalog</Typography>
        </Box>
        {!isMobile && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')} sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
            Add Record
          </Button>
        )}
      </Box>

      {/* Stats bar */}
      <Box sx={{ display:'flex', gap:2, px:{ xs:2, md:3 }, py:1, flexWrap:'wrap' }}>
        {[
          { label:'Total',  value: stats.total,  icon:<ListIcon  sx={{ fontSize:14, color:'#6366f1' }} />, color:'#6366f1' },
          { label:'Movies', value: stats.movies, icon:<MovieIcon sx={{ fontSize:14, color:'#6366f1' }} />, color:'#6366f1' },
          { label:'Series', value: stats.series, icon:<TvIcon    sx={{ fontSize:14, color:'#10b981' }} />, color:'#10b981' },
        ].map(s => (
          <Box key={s.label} sx={{ display:'flex', alignItems:'center', gap:.75 }}>
            {s.icon}
            <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>{s.label}:</Typography>
            <Typography sx={{ fontSize:13, fontWeight:700, color:s.color }}>{s.value}</Typography>
          </Box>
        ))}
        {data?.totalElements != null && (
          <Box sx={{ ml:'auto', fontSize:12, color:'rgba(255,255,255,0.3)' }}>
            Page {(data.number ?? 0) + 1} of {data.totalPages ?? 1}
          </Box>
        )}
      </Box>

      {/* Filters */}
      <RecordFilters onAdd={() => openModal('create')} />

      {/* Error */}
      {error && (
        <Box sx={{ p:2 }}>
          <Box sx={{ bgcolor:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:2, p:2, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Typography sx={{ color:'#ef4444', fontSize:13 }}>Failed to load records</Typography>
            <Button size="small" onClick={refetch} sx={{ color:'#ef4444' }}>Retry</Button>
          </Box>
        </Box>
      )}

      {/* Data view */}
      <Box sx={{ flex:1, overflow:'auto', minHeight:0 }}>
        {isMobile ? (
          <RecordMobileList data={data} loading={isLoading} onDelete={handleDelete} />
        ) : viewMode === 'table' ? (
          <RecordTable data={data} loading={isLoading} onDelete={handleDelete} queryKey={queryKey} />
        ) : (
          <RecordGrid data={data} loading={isLoading} onDelete={handleDelete} queryKey={queryKey} />
        )}
      </Box>

      {/* Mobile FAB */}
      {isMobile && (
        <Fab onClick={() => openModal('create')} sx={{ position:'fixed', bottom:24, right:24, bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
          <AddIcon />
        </Fab>
      )}

      {/* Drawers & Modals */}
      <RecordDetailDrawer data={data} />
      <RecordCreateModal open={modalState === 'create'} onClose={closeModal} />
      <RecordEditModal   open={modalState === 'edit'}   record={editRecord} onClose={closeModal} />
    </Box>
  );
}
```

- [ ] **Step 2: Open browser and verify**

Navigate to `http://localhost:5173/db-world/admin/v2/records`.

Expected:
- Page loads with "Records" header and stats bar
- Filters: name search, type dropdown, year, TMDB ID inputs visible
- Table loads with server-side pagination (page controls at bottom)
- Sort clicking on column headers triggers new API call (check Network tab)
- "+ Add Record" opens TMDB search modal
- Mobile view shows list with poster thumbnails (test at 390px width in devtools)
- No console errors

- [ ] **Step 3: Commit**

```bash
git add src/features/adminv2/records/
git commit -m "feat(adminv2): complete Record Management V2 page"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `npm run build` completes without errors
- [ ] V1 routes (`/admin/users`, `/admin/records`) still work
- [ ] V2 routes (`/admin/v2/users`, `/admin/v2/records`) both load
- [ ] Record table: changing sort column fires new network request with sort param
- [ ] Record filters: typing in name field fires new request after 350ms debounce
- [ ] Record tags: clicking `×` on a tag optimistically removes it, clicking `+` adds it
- [ ] User table: sorting/searching is instant (client-side)
- [ ] Create user modal: submitting with invalid data shows field-level errors
- [ ] Create record modal: TMDB search returns results, selecting one and confirming creates record
- [ ] Mobile (390px): table is hidden, mobile list shows for both pages
- [ ] Mobile FAB is visible and opens create modal
