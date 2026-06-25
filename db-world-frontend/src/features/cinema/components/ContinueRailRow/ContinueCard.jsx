import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { PlayArrow, Close } from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';

// Landscape (16:9) Continue Watching card: backdrop + progress bar + resume.
// Click anywhere resumes; the ✕ removes the title from the row.
const ContinueCard = ({ item, onResume, onRemove }) => {
  const dur = item.durationMs || 0;
  const pos = item.positionMs || 0;
  const pct = dur > 0 ? Math.min(100, Math.max(2, (pos / dur) * 100)) : 0;

  const isSeries = item.type === 'TV_SERIES';
  const epLabel = isSeries && item.season != null && item.episode != null
    ? `S${item.season}:E${item.episode}`
    : null;

  const img = tmdbImg(item.backdropPath ?? item.posterPath, 'w780');

  return (
    <Box
      onClick={() => onResume(item)}
      sx={{
        flexShrink: 0, position: 'relative', cursor: 'pointer',
        width: { xs: 230, sm: 260, md: 300 },
        aspectRatio: '16/9', borderRadius: 1.5, overflow: 'hidden',
        bgcolor: 'rgba(255,255,255,.06)',
        boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': { transform: 'scale(1.03)', boxShadow: '0 14px 40px rgba(0,0,0,.7)' },
        '&:hover .cw-play': { opacity: 1 },
      }}
    >
      {img && (
        <Box component="img" src={img} alt={item.title}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}

      {/* Remove */}
      <Tooltip title="Remove from Continue Watching">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onRemove(item); }}
          sx={{
            position: 'absolute', top: 4, right: 4, zIndex: 3,
            bgcolor: 'rgba(0,0,0,.6)', color: '#fff', p: 0.4,
            '&:hover': { bgcolor: 'rgba(0,0,0,.85)' },
          }}
        >
          <Close sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>

      {/* Center play affordance on hover */}
      <Box className="cw-play" sx={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        opacity: 0, transition: 'opacity .18s ease', pointerEvents: 'none',
      }}>
        <Box sx={{ bgcolor: 'rgba(0,0,0,.55)', borderRadius: '50%', p: 0.8, display: 'flex' }}>
          <PlayArrow sx={{ fontSize: 30, color: '#fff' }} />
        </Box>
      </Box>

      {/* Title + episode label */}
      <Box sx={{
        position: 'absolute', left: 0, right: 0, bottom: 4, px: 1,
        background: 'linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.35) 70%, transparent 100%)',
        pt: 2.5, pb: 0.6, pointerEvents: 'none',
      }}>
        <Typography sx={{
          color: '#fff', fontWeight: 700, fontSize: 'clamp(0.7rem, 1.6vw, 0.85rem)',
          lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 6px rgba(0,0,0,.9)',
        }}>
          {item.title}
        </Typography>
        {epLabel && (
          <Typography sx={{ color: 'rgba(255,255,255,.7)', fontSize: '0.66rem', mt: 0.1 }}>
            {epLabel}
          </Typography>
        )}
      </Box>

      {/* Progress bar pinned to the very bottom */}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, bgcolor: 'rgba(255,255,255,.25)' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: '#e50914' }} />
      </Box>
    </Box>
  );
};

export default ContinueCard;
