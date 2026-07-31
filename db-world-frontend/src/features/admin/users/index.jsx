import { useState, useCallback, useMemo } from 'react';
import { useMediaQuery, useTheme as useMuiTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ManageAccountsIcon from '@mui/icons-material/ManageAccountsRounded';
import GroupIcon from '@mui/icons-material/Group';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { AdminPage, SectionCard, StatCard, StatGrid, ErrorState, AdminActionButton, StickyBar } from '@features/admin/adminUi';
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
  const qc = useQueryClient();
  const { modalState, editUserId, openModal, closeModal } = useUserStore();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

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

  // Page-level action registered into the admin top bar (labeled on all sizes).
  const addAction = (
    <AdminActionButton icon={AddIcon} onClick={() => openModal('create')}>Add User</AdminActionButton>
  );

  return (
    <AdminPage
      title="User Management"
      subtitle="Manage all platform users"
      icon={ManageAccountsIcon}
      actions={addAction}
      onRefresh={refetch}
      refreshing={isFetching}
    >
      {/* Stats */}
      <StatGrid min={150} sx={{ mb: 3 }}>
        <StatCard index={0} icon={GroupIcon}              label="Total Users" value={stats.total}   accent={T.teal}   loading={isLoading} />
        <StatCard index={1} icon={AdminPanelSettingsIcon} label="Admins"      value={stats.admins}  accent="#f59e0b" loading={isLoading} />
        <StatCard index={2} icon={PersonIcon}             label="Viewers"     value={stats.viewers} accent="#10b981" loading={isLoading} />
      </StatGrid>

      {/* Sticky filters / sort — pins to the top on scroll */}
      <StickyBar>
        <UserFilters
          search={params.search}
          role={params.role}
          sortBy={params.sortBy}
          sortDir={params.sortDir}
          onSearch={handleSearch}
          onRole={handleRole}
          onSort={handleSort}
        />
      </StickyBar>

      {/* Table */}
      <SectionCard padding={false} flushMobile>
        {error ? (
          <ErrorState message="Failed to load users" onRetry={refetch} />
        ) : (
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
        )}
      </SectionCard>

      {/* Modals */}
      <UserDetailDrawer />
      <UserCreateModal open={modalState === 'create'} onClose={closeModal} />
      <UserEditModal   open={modalState === 'edit'}   userId={editUserId} onClose={closeModal} />
      <UserBulkModal   open={modalState === 'bulk'}   onClose={closeModal} />
    </AdminPage>
  );
}
