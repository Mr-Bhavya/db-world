// db-world-frontend/src/features/adminv2/records/RecordMobileList.jsx
import { Box, Chip, IconButton, Menu, MenuItem, ListItemIcon, Skeleton, Typography, Pagination } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { useState } from 'react';
import { useRecordStore } from '../stores/useRecordStore';
import { formatDistanceToNow } from 'date-fns';

const TMDB_THUMB = 'https://image.tmdb.org/t/p/w92';

function RecordRow({ record, onDelete }) {
  const { openDrawer, openModal } = useRecordStore();
  const [anchor, setAnchor] = useState(null);
  const poster = record.tmdb?.posterPath;

  return (
    <Box sx={{ display:'flex', alignItems:'center', gap:1.5, p:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      {/* Thumbnail */}
      <Box sx={{ width:36, height:52, borderRadius:1, overflow:'hidden', flexShrink:0, bgcolor:'rgba(255,255,255,0.06)' }}>
        {poster
          ? <Box component="img" src={`${TMDB_THUMB}${poster}`} alt={record.name} sx={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <Box sx={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {record.type === 'MOVIE' ? <MovieIcon sx={{ fontSize:16, color:'rgba(255,255,255,0.2)' }} /> : <TvIcon sx={{ fontSize:16, color:'rgba(255,255,255,0.2)' }} />}
            </Box>
        }
      </Box>
      {/* Info */}
      <Box sx={{ flex:1, minWidth:0 }}>
        <Box sx={{ fontWeight:600, fontSize:14, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{record.name}</Box>
        <Box sx={{ display:'flex', gap:1, mt:.25, flexWrap:'wrap' }}>
          <Chip label={record.type} size="small" sx={{ height:16, fontSize:9, fontWeight:700, bgcolor: record.type === 'MOVIE' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: record.type === 'MOVIE' ? '#6366f1' : '#10b981' }} />
          {record.year && <Box sx={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{record.year}</Box>}
        </Box>
        {record.updatedAt && <Box sx={{ fontSize:11, color:'rgba(255,255,255,0.3)', mt:.25 }}>{formatDistanceToNow(new Date(record.updatedAt), { addSuffix:true })}</Box>}
      </Box>
      {/* Menu */}
      <IconButton size="small" sx={{ color:'rgba(255,255,255,0.4)' }} onClick={e => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        PaperProps={{ sx:{ bgcolor:'#1a1a2e', border:'1px solid rgba(255,255,255,0.08)', color:'#fff' } }}>
        <MenuItem onClick={() => { openDrawer(record.recordId); setAnchor(null); }}>
          <ListItemIcon><VisibilityIcon fontSize="small" sx={{ color:'#6366f1' }} /></ListItemIcon>View
        </MenuItem>
        <MenuItem onClick={() => { openModal('edit', record.recordId); setAnchor(null); }}>
          <ListItemIcon><EditIcon fontSize="small" sx={{ color:'#10b981' }} /></ListItemIcon>Edit
        </MenuItem>
        <MenuItem onClick={() => { onDelete(record.recordId); setAnchor(null); }}>
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color:'#ef4444' }} /></ListItemIcon>
          <Box sx={{ color:'#ef4444' }}>Delete</Box>
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default function RecordMobileList({ data, loading, onDelete }) {
  const { page, setPage } = useRecordStore();
  const totalPages = data?.totalPages ?? 0;

  if (loading) return (
    <Box>{Array.from({ length:8 }).map((_, i) => <Skeleton key={i} height={72} sx={{ bgcolor:'rgba(255,255,255,0.04)', mx:2, mb:.5 }} />)}</Box>
  );

  return (
    <Box>
      {(data?.content ?? []).map(r => <RecordRow key={r.recordId} record={r} onDelete={onDelete} />)}
      {totalPages > 1 && (
        <Box sx={{ display:'flex', justifyContent:'center', py:2 }}>
          <Pagination count={totalPages} page={page + 1} onChange={(_, p) => setPage(p - 1)} size="small"
            sx={{ '& .MuiPaginationItem-root':{ color:'rgba(255,255,255,0.5)' }, '& .Mui-selected':{ bgcolor:'rgba(99,102,241,0.3) !important', color:'#6366f1' } }} />
        </Box>
      )}
    </Box>
  );
}
