import { useState } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Skeleton, Avatar, Typography, Paper, Stack,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon        from '@mui/icons-material/Edit';
import DeleteIcon      from '@mui/icons-material/Delete';
import MoreVertIcon    from '@mui/icons-material/MoreVert';
import BlockIcon       from '@mui/icons-material/Block';
import LockOpenIcon    from '@mui/icons-material/LockOpen';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { formatDistanceToNow } from 'date-fns';
import { useT }        from '@shared/theme';
import { useUserStore } from '../stores/useUserStore';

const ROLE_COLOR = { OWNER: '#f59e0b', ADMIN: '#3b82f6', VIEWER: '#10b981' };

function initialsOf(u) {
  return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}
function lastLoginOf(u) {
  const d = u.loginData?.[0]?.lastLoginDate;
  return d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—';
}
function statusOf(u) {
  return u.enabled === false
    ? { label: 'Disabled', color: '#ef4444' }
    : { label: 'Active', color: '#10b981' };
}

function UserAvatar({ user, size = 36 }) {
  const role = user.userRole?.name ?? 'VIEWER';
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: ROLE_COLOR[role] ?? '#0d9488', fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, color: '#fff' }}>
      {initialsOf(user)}
    </Avatar>
  );
}

function RoleChip({ role }) {
  const c = ROLE_COLOR[role] ?? '#0d9488';
  return <Chip label={role} size="small" sx={{ bgcolor: `${c}18`, color: c, border: `1px solid ${c}33`, fontWeight: 700, fontSize: 10, height: 20 }} />;
}

function StatusBadge({ user }) {
  const { label, color } = statusOf(user);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <FiberManualRecordIcon sx={{ fontSize: 8, color }} />
      <Typography sx={{ fontSize: 12, color, fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

function RowMenu({ user, onView, onEdit, onToggleStatus, onDelete }) {
  const T = useT();
  const [anchor, setAnchor] = useState(null);
  const close = () => setAnchor(null);
  const isEnabled = user.enabled !== false;
  return (
    <>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }} sx={{ color: T.textFaint }}>
        <MoreVertIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        <MenuItem onClick={() => { onView(user.userId); close(); }}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon><ListItemText>View details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onEdit(user.userId); close(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Edit user</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onToggleStatus(user.userId, !isEnabled); close(); }}
          sx={{ color: isEnabled ? '#f59e0b' : '#10b981' }}>
          <ListItemIcon>{isEnabled
            ? <BlockIcon fontSize="small" sx={{ color: '#f59e0b' }} />
            : <LockOpenIcon fontSize="small" sx={{ color: '#10b981' }} />}</ListItemIcon>
          <ListItemText>{isEnabled ? 'Disable user' : 'Enable user'}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { onDelete(user.userId); close(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

function DesktopTable({ users, loading, size, T, actions }) {
  const HEAD = ['User', 'Role', 'Mobile', 'Logins', 'Last Login', 'Status', ''];
  const headSx = { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: T.textFaint, bgcolor: T.glass, borderColor: T.border, whiteSpace: 'nowrap' };
  const cellSx = { borderColor: T.border, color: T.text, fontSize: 13, py: 1, px: 1.5 };
  return (
    <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
      <Table size="small" stickyHeader sx={{ minWidth: 720 }}>
        <TableHead>
          <TableRow>
            {HEAD.map((h, i) => <TableCell key={i} sx={{ ...headSx, ...(i === 3 ? { textAlign: 'center' } : {}) }}>{h}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && Array.from({ length: Math.min(size, 10) }).map((_, i) => (
            <TableRow key={i}>
              {HEAD.map((_h, j) => <TableCell key={j} sx={cellSx}><Skeleton height={j === 0 ? 36 : 18} /></TableCell>)}
            </TableRow>
          ))}

          {!loading && users.length === 0 && (
            <TableRow><TableCell colSpan={HEAD.length} align="center" sx={{ py: 8, color: T.textFaint, fontSize: 13, borderColor: T.border }}>No users found</TableCell></TableRow>
          )}

          {!loading && users.map(user => (
            <TableRow key={user.userId} hover onClick={() => actions.onView(user.userId)}
              sx={{ cursor: 'pointer', '& td': { borderColor: T.border }, '&:hover': { bgcolor: `${T.border}40` } }}>
              <TableCell sx={{ ...cellSx, minWidth: 220 }}>
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <UserAvatar user={user} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                      {user.firstName} {user.lastName}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                      {user.email}
                    </Typography>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell sx={cellSx}><RoleChip role={user.userRole?.name ?? 'VIEWER'} /></TableCell>
              <TableCell sx={{ ...cellSx, color: T.textMuted }}>{user.mobileNo ?? '—'}</TableCell>
              <TableCell sx={{ ...cellSx, textAlign: 'center', fontWeight: 600 }}>{user.noOfLogin ?? 0}</TableCell>
              <TableCell sx={{ ...cellSx, color: T.textFaint, fontSize: 12, whiteSpace: 'nowrap' }}>{lastLoginOf(user)}</TableCell>
              <TableCell sx={cellSx}><StatusBadge user={user} /></TableCell>
              <TableCell sx={{ ...cellSx, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                <RowMenu user={user} {...actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MobileCards({ users, loading, T, actions }) {
  if (loading) {
    return (
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: T.border, bgcolor: T.glass }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1 }}><Skeleton width="60%" height={16} /><Skeleton width="40%" height={12} /></Box>
            </Stack>
          </Paper>
        ))}
      </Box>
    );
  }
  if (!users.length) {
    return <Box sx={{ py: 8, textAlign: 'center', color: T.textFaint, fontSize: 13 }}>No users found</Box>;
  }
  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {users.map(user => (
        <Paper key={user.userId} variant="outlined" onClick={() => actions.onView(user.userId)}
          sx={{ p: 1.25, borderRadius: 2, borderColor: T.border, bgcolor: T.glass, cursor: 'pointer', '&:active': { bgcolor: `${T.border}40` } }}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <UserAvatar user={user} size={40} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.firstName} {user.lastName}
                </Typography>
                <StatusBadge user={user} />
              </Stack>
              <Typography sx={{ fontSize: 12, color: T.textFaint, wordBreak: 'break-all' }}>{user.email}</Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                <RoleChip role={user.userRole?.name ?? 'VIEWER'} />
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>{user.mobileNo ?? '—'}</Typography>
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>· {user.noOfLogin ?? 0} logins</Typography>
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>· {lastLoginOf(user)}</Typography>
              </Stack>
            </Box>
            <Box onClick={(e) => e.stopPropagation()}><RowMenu user={user} {...actions} /></Box>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}

export default function UserTable({ users, loading, isMobile, total, page, size, onPageChange, onPageSizeChange, onDelete, onToggleStatus }) {
  const T = useT();
  const { openDrawer, openModal } = useUserStore();
  const actions = { onView: openDrawer, onEdit: (id) => openModal('edit', id), onToggleStatus, onDelete };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isMobile
        ? <MobileCards users={users} loading={loading} T={T} actions={actions} />
        : <DesktopTable users={users} loading={loading} size={size} T={T} actions={actions} />}

      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={size}
        rowsPerPageOptions={[10, 25, 50, 100]}
        onPageChange={(_, pg) => onPageChange(pg)}
        onRowsPerPageChange={e => onPageSizeChange(Number(e.target.value))}
        labelRowsPerPage={isMobile ? '' : 'Rows:'}
        sx={{
          borderTop: `1px solid ${T.border}`, color: T.textMuted, flexShrink: 0, bgcolor: T.glass,
          '& .MuiIconButton-root': { color: T.textMuted },
          '& .MuiSelect-icon':     { color: T.textMuted },
          '& .MuiTablePagination-select': { color: T.text },
          '& .MuiTablePagination-toolbar': { px: { xs: 1, sm: 2 }, minHeight: 48 },
        }}
      />
    </Box>
  );
}
