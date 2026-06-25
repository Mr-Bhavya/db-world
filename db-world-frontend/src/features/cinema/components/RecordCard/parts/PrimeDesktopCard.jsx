import React from 'react';
import { motion } from 'framer-motion';
import { Box, Typography, IconButton, Tooltip, Skeleton } from '@mui/material';
import {
  PlayArrow, Check, ThumbUp, ThumbUpOutlined,
  BookmarkAdd, BookmarkAdded, ExpandMore, Star,
} from '@mui/icons-material';
import { tmdbImg } from '../../../api/cinemaApi';
import { year } from './cardHelpers';

// Desktop "prime" rail card: a fixed portrait SLOT (never reflows) with an
// absolute landscape overlay that grows toward `expandDir` on hover.
const PrimeDesktopCard = ({
  record, interaction = {}, cfg, expandDir, isExpanded,
  cardRef, onMouseEnter, onMouseLeave, goDetail, goPlay,
  imgError, imgLoaded, setImgError, setImgLoaded,
  onWatchlist, onLike,
}) => {
  const PRIME_H = cfg.tiers.desktop;
  const PORTRAIT = Math.round(PRIME_H * 9 / 16);
  const GAP = 6;
  const LANDSCAPE = Math.round(PRIME_H * 16 / 9) - GAP;
  const portraitSrc = imgError ? null : tmdbImg(record.posterPath ?? record.backdropPath, 'w342');
  const landscapeSrc = imgError ? null : tmdbImg(record.backdropPath ?? record.posterPath, 'w780');

  const iconBtn = (title, onClick, child, extra = {}) => (
    <Tooltip title={title}>
      <IconButton size="small" onClick={onClick}
        sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', p: 0.65, '&:hover': { borderColor: '#fff' }, ...extra }}>
        {child}
      </IconButton>
    </Tooltip>
  );

  return (
    <Box
      ref={cardRef}
      component={motion.div}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={goDetail}
      animate={{ zIndex: isExpanded ? 10 : 1 }}
      transition={{ duration: 0 }}
      sx={{ flexShrink: 0, position: 'relative', width: PORTRAIT, height: PRIME_H, cursor: 'pointer' }}
    >
      {/* Idle portrait poster — the fixed footprint */}
      <Box sx={{ position: 'absolute', inset: 0, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'rgba(255,255,255,.06)' }}>
        {!imgLoaded && <Skeleton variant="rectangular" width="100%" height="100%" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,.06)' }} />}
        {portraitSrc && (
          <Box component="img" src={portraitSrc} alt={record.title}
            onLoad={() => setImgLoaded(true)} onError={() => { setImgError(true); setImgLoaded(true); }}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        {interaction.watched && (
          <Box sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,.72)', borderRadius: 10, px: 0.7, py: 0.2, display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <Check sx={{ fontSize: 10, color: '#4caf50' }} />
            <Typography sx={{ fontSize: '0.6rem', color: '#4caf50', fontWeight: 700 }}>Watched</Typography>
          </Box>
        )}
      </Box>

      {/* Hover overlay — absolute landscape, grows toward expandDir (no reflow) */}
      {isExpanded && (
        <Box
          component={motion.div}
          initial={{ width: PORTRAIT, opacity: 0.5 }}
          animate={{ width: LANDSCAPE, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          sx={{
            position: 'absolute', top: 0, height: PRIME_H,
            ...(expandDir === 'left' ? { right: 0 } : { left: 0 }),
            borderRadius: 1.5, overflow: 'hidden', zIndex: 5, bgcolor: '#141414',
          }}
        >
          {landscapeSrc && (
            <Box component="img" src={landscapeSrc} alt={record.title}
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,.97) 0%, rgba(0,0,0,.4) 75%, transparent 100%)',
            p: 1.6, pt: 4,
          }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', mb: 0.6, lineHeight: 1.2 }}>
              {record.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.9, mb: 0.7, alignItems: 'center' }}>
              {record.voteAverage > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  <Star sx={{ fontSize: 15, color: '#46d369' }} />
                  <Typography sx={{ color: '#46d369', fontSize: '0.85rem', fontWeight: 700 }}>{Number(record.voteAverage).toFixed(1)}</Typography>
                </Box>
              )}
              {year(record.releaseDate) && <Typography sx={{ color: 'rgba(255,255,255,.6)', fontSize: '0.85rem' }}>{year(record.releaseDate)}</Typography>}
            </Box>
            {record.genres?.length > 0 && (
              <Typography sx={{ color: 'rgba(255,255,255,.45)', fontSize: '0.74rem', mb: 1 }}>
                {record.genres.slice(0, 3).join(' · ')}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
              <Tooltip title="Play">
                <IconButton size="small" onClick={goPlay} sx={{ bgcolor: '#fff', color: '#000', p: 0.7, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }}>
                  <PlayArrow sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              {!interaction?.watched && iconBtn(interaction.watchlisted ? 'In My List' : 'Add to My List',
                (e) => { e.stopPropagation(); onWatchlist?.(record); },
                interaction.watchlisted ? <BookmarkAdded sx={{ fontSize: 16 }} /> : <BookmarkAdd sx={{ fontSize: 16 }} />,
                { color: interaction.watchlisted ? '#46d369' : '#fff' })}
              {iconBtn(interaction.liked ? 'Unlike' : 'Like',
                (e) => { e.stopPropagation(); onLike?.(record); },
                interaction.liked ? <ThumbUp sx={{ fontSize: 16 }} /> : <ThumbUpOutlined sx={{ fontSize: 16 }} />)}
              {iconBtn('More details', goDetail, <ExpandMore sx={{ fontSize: 18 }} />, { ml: 'auto' })}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default PrimeDesktopCard;
