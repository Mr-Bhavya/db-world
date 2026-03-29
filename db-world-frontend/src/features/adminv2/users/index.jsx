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
import { useT } from '@shared/theme';
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
  const T       = useT();
  const theme   = useTheme();
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
    onError:   () => enqueueSnackbar('Delete failed', { variant: 'error' }),
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: T.adminBg, color: T.textPrimary, minHeight: 0 }}>

      {/* Page header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, color: T.textPrimary }}>User Management</Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25 }}>Manage all platform users</Typography>
        </Box>
        {!isMobile && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal('create')}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
            Add User
          </Button>
        )}
      </Box>

      {/* Stats bar */}
      <Box sx={{ display: 'flex', gap: 2, px: { xs: 2, md: 3 }, py: 1, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',         value: stats.total,   icon: <GroupIcon sx={{ fontSize: 14, color: T.teal }} />,                   color: T.teal },
          { label: 'Admins/Owners', value: stats.admins,  icon: <AdminPanelSettingsIcon sx={{ fontSize: 14, color: '#f59e0b' }} />,    color: '#f59e0b' },
          { label: 'Viewers',       value: stats.viewers, icon: <PersonIcon sx={{ fontSize: 14, color: '#10b981' }} />,                color: '#10b981' },
          ...(filtered.length !== allUsers.length ? [{ label: 'Filtered', value: filtered.length, icon: <GroupIcon sx={{ fontSize: 14, color: T.textFaint }} />, color: T.textMuted }] : []),
        ].map(s => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {s.icon}
            <Typography sx={{ fontSize: 13, color: T.textMuted }}>{s.label}:</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedRows.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, md: 3 }, py: 1, bgcolor: T.tealBg, borderTop: `1px solid ${T.glassBorderHover}` }}>
              <Typography sx={{ fontSize: 13, color: T.teal, fontWeight: 600 }}>{selectedRows.length} selected</Typography>
              <Button size="small" startIcon={<DeleteSweepIcon />} onClick={() => openModal('bulk')}
                sx={{ color: T.error, borderColor: `${T.error}44`, border: '1px solid' }}>Bulk Actions</Button>
              <Button size="small" onClick={clearSelection} sx={{ color: T.textMuted, ml: 'auto' }}>Clear</Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <UserFilters onAddUser={() => openModal('create')} />

      {/* Error */}
      {error && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ bgcolor: T.errorBg, border: `1px solid ${T.error}44`, borderRadius: 2, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ color: T.error, fontSize: 13 }}>Failed to load users</Typography>
            <Button size="small" onClick={refetch} sx={{ color: T.error }}>Retry</Button>
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
        <Fab onClick={() => openModal('create')} sx={{ position: 'fixed', bottom: 24, right: 24, bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>
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
