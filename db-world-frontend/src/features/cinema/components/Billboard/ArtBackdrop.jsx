import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import { tmdbImg } from '../../api/cinemaApi';

/**
 * Billboard backdrop.
 *
 * Two fit modes:
 *  - `cover`   — the image FILLS the frame edge-to-edge (Netflix look). Scales with the container
 *               (aspect-ratio) so narrowing the window shrinks it proportionally; a wider-than-16:9
 *               frame trims a little top/bottom (never the sides), with `object-position` biased up
 *               to keep faces. A gentle Ken Burns zoom adds life.
 *  - `contain` — the FULL image, never cropped, over a blurred colour-fill of itself.
 *
 * Source is chosen by device tier (portrait poster on phones, landscape backdrop otherwise).
 */

const SIZE_BY_TIER = { phone: 'w780', tablet: 'w1280', desktop: 'w1280', monitor: 'original', tv: 'original' };

function pickPath(record, tier) {
  if (!record) return null;
  const wide = record.backdropPath || record.backdropPathText;
  const tall = record.posterPathClean || record.posterPath;
  return tier === 'phone' ? (tall || wide) : (wide || tall);
}

// Readability + blend scrims, tinted with the title's dominant colour: dark-left for the text,
// fade-to-colour at the bottom so the hero dissolves into the page below.
function buildGradients(base) {
  return [
    `linear-gradient(to right, rgba(${base},0.85) 0%, rgba(${base},0.55) 26%, rgba(${base},0.15) 48%, transparent 68%)`,
    `linear-gradient(to top, rgba(${base},0.95) 0%, rgba(${base},0.4) 20%, rgba(${base},0.08) 40%, transparent 58%)`,
  ];
}

export default function ArtBackdrop({
  record,
  tier = 'desktop',
  reducedMotion = false,
  kenBurns = true,
  cycleMs = 8000,
  gradient = 'billboard',
  objectPosition,
  fit = 'cover',
  heroColor = null,
  fadeBottom = false,
}) {
  const path = useMemo(() => pickPath(record, tier), [record, tier]);
  const src = path ? tmdbImg(path, SIZE_BY_TIER[tier] ?? 'original') : null;
  const blurSrc = path ? tmdbImg(path, 'w300') : null;
  const base = heroColor || '16,16,16';
  const isContain = fit === 'contain';
  const pos = objectPosition || (isContain ? 'right center' : 'center 25%');
  const grads = gradient === 'none' ? [] : buildGradients(base);
  const zoom = kenBurns && !reducedMotion;

  return (
    <Box aria-hidden sx={{
      position: 'absolute', inset: 0, overflow: 'hidden', bgcolor: `rgb(${base})`,
      // Fade the whole backdrop into the page along the bottom (Movies/TV full-bleed billboard).
      ...(fadeBottom && {
        WebkitMaskImage: 'linear-gradient(to bottom, #000 90%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, #000 90%, transparent 100%)',
      }),
    }}>
      {/* COVER — single edge-to-edge image with a gentle Ken Burns zoom. */}
      {!isContain && src && (
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: zoom ? 1.06 : 1 }}
          transition={{ duration: reducedMotion ? 0 : cycleMs / 1000, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0, willChange: 'transform' }}
        >
          <Box component="img" src={src} alt="" loading="eager" draggable={false}
            sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: pos, userSelect: 'none', WebkitUserDrag: 'none', filter: 'saturate(1.03)' }} />
        </motion.div>
      )}

      {/* CONTAIN — blurred colour-fill + sharp full (uncropped) image. */}
      {isContain && (
        <>
          {blurSrc && (
            <motion.div
              initial={{ scale: 1.12 }}
              animate={{ scale: zoom ? 1.2 : 1.12 }}
              transition={{ duration: reducedMotion ? 0 : cycleMs / 1000, ease: 'linear' }}
              style={{ position: 'absolute', inset: 0, willChange: 'transform' }}
            >
              <Box component="img" src={blurSrc} alt="" loading="eager" draggable={false}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', filter: 'blur(46px) brightness(0.55) saturate(1.25)', transform: 'scale(1.1)' }} />
            </motion.div>
          )}
          {src && (
            <Box component="img" src={src} alt="" loading="eager" draggable={false}
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', objectFit: 'contain', objectPosition: pos, userSelect: 'none', WebkitUserDrag: 'none' }} />
          )}
        </>
      )}

      {!src && (
        <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(${base},1) 0%, rgba(16,16,16,1) 100%)` }} />
      )}

      {grads.map((g, i) => (
        <Box key={i} sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: g }} />
      ))}
    </Box>
  );
}
