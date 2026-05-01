import { Box, Skeleton, IconButton, Tooltip, Chip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { useRecordStore } from '../stores/useRecordStore';
import { useTagDefs } from './useTagDefs';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185';

const parseTags = (tags) => tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

function RecordCard({ record, onDelete, index }) {
  const T = useT();
  const { openModal, openTmdbModal, openRecordDetail, openMediaFiles } = useRecordStore();
  const { tagColor, tagLabel } = useTagDefs();
  const poster = record.tmdb?.posterPath ?? record.tmdb?.backdropPath;
  const isMovie = record.type === 'MOVIE';
  const tags = parseTags(record.tags);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.3) }}
      style={{ height: '100%' }}
    >
      <Box sx={{
        height: '100%',
        display: 'flex', flexDirection: 'column',
        bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 2,
        overflow: 'hidden', transition: 'all .18s',
        '&:hover': {
          borderColor: T.teal,
          boxShadow: `0 0 0 1px ${T.teal}40, 0 4px 16px rgba(0,0,0,0.18)`,
          '& .card-actions': { opacity: 1 },
        },
      }}>
        {/* Poster */}
        <Box sx={{ position: 'relative', aspectRatio: '2/3', bgcolor: T.adminBg, overflow: 'hidden', flexShrink: 0 }}>
          {poster
            ? <Box component="img" src={`${TMDB_IMG}${poster}`} alt={record.name}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
            : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isMovie
                  ? <MovieIcon sx={{ fontSize: 36, color: T.textFaint }} />
                  : <TvIcon    sx={{ fontSize: 36, color: T.textFaint }} />}
              </Box>
          }

          {/* Type badge */}
          <Chip label={isMovie ? 'Movie' : 'Series'} size="small" sx={{
            position: 'absolute', top: 6, left: 6, height: 18, fontSize: 9, fontWeight: 800,
            bgcolor: isMovie ? T.teal : T.success, color: '#fff',
            '& .MuiChip-label': { px: 1 },
          }} />

          {/* Action overlay */}
          <Box className="card-actions" sx={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: .75,
            bgcolor: 'rgba(0,0,0,0.56)', opacity: 0, transition: 'opacity .18s',
          }}>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openModal('edit', record.recordId)}
                sx={{ bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: T.success } }}>
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Media Files">
              <IconButton size="small" onClick={() => openMediaFiles(record.recordId)}
                sx={{ bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: T.teal } }}>
                <VideoFileIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => onDelete(record.recordId)}
                sx={{ bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: T.error } }}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Info */}
        <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: .5, flex: 1 }}>
          <Typography sx={{
            fontWeight: 600, fontSize: 12, color: T.textPrimary, lineHeight: 1.3,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {record.name}
          </Typography>

          {/* Year + TMDB ID row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: .5 }}>
            <Box sx={{ fontSize: 11, color: T.textFaint }}>{record.year ?? '—'}</Box>
            {record.tmdbId && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: .25 }}>
                <Tooltip title="View TMDB data">
                  <Box onClick={() => openTmdbModal(record)}
                    sx={{ fontSize: 10, color: T.teal, cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
                    #{record.tmdbId}
                  </Box>
                </Tooltip>
                <Box
                  component="a"
                  href={`https://www.themoviedb.org/${isMovie ? 'movie' : 'tv'}/${record.tmdbId}`}
                  target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  sx={{ color: T.textFaint, display: 'flex', '&:hover': { color: T.teal } }}>
                  <OpenInNewIcon sx={{ fontSize: 9 }} />
                </Box>
              </Box>
            )}
          </Box>

          {/* Record ID */}
          <Tooltip title="View record details">
            <Box onClick={() => openRecordDetail(record.recordId)}
              sx={{ fontSize: 10, color: T.textFaint, cursor: 'pointer', '&:hover': { color: T.teal },
                width: 'fit-content' }}>
              ID: {record.recordId}
            </Box>
          </Tooltip>

          {/* Tags */}
          {tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .35, mt: .25 }}>
              {tags.slice(0, 3).map(tagType => (
                <Chip key={tagType}
                  label={tagLabel(tagType)}
                  size="small"
                  sx={{
                    height: 14, fontSize: 9, fontWeight: 700,
                    bgcolor: `${tagColor(tagType)}18`,
                    color: tagColor(tagType),
                    border: `1px solid ${tagColor(tagType)}33`,
                    '& .MuiChip-label': { px: .75 },
                  }}
                />
              ))}
              {tags.length > 3 && (
                <Chip label={`+${tags.length - 3}`} size="small"
                  sx={{ height: 14, fontSize: 9, bgcolor: T.glass, color: T.textFaint, '& .MuiChip-label': { px: .75 } }} />
              )}
            </Box>
          )}
        </Box>
      </Box>
    </motion.div>
  );
}

export default function RecordGrid({ rows, loading, onDelete }) {
  const T = useT();

  if (loading && rows.length === 0) return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5, p: 2 }}>
      {Array.from({ length: 16 }).map((_, i) => (
        <Box key={i}>
          <Skeleton variant="rounded" sx={{ aspectRatio: '2/3', bgcolor: T.glass }} />
          <Skeleton height={14} sx={{ bgcolor: T.glass, mt: .5 }} />
          <Skeleton height={12} width="60%" sx={{ bgcolor: T.glass, mt: .25 }} />
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5, p: 2 }}>
      {rows.map((r, i) => (
        <RecordCard key={r.recordId} record={r} onDelete={onDelete} index={i} />
      ))}
    </Box>
  );
}
