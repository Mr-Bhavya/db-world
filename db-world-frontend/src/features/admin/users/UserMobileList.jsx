import { Box, Chip, IconButton, Menu, MenuItem, ListItemIcon, Skeleton } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../stores/useUserStore';
import { useT } from '@shared/theme';
import { formatDistanceToNow } from 'date-fns';
import { ROLE_COLORS } from './constants';

function UserRow({ user, onDelete }) {
  const T = useT();
  const { openDrawer, openModal } = useUserStore();
  const [anchor, setAnchor] = useState(null);
  const role = user.userRole?.roleName ?? 'VIEWER';
  const lastLogin = user.loginData?.[0]?.lastLoginDate;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '12px 16px', borderBottom: `1px solid ${T.border}`, bgcolor: T.sidebar }}>
        <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: T.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0, color: '#fff' }}>
          {(user.firstName?.[0] ?? '?').toUpperCase()}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ fontWeight: 600, fontSize: 14, color: T.textPrimary }}>{user.firstName} {user.lastName}</Box>
          <Box sx={{ fontSize: 12, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</Box>
          {lastLogin && (
            <Box sx={{ fontSize: 11, color: T.textFaint }}>{formatDistanceToNow(new Date(lastLogin), { addSuffix: true })}</Box>
          )}
        </Box>
        <Chip label={role} size="small" sx={{ bgcolor: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}40`, fontWeight: 700, fontSize: 10 }} />
        <IconButton size="small" sx={{ color: T.textMuted }} onClick={e => setAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
          PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, boxShadow: '0 4px 20px rgba(0,0,0,0.24)' } }}
        >
          <MenuItem onClick={() => { openDrawer(user.userId); setAnchor(null); }} sx={{ '&:hover': { bgcolor: T.tealBg } }}>
            <ListItemIcon><VisibilityIcon fontSize="small" sx={{ color: T.teal }} /></ListItemIcon>
            <Box sx={{ color: T.textPrimary }}>View</Box>
          </MenuItem>
          <MenuItem onClick={() => { openModal('edit', user.userId); setAnchor(null); }} sx={{ '&:hover': { bgcolor: T.tealBg } }}>
            <ListItemIcon><EditIcon fontSize="small" sx={{ color: '#10b981' }} /></ListItemIcon>
            <Box sx={{ color: T.textPrimary }}>Edit</Box>
          </MenuItem>
          <MenuItem onClick={() => { onDelete(user.userId); setAnchor(null); }} sx={{ '&:hover': { bgcolor: T.errorBg } }}>
            <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: T.error }} /></ListItemIcon>
            <Box sx={{ color: T.error }}>Delete</Box>
          </MenuItem>
        </Menu>
      </Box>
    </motion.div>
  );
}

export default function UserMobileList({ users, loading, onDelete }) {
  const T = useT();
  if (loading) return (
    <Box>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={72} sx={{ bgcolor: T.glass, mx: 2, mb: 0.5 }} />)}</Box>
  );
  return (
    <Box>{users.map(u => <UserRow key={u.userId} user={u} onDelete={onDelete} />)}</Box>
  );
}
