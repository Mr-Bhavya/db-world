// db-world-frontend/src/features/adminv2/records/RecordDetailDrawer.jsx
import { Drawer, Box, Typography, Chip, Divider, IconButton, Skeleton, Rating } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useRecordStore } from '../stores/useRecordStore';

const TMDB_IMG   = 'https://image.tmdb.org/t/p/w500';
const TMDB_SMALL = 'https://image.tmdb.org/t/p/w185';

const InfoRow = ({ label, value }) => value ? (
  <Box sx={{ display:'flex', justifyContent:'space-between', py:.75, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
    <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{label}</Typography>
    <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.8)', textAlign:'right', maxWidth:'60%' }}>{value}</Typography>
  </Box>
) : null;

export default function RecordDetailDrawer({ data }) {
  const { drawerRecordId, closeDrawer } = useRecordStore();
  const open = Boolean(drawerRecordId);

  // Find record in current page data
  const record = data?.content?.find(r => r.recordId === drawerRecordId);
  const tmdb   = record?.tmdb;

  const backdrop = tmdb?.backdropPath ?? tmdb?.posterPath;
  const genres   = tmdb?.genres?.map(g => g.name).join(', ');
  const providers = [...new Set(tmdb?.providers?.map(p => p.providerName).filter(Boolean) ?? [])].join(', ') || null;

  return (
    <Drawer anchor="right" open={open} onClose={closeDrawer}
      PaperProps={{ sx:{ width:{ xs:'100vw', sm:460 }, bgcolor:'#0d0d18', borderLeft:'1px solid rgba(255,255,255,0.06)', color:'#fff', display:'flex', flexDirection:'column' } }}>

      {/* Backdrop */}
      {backdrop && (
        <Box sx={{ position:'relative', height:180, overflow:'hidden', flexShrink:0 }}>
          <Box component="img" src={`${TMDB_IMG}${backdrop}`} alt="" sx={{ width:'100%', height:'100%', objectFit:'cover', filter:'brightness(.55)' }} />
          <Box sx={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 40%, #0d0d18 100%)' }} />
          <IconButton onClick={closeDrawer} sx={{ position:'absolute', top:8, right:8, color:'#fff', bgcolor:'rgba(0,0,0,0.5)' }}><CloseIcon /></IconButton>
        </Box>
      )}

      {/* Header (when no backdrop) */}
      {!backdrop && (
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', p:2, borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          <Typography sx={{ fontWeight:700, fontSize:16 }}>Record Details</Typography>
          <IconButton onClick={closeDrawer} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
        </Box>
      )}

      <Box sx={{ p:2, overflowY:'auto', flex:1 }}>
        {!open ? null : !record ? (
          <Box sx={{ display:'flex', flexDirection:'column', gap:2, alignItems:'center', pt:4 }}>
            <Typography sx={{ fontSize:14, color:'rgba(255,255,255,0.4)' }}>Record not available in current page.</Typography>
            <Typography sx={{ fontSize:12, color:'rgba(255,255,255,0.25)' }}>Navigate to the page containing this record and try again.</Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontWeight:700, fontSize:20, mb:.5 }}>{record.name}</Typography>
            <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', mb:1.5 }}>
              <Chip label={record.type} size="small" sx={{ bgcolor: record.type === 'MOVIE' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: record.type === 'MOVIE' ? '#6366f1' : '#10b981', fontWeight:700 }} />
              {record.year && <Chip label={record.year} size="small" sx={{ bgcolor:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)' }} />}
            </Box>

            {tmdb?.voteAverage > 0 && (
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1.5 }}>
                <Rating value={tmdb.voteAverage / 2} precision={0.5} readOnly size="small" sx={{ color:'#f59e0b' }} />
                <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>{tmdb.voteAverage?.toFixed(1)} / 10</Typography>
              </Box>
            )}

            {tmdb?.overview && (
              <Typography sx={{ fontSize:13, color:'rgba(255,255,255,0.65)', lineHeight:1.6, mb:2 }}>{tmdb.overview}</Typography>
            )}

            <InfoRow label="TMDB ID"  value={record.tmdbId} />
            <InfoRow label="Genres"   value={genres} />
            <InfoRow label="Runtime"  value={tmdb?.runtime ? `${tmdb.runtime} min` : null} />
            <InfoRow label="Status"   value={tmdb?.status} />
            <InfoRow label="Language" value={tmdb?.originalLanguage?.toUpperCase()} />
            <InfoRow label="Providers" value={providers} />

            {/* Tags */}
            {record.tags?.length > 0 && (
              <>
                <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.06)' }} />
                <Typography sx={{ fontSize:11, textTransform:'uppercase', letterSpacing:.8, color:'rgba(255,255,255,0.3)', mb:1 }}>Tags</Typography>
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:.75 }}>
                  {record.tags.map(t => (
                    <Chip key={t.tagType} label={t.tagType.replace(/_/g,' ')} size="small" sx={{ fontSize:11, fontWeight:700, bgcolor:'rgba(99,102,241,0.15)', color:'#6366f1' }} />
                  ))}
                </Box>
              </>
            )}

            {/* Cast */}
            {tmdb?.credits?.cast?.length > 0 && (
              <>
                <Divider sx={{ my:2, borderColor:'rgba(255,255,255,0.06)' }} />
                <Typography sx={{ fontSize:11, textTransform:'uppercase', letterSpacing:.8, color:'rgba(255,255,255,0.3)', mb:1 }}>Cast</Typography>
                <Box sx={{ display:'flex', gap:1.5, overflowX:'auto', pb:1 }}>
                  {tmdb.credits.cast.slice(0,10).map(c => (
                    <Box key={c.id} sx={{ flexShrink:0, textAlign:'center', width:60 }}>
                      <Box sx={{ width:52, height:52, borderRadius:'50%', overflow:'hidden', bgcolor:'rgba(255,255,255,0.08)', mx:'auto' }}>
                        {c.profilePath
                          ? <Box component="img" src={`${TMDB_SMALL}${c.profilePath}`} alt={c.name} sx={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <Box sx={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'rgba(255,255,255,0.4)' }}>{c.name?.[0]}</Box>
                        }
                      </Box>
                      <Typography sx={{ fontSize:10, color:'rgba(255,255,255,0.6)', mt:.5, lineHeight:1.2, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{c.name}</Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
