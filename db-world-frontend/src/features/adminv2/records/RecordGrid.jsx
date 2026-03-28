// db-world-frontend/src/features/adminv2/records/RecordGrid.jsx
import { Box, Skeleton, IconButton, Tooltip, Typography, Pagination } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { motion } from 'framer-motion';
import { useRecordStore } from '../stores/useRecordStore';
import RecordTagsInline from './RecordTagsInline';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';

function RecordCard({ record, onDelete, index, queryKey }) {
  const { openDrawer, openModal } = useRecordStore();
  const poster = record.tmdb?.posterPath ?? record.tmdb?.backdropPath;

  return (
    <motion.div initial={{ opacity:0, scale:.97 }} animate={{ opacity:1, scale:1 }} transition={{ delay: index * 0.03 }}>
      <Box sx={{ bgcolor:'#131320', border:'1px solid rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden', display:'flex', flexDirection:'column', '&:hover':{ borderColor:'rgba(99,102,241,0.3)', '& .hover-actions':{ opacity:1 } }, transition:'border-color .2s' }}>
        {/* Poster */}
        <Box sx={{ position:'relative', aspectRatio:'2/3', bgcolor:'rgba(255,255,255,0.04)', overflow:'hidden' }}>
          {poster
            ? <Box component="img" src={`${TMDB_IMG}${poster}`} alt={record.name} sx={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" />
            : <Box sx={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {record.type === 'MOVIE' ? <MovieIcon sx={{ fontSize:40, color:'rgba(255,255,255,0.15)' }} /> : <TvIcon sx={{ fontSize:40, color:'rgba(255,255,255,0.15)' }} />}
              </Box>
          }
          {/* Type badge */}
          <Box sx={{ position:'absolute', top:8, left:8, px:1, py:.25, borderRadius:1, bgcolor: record.type === 'MOVIE' ? 'rgba(99,102,241,0.85)' : 'rgba(16,185,129,0.85)', fontSize:10, fontWeight:700, color:'#fff' }}>
            {record.type}
          </Box>
          {/* Hover actions */}
          <Box className="hover-actions" sx={{ position:'absolute', top:8, right:8, display:'flex', flexDirection:'column', gap:.5, opacity:0, transition:'opacity .2s' }}>
            <Tooltip title="View" placement="left"><IconButton size="small" onClick={() => openDrawer(record.recordId)} sx={{ bgcolor:'rgba(0,0,0,0.6)', color:'#fff','&:hover':{ bgcolor:'#6366f1' } }}><VisibilityIcon sx={{ fontSize:14 }} /></IconButton></Tooltip>
            <Tooltip title="Edit" placement="left"><IconButton size="small" onClick={() => openModal('edit', record.recordId)} sx={{ bgcolor:'rgba(0,0,0,0.6)', color:'#fff','&:hover':{ bgcolor:'#10b981' } }}><EditIcon sx={{ fontSize:14 }} /></IconButton></Tooltip>
            <Tooltip title="Delete" placement="left"><IconButton size="small" onClick={() => onDelete(record.recordId)} sx={{ bgcolor:'rgba(0,0,0,0.6)', color:'#fff','&:hover':{ bgcolor:'#ef4444' } }}><DeleteIcon sx={{ fontSize:14 }} /></IconButton></Tooltip>
          </Box>
        </Box>
        {/* Info */}
        <Box sx={{ p:1.5, flex:1, display:'flex', flexDirection:'column', gap:.75 }}>
          <Typography sx={{ fontSize:13, fontWeight:600, color:'#fff', lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{record.name}</Typography>
          <Box sx={{ display:'flex', gap:1, fontSize:11, color:'rgba(255,255,255,0.4)' }}>
            {record.year && <span>{record.year}</span>}
            {record.tmdbId && <span>TMDB: {record.tmdbId}</span>}
          </Box>
          <RecordTagsInline record={record} queryKey={queryKey} />
        </Box>
      </Box>
    </motion.div>
  );
}

export default function RecordGrid({ data, loading, onDelete, queryKey }) {
  const { page, pageSize, setPage } = useRecordStore();
  const totalPages = data?.totalPages ?? 0;

  if (loading) return (
    <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:2, p:2 }}>
      {Array.from({ length: pageSize }).map((_, i) => (
        <Box key={i}>
          <Skeleton variant="rounded" sx={{ aspectRatio:'2/3', bgcolor:'rgba(255,255,255,0.05)' }} />
          <Skeleton height={20} sx={{ bgcolor:'rgba(255,255,255,0.05)', mt:.5 }} />
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2, p:2 }}>
      <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:2 }}>
        {(data?.content ?? []).map((r, i) => (
          <RecordCard key={r.recordId} record={r} onDelete={onDelete} index={i} queryKey={queryKey} />
        ))}
      </Box>
      {totalPages > 1 && (
        <Box sx={{ display:'flex', justifyContent:'center' }}>
          <Pagination count={totalPages} page={page + 1} onChange={(_, p) => setPage(p - 1)}
            sx={{ '& .MuiPaginationItem-root':{ color:'rgba(255,255,255,0.5)' }, '& .Mui-selected':{ bgcolor:'rgba(99,102,241,0.3) !important', color:'#6366f1' } }} />
        </Box>
      )}
    </Box>
  );
}
