import { useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Alert, IconButton, Tooltip, CircularProgress,
  createTheme, ThemeProvider, useMediaQuery, useTheme as useMuiTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import GroupIcon from '@mui/icons-material/Group';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT, useThemeMode } from '@shared/theme';
import { getAllUsers, deleteUser, setUserStatus } from '../api/adminApi';
import { useUserStore } from '../stores/useUserStore';
import UserTable from './UserTable';
import UserFilters from './UserFilters';
import UserDetailDrawer from './UserDetailDrawer';
import UserCreateModal from './UserCreateModal';
import UserEditModal from './UserEditModal';
import UserBulkModal from './UserBulkModal';

export default function UserManagementV2() {
  const T  = useT();
  const { mode } = useThemeMode();
  const qc = useQueryClient();
  const { modalState, editUserId, openModal, closeModal } = useUserStore();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  // Scope MUI's palette to the admin theme so surfaces/text stay correct on the
  // white theme (the global MUI theme follows the cinema light/dark mode).
  const adminMuiTheme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#0d9488', contrastText: '#ffffff' },
      secondary: { main: '#4db6ac' },
      background: {
        default: mode === 'dark' ? '#000000' : '#ffffff',
        paper: mode === 'dark' ? '#111111' : '#ffffff',
      },
    },
    shape: { borderRadius: 8 },
    typography: { fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' },
  }), [mode]);

  // ── Server-side state ─────────────────────────────────────────────────────
  const [params, setParams] = useState({
    page: 0, size: 25, search: '', role: 'ALL', sortBy: 'userId', sortDir: 'desc',
  });

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['users', params],
    queryFn:  () => getAllUsers(params),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const users         = useMemo(() => data?.content ?? [], [data]);
  const totalElements = data?.totalElements ?? 0;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearch   = useCallback((v)  => setParams(p => ({ ...p, page: 0, search: v })), []);
  const handleRole     = useCallback((v)  => setParams(p => ({ ...p, page: 0, role: v })), []);
  const handleSort     = useCallback((by, dir) => setParams(p => ({ ...p, page: 0, sortBy: by, sortDir: dir })), []);
  const handlePage     = useCallback((pg) => setParams(p => ({ ...p, page: pg })), []);
  const handlePageSize = useCallback((sz) => setParams(p => ({ ...p, page: 0, size: sz })), []);

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      notify.success('User deleted');
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  const handleDelete = useCallback((userId) => {
    if (window.confirm('Delete this user?')) doDelete(userId);
  }, [doDelete]);

  const { mutate: doToggleStatus } = useMutation({
    mutationFn: ({ userId, enabled }) => setUserStatus(userId, enabled),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      notify.success(res?.message ?? 'Status updated');
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to update status'),
  });

  const handleToggleStatus = useCallback((userId, enabled) => {
    if (!enabled && !window.confirm('Disable this user? They will be logged out and unable to sign in.')) return;
    doToggleStatus({ userId, enabled });
  }, [doToggleStatus]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:   totalElements,
    admins:  users.filter(u => ['ADMIN', 'OWNER'].includes(u.userRole?.name)).length,
    viewers: users.filter(u => u.userRole?.name === 'VIEWER').length,
  }), [users, totalElements]);

  const statItems = [
    { label: 'Total',   value: stats.total,   icon: GroupIcon,               color: '#0d9488' },
    { label: 'Admins',  value: stats.admins,  icon: AdminPanelSettingsIcon,  color: '#f59e0b' },
    { label: 'Viewers', value: stats.viewers, icon: PersonIcon,              color: '#10b981' },
  ];

  return (
    <ThemeProvider theme={adminMuiTheme}>
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: T.bg, color: T.text, minHeight: 0 }}>

      {/* Header — compact on mobile, single Add action */}
      <Box sx={{ px: { xs: 1.5, md: 3 }, pt: { xs: 1.5, md: 2.5 }, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 17, md: 22 }, color: T.text, lineHeight: 1.15, letterSpacing: '-0.02em' }} noWrap>
            User Management
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textFaint, mt: 0.2 }} noWrap>
            Manage all platform users
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <Tooltip title="Refresh"><span>
            <IconButton size="small" onClick={refetch} disabled={isFetching}
              sx={{ border: 1, borderColor: T.border, borderRadius: 1.5, color: T.textMuted }}>
              {isFetching ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </span></Tooltip>
          {isMobile ? (
            <Tooltip title="Add User">
              <IconButton size="small" onClick={() => openModal('create')}
                sx={{ bgcolor: '#0d9488', color: '#fff', borderRadius: 1.5, '&:hover': { bgcolor: '#0f766e' } }}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')}
              sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' }, fontWeight: 600 }}>
              Add User
            </Button>
          )}
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: { xs: 2, md: 2.5 }, px: { xs: 1.5, md: 3 }, py: 0.75, flexWrap: 'wrap' }}>
        {statItems.map(s => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <s.icon sx={{ fontSize: 14, color: s.color }} />
            <Typography sx={{ fontSize: 12, color: T.textMuted }}>{s.label}:</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Filters / toolbar (no duplicate Add button) */}
      <UserFilters
        search={params.search}
        role={params.role}
        sortBy={params.sortBy}
        sortDir={params.sortDir}
        onSearch={handleSearch}
        onRole={handleRole}
        onSort={handleSort}
      />

      {error && (
        <Box sx={{ px: 2, py: 1 }}>
          <Alert severity="error" action={<Button size="small" onClick={refetch}>Retry</Button>}>
            Failed to load users
          </Alert>
        </Box>
      )}

      {/* Table / cards */}
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <UserTable
          users={users}
          loading={isLoading}
          isMobile={isMobile}
          total={totalElements}
          page={params.page}
          size={params.size}
          sortBy={params.sortBy}
          sortDir={params.sortDir}
          onSort={handleSort}
          onPageChange={handlePage}
          onPageSizeChange={handlePageSize}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
        />
      </Box>

      {/* Modals */}
      <UserDetailDrawer />
      <UserCreateModal open={modalState === 'create'} onClose={closeModal} />
      <UserEditModal   open={modalState === 'edit'}   userId={editUserId} onClose={closeModal} />
      <UserBulkModal   open={modalState === 'bulk'}   onClose={closeModal} />
    </Box>
    </ThemeProvider>
  );
}
