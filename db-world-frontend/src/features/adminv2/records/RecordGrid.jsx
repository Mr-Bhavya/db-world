import { Box, Skeleton, IconButton, Tooltip, Chip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { useRecordStore } from '../stores/useRecordStore';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185';

function RecordCard({ record, onDelete, index }) {
  const T = useT();
  const { openDrawer, openModal, openTmdbModal, openRecordDetail, openMediaFiles } = useRecordStore();
  const poster = record.tmdb?.posterPath ?? record.tmdb?.backdropPath;
  const isMovie = record.type === 'MOVIE';

  return (
    <motion.div initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.02 }}>
      <Box sx={{
        bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1.5,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transition: 'all .18s',
        '&:hover': { borderColor: T.glassBorderHover, boxShadow: `0 0 0 1px ${T.tealGlow}`, '& .card-actions': { opacity: 1 } },
      }}>
        {/* Poster — compact 2:3 ratio */}
        <Box sx={{ position: 'relative', aspectRatio: '2/3', bgcolor: T.glass, overflow: 'hidden' }}>
          {poster
            ? <Box component="img" src={`${TMDB_IMG}${poster}`} alt={record.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isMovie ? <MovieIcon sx={{ fontSize: 32, color: T.textFaint }} /> : <TvIcon sx={{ fontSize: 32, color: T.textFaint }} />}
              </Box>
          }
          {/* Type badge */}
          <Chip
            label={isMovie ? 'M' : 'S'} size="small"
            sx={{ position: 'absolute', top: 5, left: 5, height: 16, fontSize: 9, fontWeight: 800,
              bgcolor: isMovie ? T.teal : T.success, color: '#fff', '& .MuiChip-label': { px: .75 } }}
          />
          {/* Hover actions */}
          <Box className="card-actions" sx={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: .5,
            bgcolor: 'rgba(0,0,0,0.52)', opacity: 0, transition: 'opacity .18s',
          }}>
            <Tooltip title="View"><IconButton size="small" onClick={() => openDrawer(record.recordId)} sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: T.teal } }}><VisibilityIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
            <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal('edit', record.recordId)} sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: T.success } }}><EditIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
            <Tooltip title="Media Files"><IconButton size="small" onClick={() => openMediaFiles(record.recordId)} sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: T.teal } }}><VideoFileIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
            <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(record.recordId)} sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: T.error } }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
          </Box>
        </Box>

        {/* Compact info */}
        <Box sx={{ px: 1, py: .75 }}>
          <Box sx={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, lineHeight: 1.25,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {record.name}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: .5 }}>
            {record.year && <Box sx={{ fontSize: 10, color: T.textFaint }}>{record.year}</Box>}
            {record.tmdbId && (
              <Box
                onClick={() => openTmdbModal(record)}
                sx={{ fontSize: 10, color: T.teal, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              >
                #{record.tmdbId}
              </Box>
            )}
          </Box>
          {/* Record ID + quick links row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: .25 }}>
            <Box
              onClick={() => openRecordDetail(record.recordId)}
              sx={{ fontSize: 9, color: T.textFaint, cursor: 'pointer', '&:hover': { color: T.teal } }}
            >
              ID:{record.recordId}
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

export default function RecordGrid({ rows, loading, onDelete }) {
  const T = useT();

  if (loading && rows.length === 0) return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1.5, p: 2 }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <Box key={i}>
          <Skeleton variant="rounded" sx={{ aspectRatio: '2/3', bgcolor: T.glass }} />
          <Skeleton height={14} sx={{ bgcolor: T.glass, mt: .5 }} />
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1.5, p: 2 }}>
      {rows.map((r, i) => (
        <RecordCard key={r.recordId} record={r} onDelete={onDelete} index={i} />
      ))}
    </Box>
  );
}
