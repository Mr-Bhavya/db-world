import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TableSortLabel, TablePagination, Chip, IconButton,
  Tooltip, Skeleton, Avatar, Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon        from '@mui/icons-material/Edit';
import DeleteIcon      from '@mui/icons-material/Delete';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { formatDistanceToNow } from 'date-fns';
import { useT }        from '@shared/theme';
import { useUserStore } from '../stores/useUserStore';

const ROLE_COLOR = { OWNER: '#f59e0b', ADMIN: '#3b82f6', VIEWER: '#10b981' };
const COLUMNS = [
  { id: 'fullName',    label: 'User',       sortKey: 'firstName', minWidth: 200 },
  { id: 'userRole',    label: 'Role',       sortable: false,      minWidth: 100 },
  { id: 'mobileNo',   label: 'Mobile',     sortable: false,      minWidth: 120 },
  { id: 'noOfLogin',  label: 'Logins',     sortKey: 'noOfLogin', minWidth: 70,  align: 'center' },
  { id: 'lastLogin',  label: 'Last Login', sortKey: 'lastLogin', minWidth: 130 },
  { id: 'status',     label: 'Status',     sortable: false,      minWidth: 85  },
  { id: 'actions',    label: '',           sortable: false,      minWidth: 110 },
];

function AvatarCell({ user }) {
  const T = useT();
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const role  = user.userRole?.roleName ?? 'VIEWER';
  const color = ROLE_COLOR[role] ?? '#0d9488';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.5 }}>
      <Avatar sx={{ width: 36, height: 36, bgcolor: color, fontSize: 13, fontWeight: 700, flexShrink: 0, color: '#fff' }}>
        {initials}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
          {user.firstName} {user.lastName}
        </Typography>
        <Typography sx={{ fontSize: 11, color: T.textFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
          {user.email}
        </Typography>
      </Box>
    </Box>
  );
}

function StatusBadge({ user }) {
  const active = user.enabled !== false && user.accountNonLocked !== false;
  const color  = active ? '#10b981' : '#ef4444';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <FiberManualRecordIcon sx={{ fontSize: 8, color }} />
      <Typography sx={{ fontSize: 12, color, fontWeight: 600 }}>
        {active ? 'Active' : 'Inactive'}
      </Typography>
    </Box>
  );
}

function SortTH({ col, sortBy, sortDir, onSort, T }) {
  if (col.sortable === false || !col.sortKey) {
    return (
      <TableCell sx={{ minWidth: col.minWidth, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: T.textFaint, bgcolor: T.glass, borderColor: T.border, whiteSpace: 'nowrap', align: col.align }}>
        {col.label}
      </TableCell>
    );
  }
  const active = sortBy === col.sortKey;
  return (
    <TableCell sx={{ minWidth: col.minWidth, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: T.textFaint, bgcolor: T.glass, borderColor: T.border, whiteSpace: 'nowrap', userSelect: 'none', align: col.align }}>
      <TableSortLabel
        active={active}
        direction={active ? sortDir : 'desc'}
        onClick={() => onSort(col.sortKey, active && sortDir === 'desc' ? 'asc' : 'desc')}
        sx={{ color: `${T.textFaint} !important`, '& .MuiTableSortLabel-icon': { color: `${active ? '#0d9488' : T.textFaint} !important` }, '&.Mui-active': { color: '#0d9488 !important' } }}>
        {col.label}
      </TableSortLabel>
    </TableCell>
  );
}

export default function UserTable({ users, loading, total, page, size, sortBy, sortDir, onSort, onPageChange, onPageSizeChange, onDelete }) {
  const T = useT();
  const { openDrawer, openModal } = useUserStore();

  const cellSx = { borderColor: T.border, color: T.text, fontSize: 13, py: 1.25, px: 1.5 };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TableContainer sx={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        <Table size="small" stickyHeader sx={{ minWidth: 700 }}>
          <TableHead>
            <TableRow>
              {COLUMNS.map(col => (
                <SortTH key={col.id} col={col} sortBy={sortBy} sortDir={sortDir} onSort={onSort} T={T} />
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading && Array.from({ length: size > 10 ? 10 : size }).map((_, i) => (
              <TableRow key={i}>
                {COLUMNS.map(c => (
                  <TableCell key={c.id} sx={cellSx}>
                    <Skeleton variant={c.id === 'fullName' ? 'rectangular' : 'text'} height={c.id === 'fullName' ? 36 : 18} />
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 8, color: T.textFaint, fontSize: 13, borderColor: T.border }}>
                  No users found
                </TableCell>
              </TableRow>
            )}

            {!loading && users.map(user => {
              const role      = user.userRole?.roleName ?? 'VIEWER';
              const roleColor = ROLE_COLOR[role] ?? '#0d9488';
              const lastLogin = user.loginData?.[0]?.lastLoginDate;
              return (
                <TableRow key={user.userId} hover sx={{ '& td': { borderColor: T.border }, '&:hover': { bgcolor: `${T.border}40` } }}>

                  {/* User avatar + name + email */}
                  <TableCell sx={{ ...cellSx, minWidth: 200 }}>
                    <AvatarCell user={user} />
                  </TableCell>

                  {/* Role chip */}
                  <TableCell sx={{ ...cellSx, minWidth: 100 }}>
                    <Chip
                      label={role}
                      size="small"
                      sx={{ bgcolor: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}33`, fontWeight: 700, fontSize: 10, height: 20 }}
                    />
                  </TableCell>

                  {/* Mobile */}
                  <TableCell sx={{ ...cellSx, minWidth: 120, color: T.textMuted }}>
                    {user.mobileNo ?? '—'}
                  </TableCell>

                  {/* Login count */}
                  <TableCell sx={{ ...cellSx, minWidth: 70, textAlign: 'center', fontWeight: 600 }}>
                    {user.noOfLogin ?? 0}
                  </TableCell>

                  {/* Last login */}
                  <TableCell sx={{ ...cellSx, minWidth: 130, color: T.textFaint, fontSize: 12, whiteSpace: 'nowrap' }}>
                    {lastLogin
                      ? formatDistanceToNow(new Date(lastLogin), { addSuffix: true })
                      : '—'}
                  </TableCell>

                  {/* Status */}
                  <TableCell sx={{ ...cellSx, minWidth: 85 }}>
                    <StatusBadge user={user} />
                  </TableCell>

                  {/* Actions */}
                  <TableCell sx={{ ...cellSx, minWidth: 110, whiteSpace: 'nowrap' }}>
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={() => openDrawer(user.userId)}
                        sx={{ color: T.textFaint, '&:hover': { color: '#0d9488', bgcolor: '#0d948818' } }}>
                        <VisibilityIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openModal('edit', user.userId)}
                        sx={{ color: T.textFaint, '&:hover': { color: '#10b981', bgcolor: '#10b98118' } }}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => onDelete(user.userId)}
                        sx={{ color: T.textFaint, '&:hover': { color: '#ef4444', bgcolor: '#ef444418' } }}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={size}
        rowsPerPageOptions={[10, 25, 50, 100]}
        onPageChange={(_, pg) => onPageChange(pg)}
        onRowsPerPageChange={e => onPageSizeChange(Number(e.target.value))}
        sx={{
          borderTop: `1px solid ${T.border}`,
          color: T.textMuted,
          flexShrink: 0,
          bgcolor: T.glass,
          '& .MuiIconButton-root': { color: T.textMuted },
          '& .MuiSelect-icon':     { color: T.textMuted },
          '& .MuiTablePagination-select': { color: T.text },
        }}
      />
    </Box>
  );
}
