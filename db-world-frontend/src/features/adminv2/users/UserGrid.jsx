import { Box, Chip, IconButton, Tooltip, Skeleton } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion } from 'framer-motion';
import { useUserStore } from '../stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';
import { ROLE_COLORS } from './constants';

function UserCard({ user, onDelete, index }) {
  const { openDrawer, openModal } = useUserStore();
  const role = user.userRole?.roleName ?? 'VIEWER';

  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: index * 0.04 }}>
      <Box sx={{ bgcolor:'#ffffff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:2, p:2, display:'flex', flexDirection:'column', gap:1.5, '&:hover':{ borderColor:'rgba(13,148,136,0.3)', boxShadow:'0 0 0 1px rgba(13,148,136,0.12)' }, transition:'all .2s' }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
          <Box sx={{ width:40, height:40, borderRadius:'50%', bgcolor:'#0d9488', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, flexShrink:0, color:'#fff' }}>
            {(user.firstName?.[0] ?? '?').toUpperCase()}
          </Box>
          <Box sx={{ flex:1, minWidth:0 }}>
            <Box sx={{ fontWeight:600, fontSize:14, color:'#0f172a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {user.firstName} {user.lastName}
            </Box>
            <Box sx={{ fontSize:12, color:'rgba(15,23,42,0.5)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.email}</Box>
          </Box>
          <Chip label={role} size="small" sx={{ bgcolor:`${ROLE_COLORS[role]}18`, color:ROLE_COLORS[role], fontWeight:700, fontSize:11 }} />
        </Box>
        <Box sx={{ display:'flex', gap:2, fontSize:12, color:'rgba(15,23,42,0.5)' }}>
          <span>Logins: <b style={{ color:'rgba(15,23,42,0.8)' }}>{user.noOfLogin ?? 0}</b></span>
          {user.loginData?.[0]?.loginTime && (
            <span>Last: <b style={{ color:'rgba(15,23,42,0.8)' }}>{formatDistanceToNow(new Date(user.loginData[0].loginTime), { addSuffix:true })}</b></span>
          )}
        </Box>
        <Box sx={{ display:'flex', gap:0.5, justifyContent:'flex-end' }}>
          <Tooltip title="View"><IconButton size="small" onClick={() => openDrawer(user.userId)} sx={{ color:'rgba(15,23,42,0.4)','&:hover':{ color:'#0d9488', bgcolor:'rgba(13,148,136,0.08)' } }}><VisibilityIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal('edit', user.userId)} sx={{ color:'rgba(15,23,42,0.4)','&:hover':{ color:'#10b981', bgcolor:'rgba(16,185,129,0.08)' } }}><EditIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(user.userId)} sx={{ color:'rgba(15,23,42,0.4)','&:hover':{ color:'#ef4444', bgcolor:'rgba(239,68,68,0.08)' } }}><DeleteIcon sx={{ fontSize:16 }} /></IconButton></Tooltip>
        </Box>
      </Box>
    </motion.div>
  );
}

export default function UserGrid({ users, loading, onDelete }) {
  if (loading) {
    return (
      <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:2, p:2 }}>
        {Array.from({ length:8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={140} sx={{ bgcolor:'rgba(0,0,0,0.06)' }} />
        ))}
      </Box>
    );
  }
  return (
    <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:2, p:2 }}>
      {users.map((u, i) => <UserCard key={u.userId} user={u} onDelete={onDelete} index={i} />)}
    </Box>
  );
}
