import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography, IconButton, Tooltip, Skeleton, Button } from '@mui/material';
import {
  PlayArrow, Check,
  BookmarkAdd, BookmarkAdded, ExpandMore, Star,
} from '@mui/icons-material';
import { tmdbImg } from '../../../api/cinemaApi';
import { year } from './cardHelpers';
import CardReactionButton from './CardReactionButton';

// MUST match RailRow's PRIME_ANIM_MS / PRIME_ANIM_EASE. If the overlay growth
// and the neighbour slide-aside run at different speeds, the seam between them
// breathes mid-animation and the cursor drops into a dead zone → flicker.
const DUR = 0.3;                  // 300ms — matches RailRow PRIME_ANIM_MS
const EASE = [0.4, 0, 0.2, 1];    // matches cubic-bezier(0.4, 0, 0.2, 1)

// Desktop "prime" rail card: a fixed portrait SLOT (never reflows) with an
// absolute landscape overlay that grows toward `expandDir` on hover.
const PrimeDesktopCard = ({
  record, interaction = {}, cfg, primeHeight, expandDir = 'right', isExpanded,
  cardRef, onMouseEnter, onMouseLeave, goDetail, goPlay,
  imgError, imgLoaded, setImgError, setImgLoaded,
  onWatchlist, onLike, onLove,
}) => {
  // Fluid height passed down from RecordCard so the expand-on-hover slot scales
  // with the viewport, and stays in sync with RailRow's PRIME_SHIFT math.
  const PRIME_H = primeHeight ?? cfg.tiers.desktop;
  const PORTRAIT = Math.round(PRIME_H * 9 / 16);
  const GAP = 6;
  const LANDSCAPE = Math.round(PRIME_H * 16 / 9) - GAP;

  const portraitSrc = imgError ? null : tmdbImg(record.posterPath ?? record.backdropPath, 'w342');
  const landscapeSrc = tmdbImg(record.backdropPath ?? record.posterPath, 'w780');
  const logoSrc = record.logoPath ? tmdbImg(record.logoPath, 'w300') : null;

  // Keep the slot z-index elevated until the collapse animation completes, so
  // the shrinking overlay never slides under a neighbouring card mid-transition.
  const [elevated, setElevated] = useState(false);
  useEffect(() => { if (isExpanded) setElevated(true); }, [isExpanded]);

  // The landscape backdrop gets its own load/error state — previously it shared
  // the portrait's `imgError`, so a failed poster blanked the backdrop too.
  const [lsLoaded, setLsLoaded] = useState(false);
  const [lsError, setLsError] = useState(false);

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
      animate={{ zIndex: elevated ? 10 : 1 }}
      transition={{ duration: 0 }}
      sx={{ flexShrink: 0, position: 'relative', width: PORTRAIT, height: PRIME_H, cursor: 'pointer' }}
    >
      {/* Idle portrait poster — the fixed footprint */}
      <Box sx={{ position: 'absolute', inset: 0, borderRadius: 1, overflow: 'hidden', bgcolor: 'rgba(255,255,255,.06)' }}>
        {!imgLoaded && <Skeleton variant="rectangular" width="100%" height="100%" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,.06)' }} />}
        {portraitSrc && (
          <Box component="img" src={portraitSrc} alt={record.title}
            onLoad={() => setImgLoaded(true)} onError={() => { setImgError(true); setImgLoaded(true); }}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: imgLoaded ? 1 : 0, transition: 'opacity .3s' }} />
        )}
        {interaction.watched && (
          <Box sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,.72)', borderRadius: 10, px: 0.7, py: 0.2, display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <Check sx={{ fontSize: 10, color: '#4caf50' }} />
            <Typography sx={{ fontSize: '0.6rem', color: '#4caf50', fontWeight: 700 }}>Watched</Typography>
          </Box>
        )}
      </Box>

      {/* Hover overlay — absolute landscape, grows toward expandDir (no reflow).
          AnimatePresence gives it a real collapse animation on mouse-leave
          instead of snapping shut on unmount. */}
      <AnimatePresence onExitComplete={() => setElevated(false)}>
        {isExpanded && (
          <Box
            key="prime-overlay"
            component={motion.div}
            initial={{ width: PORTRAIT, opacity: 0 }}
            animate={{ width: LANDSCAPE, opacity: 1 }}
            exit={{ width: PORTRAIT, opacity: 0 }}
            transition={{ duration: DUR, ease: EASE }}
            sx={{
              position: 'absolute', top: 0, height: PRIME_H,
              ...(expandDir === 'left' ? { right: 0 } : { left: 0 }),
              borderRadius: 1, overflow: 'hidden', zIndex: 5, bgcolor: '#141414',
            }}
          >
            {landscapeSrc && !lsError && (
              <Box component="img" src={landscapeSrc} alt={record.title}
                onLoad={() => setLsLoaded(true)} onError={() => setLsError(true)}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: lsLoaded ? 1 : 0, transition: 'opacity .25s' }} />
            )}
            <Box sx={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,.98) 0%, rgba(0,0,0,.75) 42%, rgba(0,0,0,.2) 78%, transparent 100%)',
              p: 2, pt: 5,
            }}>
              {/* Logo (falls back to the title) */}
              {logoSrc ? (
                <Box component="img" src={logoSrc} alt={record.title}
                  sx={{ maxHeight: 56, maxWidth: '72%', objectFit: 'contain', objectPosition: 'left bottom', display: 'block', mb: 0.9, filter: 'drop-shadow(0 2px 10px rgba(0,0,0,.85))' }} />
              ) : (
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem', mb: 0.7, lineHeight: 1.15, textShadow: '0 2px 10px rgba(0,0,0,.85)' }}>
                  {record.title}
                </Typography>
              )}

              {/* Meta — one dotted line */}
              <Box sx={{ display: 'flex', gap: 0.9, mb: 0.7, flexWrap: 'wrap', alignItems: 'center' }}>
                {record.voteAverage > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                    <Star sx={{ fontSize: 15, color: '#46d369' }} />
                    <Typography sx={{ color: '#46d369', fontSize: '0.85rem', fontWeight: 800 }}>{Number(record.voteAverage).toFixed(1)}</Typography>
                  </Box>
                )}
                {year(record.releaseDate) && (
                  <Typography sx={{ color: 'rgba(255,255,255,.72)', fontSize: '0.85rem', fontWeight: 600 }}>{year(record.releaseDate)}</Typography>
                )}
                {record.genres?.slice(0, 3).map((g) => (
                  <React.Fragment key={g}>
                    <Box component="span" sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.35)' }} />
                    <Typography sx={{ color: 'rgba(255,255,255,.62)', fontSize: '0.78rem' }}>{g}</Typography>
                  </React.Fragment>
                ))}
              </Box>

              {/* Overview snippet */}
              {record.overview && (
                <Typography sx={{
                  color: 'rgba(255,255,255,.7)', fontSize: '0.82rem', lineHeight: 1.45, mb: 1.1,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '92%',
                }}>
                  {record.overview}
                </Typography>
              )}

              {/* Actions — prominent Play, then the secondary icons */}
              <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center' }}>
                <Button
                  onClick={goPlay}
                  variant="contained"
                  startIcon={<PlayArrow sx={{ fontSize: 21 }} />}
                  sx={{
                    bgcolor: '#fff', color: '#000', fontWeight: 800, textTransform: 'none',
                    fontSize: '0.86rem', borderRadius: 1, py: 0.5, px: 2.2, boxShadow: 'none',
                    '&:hover': { bgcolor: 'rgba(255,255,255,.85)', boxShadow: 'none' },
                  }}
                >
                  Play
                </Button>
                {iconBtn(interaction.watchlisted ? 'In My List' : 'Add to My List',
                  (e) => { e.stopPropagation(); onWatchlist?.(record); },
                  interaction.watchlisted ? <BookmarkAdded sx={{ fontSize: 16 }} /> : <BookmarkAdd sx={{ fontSize: 16 }} />,
                  { color: interaction.watchlisted ? '#46d369' : '#fff' })}
                <CardReactionButton
                  record={record}
                  liked={interaction.liked}
                  loved={interaction.loved}
                  onLike={onLike}
                  onLove={onLove}
                  iconSize={16}
                  pad={0.65}
                />
                <Box sx={{ ml: 'auto' }}>
                  {iconBtn('More details', goDetail, <ExpandMore sx={{ fontSize: 18 }} />)}
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default memo(PrimeDesktopCard);