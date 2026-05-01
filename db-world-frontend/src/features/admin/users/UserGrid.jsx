import { Box, Chip, IconButton, Tooltip, Skeleton } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LoginIcon from '@mui/icons-material/Login';
import { motion } from 'framer-motion';
import { useUserStore } from '../stores/useUserStore';
import { useT } from '@shared/theme';
import { formatDistanceToNow } from 'date-fns';
import { ROLE_COLORS } from './constants';

function UserCard({ user, onDelete, index }) {
  const T = useT();
  const { openDrawer, openModal } = useUserStore();
  const role = user.userRole?.roleName ?? 'VIEWER';
  const lastLogin = user.loginData?.[0]?.lastLoginDate;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Box sx={{
        bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 2.5, p: 2.5,
        display: 'flex', flexDirection: 'column', gap: 1.5,
        transition: 'all .2s',
        '&:hover': { borderColor: T.glassBorderHover, boxShadow: `0 0 0 1px ${T.tealGlow}`, bgcolor: T.glassHover },
      }}>
        {/* Avatar + role */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: '50%', bgcolor: T.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, flexShrink: 0, color: '#fff' }}>
            {(user.firstName?.[0] ?? '?').toUpperCase()}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ fontWeight: 600, fontSize: 14, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.firstName} {user.lastName}
            </Box>
            <Box sx={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</Box>
          </Box>
          <Chip label={role} size="small" sx={{ bgcolor: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}40`, fontWeight: 700, fontSize: 11 }} />
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, fontSize: 12, color: T.textMuted }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <LoginIcon sx={{ fontSize: 13 }} />
            <b style={{ color: T.textPrimary }}>{user.noOfLogin ?? 0}</b> logins
          </span>
          {lastLogin && (
            <span>Last: <b style={{ color: T.textPrimary }}>{formatDistanceToNow(new Date(lastLogin), { addSuffix: true })}</b></span>
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', borderTop: `1px solid ${T.border}`, pt: 1 }}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => openDrawer(user.userId)} sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
              <VisibilityIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openModal('edit', user.userId)} sx={{ color: T.textMuted, '&:hover': { color: '#10b981', bgcolor: 'rgba(16,185,129,0.1)' } }}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => onDelete(user.userId)} sx={{ color: T.textMuted, '&:hover': { color: T.error, bgcolor: T.errorBg } }}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </motion.div>
  );
}

export default function UserGrid({ users, loading, onDelete }) {
  const T = useT();
  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2, p: 2 }}>
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="rounded" height={160} sx={{ bgcolor: T.glass }} />)}
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2, p: 2 }}>
      {users.map((u, i) => <UserCard key={u.userId} user={u} onDelete={onDelete} index={i} />)}
    </Box>
  );
}
