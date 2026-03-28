import { Box, Chip, IconButton, Menu, MenuItem, ListItemIcon, Skeleton } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';
import { ROLE_COLORS } from './constants';

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
