# adminv2 — Setup & User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared adminv2 infrastructure and a production-grade User Management page inside `db-world-frontend/src/features/adminv2/`.

**Architecture:** New folder alongside V1 — routes wired into existing AdminLayout and App.jsx. Shared `adminApi.js` calls correct new backend paths. TanStack Query manages server state; Zustand manages UI state; RHF + Zod handle all forms.

**Tech Stack:** React 18, MUI v7, TanStack Query v5, Zustand 5, React Hook Form v7, Zod, Framer Motion, Notistack, Axios

---

## Task 1: Install new dependencies

**Files:**
- Modify: `db-world-frontend/package.json` (via npm install)

- [ ] **Step 1: Install packages**

```bash
cd db-world-frontend
npm install @tanstack/react-query @tanstack/react-query-devtools zod @hookform/resolvers
```

Expected output: 4 packages added, no peer dep warnings.

- [ ] **Step 2: Verify install**

```bash
grep -E "@tanstack|\"zod\"|@hookform/resolvers" package.json
```

Expected: all 3 entries visible in `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(adminv2): install tanstack-query, zod, hookform-resolvers"
```

---

## Task 2: Add QueryClientProvider to App.jsx

**Files:**
- Modify: `db-world-frontend/src/app/App.jsx`

- [ ] **Step 1: Add imports at the top of App.jsx** (after existing imports)

```jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 min
      gcTime: 1000 * 60 * 10,          // 10 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 2: Wrap the return JSX**

Find the outermost element returned by `App` (likely a `<Router>` or `<ThemeProvider>`) and wrap it:

```jsx
return (
  <QueryClientProvider client={queryClient}>
    {/* existing JSX unchanged */}
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);
```

- [ ] **Step 3: Verify dev server starts without error**

```bash
npm run dev
```

Expected: Vite starts, no import errors, ReactQueryDevtools panel visible in bottom-right corner.

- [ ] **Step 4: Commit**

```bash
git add src/app/App.jsx
git commit -m "feat(adminv2): add QueryClientProvider to app root"
```

---

## Task 3: Create adminApi.js

**Files:**
- Create: `db-world-frontend/src/features/adminv2/api/adminApi.js`

- [ ] **Step 1: Create the file**

```js
// db-world-frontend/src/features/adminv2/api/adminApi.js
import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

/* ─── USER APIS ─────────────────────────────────────────────────── */

export const getAllUsers = () =>
  axiosInstance.get('/api/user/all').then(r => r.data.data);

export const getUserById = (userId) =>
  axiosInstance.get(`/api/user/${userId}`).then(r => r.data.data);

export const createUser = (body) =>
  axiosInstance.post('/api/user', body).then(r => r.data.data);

export const bulkCreateUsers = (body) =>
  axiosInstance.post('/api/user/bulk', body).then(r => r.data.data);

export const updateUser = (userId, body) =>
  axiosInstance.put(`/api/user/${userId}`, body).then(r => r.data.data);

export const updateUserRole = (userId, roleId) =>
  axiosInstance.patch(`/api/user/${userId}/role`, null, { params: { roleId } }).then(r => r.data.data);

export const deleteUser = (userId) =>
  axiosInstance.delete(`/api/user/${userId}`).then(r => r.data);

export const changePassword = (body) =>
  axiosInstance.patch('/api/user/change-password', body).then(r => r.data);

export const searchUsers = (q, limit = 5) =>
  axiosInstance.get('/api/user/search', { params: { q, limit } }).then(r => r.data.data);

/* ─── RECORD APIS ───────────────────────────────────────────────── */

export const getRecordsTable = (params) =>
  axiosInstance.get('/api/cinema/admin/catalog/table', { params }).then(r => r.data.data);
  // returns Spring Page: { content: [], totalElements, totalPages, number, size }

export const createRecord = (body) =>
  axiosInstance.post('/api/cinema/admin/catalog', body).then(r => r.data.data);

export const updateRecord = (id, body) =>
  axiosInstance.put(`/api/cinema/admin/catalog/${id}`, body).then(r => r.data.data);

export const deleteRecord = (id) =>
  axiosInstance.delete(`/api/cinema/admin/catalog/${id}`).then(r => r.data);

export const addRecordTag = (recordId, body) =>
  axiosInstance.post(`/api/cinema/admin/catalog/${recordId}/tags`, body).then(r => r.data.data);

export const removeRecordTag = (recordId, tagType) =>
  axiosInstance.delete(`/api/cinema/admin/catalog/${recordId}/tags/${tagType}`).then(r => r.data);

export const createTag = (recordId, body) =>
  axiosInstance.post(`/api/cinema/admin/catalog/tags/${recordId}`, body).then(r => r.data.data);

export const updateTag = (tagId, body) =>
  axiosInstance.put(`/api/cinema/admin/catalog/tags/${tagId}`, body).then(r => r.data.data);

export const deleteTag = (tagId) =>
  axiosInstance.delete(`/api/cinema/admin/catalog/tags/${tagId}`).then(r => r.data);

/* ─── TMDB SEARCH (for record create modal) ─────────────────────── */

export const searchTmdb = (type, query, year) =>
  axiosInstance.get('/api/tmdb/search', { params: { type, query, year } }).then(r => r.data.data);
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/api/adminApi.js
git commit -m "feat(adminv2): add adminApi.js with correct backend paths"
```

---

## Task 4: Create Zod schemas

**Files:**
- Create: `db-world-frontend/src/features/adminv2/schemas/userSchemas.js`
- Create: `db-world-frontend/src/features/adminv2/schemas/recordSchemas.js`

- [ ] **Step 1: Create userSchemas.js**

```js
// db-world-frontend/src/features/adminv2/schemas/userSchemas.js
import { z } from 'zod';

export const createUserSchema = z.object({
  firstName: z.string().min(2, 'Min 2 chars').max(20, 'Max 20 chars'),
  lastName:  z.string().min(1, 'Min 1 char').max(20, 'Max 20 chars'),
  dob:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: yyyy-MM-dd').optional().or(z.literal('')),
  gender:    z.string().min(1, 'Required'),
  mobileNo:  z.coerce.number()
               .min(999999999, 'Must be at least 9 digits')
               .max(9999999999, 'Must be at most 10 digits'),
  email:     z.string().email('Invalid email'),
  password:  z.string().min(6, 'Min 6 chars').max(100, 'Max 100 chars'),
  roleId:    z.coerce.number().optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(2).max(20),
  lastName:  z.string().min(1).max(20),
  dob:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  gender:    z.string().min(1),
  mobileNo:  z.coerce.number().min(999999999).max(9999999999),
  password:  z.string().min(6).max(100),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword:     z.string().min(6, 'Min 6 chars').max(100),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

- [ ] **Step 2: Create recordSchemas.js**

```js
// db-world-frontend/src/features/adminv2/schemas/recordSchemas.js
import { z } from 'zod';

export const createRecordSchema = z.object({
  type:   z.enum(['MOVIE', 'SERIES'], { required_error: 'Type is required' }),
  tmdbId: z.coerce.number().int().positive('Must be a positive integer'),
});

export const updateRecordSchema = createRecordSchema;

export const addTagSchema = z.object({
  tagType:  z.enum(['FEATURED','NEW_RELEASE','TRENDING','EDITOR_PICK','SHOW_ON_TOP','RECENTLY_ADDED','TOP_10']),
  priority: z.coerce.number().int().min(0).max(999).optional(),
});
```

- [ ] **Step 3: Commit**

```bash
git add src/features/adminv2/schemas/
git commit -m "feat(adminv2): add zod validation schemas for users and records"
```

---

## Task 5: Create Zustand stores

**Files:**
- Create: `db-world-frontend/src/features/adminv2/stores/useUserStore.js`
- Create: `db-world-frontend/src/features/adminv2/stores/useRecordStore.js`

- [ ] **Step 1: Create useUserStore.js**

```js
// db-world-frontend/src/features/adminv2/stores/useUserStore.js
import { create } from 'zustand';

export const useUserStore = create((set) => ({
  // view
  viewMode:     'table',      // 'table' | 'grid'
  setViewMode:  (v) => set({ viewMode: v }),

  // filters (client-side)
  searchTerm:    '',
  roleFilter:    'ALL',       // 'ALL' | 'OWNER' | 'ADMIN' | 'VIEWER'
  sortModel:     [],
  setSearchTerm: (v) => set({ searchTerm: v }),
  setRoleFilter: (v) => set({ roleFilter: v }),
  setSortModel:  (v) => set({ sortModel: v }),

  // selection
  selectedRows:     [],
  setSelectedRows:  (v) => set({ selectedRows: v }),
  clearSelection:   () => set({ selectedRows: [] }),

  // modals / drawer
  drawerUserId:   null,
  modalState:     null,   // null | 'create' | 'edit' | 'bulk'
  editUserId:     null,
  openDrawer:     (id) => set({ drawerUserId: id }),
  closeDrawer:    () => set({ drawerUserId: null }),
  openModal:      (type, userId = null) => set({ modalState: type, editUserId: userId }),
  closeModal:     () => set({ modalState: null, editUserId: null }),
}));
```

- [ ] **Step 2: Create useRecordStore.js**

```js
// db-world-frontend/src/features/adminv2/stores/useRecordStore.js
import { create } from 'zustand';

export const useRecordStore = create((set) => ({
  // view
  viewMode:    'table',   // 'table' | 'grid'
  setViewMode: (v) => set({ viewMode: v }),

  // server-side filters
  filters: {
    name:     '',
    type:     '',        // '' | 'MOVIE' | 'SERIES'
    year:     '',
    tmdbId:   '',
    recordId: '',
  },
  setFilter:    (key, value) => set(s => ({ filters: { ...s.filters, [key]: value } })),
  clearFilters: () => set({ filters: { name:'', type:'', year:'', tmdbId:'', recordId:'' }, page: 0 }),

  // pagination
  page:        0,
  pageSize:    25,
  setPage:     (p) => set({ page: p }),
  setPageSize: (s) => set({ pageSize: s, page: 0 }),

  // sort — maps to Spring Pageable sort param
  sortModel:    [],        // [{ field: 'name', sort: 'asc' }]
  setSortModel: (v) => set({ sortModel: v }),

  // selection
  selectedRows:    [],
  setSelectedRows: (v) => set({ selectedRows: v }),
  clearSelection:  () => set({ selectedRows: [] }),

  // modals / drawer
  drawerRecordId: null,
  modalState:     null,   // null | 'create' | 'edit'
  editRecordId:   null,
  openDrawer:     (id) => set({ drawerRecordId: id }),
  closeDrawer:    () => set({ drawerRecordId: null }),
  openModal:      (type, id = null) => set({ modalState: type, editRecordId: id }),
  closeModal:     () => set({ modalState: null, editRecordId: null }),
}));
```

- [ ] **Step 3: Commit**

```bash
git add src/features/adminv2/stores/
git commit -m "feat(adminv2): add zustand stores for user and record UI state"
```

---

## Task 6: Wire V2 routes into App.jsx and AdminLayout.jsx

**Files:**
- Modify: `db-world-frontend/src/app/App.jsx`
- Modify: `db-world-frontend/src/features/admin/layout/AdminLayout.jsx`

- [ ] **Step 1: Add lazy imports to App.jsx** (after the last existing lazy admin import)

```jsx
const LazyUserManagementV2  = lazy(() => import('../features/adminv2/users'));
const LazyRecordManagementV2 = lazy(() => import('../features/adminv2/records'));
```

- [ ] **Step 2: Add routes to App.jsx** (inside the AdminLayout route block, after the last existing admin route)

```jsx
<Route path="v2/users"   element={<LazyUserManagementV2 />} />
<Route path="v2/records" element={<LazyRecordManagementV2 />} />
```

- [ ] **Step 3: Add nav items to AdminLayout.jsx**

In the `NAV` array, find the `Users` section and add a new item; find the `Content` section and add a record item. Or add a new `V2` section at the top:

```js
{
  id: 'v2',
  label: 'V2 (New)',
  items: [
    {
      id: 'v2-users',
      label: 'Users V2',
      icon: ManageAccountsIcon,   // already imported or add: import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
      path: 'v2/users',
      badge: 'New',
    },
    {
      id: 'v2-records',
      label: 'Records V2',
      icon: MovieIcon,            // already imported or add: import MovieIcon from '@mui/icons-material/Movie'
      path: 'v2/records',
      badge: 'New',
    },
  ],
},
```

Note: Add the icon imports at the top of AdminLayout.jsx if not already present:
```js
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import MovieIcon from '@mui/icons-material/Movie';
```

- [ ] **Step 4: Verify navigation works**

```bash
npm run dev
```
Navigate to `http://localhost:5173/db-world/admin` — confirm the "V2 (New)" section appears in the sidebar with both links. Clicking them should show a 404-style blank (no component yet) without crashing.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.jsx src/features/admin/layout/AdminLayout.jsx
git commit -m "feat(adminv2): add v2 routes and sidebar nav items"
```

---

## Task 7: UserFilters component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/users/UserFilters.jsx`

- [ ] **Step 1: Create UserFilters.jsx**

```jsx
// db-world-frontend/src/features/adminv2/users/UserFilters.jsx
import { useRef } from 'react';
import { Box, TextField, ToggleButton, ToggleButtonGroup, InputAdornment, IconButton, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { useUserStore } from '../stores/useUserStore';

const ROLE_OPTIONS = ['ALL','OWNER','ADMIN','VIEWER'];

const sx = {
  wrap:   { display:'flex', flexWrap:'wrap', gap:1, alignItems:'center', p:{ xs:'8px 12px', md:'12px 16px' }, borderBottom:'1px solid rgba(255,255,255,0.06)' },
  search: { flex:'1 1 200px', minWidth:0, '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', borderRadius:2, color:'#fff', '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' }, '&:hover fieldset':{ borderColor:'rgba(255,255,255,0.2)' } } },
  chip:   (active) => ({ px:1.5, py:0.5, borderRadius:99, border:'1px solid', borderColor: active ? '#6366f1' : 'rgba(255,255,255,0.1)', color: active ? '#6366f1' : 'rgba(255,255,255,0.6)', bgcolor: active ? 'rgba(99,102,241,0.12)' : 'transparent', cursor:'pointer', fontSize:12, fontWeight:600, userSelect:'none', transition:'all .15s' }),
  toggle: { bgcolor:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1) !important', borderRadius:'8px !important', color:'rgba(255,255,255,0.5)', '&.Mui-selected':{ bgcolor:'rgba(99,102,241,0.2)', color:'#6366f1' } },
};

export default function UserFilters({ onAddUser }) {
  const { searchTerm, setSearchTerm, roleFilter, setRoleFilter, viewMode, setViewMode } = useUserStore();
  const timerRef = useRef(null);

  const handleSearch = (e) => {
    const v = e.target.value;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearchTerm(v), 250);
  };

  return (
    <Box sx={sx.wrap}>
      {/* Search */}
      <TextField
        size="small"
        placeholder="Search name, email…"
        defaultValue={searchTerm}
        onChange={handleSearch}
        sx={sx.search}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color:'rgba(255,255,255,0.3)', fontSize:18 }} /></InputAdornment>,
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ color:'rgba(255,255,255,0.4)' }}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      {/* Role chips */}
      <Box sx={{ display:'flex', gap:0.75, flexShrink:0 }}>
        {ROLE_OPTIONS.map(r => (
          <Box key={r} sx={sx.chip(roleFilter === r)} onClick={() => setRoleFilter(r)}>{r}</Box>
        ))}
      </Box>

      {/* View toggle */}
      <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
        <ToggleButton value="table" sx={sx.toggle}><Tooltip title="Table"><TableRowsIcon fontSize="small" /></Tooltip></ToggleButton>
        <ToggleButton value="grid"  sx={sx.toggle}><Tooltip title="Grid"><GridViewIcon fontSize="small" /></Tooltip></ToggleButton>
      </ToggleButtonGroup>

      {/* Add user */}
      <Tooltip title="Add User">
        <IconButton onClick={onAddUser} sx={{ bgcolor:'#6366f1', color:'#fff', borderRadius:2, '&:hover':{ bgcolor:'#5254cc' } }}>
          <GroupAddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/users/UserFilters.jsx
git commit -m "feat(adminv2): add UserFilters component"
```

---

## Task 8: UserTable component (desktop)

**Files:**
- Create: `db-world-frontend/src/features/adminv2/users/UserTable.jsx`

- [ ] **Step 1: Create UserTable.jsx**

```jsx
// db-world-frontend/src/features/adminv2/users/UserTable.jsx
import { useMemo } from 'react';
import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useUserStore } from '../stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';

const ROLE_COLORS = { OWNER:'#f59e0b', ADMIN:'#6366f1', VIEWER:'#10b981' };

const gridSx = {
  bgcolor:'transparent', border:'none', color:'#fff',
  '& .MuiDataGrid-columnHeaders':{ bgcolor:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.5)', fontSize:11, textTransform:'uppercase', letterSpacing:.5 },
  '& .MuiDataGrid-row':{ borderBottom:'1px solid rgba(255,255,255,0.04)', '&:hover':{ bgcolor:'rgba(255,255,255,0.03)' } },
  '& .MuiDataGrid-cell':{ borderBottom:'none', color:'rgba(255,255,255,0.85)', fontSize:13 },
  '& .MuiDataGrid-footerContainer':{ borderTop:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)' },
  '& .MuiCheckbox-root':{ color:'rgba(255,255,255,0.3)' },
  '& .MuiDataGrid-virtualScroller':{ minHeight:200 },
};

export default function UserTable({ users, loading, onDelete }) {
  const { setSelectedRows, sortModel, setSortModel, openDrawer, openModal } = useUserStore();

  const columns = useMemo(() => [
    {
      field:'fullName', headerName:'Name', flex:1.5, minWidth:160,
      valueGetter: (_, row) => `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
      renderCell: ({ value, row }) => (
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          <Box sx={{ width:30, height:30, borderRadius:'50%', bgcolor:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
            {(row.firstName?.[0] ?? '?').toUpperCase()}
          </Box>
          <Box sx={{ overflow:'hidden' }}>
            <Box sx={{ fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</Box>
            <Box sx={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{row.email}</Box>
          </Box>
        </Box>
      ),
    },
    { field:'email', headerName:'Email', flex:1.5, minWidth:180 },
    { field:'mobileNo', headerName:'Mobile', flex:1, minWidth:130, valueFormatter: v => v ?? '—' },
    {
      field:'userRole', headerName:'Role', width:110,
      renderCell: ({ row }) => {
        const role = row.userRole?.roleName ?? 'VIEWER';
        return <Chip label={role} size="small" sx={{ bgcolor:`${ROLE_COLORS[role]}22`, color:ROLE_COLORS[role], border:`1px solid ${ROLE_COLORS[role]}44`, fontWeight:600, fontSize:11 }} />;
      },
    },
    { field:'noOfLogin', headerName:'Logins', width:90, type:'number', align:'center', headerAlign:'center' },
    {
      field:'lastLogin', headerName:'Last Login', width:140,
      valueGetter: (_, row) => row.loginData?.[0]?.loginTime ?? null,
      renderCell: ({ value }) => value ? <Box sx={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{formatDistanceToNow(new Date(value), { addSuffix:true })}</Box> : '—',
    },
    {
      field:'actions', headerName:'', width:160, sortable:false,
      renderCell: ({ row }) => (
        <Box sx={{ display:'flex', gap:0.5 }}>
          <Tooltip title="View"><IconButton size="small" onClick={() => openDrawer(row.userId)} sx={{ color:'rgba(255,255,255,0.5)','&:hover':{ color:'#6366f1' } }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal('edit', row.userId)} sx={{ color:'rgba(255,255,255,0.5)','&:hover':{ color:'#10b981' } }}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Change Role"><IconButton size="small" onClick={() => openModal('role', row.userId)} sx={{ color:'rgba(255,255,255,0.5)','&:hover':{ color:'#f59e0b' } }}><AdminPanelSettingsIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(row.userId)} sx={{ color:'rgba(255,255,255,0.5)','&:hover':{ color:'#ef4444' } }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ], [openDrawer, openModal, onDelete]);

  return (
    <DataGrid
      rows={users}
      columns={columns}
      getRowId={r => r.userId}
      loading={loading}
      checkboxSelection
      disableRowSelectionOnClick
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      onRowSelectionModelChange={ids => setSelectedRows(Array.from(ids))}
      pageSizeOptions={[25, 50, 100]}
      initialState={{ pagination:{ paginationModel:{ pageSize:25 } } }}
      sx={gridSx}
      slotProps={{ loadingOverlay:{ variant:'skeleton', noRowsVariant:'skeleton' } }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/users/UserTable.jsx
git commit -m "feat(adminv2): add UserTable with MUI DataGrid"
```

---

## Task 9: UserGrid component (tablet/desktop)

**Files:**
- Create: `db-world-frontend/src/features/adminv2/users/UserGrid.jsx`

- [ ] **Step 1: Create UserGrid.jsx**

```jsx
// db-world-frontend/src/features/adminv2/users/UserGrid.jsx
import { Box, Chip, IconButton, Tooltip, Skeleton } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion } from 'framer-motion';
import { useUserStore } from '../stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';

const ROLE_COLORS = { OWNER:'#f59e0b', ADMIN:'#6366f1', VIEWER:'#10b981' };

function UserCard({ user, onDelete, index }) {
  const { openDrawer, openModal } = useUserStore();
  const role = user.userRole?.roleName ?? 'VIEWER';

  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: index * 0.04 }}>
      <Box sx={{ bgcolor:'#131320', border:'1px solid rgba(255,255,255,0.06)', borderRadius:2, p:2, display:'flex', flexDirection:'column', gap:1.5, '&:hover':{ borderColor:'rgba(99,102,241,0.3)', boxShadow:'0 0 0 1px rgba(99,102,241,0.15)' }, transition:'all .2s' }}>
        {/* Header */}
        <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
          <Box sx={{ width:40, height:40, borderRadius:'50%', bgcolor:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, flexShrink:0 }}>
            {(user.firstName?.[0] ?? '?').toUpperCase()}
          </Box>
          <Box sx={{ flex:1, minWidth:0 }}>
            <Box sx={{ fontWeight:600, fontSize:14, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {user.firstName} {user.lastName}
            </Box>
            <Box sx={{ fontSize:12, color:'rgba(255,255,255,0.45)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.email}</Box>
          </Box>
          <Chip label={role} size="small" sx={{ bgcolor:`${ROLE_COLORS[role]}22`, color:ROLE_COLORS[role], fontWeight:700, fontSize:11 }} />
        </Box>
        {/* Stats */}
        <Box sx={{ display:'flex', gap:2, fontSize:12, color:'rgba(255,255,255,0.45)' }}>
          <span>Logins: <b style={{ color:'rgba(255,255,255,0.7)' }}>{user.noOfLogin ?? 0}</b></span>
          {user.loginData?.[0]?.loginTime && (
            <span>Last: <b style={{ color:'rgba(255,255,255,0.7)' }}>{formatDistanceToNow(new Date(user.loginData[0].loginTime), { addSuffix:true })}</b></span>
          )}
        </Box>
        {/* Actions */}
        <Box sx={{ display:'flex', gap:0.5, justifyContent:'flex-end' }}>
          <Tooltip title="View"><IconButton size="small" onClick={() => openDrawer(user.userId)} sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#6366f1' } }}><VisibilityIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal('edit', user.userId)} sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#10b981' } }}><EditIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(user.userId)} sx={{ color:'rgba(255,255,255,0.4)','&:hover':{ color:'#ef4444' } }}><DeleteIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
        </Box>
      </Box>
    </motion.div>
  );
}

export default function UserGrid({ users, loading, onDelete }) {
  if (loading) {
    return (
      <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:2, p:2 }}>
        {Array.from({ length:8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={140} sx={{ bgcolor:'rgba(255,255,255,0.05)' }} />
        ))}
      </Box>
    );
  }
  return (
    <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:2, p:2 }}>
      {users.map((u, i) => <UserCard key={u.userId} user={u} onDelete={onDelete} index={i} />)}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/users/UserGrid.jsx
git commit -m "feat(adminv2): add UserGrid card view"
```

---

## Task 10: UserMobileList component (mobile only)

**Files:**
- Create: `db-world-frontend/src/features/adminv2/users/UserMobileList.jsx`

- [ ] **Step 1: Create UserMobileList.jsx**

```jsx
// db-world-frontend/src/features/adminv2/users/UserMobileList.jsx
import { Box, Chip, IconButton, Menu, MenuItem, ListItemIcon, Skeleton } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';

const ROLE_COLORS = { OWNER:'#f59e0b', ADMIN:'#6366f1', VIEWER:'#10b981' };

function UserRow({ user, onDelete }) {
  const { openDrawer, openModal } = useUserStore();
  const [anchor, setAnchor] = useState(null);
  const role = user.userRole?.roleName ?? 'VIEWER';

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:1.5, p:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <Box sx={{ width:36, height:36, borderRadius:'50%', bgcolor:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0 }}>
          {(user.firstName?.[0] ?? '?').toUpperCase()}
        </Box>
        <Box sx={{ flex:1, minWidth:0 }}>
          <Box sx={{ fontWeight:600, fontSize:14, color:'#fff' }}>{user.firstName} {user.lastName}</Box>
          <Box sx={{ fontSize:12, color:'rgba(255,255,255,0.45)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</Box>
          {user.loginData?.[0]?.loginTime && (
            <Box sx={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>{formatDistanceToNow(new Date(user.loginData[0].loginTime), { addSuffix:true })}</Box>
          )}
        </Box>
        <Chip label={role} size="small" sx={{ bgcolor:`${ROLE_COLORS[role]}22`, color:ROLE_COLORS[role], fontWeight:700, fontSize:10 }} />
        <IconButton size="small" sx={{ color:'rgba(255,255,255,0.4)' }} onClick={e => setAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
          PaperProps={{ sx:{ bgcolor:'#1a1a2e', border:'1px solid rgba(255,255,255,0.08)', color:'#fff' } }}>
          <MenuItem onClick={() => { openDrawer(user.userId); setAnchor(null); }}>
            <ListItemIcon><VisibilityIcon fontSize="small" sx={{ color:'#6366f1' }} /></ListItemIcon>View
          </MenuItem>
          <MenuItem onClick={() => { openModal('edit', user.userId); setAnchor(null); }}>
            <ListItemIcon><EditIcon fontSize="small" sx={{ color:'#10b981' }} /></ListItemIcon>Edit
          </MenuItem>
          <MenuItem onClick={() => { onDelete(user.userId); setAnchor(null); }}>
            <ListItemIcon><DeleteIcon fontSize="small" sx={{ color:'#ef4444' }} /></ListItemIcon>
            <Box sx={{ color:'#ef4444' }}>Delete</Box>
          </MenuItem>
        </Menu>
      </Box>
    </motion.div>
  );
}

export default function UserMobileList({ users, loading, onDelete }) {
  if (loading) return (
    <Box>{Array.from({ length:6 }).map((_, i) => <Skeleton key={i} height={72} sx={{ bgcolor:'rgba(255,255,255,0.04)', mx:2, mb:.5 }} />)}</Box>
  );
  return (
    <Box>{users.map(u => <UserRow key={u.userId} user={u} onDelete={onDelete} />)}</Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/users/UserMobileList.jsx
git commit -m "feat(adminv2): add UserMobileList for mobile view"
```

---

## Task 11: UserDetailDrawer component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/users/UserDetailDrawer.jsx`

- [ ] **Step 1: Create UserDetailDrawer.jsx**

```jsx
// db-world-frontend/src/features/adminv2/users/UserDetailDrawer.jsx
import { Drawer, Box, Typography, Chip, Divider, IconButton, Skeleton, Avatar } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '../stores/useUserStore';
import { getUserById } from '../api/adminApi';
import { format } from 'date-fns';

const ROLE_COLORS = { OWNER:'#f59e0b', ADMIN:'#6366f1', VIEWER:'#10b981' };

const InfoRow = ({ label, value }) => (
  <Box sx={{ display:'flex', justifyContent:'space-between', py:1, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
    <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>{label}</Typography>
    <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.85)', textAlign:'right', maxWidth:'60%' }}>{value ?? '—'}</Typography>
  </Box>
);

export default function UserDetailDrawer() {
  const { drawerUserId, closeDrawer } = useUserStore();
  const open = Boolean(drawerUserId);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', drawerUserId],
    queryFn: () => getUserById(drawerUserId),
    enabled: open,
  });

  const role = user?.userRole?.roleName ?? 'VIEWER';

  return (
    <Drawer anchor="right" open={open} onClose={closeDrawer}
      PaperProps={{ sx:{ width:{ xs:'100vw', sm:420 }, bgcolor:'#0d0d18', borderLeft:'1px solid rgba(255,255,255,0.06)', color:'#fff' } }}>
      {/* Header */}
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', p:2, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <Typography sx={{ fontWeight:700, fontSize:16 }}>User Details</Typography>
        <IconButton onClick={closeDrawer} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p:2, overflowY:'auto', flex:1 }}>
        {isLoading ? (
          <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
            <Skeleton variant="circular" width={64} height={64} sx={{ bgcolor:'rgba(255,255,255,0.05)', mx:'auto' }} />
            {Array.from({ length:8 }).map((_, i) => <Skeleton key={i} height={36} sx={{ bgcolor:'rgba(255,255,255,0.05)' }} />)}
          </Box>
        ) : user && (
          <>
            {/* Avatar */}
            <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', mb:3, gap:1 }}>
              <Avatar sx={{ width:64, height:64, bgcolor:'#6366f1', fontSize:24, fontWeight:700 }}>
                {(user.firstName?.[0] ?? '?').toUpperCase()}
              </Avatar>
              <Typography sx={{ fontWeight:700, fontSize:18 }}>{user.firstName} {user.lastName}</Typography>
              <Chip label={role} size="small" sx={{ bgcolor:`${ROLE_COLORS[role]}22`, color:ROLE_COLORS[role], fontWeight:700 }} />
            </Box>

            <Typography sx={{ fontSize:11, textTransform:'uppercase', letterSpacing:.8, color:'rgba(255,255,255,0.3)', mb:1 }}>Profile</Typography>
            <InfoRow label="Email"    value={user.email} />
            <InfoRow label="Mobile"   value={user.mobileNo} />
            <InfoRow label="Gender"   value={user.gender} />
            <InfoRow label="DOB"      value={user.dob ? format(new Date(user.dob), 'dd MMM yyyy') : null} />
            <InfoRow label="Logins"   value={user.noOfLogin} />
            <InfoRow label="Created"  value={user.creationDate ? format(new Date(user.creationDate), 'dd MMM yyyy') : null} />

            {/* Login history */}
            {user.loginData?.length > 0 && (
              <>
                <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.06)' }} />
                <Typography sx={{ fontSize:11, textTransform:'uppercase', letterSpacing:.8, color:'rgba(255,255,255,0.3)', mb:1 }}>Login History</Typography>
                {user.loginData.slice(0,5).map((l, i) => (
                  <Box key={i} sx={{ py:.75, borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:12, color:'rgba(255,255,255,0.6)' }}>
                    {l.loginTime ? format(new Date(l.loginTime), 'dd MMM yyyy, HH:mm') : '—'} · {l.ipAddress ?? 'unknown'}
                  </Box>
                ))}
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
git add src/features/adminv2/users/UserDetailDrawer.jsx
git commit -m "feat(adminv2): add UserDetailDrawer with login history"
```

---

## Task 12: UserCreateModal component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/users/UserCreateModal.jsx`

- [ ] **Step 1: Create UserCreateModal.jsx**

```jsx
// db-world-frontend/src/features/adminv2/users/UserCreateModal.jsx
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField, MenuItem, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { createUserSchema } from '../schemas/userSchemas';
import { createUser } from '../api/adminApi';

const dialogSx = { PaperProps:{ sx:{ bgcolor:'#0d0d18', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', width:'100%', maxWidth:540 } } };
const inputSx  = { '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', color:'#fff', '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' }, '&:hover fieldset':{ borderColor:'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset':{ borderColor:'#6366f1' } }, '& .MuiInputLabel-root':{ color:'rgba(255,255,255,0.5)' }, '& .MuiFormHelperText-root':{ color:'#ef4444' } };

export default function UserCreateModal({ open, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { control, handleSubmit, reset, formState:{ errors } } = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { firstName:'', lastName:'', dob:'', gender:'', mobileNo:'', email:'', password:'', roleId:'' },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['users'] });
      enqueueSnackbar('User created successfully', { variant:'success' });
      reset(); onClose();
    },
    onError: (err) => enqueueSnackbar(err?.response?.data?.message ?? 'Failed to create user', { variant:'error' }),
  });

  const F = ({ name, label, type='text', ...props }) => (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField {...field} label={label} type={type} size="small" fullWidth sx={inputSx} error={!!errors[name]} helperText={errors[name]?.message} {...props} />
    )} />
  );

  return (
    <Dialog open={open} onClose={onClose} fullScreen={false} sx={dialogSx}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', pb:1 }}>
        Add User
        <IconButton onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(d => mutate(d))}>
        <DialogContent sx={{ pt:1 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}><F name="firstName" label="First Name" /></Grid>
            <Grid item xs={6}><F name="lastName"  label="Last Name" /></Grid>
            <Grid item xs={12}><F name="email"    label="Email" type="email" /></Grid>
            <Grid item xs={6}><F name="password"  label="Password" type="password" /></Grid>
            <Grid item xs={6}><F name="mobileNo"  label="Mobile No" type="number" /></Grid>
            <Grid item xs={6}><F name="dob"       label="Date of Birth" type="date" InputLabelProps={{ shrink:true }} /></Grid>
            <Grid item xs={6}>
              <Controller name="gender" control={control} render={({ field }) => (
                <TextField {...field} select label="Gender" size="small" fullWidth sx={inputSx} error={!!errors.gender} helperText={errors.gender?.message}>
                  {['Male','Female','Other'].map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
              )} />
            </Grid>
            <Grid item xs={12}>
              <Controller name="roleId" control={control} render={({ field }) => (
                <TextField {...field} select label="Role (optional)" size="small" fullWidth sx={inputSx}>
                  <MenuItem value="">Default (Viewer)</MenuItem>
                  <MenuItem value={1}>Owner</MenuItem>
                  <MenuItem value={2}>Admin</MenuItem>
                  <MenuItem value={3}>Viewer</MenuItem>
                </TextField>
              )} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2 }}>
          <Button onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending} sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Create User'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/users/UserCreateModal.jsx
git commit -m "feat(adminv2): add UserCreateModal with Zod validation"
```

---

## Task 13: UserEditModal component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/users/UserEditModal.jsx`

- [ ] **Step 1: Create UserEditModal.jsx**

```jsx
// db-world-frontend/src/features/adminv2/users/UserEditModal.jsx
import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField, MenuItem, IconButton, CircularProgress, Tabs, Tab, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { updateUserSchema, changePasswordSchema } from '../schemas/userSchemas';
import { updateUser, changePassword, getUserById } from '../api/adminApi';

const inputSx = { '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', color:'#fff', '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' }, '&:hover fieldset':{ borderColor:'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset':{ borderColor:'#6366f1' } }, '& .MuiInputLabel-root':{ color:'rgba(255,255,255,0.5)' }, '& .MuiFormHelperText-root':{ color:'#ef4444' } };
const tabSx  = { color:'rgba(255,255,255,0.5)', '&.Mui-selected':{ color:'#6366f1' } };

function ProfileTab({ userId, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: user } = useQuery({ queryKey:['user', userId], queryFn:() => getUserById(userId), enabled:!!userId });

  const { control, handleSubmit, reset, formState:{ errors } } = useForm({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { firstName:'', lastName:'', dob:'', gender:'', mobileNo:'', password:'' },
  });

  useEffect(() => {
    if (user) reset({ firstName:user.firstName??'', lastName:user.lastName??'', dob:user.dob??'', gender:user.gender??'', mobileNo:user.mobileNo??'', password:'' });
  }, [user, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (d) => updateUser(userId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['users'] }); qc.invalidateQueries({ queryKey:['user', userId] }); enqueueSnackbar('User updated', { variant:'success' }); onClose(); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Update failed', { variant:'error' }),
  });

  const F = ({ name, label, ...props }) => (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField {...field} label={label} size="small" fullWidth sx={inputSx} error={!!errors[name]} helperText={errors[name]?.message} {...props} />
    )} />
  );

  return (
    <form onSubmit={handleSubmit(d => mutate(d))}>
      <Grid container spacing={2} sx={{ pt:1 }}>
        <Grid item xs={6}><F name="firstName" label="First Name" /></Grid>
        <Grid item xs={6}><F name="lastName"  label="Last Name" /></Grid>
        <Grid item xs={6}><F name="mobileNo"  label="Mobile" type="number" /></Grid>
        <Grid item xs={6}><F name="dob"       label="Date of Birth" type="date" InputLabelProps={{ shrink:true }} /></Grid>
        <Grid item xs={6}>
          <Controller name="gender" control={control} render={({ field }) => (
            <TextField {...field} select label="Gender" size="small" fullWidth sx={inputSx}>
              {['Male','Female','Other'].map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
            </TextField>
          )} />
        </Grid>
        <Grid item xs={6}><F name="password" label="New Password" type="password" /></Grid>
      </Grid>
      <Box sx={{ display:'flex', justifyContent:'flex-end', mt:2, gap:1 }}>
        <Button onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isPending} sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
        </Button>
      </Box>
    </form>
  );
}

function PasswordTab({ userId, onClose }) {
  const { enqueueSnackbar } = useSnackbar();
  const { control, handleSubmit, formState:{ errors } } = useForm({ resolver: zodResolver(changePasswordSchema) });

  const { mutate, isPending } = useMutation({
    mutationFn: changePassword,
    onSuccess: () => { enqueueSnackbar('Password changed', { variant:'success' }); onClose(); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed', { variant:'error' }),
  });

  const F = ({ name, label }) => (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField {...field} label={label} type="password" size="small" fullWidth sx={{ ...inputSx, mb:2 }} error={!!errors[name]} helperText={errors[name]?.message} />
    )} />
  );

  return (
    <form onSubmit={handleSubmit(d => mutate(d))}>
      <Box sx={{ pt:1 }}>
        <F name="currentPassword" label="Current Password" />
        <F name="newPassword"     label="New Password" />
        <F name="confirmPassword" label="Confirm Password" />
        <Box sx={{ display:'flex', justifyContent:'flex-end', gap:1 }}>
          <Button onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending} sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Change Password'}
          </Button>
        </Box>
      </Box>
    </form>
  );
}

export default function UserEditModal({ open, userId, onClose }) {
  const [tab, setTab] = useState(0);
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx:{ bgcolor:'#0d0d18', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', width:'100%', maxWidth:520 } }}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', pb:0 }}>
        Edit User
        <IconButton onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px:2, borderBottom:'1px solid rgba(255,255,255,0.06)', '& .MuiTabs-indicator':{ bgcolor:'#6366f1' } }}>
        <Tab label="Profile" sx={tabSx} />
        <Tab label="Password" sx={tabSx} />
      </Tabs>
      <DialogContent>
        {tab === 0 && <ProfileTab userId={userId} onClose={onClose} />}
        {tab === 1 && <PasswordTab userId={userId} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/users/UserEditModal.jsx
git commit -m "feat(adminv2): add UserEditModal with profile and password tabs"
```

---

## Task 14: UserBulkModal component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/users/UserBulkModal.jsx`

- [ ] **Step 1: Create UserBulkModal.jsx**

```jsx
// db-world-frontend/src/features/adminv2/users/UserBulkModal.jsx
import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Tabs, Tab, Box, TextField, MenuItem, Typography, Alert, CircularProgress, IconButton, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { bulkCreateUsers, deleteUser, updateUserRole } from '../api/adminApi';
import { useUserStore } from '../stores/useUserStore';

const tabSx  = { color:'rgba(255,255,255,0.5)', '&.Mui-selected':{ color:'#6366f1' } };
const inputSx = { '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', color:'#fff', '& fieldset':{ borderColor:'rgba(255,255,255,0.1)' } }, '& .MuiInputLabel-root':{ color:'rgba(255,255,255,0.5)' } };

// Tab 0: Bulk import via JSON paste
function ImportTab({ onClose }) {
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState('');
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const tryParse = () => {
    try { const d = JSON.parse(raw); setParsed(Array.isArray(d) ? d : [d]); setParseError(''); }
    catch { setParseError('Invalid JSON. Expected an array of user objects.'); }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => bulkCreateUsers(parsed),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey:['users'] });
      enqueueSnackbar(`${res?.length ?? 0} users created`, { variant:'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Bulk create failed', { variant:'error' }),
  });

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>
        Paste a JSON array of user objects matching CreateUserRequest format.
      </Typography>
      <TextField multiline rows={8} value={raw} onChange={e => { setRaw(e.target.value); setParsed(null); }}
        placeholder={'[\n  { "firstName": "John", "lastName": "Doe", "email": "j@e.com", "password": "pass123", "gender": "Male", "mobileNo": 9876543210 }\n]'}
        sx={inputSx} fullWidth size="small" />
      {parseError && <Alert severity="error" sx={{ bgcolor:'rgba(239,68,68,0.1)', color:'#ef4444' }}>{parseError}</Alert>}
      {parsed && <Alert severity="success" sx={{ bgcolor:'rgba(16,185,129,0.1)', color:'#10b981' }}>{parsed.length} user(s) ready to import</Alert>}
      <Box sx={{ display:'flex', gap:1, justifyContent:'flex-end' }}>
        <Button onClick={tryParse} variant="outlined" sx={{ borderColor:'rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.7)' }}>Parse</Button>
        <Button onClick={() => mutate()} disabled={!parsed || isPending} variant="contained" sx={{ bgcolor:'#6366f1' }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Import'}
        </Button>
      </Box>
    </Box>
  );
}

// Tab 1: Bulk delete selected rows
function BulkDeleteTab({ onClose }) {
  const { selectedRows, clearSelection } = useUserStore();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [confirmed, setConfirmed] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () => Promise.all(selectedRows.map(id => deleteUser(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['users'] });
      clearSelection();
      enqueueSnackbar(`${selectedRows.length} users deleted`, { variant:'success' });
      onClose();
    },
    onError: () => enqueueSnackbar('Some deletions failed', { variant:'error' }),
  });

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      <Alert severity="warning" sx={{ bgcolor:'rgba(245,158,11,0.1)', color:'#f59e0b' }}>
        You are about to permanently delete {selectedRows.length} user(s). This cannot be undone.
      </Alert>
      <Box sx={{ display:'flex', flexWrap:'wrap', gap:.5 }}>
        {selectedRows.map(id => <Chip key={id} label={`ID: ${id}`} size="small" sx={{ bgcolor:'rgba(239,68,68,0.15)', color:'#ef4444' }} />)}
      </Box>
      <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
        <input type="checkbox" id="confirm-del" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
        <label htmlFor="confirm-del" style={{ fontSize:13, color:'rgba(255,255,255,0.7)' }}>I understand this is irreversible</label>
      </Box>
      <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
        <Button onClick={() => mutate()} disabled={!confirmed || isPending || !selectedRows.length} variant="contained" sx={{ bgcolor:'#ef4444','&:hover':{ bgcolor:'#dc2626' } }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : `Delete ${selectedRows.length} Users`}
        </Button>
      </Box>
    </Box>
  );
}

// Tab 2: Bulk role assignment
function BulkRoleTab({ onClose }) {
  const { selectedRows, clearSelection } = useUserStore();
  const [roleId, setRoleId] = useState('');
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { mutate, isPending } = useMutation({
    mutationFn: () => Promise.all(selectedRows.map(id => updateUserRole(id, roleId))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['users'] });
      clearSelection();
      enqueueSnackbar(`Role updated for ${selectedRows.length} users`, { variant:'success' });
      onClose();
    },
    onError: () => enqueueSnackbar('Some role updates failed', { variant:'error' }),
  });

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>
        Assign role to {selectedRows.length} selected user(s):
      </Typography>
      <TextField select label="Select Role" value={roleId} onChange={e => setRoleId(e.target.value)} size="small" sx={inputSx}>
        <MenuItem value={1}>Owner</MenuItem>
        <MenuItem value={2}>Admin</MenuItem>
        <MenuItem value={3}>Viewer</MenuItem>
      </TextField>
      <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
        <Button onClick={() => mutate()} disabled={!roleId || isPending || !selectedRows.length} variant="contained" sx={{ bgcolor:'#6366f1' }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Assign Role'}
        </Button>
      </Box>
    </Box>
  );
}

export default function UserBulkModal({ open, onClose }) {
  const [tab, setTab] = useState(0);
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx:{ bgcolor:'#0d0d18', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', width:'100%', maxWidth:560 } }}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', pb:0 }}>
        Bulk Operations
        <IconButton onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px:2, borderBottom:'1px solid rgba(255,255,255,0.06)', '& .MuiTabs-indicator':{ bgcolor:'#6366f1' } }}>
        <Tab label="Import" sx={tabSx} />
        <Tab label="Bulk Delete" sx={tabSx} />
        <Tab label="Assign Role" sx={tabSx} />
      </Tabs>
      <DialogContent>
        {tab === 0 && <ImportTab onClose={onClose} />}
        {tab === 1 && <BulkDeleteTab onClose={onClose} />}
        {tab === 2 && <BulkRoleTab onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/adminv2/users/UserBulkModal.jsx
git commit -m "feat(adminv2): add UserBulkModal with import, delete, role tabs"
```

---

## Task 15: UserManagementV2 orchestrator (index.jsx)

**Files:**
- Create: `db-world-frontend/src/features/adminv2/users/index.jsx`

- [ ] **Step 1: Create index.jsx**

```jsx
// db-world-frontend/src/features/adminv2/users/index.jsx
import { useMemo, useCallback } from 'react';
import { Box, Typography, Fab, useMediaQuery, useTheme, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GroupIcon from '@mui/icons-material/Group';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllUsers, deleteUser } from '../api/adminApi';
import { useUserStore } from '../stores/useUserStore';
import UserFilters from './UserFilters';
import UserTable from './UserTable';
import UserGrid from './UserGrid';
import UserMobileList from './UserMobileList';
import UserDetailDrawer from './UserDetailDrawer';
import UserCreateModal from './UserCreateModal';
import UserEditModal from './UserEditModal';
import UserBulkModal from './UserBulkModal';

export default function UserManagementV2() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const { viewMode, searchTerm, roleFilter, sortModel, selectedRows, clearSelection, modalState, editUserId, openModal, closeModal } = useUserStore();

  // Fetch all users once
  const { data: allUsers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
  });

  // Delete mutation
  const { mutate: doDelete } = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['users'] }); enqueueSnackbar('User deleted', { variant:'success' }); },
    onError: () => enqueueSnackbar('Delete failed', { variant:'error' }),
  });

  // Client-side filter + sort
  const filtered = useMemo(() => {
    let list = allUsers;
    if (roleFilter !== 'ALL') list = list.filter(u => u.userRole?.roleName === roleFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(u =>
        [u.firstName, u.lastName, u.email].some(f => f?.toLowerCase().includes(q))
      );
    }
    if (sortModel.length > 0) {
      const { field, sort } = sortModel[0];
      list = [...list].sort((a, b) => {
        const av = field === 'fullName' ? `${a.firstName} ${a.lastName}` : a[field];
        const bv = field === 'fullName' ? `${b.firstName} ${b.lastName}` : b[field];
        if (av == null) return 1; if (bv == null) return -1;
        return sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }
    return list;
  }, [allUsers, roleFilter, searchTerm, sortModel]);

  const handleDelete = useCallback((userId) => {
    if (window.confirm('Delete this user?')) doDelete(userId);
  }, [doDelete]);

  const stats = useMemo(() => ({
    total:   allUsers.length,
    admins:  allUsers.filter(u => ['ADMIN','OWNER'].includes(u.userRole?.roleName)).length,
    viewers: allUsers.filter(u => u.userRole?.roleName === 'VIEWER').length,
  }), [allUsers]);

  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column', bgcolor:'#0d0d18', color:'#fff', minHeight:0 }}>
      {/* Page header */}
      <Box sx={{ px:{ xs:2, md:3 }, pt:{ xs:2, md:3 }, pb:1, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Box>
          <Typography sx={{ fontWeight:700, fontSize:{ xs:18, md:22 } }}>User Management</Typography>
          <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.4)', mt:.25 }}>Manage all platform users</Typography>
        </Box>
        {!isMobile && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')} sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
            Add User
          </Button>
        )}
      </Box>

      {/* Stats bar */}
      <Box sx={{ display:'flex', gap:2, px:{ xs:2, md:3 }, py:1, flexWrap:'wrap' }}>
        {[
          { label:'Total', value:stats.total, color:'#6366f1' },
          { label:'Admins/Owners', value:stats.admins, color:'#f59e0b' },
          { label:'Viewers', value:stats.viewers, color:'#10b981' },
          ...(filtered.length !== allUsers.length ? [{ label:'Filtered', value:filtered.length, color:'rgba(255,255,255,0.5)' }] : []),
        ].map(s => (
          <Box key={s.label} sx={{ display:'flex', alignItems:'center', gap:.75 }}>
            <GroupIcon sx={{ fontSize:14, color:s.color }} />
            <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>{s.label}:</Typography>
            <Typography sx={{ fontSize:13, fontWeight:700, color:s.color }}>{s.value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedRows.length > 0 && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1.5, px:{ xs:2, md:3 }, py:1, bgcolor:'rgba(99,102,241,0.1)', borderTop:'1px solid rgba(99,102,241,0.2)' }}>
              <Typography sx={{ fontSize:13, color:'#6366f1', fontWeight:600 }}>{selectedRows.length} selected</Typography>
              <Button size="small" startIcon={<DeleteSweepIcon />} onClick={() => openModal('bulk')} sx={{ color:'#ef4444', borderColor:'rgba(239,68,68,0.3)', border:'1px solid' }}>Bulk Actions</Button>
              <Button size="small" onClick={clearSelection} sx={{ color:'rgba(255,255,255,0.4)', ml:'auto' }}>Clear</Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <UserFilters onAddUser={() => openModal('create')} />

      {/* Error */}
      {error && (
        <Box sx={{ p:2 }}>
          <Box sx={{ bgcolor:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:2, p:2, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Typography sx={{ color:'#ef4444', fontSize:13 }}>Failed to load users</Typography>
            <Button size="small" onClick={refetch} sx={{ color:'#ef4444' }}>Retry</Button>
          </Box>
        </Box>
      )}

      {/* Data view */}
      <Box sx={{ flex:1, overflow:'auto', minHeight:0 }}>
        {isMobile ? (
          <UserMobileList users={filtered} loading={isLoading} onDelete={handleDelete} />
        ) : viewMode === 'table' ? (
          <UserTable users={filtered} loading={isLoading} onDelete={handleDelete} />
        ) : (
          <UserGrid users={filtered} loading={isLoading} onDelete={handleDelete} />
        )}
      </Box>

      {/* Mobile FAB */}
      {isMobile && (
        <Fab onClick={() => openModal('create')} sx={{ position:'fixed', bottom:24, right:24, bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
          <AddIcon />
        </Fab>
      )}

      {/* Drawers & Modals */}
      <UserDetailDrawer />
      <UserCreateModal open={modalState === 'create'} onClose={closeModal} />
      <UserEditModal   open={modalState === 'edit'}   userId={editUserId} onClose={closeModal} />
      <UserBulkModal   open={modalState === 'bulk'}   onClose={closeModal} />
    </Box>
  );
}
```

- [ ] **Step 2: Open browser and verify**

Navigate to `http://localhost:5173/db-world/admin/v2/users`.

Expected:
- Page loads with header "User Management"
- Stats bar shows totals
- Table view is default (desktop), mobile shows list
- "+ Add User" button opens create modal
- Filters work for role/search
- No console errors

- [ ] **Step 3: Commit**

```bash
git add src/features/adminv2/users/
git commit -m "feat(adminv2): complete User Management V2 page"
```

---

*Part 2 of this plan covers Record Management — see `2026-03-28-adminv2-records-plan.md`*
