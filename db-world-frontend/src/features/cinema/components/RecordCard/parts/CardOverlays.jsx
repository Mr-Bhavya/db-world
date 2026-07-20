import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import {
  PlayArrow, Check, Visibility, VisibilityOff,
  BookmarkAdd, BookmarkAdded, ExpandMore, Star,
} from '@mui/icons-material';
import { tmdbImg } from '../../../api/cinemaApi';
import { year } from './cardHelpers';
import CardReactionButton from './CardReactionButton';

// Title logo over a clean image — shown ALONE (no meta) when available.
const LogoImg = ({ record, maxH = 34 }) => (
  <Box
    component="img"
    src={tmdbImg(record.logoPath, 'w300')}
    alt={record.title}
    draggable={false}
    sx={{
      maxHeight: maxH,
      maxWidth: '90%',
      objectFit: 'contain',
      objectPosition: 'left bottom',
      display: 'block',
      filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.95))',
    }}
  />
);

// Small shared meta row (★ rating · year · genres) used by the title overlay.
const MetaRow = ({ record }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexWrap: 'nowrap' }}>
    {record.voteAverage > 0 && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, flexShrink: 0 }}>
        <Star sx={{ fontSize: 9, color: '#46d369' }} />
        <Typography sx={{ color: '#46d369', fontSize: '0.6rem', fontWeight: 800, lineHeight: 1 }}>
          {Number(record.voteAverage).toFixed(1)}
        </Typography>
      </Box>
    )}
    {year(record.releaseDate) && (
      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', lineHeight: 1, flexShrink: 0 }}>
        {year(record.releaseDate)}
      </Typography>
    )}
    {record.genres?.length > 0 && (
      <Typography sx={{
        color: 'rgba(255,255,255,0.32)', fontSize: '0.56rem', lineHeight: 1,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {record.genres.slice(0, 2).join(' · ')}
      </Typography>
    )}
  </Box>
);

// Landscape title overlay — three styles per rail type (glass / tag / fade).
// With a logo: show the logo ALONE (no meta). Without: text title + meta row.
export const CardTitleOverlay = ({ record, titleStyle = 'fade' }) => {
  const hasLogo = Boolean(record.logoPath);

  if (titleStyle === 'glass') return (
    <Box sx={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backdropFilter: 'blur(14px) saturate(160%)',
      WebkitBackdropFilter: 'blur(14px) saturate(160%)',
      background: 'rgba(0,0,0,0.52)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      px: 1.2, pt: 0.65, pb: 0.6, pointerEvents: 'none',
    }}>
      {hasLogo ? (
        <LogoImg record={record} maxH={30} />
      ) : (
        <>
          <Typography sx={{
            color: '#fff', fontWeight: 700, fontSize: 'clamp(0.66rem, 1.7vw, 0.86rem)',
            lineHeight: 1.2, mb: 0.25, display: '-webkit-box', WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical', overflow: 'hidden', letterSpacing: 0.1,
          }}>
            {record.title}
          </Typography>
          <MetaRow record={record} />
        </>
      )}
    </Box>
  );

  if (titleStyle === 'tag') return (
    <Box sx={{
      position: 'absolute', bottom: 7, left: 7, maxWidth: '82%',
      bgcolor: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      borderRadius: '5px', px: 0.85, py: 0.4, border: '1px solid rgba(255,255,255,0.11)',
      pointerEvents: 'none',
    }}>
      {hasLogo ? (
        <LogoImg record={record} maxH={24} />
      ) : (
        <Typography sx={{
          color: '#fff', fontWeight: 650, fontSize: 'clamp(0.62rem, 1.5vw, 0.8rem)',
          lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {record.title}
        </Typography>
      )}
    </Box>
  );

  // fade (default)
  return (
    <Box sx={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.55) 52%, transparent 100%)',
      px: 1.2, pb: 1, pt: 3.5, pointerEvents: 'none',
    }}>
      {hasLogo ? (
        <LogoImg record={record} maxH={36} />
      ) : (
        <>
          <Typography sx={{
            color: '#fff', fontWeight: 750, fontSize: 'clamp(0.68rem, 1.8vw, 0.9rem)',
            lineHeight: 1.15, mb: 0.35, display: '-webkit-box', WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
            textShadow: '0 1px 8px rgba(0,0,0,0.9)', letterSpacing: 0.15,
          }}>
            {record.title}
          </Typography>
          <MetaRow record={record} />
        </>
      )}
    </Box>
  );
};

// Portrait poster title caption (type="poster").
export const PosterCaption = ({ record }) => (
  <Box sx={{
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)',
    px: 1, pb: 0.8, pt: 2.5, pointerEvents: 'none',
  }}>
    <Typography sx={{
      color: '#fff', fontWeight: 700, fontSize: 'clamp(0.66rem, 1.6vw, 0.82rem)',
      lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 6px rgba(0,0,0,0.9)',
    }}>
      {record.title}
    </Typography>
  </Box>
);

// Prime expanded info bar — simple on mobile (tap opens detail), full row on desktop.
export const ExpandedInfoBar = ({ record, interaction, isMobile, goPlay, onWatchlist, onLike, onLove, onWatched, goDetail }) => {
  if (isMobile) return (
    <Box sx={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(to top, rgba(0,0,0,.95) 0%, rgba(0,0,0,.45) 70%, transparent 100%)',
      p: 1, pt: 2.5,
    }}>
      <Typography sx={{
        color: '#fff', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.2,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {record.title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75, mt: 0.4, alignItems: 'center' }}>
        {record.voteAverage > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <Star sx={{ fontSize: 11, color: '#46d369' }} />
            <Typography sx={{ color: '#46d369', fontSize: '0.7rem', fontWeight: 700 }}>
              {Number(record.voteAverage).toFixed(1)}
            </Typography>
          </Box>
        )}
        {year(record.releaseDate) && (
          <Typography sx={{ color: 'rgba(255,255,255,.55)', fontSize: '0.7rem' }}>
            {year(record.releaseDate)}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(to top, rgba(0,0,0,.97) 0%, rgba(0,0,0,.4) 75%, transparent 100%)',
      p: 1.2, pt: 3,
    }}>
      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', mb: 0.5, lineHeight: 1.2 }}>
        {record.title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.6, alignItems: 'center' }}>
        {record.voteAverage > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <Star sx={{ fontSize: 11, color: '#46d369' }} />
            <Typography sx={{ color: '#46d369', fontSize: '0.7rem', fontWeight: 700 }}>
              {Number(record.voteAverage).toFixed(1)}
            </Typography>
          </Box>
        )}
        {year(record.releaseDate) && (
          <Typography sx={{ color: 'rgba(255,255,255,.5)', fontSize: '0.7rem' }}>
            {year(record.releaseDate)}
          </Typography>
        )}
      </Box>
      {record.genres?.length > 0 && (
        <Typography sx={{ color: 'rgba(255,255,255,.4)', fontSize: '0.64rem', mb: 0.8 }}>
          {record.genres.slice(0, 3).join(' · ')}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Tooltip title="Play">
          <IconButton size="small" onClick={goPlay}
            sx={{ bgcolor: '#fff', color: '#000', p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }}>
            <PlayArrow sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={interaction.watchlisted ? 'In My List' : 'Add to My List'}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onWatchlist?.(record); }}
            sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: interaction.watchlisted ? '#46d369' : '#fff', p: 0.4, '&:hover': { borderColor: '#fff' } }}>
            {interaction.watchlisted ? <BookmarkAdded sx={{ fontSize: 12 }} /> : <BookmarkAdd sx={{ fontSize: 12 }} />}
          </IconButton>
        </Tooltip>
        <CardReactionButton
          record={record}
          liked={interaction.liked}
          loved={interaction.loved}
          onLike={onLike}
          onLove={onLove}
          iconSize={12}
          pad={0.4}
        />
        <Tooltip title={interaction.watched ? 'Watched' : 'Mark Watched'}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onWatched?.(record); }}
            sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: interaction.watched ? '#a5d6a7' : '#fff', p: 0.4, '&:hover': { borderColor: '#fff' } }}>
            {interaction.watched ? <Visibility sx={{ fontSize: 12 }} /> : <VisibilityOff sx={{ fontSize: 12 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="More details">
          <IconButton size="small" onClick={goDetail}
            sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', p: 0.4, ml: 'auto', '&:hover': { borderColor: '#fff' } }}>
            <ExpandMore sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

// Wide / Continue inline hover panel (desktop).
export const WideHoverOverlay = ({ record, interaction, goPlay, onWatchlist, onLike, onLove, goDetail }) => (
  <Box sx={{
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    background: `linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.82) 28%, rgba(0,0,0,0.35) 62%, rgba(0,0,0,0.06) 100%)`,
    p: 1.25,
  }}>
    <Box sx={{ mb: 0.7 }}>
      <Typography sx={{
        color: '#fff', fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2, mb: 0.35,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {record.title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', flexWrap: 'wrap', mb: 0.45 }}>
        {record.voteAverage > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <Star sx={{ fontSize: 12, color: '#46d369' }} />
            <Typography sx={{ color: '#46d369', fontSize: '0.72rem', fontWeight: 800 }}>
              {Number(record.voteAverage).toFixed(1)}
            </Typography>
          </Box>
        )}
        {year(record.releaseDate) && (
          <Typography sx={{ color: 'rgba(255,255,255,.62)', fontSize: '0.72rem', fontWeight: 600 }}>
            {year(record.releaseDate)}
          </Typography>
        )}
        {record.genres?.length > 0 && (
          <Typography sx={{
            color: 'rgba(255,255,255,.46)', fontSize: '0.68rem',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '70%',
          }}>
            {record.genres.slice(0, 3).join(' · ')}
          </Typography>
        )}
      </Box>
    </Box>
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
      <Tooltip title="Play">
        <IconButton size="small" onClick={goPlay}
          sx={{ bgcolor: '#fff', color: '#000', p: 0.55, '&:hover': { bgcolor: 'rgba(255,255,255,.88)' } }}>
          <PlayArrow sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={interaction.watchlisted ? 'In My List' : 'Add to My List'}>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onWatchlist?.(record); }}
          sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: interaction.watchlisted ? '#46d369' : '#fff', p: 0.42, '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.08)' } }}>
          {interaction.watchlisted ? <BookmarkAdded sx={{ fontSize: 13 }} /> : <BookmarkAdd sx={{ fontSize: 13 }} />}
        </IconButton>
      </Tooltip>
      <CardReactionButton
        record={record}
        liked={interaction.liked}
        loved={interaction.loved}
        onLike={onLike}
        onLove={onLove}
        iconSize={13}
        pad={0.42}
      />
      <Tooltip title="More details">
        <IconButton size="small" onClick={goDetail}
          sx={{ border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', p: 0.42, ml: 'auto', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.08)' } }}>
          <ExpandMore sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Box>
  </Box>
);

// Default compact hover overlay (poster/standard/jumbo, on the card itself).
export const CompactHoverOverlay = ({ record }) => (
  <Box sx={{
    position: 'absolute', inset: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.1) 55%, transparent 100%)',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 0.8,
  }}>
    <Typography sx={{
      color: '#fff', fontWeight: 700, fontSize: 'clamp(0.65rem, 2vw, 0.9rem)', lineHeight: 1.3, mb: 0.3,
      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
    }}>
      {record.title}
    </Typography>
    {record.voteAverage > 0 && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
        <Star sx={{ fontSize: 10, color: '#46d369' }} />
        <Typography sx={{ color: '#46d369', fontSize: 'clamp(0.6rem, 1.5vw, 0.78rem)', fontWeight: 700 }}>
          {Number(record.voteAverage).toFixed(1)}
        </Typography>
      </Box>
    )}
  </Box>
);

// "Watched" pill badge (top-right).
export const WatchedBadge = () => (
  <Box sx={{
    position: 'absolute', top: 5, right: 5,
    bgcolor: 'rgba(0,0,0,.72)', borderRadius: 10, px: 0.7, py: 0.2,
    display: 'flex', alignItems: 'center', gap: 0.3,
  }}>
    <Check sx={{ fontSize: 9, color: '#4caf50' }} />
    <Typography sx={{ fontSize: '0.58rem', color: '#4caf50', fontWeight: 700 }}>Watched</Typography>
  </Box>
);
