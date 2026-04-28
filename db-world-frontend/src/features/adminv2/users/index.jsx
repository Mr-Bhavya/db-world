import { useState, useCallback, useMemo } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { getAllUsers, deleteUser } from '../api/adminApi';
import { useUserStore } from '../stores/useUserStore';
import UserTable from './UserTable';
import UserFilters from './UserFilters';
import UserDetailDrawer from './UserDetailDrawer';
import UserCreateModal from './UserCreateModal';
import UserEditModal from './UserEditModal';
import UserBulkModal from './UserBulkModal';

export default function UserManagementV2() {
  const T  = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { modalState, editUserId, openModal, closeModal } = useUserStore();

  // ── Server-side state ─────────────────────────────────────────────────────
  const [params, setParams] = useState({
    page: 0, size: 25, search: '', role: 'ALL', sortBy: 'userId', sortDir: 'desc',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users', params],
    queryFn:  () => getAllUsers(params),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const users         = data?.content       ?? [];
  const totalElements = data?.totalElements ?? 0;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearch     = useCallback((v)  => setParams(p => ({ ...p, page: 0, search: v })), []);
  const handleRole       = useCallback((v)  => setParams(p => ({ ...p, page: 0, role: v })), []);
  const handleSort       = useCallback((by, dir) => setParams(p => ({ ...p, page: 0, sortBy: by, sortDir: dir })), []);
  const handlePage       = useCallback((pg) => setParams(p => ({ ...p, page: pg })), []);
  const handlePageSize   = useCallback((sz) => setParams(p => ({ ...p, page: 0, size: sz })), []);

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      enqueueSnackbar('User deleted', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Delete failed', { variant: 'error' }),
  });

  const handleDelete = useCallback((userId) => {
    if (window.confirm('Delete this user?')) doDelete(userId);
  }, [doDelete]);

  // ── Stats from current page + params ─────────────────────────────────────
  const stats = useMemo(() => ({
    total:   totalElements,
    admins:  users.filter(u => ['ADMIN', 'OWNER'].includes(u.userRole?.roleName)).length,
    viewers: users.filter(u => u.userRole?.roleName === 'VIEWER').length,
  }), [users, totalElements]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: T.bg, color: T.text, minHeight: 0 }}>

      {/* Header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 18, md: 22 }, color: T.text, lineHeight: 1.2 }}>
            User Management
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textFaint, mt: 0.2 }}>
            Manage all platform users
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')}
          sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' }, fontWeight: 600 }}>
          Add User
        </Button>
      </Box>

      {/* Stats bar */}
      <Box sx={{ display: 'flex', gap: 2.5, px: { xs: 2, md: 3 }, py: 0.75, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',   value: stats.total,   icon: <GroupIcon sx={{ fontSize: 14, color: '#0d9488' }} />,   color: '#0d9488' },
          { label: 'Admins',  value: stats.admins,  icon: <AdminPanelSettingsIcon sx={{ fontSize: 14, color: '#f59e0b' }} />, color: '#f59e0b' },
          { label: 'Viewers', value: stats.viewers, icon: <PersonIcon sx={{ fontSize: 14, color: '#10b981' }} />,   color: '#10b981' },
        ].map(s => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {s.icon}
            <Typography sx={{ fontSize: 12, color: T.textMuted }}>{s.label}:</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Filters */}
      <UserFilters
        search={params.search}
        role={params.role}
        onSearch={handleSearch}
        onRole={handleRole}
        onAddUser={() => openModal('create')}
      />

      {/* Error */}
      {error && (
        <Box sx={{ px: 2, py: 1 }}>
          <Alert severity="error" action={<Button size="small" onClick={refetch}>Retry</Button>}>
            Failed to load users
          </Alert>
        </Box>
      )}

      {/* Table */}
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <UserTable
          users={users}
          loading={isLoading}
          total={totalElements}
          page={params.page}
          size={params.size}
          sortBy={params.sortBy}
          sortDir={params.sortDir}
          onSort={handleSort}
          onPageChange={handlePage}
          onPageSizeChange={handlePageSize}
          onDelete={handleDelete}
        />
      </Box>

      {/* Modals */}
      <UserDetailDrawer />
      <UserCreateModal open={modalState === 'create'} onClose={closeModal} />
      <UserEditModal   open={modalState === 'edit'}   userId={editUserId} onClose={closeModal} />
      <UserBulkModal   open={modalState === 'bulk'}   onClose={closeModal} />
    </Box>
  );
}
