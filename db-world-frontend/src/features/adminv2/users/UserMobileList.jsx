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
      <Box sx={{ display:'flex', alignItems:'center', gap:1.5, p:'12px 16px', borderBottom:'1px solid rgba(0,0,0,0.06)', bgcolor:'#ffffff' }}>
        <Box sx={{ width:36, height:36, borderRadius:'50%', bgcolor:'#0d9488', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0, color:'#fff' }}>
          {(user.firstName?.[0] ?? '?').toUpperCase()}
        </Box>
        <Box sx={{ flex:1, minWidth:0 }}>
          <Box sx={{ fontWeight:600, fontSize:14, color:'#0f172a' }}>{user.firstName} {user.lastName}</Box>
          <Box sx={{ fontSize:12, color:'rgba(15,23,42,0.5)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</Box>
          {user.loginData?.[0]?.loginTime && (
            <Box sx={{ fontSize:11, color:'rgba(15,23,42,0.35)' }}>{formatDistanceToNow(new Date(user.loginData[0].loginTime), { addSuffix:true })}</Box>
          )}
        </Box>
        <Chip label={role} size="small" sx={{ bgcolor:`${ROLE_COLORS[role]}18`, color:ROLE_COLORS[role], fontWeight:700, fontSize:10 }} />
        <IconButton size="small" sx={{ color:'rgba(15,23,42,0.4)' }} onClick={e => setAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
          PaperProps={{ sx:{ bgcolor:'#ffffff', border:'1px solid rgba(0,0,0,0.1)', color:'#0f172a', boxShadow:'0 4px 20px rgba(0,0,0,0.12)' } }}>
          <MenuItem onClick={() => { openDrawer(user.userId); setAnchor(null); }}>
            <ListItemIcon><VisibilityIcon fontSize="small" sx={{ color:'#0d9488' }} /></ListItemIcon>View
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
    <Box>{Array.from({ length:6 }).map((_, i) => <Skeleton key={i} height={72} sx={{ bgcolor:'rgba(0,0,0,0.06)', mx:2, mb:.5 }} />)}</Box>
  );
  return (
    <Box>{users.map(u => <UserRow key={u.userId} user={u} onDelete={onDelete} />)}</Box>
  );
}
