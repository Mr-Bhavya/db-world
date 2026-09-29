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

/**
 * The mobile tile is a CARD: artwork on top, a solid body beneath it, one background
 * and one rounded outline around both.
 *
 * It used to be a bare image with a loose row of text and buttons floating under it.
 * With only the rail's gap between tiles, that row's right-aligned controls sat against
 * the NEXT tile's artwork and read as belonging to neither — the buttons looked like
 * they were in the gutter. Giving the tile a body solves that without putting anything
 * on top of the picture: the controls are inside the card's own painted area, so what
 * they act on is never in question, and the artwork stays clean.
 */
export const MOBILE_SHELL = {
  bgcolor: 'rgba(255,255,255,.055)',
  border: '1px solid rgba(255,255,255,.09)',
  borderRadius: 1.5,
  overflow: 'hidden',
};

// Landscape (16:9) Continue Watching card. The backdrop is a clean image with no
// baked-in title, so the title is always drawn — over the image on desktop, in the
// card body on mobile.
//  - Desktop: logo/title + time left over a gradient; hovering reveals Play · Info ·
//    Remove and darkens the gradient.
//  - Mobile (no hover): a play circle on the image; title, time left, Info and Remove
//    all live in the card body below it.
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
    '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 2 },
  };

  /**
   * Controls in the card body.
   *
   * 36px painted, 44px tappable: the extra comes from a transparent ::after ring, which
   * grows the hit area without growing the button or disturbing the row. The 8px gap
   * then puts their centres exactly 44px apart, so the two targets meet and neither
   * steals from the other — which matters when one of them throws away your place in
   * the title. They were 30px boxes before, and overlapping nothing but each other.
   */
  const bodyBtnSx = {
    position: 'relative',
    width: 36, height: 36, p: 0, flexShrink: 0,
    color: 'rgba(255,255,255,.72)',
    '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,.08)' },
    '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 2 },
    '&::after': {
      content: '""', position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)', width: 44, height: 44,
    },
  };

  // Wordmark logo, falling back to the text title — desktop draws this over the art.
  const titleMark = logoUrl ? (
    <Box component="img" src={logoUrl} alt="" loading="lazy" decoding="async"
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
    <Box ref={cardRef} sx={{
      flexShrink: 0, width: { xs: 230, sm: 260, md: 300 },
      ...(isMobile ? MOBILE_SHELL : null),
    }}>
      {/* ── Image ── */}
      <Box
        onClick={resume}
        // It was a plain div with an onClick: the card's PRIMARY action could not be
        // reached or announced by anything that is not a mouse.
        role="button"
        tabIndex={loading ? -1 : 0}
        aria-label={`Resume ${item.title}${subLine ? ` — ${subLine}` : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resume(e); }
        }}
        sx={{
          position: 'relative', cursor: loading ? 'wait' : 'pointer',
          '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: -3 },
          width: '100%', aspectRatio: '16/9', overflow: 'hidden',
          // On mobile the shell owns the corners and the outline.
          borderRadius: isMobile ? 0 : 1,
          bgcolor: 'rgba(255,255,255,.06)',
          ...(isMobile ? null : {
            boxShadow: '0 2px 8px rgba(0,0,0,.3)',
            transition: 'transform .18s ease, box-shadow .18s ease',
            '&:hover': { transform: 'scale(1.03)', boxShadow: '0 14px 40px rgba(0,0,0,.7)' },
            '&:hover .cw-actions': { opacity: 1, maxHeight: 96, pointerEvents: 'auto' },
            '&:hover .cw-grad': {
              background: 'linear-gradient(to top, rgba(0,0,0,.96) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.12) 78%, transparent 100%)',
            },
          }),
        }}
      >
        {img && (
          <Box component="img" src={img} alt="" loading="lazy" decoding="async"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}

        {/* Resume in progress — instant feedback while the CDN URL + record resolve */}
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,.55)' }}>
            <CircularProgress size={30} sx={{ color: '#14b8a6' }} />
          </Box>
        )}

        {/* Mobile: the artwork carries nothing but the play affordance now — the title,
            the time left and the controls are all in the body below. Outlined rather
            than a solid white disc: at 44px of opaque white it was the brightest thing
            on the rail and it landed squarely on whoever was mid-shot. */}
        {isMobile && !loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 2, pointerEvents: 'none' }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: '50%',
              bgcolor: 'rgba(0,0,0,.45)', border: '1.5px solid rgba(255,255,255,.9)',
              display: 'grid', placeItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,.45)',
            }}>
              <PlayArrow sx={{ fontSize: 22, color: '#fff', ml: '2px' }} />
            </Box>
          </Box>
        )}

        {/* Desktop: always-on gradient + logo/title (clean backdrop needs the wordmark);
            Play / Info / Remove reveal on hover. */}
        {!isMobile && !loading && (
          <Box className="cw-grad" sx={{
            position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 1.2, pb: 1.3,
            background: 'linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.26) 48%, transparent 80%)',
            transition: 'background .2s ease',
          }}>
            <Box sx={{ mb: 0.35 }}>{titleMark}</Box>
            {/* At rest, not on hover. "S1:E3 · 23m left" is the reason you pick one
                tile over another, and it was the one thing you had to hover to learn. */}
            {subLine && (
              <Typography sx={{ color: 'rgba(255,255,255,.75)', fontSize: '0.68rem', mt: 0.2 }}>
                {subLine}
              </Typography>
            )}
            <Box className="cw-actions" sx={{
              opacity: 0, maxHeight: 0, overflow: 'hidden', pointerEvents: 'none',
              transition: 'opacity .18s ease, max-height .2s ease',
            }}>
              <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center', mt: 0.9 }}>
                <Button onClick={resume} variant="contained" startIcon={<PlayArrow sx={{ fontSize: 18 }} />}
                  sx={{ bgcolor: '#fff', color: '#000', fontWeight: 800, textTransform: 'none', fontSize: '0.78rem', borderRadius: 0.8, py: 0.3, px: 1.6, boxShadow: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,.85)', boxShadow: 'none' } }}>
                  Play
                </Button>
                <Tooltip title="More info">
                  <IconButton size="small" aria-label={`More info about ${item.title}`} onClick={info} sx={iconBtnSx}>
                    <InfoOutlined sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
                <Box sx={{ ml: 'auto' }}>
                  <Tooltip title="Remove from Continue Watching">
                    <IconButton size="small" aria-label={`Remove ${item.title} from Continue Watching`} onClick={remove} sx={iconBtnSx}>
                      <Close sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
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

      {/* ── Mobile: the card body ──
          Title, time left and the two controls, all inside the card's own background.
          This is the row that used to float loose beneath the artwork. */}
      {isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', px: 1, py: 0.85 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.3 }}>
              {item.title}
            </Typography>
            {/* Always rendered, blank when there is nothing to say, so tiles in the
                rail keep level bottoms. */}
            <Typography noWrap sx={{ color: 'rgba(255,255,255,.6)', fontSize: '0.68rem', lineHeight: 1.45 }}>
              {subLine || ' '}
            </Typography>
          </Box>
          <IconButton aria-label={`More info about ${item.title}`} onClick={info} sx={bodyBtnSx}>
            <InfoOutlined sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton aria-label={`Remove ${item.title} from Continue Watching`} onClick={remove} sx={bodyBtnSx}>
            <Close sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

export default ContinueCard;
