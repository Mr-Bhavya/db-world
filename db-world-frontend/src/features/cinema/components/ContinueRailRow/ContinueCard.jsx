import React, { useRef } from 'react';
import { Box, Typography, IconButton, Tooltip, CircularProgress, Button } from '@mui/material';
import { PlayArrow, Close, InfoOutlined } from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';

// "1h 45m" / "12m" — used for the time-remaining subline.
const formatTime = (ms) => {
  if (!ms || ms <= 0) return '0m';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Landscape (16:9) Continue Watching card. The backdrop is a clean image with no
// baked-in title, so we always overlay the logo/title.
//  - Desktop: logo/title always shown over a gradient; hovering reveals the subline +
//    Play · Info · Remove and darkens the gradient.
//  - Mobile (no hover): a play circle sits on the image (tap resumes), logo/title on the
//    image, and Info + Remove live in a bar BELOW the image.
const ContinueCard = ({ item, onResume, onRemove, onInfo, loading, isMobile }) => {
  const dur = item.durationMs || 0;
  const pos = item.positionMs || 0;
  const pct = dur > 0 ? Math.min(100, Math.max(2, (pos / dur) * 100)) : 0;

  const isSeries = item.type === 'TV_SERIES';
  const epLabel = isSeries && item.season != null && item.episode != null
    ? `S${item.season}:E${item.episode}`
    : null;
  // A fresh next episode resumes at 0 with unknown duration → label it; otherwise
  // show the time remaining (more useful than watched/total).
  const isNext = isSeries && dur === 0;
  const rightLabel = isNext ? 'Next episode' : (dur > 0 ? `${formatTime(dur - pos)} left` : null);
  const subLine = [epLabel, rightLabel].filter(Boolean).join('  ·  ');

  const img = tmdbImg(item.backdropPath ?? item.posterPath, 'w780');
  const logoUrl = item.logoPath ? tmdbImg(item.logoPath, 'w300') : null;
  const cardRef = useRef(null);

  const resume = (e) => { e?.stopPropagation?.(); if (!loading) onResume(item); };
  const info = (e) => { e?.stopPropagation?.(); onInfo?.(item, cardRef.current?.getBoundingClientRect()); };
  const remove = (e) => { e?.stopPropagation?.(); onRemove(item); };

  const iconBtnSx = {
    bgcolor: 'rgba(0,0,0,.55)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', p: 0.5,
    '&:hover': { bgcolor: 'rgba(0,0,0,.82)' },
  };

  // Wordmark logo, falling back to the text title — reused by every layer so the
  // card is identifiable without hovering.
  const titleMark = logoUrl ? (
    <Box component="img" src={logoUrl} alt={item.title}
      sx={{ maxHeight: 30, maxWidth: '78%', objectFit: 'contain', objectPosition: 'left bottom',
        display: 'block', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.85))' }} />
  ) : (
    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', lineHeight: 1.2,
      textShadow: '0 1px 6px rgba(0,0,0,.9)',
      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
      {item.title}
    </Typography>
  );

  return (
    <Box ref={cardRef} sx={{ flexShrink: 0, width: { xs: 230, sm: 260, md: 300 } }}>
      {/* ── Image ── */}
      <Box
        onClick={resume}
        sx={{
          position: 'relative', cursor: loading ? 'wait' : 'pointer',
          width: '100%', aspectRatio: '16/9', borderRadius: 1, overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,.06)', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
          transition: 'transform .18s ease, box-shadow .18s ease',
          '&:hover': { transform: 'scale(1.03)', boxShadow: '0 14px 40px rgba(0,0,0,.7)' },
          '&:hover .cw-actions': { opacity: 1, maxHeight: 96, pointerEvents: 'auto' },
          '&:hover .cw-grad': {
            background: 'linear-gradient(to top, rgba(0,0,0,.96) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.12) 78%, transparent 100%)',
          },
        }}
      >
        {img && (
          <Box component="img" src={img} alt={item.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}

        {/* Resume in progress — instant feedback while the CDN URL + record resolve */}
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,.55)' }}>
            <CircularProgress size={30} sx={{ color: '#14b8a6' }} />
          </Box>
        )}

        {/* Mobile: play circle on the card + title, since there's no hover layer */}
        {isMobile && !loading && (
          <>
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 2, pointerEvents: 'none' }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.92)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 14px rgba(0,0,0,.55)' }}>
                <PlayArrow sx={{ fontSize: 26, color: '#000', ml: '2px' }} />
              </Box>
            </Box>
            <Box sx={{
              position: 'absolute', left: 0, right: 0, bottom: 4, px: 1, pt: 2.5, pb: 0.6, zIndex: 2, pointerEvents: 'none',
              background: 'linear-gradient(to top, rgba(0,0,0,.9) 0%, rgba(0,0,0,.3) 70%, transparent 100%)',
            }}>
              {logoUrl ? (
                <Box component="img" src={logoUrl} alt={item.title}
                  sx={{ maxHeight: 26, maxWidth: '72%', objectFit: 'contain', objectPosition: 'left bottom', display: 'block', filter: 'drop-shadow(0 1px 6px rgba(0,0,0,.9))' }} />
              ) : (
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2, textShadow: '0 1px 6px rgba(0,0,0,.9)',
                  display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.title}
                </Typography>
              )}
            </Box>
          </>
        )}

        {/* Desktop: always-on gradient + logo/title (clean backdrop needs the wordmark);
            the subline + Play / Info / Remove reveal on hover. */}
        {!isMobile && !loading && (
          <Box className="cw-grad" sx={{
            position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 1.2, pb: 1.3,
            background: 'linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.26) 48%, transparent 80%)',
            transition: 'background .2s ease',
          }}>
            <Box sx={{ mb: 0.35 }}>{titleMark}</Box>
            <Box className="cw-actions" sx={{
              opacity: 0, maxHeight: 0, overflow: 'hidden', pointerEvents: 'none',
              transition: 'opacity .18s ease, max-height .2s ease',
            }}>
              {subLine && <Typography sx={{ color: 'rgba(255,255,255,.75)', fontSize: '0.68rem', mt: 0.2, mb: 0.9 }}>{subLine}</Typography>}
              <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
                <Button onClick={resume} variant="contained" startIcon={<PlayArrow sx={{ fontSize: 18 }} />}
                  sx={{ bgcolor: '#fff', color: '#000', fontWeight: 800, textTransform: 'none', fontSize: '0.78rem', borderRadius: 0.8, py: 0.3, px: 1.6, boxShadow: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,.85)', boxShadow: 'none' } }}>
                  Play
                </Button>
                <Tooltip title="More info"><IconButton size="small" onClick={info} sx={iconBtnSx}><InfoOutlined sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Box sx={{ ml: 'auto' }}>
                  <Tooltip title="Remove from Continue Watching"><IconButton size="small" onClick={remove} sx={iconBtnSx}><Close sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Progress bar pinned to the very bottom (teal app accent) */}
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, bgcolor: 'rgba(255,255,255,.25)', zIndex: 4 }}>
          <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: '#14b8a6' }} />
        </Box>
      </Box>

      {/* ── Mobile: Info + Remove below the image ── */}
      {isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.6, px: 0.2 }}>
          {subLine ? (
            <Typography sx={{ color: 'rgba(255,255,255,.6)', fontSize: '0.68rem', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subLine}
            </Typography>
          ) : <Box sx={{ flex: 1 }} />}
          <Tooltip title="More info"><IconButton size="small" onClick={info} sx={iconBtnSx}><InfoOutlined sx={{ fontSize: 17 }} /></IconButton></Tooltip>
          <Tooltip title="Remove"><IconButton size="small" onClick={remove} sx={iconBtnSx}><Close sx={{ fontSize: 15 }} /></IconButton></Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default ContinueCard;
