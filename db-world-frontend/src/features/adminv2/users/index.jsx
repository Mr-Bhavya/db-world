// db-world-frontend/src/features/adminv2/users/index.jsx
import { useMemo, useCallback } from 'react';
import { Box, Typography, Fab, useMediaQuery, useTheme, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GroupIcon from '@mui/icons-material/Group';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
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

  const { data: allUsers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); enqueueSnackbar('User deleted', { variant: 'success' }); },
    onError: () => enqueueSnackbar('Delete failed', { variant: 'error' }),
  });

  const filtered = useMemo(() => {
    let list = allUsers;
    if (roleFilter !== 'ALL') list = list.filter(u => u.userRole?.roleName === roleFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(u => [u.firstName, u.lastName, u.email].some(f => f?.toLowerCase().includes(q)));
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
    admins:  allUsers.filter(u => ['ADMIN', 'OWNER'].includes(u.userRole?.roleName)).length,
    viewers: allUsers.filter(u => u.userRole?.roleName === 'VIEWER').length,
  }), [allUsers]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f0f9f8', color: '#0f172a', minHeight: 0 }}>

      {/* Page header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, color: '#0f172a' }}>User Management</Typography>
          <Typography sx={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', mt: .25 }}>Manage all platform users</Typography>
        </Box>
        {!isMobile && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')}
            sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' } }}>
            Add User
          </Button>
        )}
      </Box>

      {/* Stats bar */}
      <Box sx={{ display: 'flex', gap: 2, px: { xs: 2, md: 3 }, py: 1, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',         value: stats.total,   icon: <GroupIcon sx={{ fontSize: 14, color: '#0d9488' }} />,                color: '#0d9488' },
          { label: 'Admins/Owners', value: stats.admins,  icon: <AdminPanelSettingsIcon sx={{ fontSize: 14, color: '#f59e0b' }} />,   color: '#f59e0b' },
          { label: 'Viewers',       value: stats.viewers, icon: <PersonIcon sx={{ fontSize: 14, color: '#10b981' }} />,               color: '#10b981' },
          ...(filtered.length !== allUsers.length ? [{ label: 'Filtered', value: filtered.length, icon: <GroupIcon sx={{ fontSize: 14, color: 'rgba(15,23,42,0.4)' }} />, color: 'rgba(15,23,42,0.5)' }] : []),
        ].map(s => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: .75 }}>
            {s.icon}
            <Typography sx={{ fontSize: 13, color: 'rgba(15,23,42,0.6)' }}>{s.label}:</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedRows.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, md: 3 }, py: 1, bgcolor: 'rgba(13,148,136,0.08)', borderTop: '1px solid rgba(13,148,136,0.2)' }}>
              <Typography sx={{ fontSize: 13, color: '#0d9488', fontWeight: 600 }}>{selectedRows.length} selected</Typography>
              <Button size="small" startIcon={<DeleteSweepIcon />} onClick={() => openModal('bulk')} sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', border: '1px solid' }}>Bulk Actions</Button>
              <Button size="small" onClick={clearSelection} sx={{ color: 'rgba(15,23,42,0.45)', ml: 'auto' }}>Clear</Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <UserFilters onAddUser={() => openModal('create')} />

      {/* Error */}
      {error && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 2, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ color: '#ef4444', fontSize: 13 }}>Failed to load users</Typography>
            <Button size="small" onClick={refetch} sx={{ color: '#ef4444' }}>Retry</Button>
          </Box>
        </Box>
      )}

      {/* Data view */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
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
        <Fab onClick={() => openModal('create')} sx={{ position: 'fixed', bottom: 24, right: 24, bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' } }}>
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
