import React, { useEffect, useRef } from 'react';
import { Box, Typography, Button, IconButton } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayArrow, Info, Add, Check, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';
import { year, clampLines } from '../HeroBanner/heroUtils';
import DB_APP_LOGO from '@assets/images/db-circle-icon.webp';

// Shared building blocks for the two billboard variants (Home spotlight + Movies/TV category).
// Keeps the ribbon/title/meta/actions identical while each page owns its own frame + navigator.

export const SURFACE_BUTTON = 'rgba(20,20,20,0.55)';
export const SURFACE_BUTTON_HOVER = 'rgba(28,28,28,0.8)';
export const BORDER = 'rgba(255,255,255,0.14)';
const EASE = [0.22, 1, 0.36, 1];

export const fmtRuntime = (min) => {
  const n = Number(min);
  if (!Number.isFinite(n) || n <= 0) return null;
  const h = Math.floor(n / 60);
  const mm = n % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
};

export function buildMetaItems(record) {
  if (!record) return [];
  const items = [record.type === 'MOVIE' ? 'Film' : 'Series'];
  if (record.genres?.length) items.push(record.genres[0]);
  const y = year(record.releaseDate);
  if (y) items.push(y);
  if (record.type === 'MOVIE') {
    const rt = fmtRuntime(record.runtime);
    if (rt) items.push(rt);
  } else if (record.numberOfSeasons > 0) {
    items.push(record.numberOfSeasons === 1 ? '1 Season' : `${record.numberOfSeasons} Seasons`);
  }
  return items;
}

/** Content-tier sizes shared by both variants (title/meta/buttons). Layout sizes live in each page. */
export function heroMetrics(isMonitor, isTv) {
  return {
    logoMaxH: isTv ? 176 : isMonitor ? 148 : 122,
    titleSize: isTv ? 'clamp(2.6rem, 4.4vw, 5rem)' : isMonitor ? 'clamp(2.4rem, 3.6vw, 4rem)' : 'clamp(2rem, 3vw, 3.4rem)',
    // Overview + meta scale fluidly with the viewport (responsive on both Home and Movies/TV),
    // and the description shows more lines the larger the screen gets.
    bodySize: 'clamp(0.9rem, 0.62rem + 0.6vw, 1.18rem)',
    metaSize: 'clamp(0.82rem, 0.66rem + 0.34vw, 1rem)',
    overviewLines: isTv ? 4 : isMonitor ? 3 : 2,
    btnHeight: isTv ? 56 : 46,
    btnFont: isTv ? '1.05rem' : '0.95rem',
    roundBtn: isTv ? 52 : 42,
    contentWidth: isTv ? 'min(42vw, 780px)' : isMonitor ? 'min(44vw, 680px)' : 'min(50vw, 560px)',
    padX: isTv ? 60 : isMonitor ? 54 : 46,
  };
}

/** Ribbon + title(logo/text) + meta + description + actions, with a per-slide crossfade. */
export function BillboardContent({ record, ix = {}, m, isTv, reducedMotion, onWatchlist, onPlay, onInfo }) {
  const logo = tmdbImg(record?.logoPath, isTv ? 'w780' : 'w500');
  const typeLabel = record?.type === 'MOVIE' ? 'Film' : 'Series';
  const metaItems = buildMetaItems(record);

  return (
    <Box sx={{ width: m.contentWidth, maxWidth: 'calc(100% - 40px)' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={record.id}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : -10 }}
          transition={{ duration: reducedMotion ? 0.2 : 0.45, ease: EASE }}
        >
          {/* App-logo ribbon (DB, not Netflix's N) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: isTv ? 1.5 : 1 }}>
            <Box component="img" src={DB_APP_LOGO} alt="DB" draggable={false}
              sx={{ height: isTv ? 32 : 26, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontWeight: 700, letterSpacing: '0.3em', fontSize: isTv ? '0.85rem' : '0.7rem', textShadow: '0 2px 8px rgba(0,0,0,0.7)', textTransform: 'uppercase' }}>
              {typeLabel}
            </Typography>
          </Box>

          {logo ? (
            <Box component="img" src={logo} alt={record.title} draggable={false}
              sx={{ maxWidth: '100%', maxHeight: m.logoMaxH, objectFit: 'contain', objectPosition: 'left bottom', display: 'block', mb: isTv ? 2 : 1.5, filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.7))' }} />
          ) : (
            <Typography sx={{ fontWeight: 900, color: '#fff', lineHeight: 1.03, mb: isTv ? 2 : 1.5, textShadow: '0 2px 12px rgba(0,0,0,0.8)', letterSpacing: '-0.03em', fontSize: m.titleSize, wordBreak: 'break-word', ...clampLines(2) }}>
              {record.title}
            </Typography>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5, mb: isTv ? 2 : 1.5, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
            {/* Age rating exactly as the certifying board issued it — CBFC "UA", US "TV-14".
                Boxed rather than folded into the bullet list so it reads as a rating and not
                as another genre. Null until TMDB sync has fetched a certification for the
                title, and then nothing renders rather than an empty box. */}
            {record.certification && (
              <Box
                component="span"
                aria-label={`Rated ${record.certification}`}
                sx={{
                  mr: 1.2, px: 0.7,
                  border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '3px',
                  color: 'rgba(255,255,255,0.92)', fontWeight: 700,
                  // Slightly smaller than the meta text so the border doesn't dominate the row.
                  fontSize: `calc(${m.metaSize} * 0.86)`,
                  letterSpacing: '0.04em', lineHeight: 1.6, whiteSpace: 'nowrap',
                }}
              >
                {record.certification}
              </Box>
            )}
            {metaItems.map((it, i) => (
              <React.Fragment key={`${it}-${i}`}>
                {i > 0 && <Box component="span" sx={{ color: 'rgba(255,255,255,0.32)', px: 0.9, fontSize: m.metaSize }}>•</Box>}
                <Typography component="span" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: m.metaSize }}>{it}</Typography>
              </React.Fragment>
            ))}
          </Box>

          {record.overview && (
            <Typography sx={{ color: 'rgba(255,255,255,0.84)', mb: isTv ? 2.5 : 2, lineHeight: 1.5, maxWidth: '100%', fontSize: m.bodySize, textShadow: '0 2px 8px rgba(0,0,0,0.6)', ...clampLines(m.overviewLines) }}>
              {record.overview}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="contained" startIcon={<PlayArrow />} onClick={onPlay}
              sx={{ minHeight: m.btnHeight, bgcolor: '#fff', color: '#000', fontWeight: 800, fontSize: m.btnFont, px: isTv ? 4.2 : 3, borderRadius: 999, textTransform: 'none', whiteSpace: 'nowrap', boxShadow: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)', boxShadow: 'none' }, '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 3 } }}>
              Play
            </Button>
            <Button variant="contained" startIcon={<Info />} onClick={onInfo}
              sx={{ minHeight: m.btnHeight, bgcolor: SURFACE_BUTTON, backdropFilter: 'blur(6px) saturate(1.05)', WebkitBackdropFilter: 'blur(6px) saturate(1.05)', border: `1px solid ${BORDER}`, color: '#fff', fontWeight: 700, fontSize: m.btnFont, px: isTv ? 4.2 : 3, borderRadius: 999, textTransform: 'none', whiteSpace: 'nowrap', boxShadow: 'none', '&:hover': { bgcolor: SURFACE_BUTTON_HOVER, borderColor: 'rgba(255,255,255,0.24)', boxShadow: 'none' }, '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 3 } }}>
              More Info
            </Button>
            <IconButton onClick={() => onWatchlist?.(record)} title={ix?.watchlisted ? 'Remove from My List' : 'Add to My List'}
              sx={{ width: m.roundBtn, height: m.roundBtn, color: '#fff', border: `2px solid ${BORDER}`, bgcolor: SURFACE_BUTTON, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', transition: 'background 0.2s ease, border-color 0.2s ease', '&:hover': { borderColor: '#fff', bgcolor: SURFACE_BUTTON_HOVER }, '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 3 } }}>
              {ix?.watchlisted ? <Check sx={{ fontSize: isTv ? 24 : 20 }} /> : <Add sx={{ fontSize: isTv ? 24 : 20 }} />}
            </IconButton>
          </Box>
        </motion.div>
      </AnimatePresence>
    </Box>
  );
}

/** Top-10 rank badge (shown when the hero rail is a ranked rail). */
export function Top10Badge({ idx, record, isTv }) {
  const rankLabel = record?.type === 'MOVIE' ? 'Movies' : 'Shows';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, bgcolor: 'rgba(0,0,0,0.55)', border: `1px solid ${BORDER}`, borderRadius: 1, px: 1, py: 0.5, backdropFilter: 'blur(6px)' }}>
      <Box sx={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 0.6, bgcolor: '#e50914', color: '#fff', fontWeight: 900, fontSize: '0.5rem', lineHeight: 1, textAlign: 'center' }}>
        TOP<br />10
      </Box>
      <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: isTv ? '1rem' : '0.86rem', whiteSpace: 'nowrap' }}>
        #{idx + 1} in {rankLabel}
      </Typography>
    </Box>
  );
}

/**
 * Bottom-right thumbnail navigator (Movies / TV Shows): prev/next arrows flanking a strip of small
 * rounded thumbnails. The active thumb auto-centres in the strip (which scrolls internally rather
 * than showing all at once). Click a thumb to jump; arrows step through.
 */
export function ThumbnailPills({ featured = [], idx = 0, onSelect, onPrev, onNext, isTv, isMonitor }) {
  const stripRef = useRef(null);
  const thumbRefs = useRef([]);
  const w = isTv ? 108 : isMonitor ? 96 : 84;
  const h = isTv ? 62 : isMonitor ? 56 : 48;
  const navBtn = isTv ? 42 : 34;
  const navIcon = isTv ? 24 : 20;

  // Keep the active thumb centred as the hero advances — scroll only the strip, never the page.
  useEffect(() => {
    const strip = stripRef.current;
    const el = thumbRefs.current[idx];
    if (!strip || !el) return;
    const target = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [idx]);

  const arrowSx = {
    flexShrink: 0, width: navBtn, height: navBtn, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)',
    border: `1px solid ${BORDER}`, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.78)' },
    '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 2 },
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: '46vw' }}>
      <IconButton onClick={onPrev} aria-label="Previous" sx={arrowSx}><ChevronLeft sx={{ fontSize: navIcon }} /></IconButton>

      <Box ref={stripRef} sx={{ display: 'flex', gap: 1, minWidth: 0, overflowX: 'auto', py: 0.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {featured.map((item, i) => {
          const active = i === idx;
          const thumb = tmdbImg(item.backdropPath ?? item.backdropPathText ?? item.posterPath, 'w300');
          return (
            <Box key={item.id ?? i} ref={(node) => { thumbRefs.current[i] = node; }} role="button" aria-label={`Go to ${item.title ?? `slide ${i + 1}`}`} onClick={() => onSelect?.(i)}
              sx={{ flex: '0 0 auto', width: w, height: h, borderRadius: 2, overflow: 'hidden', cursor: 'pointer', position: 'relative', bgcolor: 'rgba(255,255,255,0.06)', border: `2px solid ${active ? '#fff' : 'transparent'}`, opacity: active ? 1 : 0.55, transition: 'opacity 0.2s ease, border-color 0.2s ease, transform 0.2s ease', '&:hover': { opacity: 1, transform: 'translateY(-2px)' } }}>
              {thumb && <Box component="img" src={thumb} alt={item.title || ''} loading="lazy" draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
            </Box>
          );
        })}
      </Box>

      <IconButton onClick={onNext} aria-label="Next" sx={arrowSx}><ChevronRight sx={{ fontSize: navIcon }} /></IconButton>
    </Box>
  );
}
