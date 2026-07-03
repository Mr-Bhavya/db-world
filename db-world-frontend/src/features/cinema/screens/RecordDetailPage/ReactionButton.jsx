import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import ThumbUpRoundedIcon from '@mui/icons-material/ThumbUpRounded';
import ThumbUpOffAltRoundedIcon from '@mui/icons-material/ThumbUpOffAltRounded';

/* ═══════════════════════════════════════════════════════════
   NETFLIX-STYLE REACTION BUTTON

   Collapses "Like" + "Love" into a single control. Hovering
   (desktop) or tapping (touch) reveals a floating chooser with
   two reactions:
     • Like  → single thumb 👍
     • Love  → double thumb 👍👍
   Reactions are mutually exclusive (picking one clears the
   other), matching Netflix's thumb scale.

   The wrapper carries `data-noexpand` so taps inside the mobile
   RecordDetailSheet don't trigger the sheet's expand gesture.
═══════════════════════════════════════════════════════════ */

const LIKE_COLOR = '#3b82f6';
const LOVE_COLOR = '#ec4899';

/* Two overlapping thumbs = "Love" (a.k.a. double like). Square footprint so
   the host IconButton stays a circle (a wider box stretches it into an oval). */
function DoubleThumb({ size, filled }) {
  const Icon = filled ? ThumbUpRoundedIcon : ThumbUpOffAltRoundedIcon;
  const t = size * 0.68;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
      <Icon sx={{ fontSize: t, position: 'absolute', left: 0, bottom: 0, opacity: filled ? 0.65 : 0.55 }} />
      <Icon sx={{ fontSize: t, position: 'absolute', right: 0, top: 0 }} />
    </Box>
  );
}

export default function ReactionButton({ liked, loved, onToggle, btnSize, iconSize }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);

  // Hover-to-reveal only on real pointer devices; touch uses tap.
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const openNow = useCallback(() => { cancelClose(); setOpen(true); }, [cancelClose]);
  // Small delay so moving the cursor across the bridge gap doesn't flicker shut.
  const closeSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }, [cancelClose]);

  // Close on outside tap/click.
  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open]);

  useEffect(() => cancelClose, [cancelClose]);

  // Apply a reaction with mutual exclusivity (Netflix thumb scale):
  //   picking the active one removes it; picking the other swaps.
  const choose = useCallback((key) => {
    const isActive = key === 'liked' ? liked : loved;
    if (isActive) {
      onToggle(key, true);                       // toggle the active reaction off
    } else {
      onToggle(key, false);                      // turn the chosen reaction on
      if (key === 'liked' && loved) onToggle('loved', true);   // clear the other
      if (key === 'loved' && liked) onToggle('liked', true);
    }
    setOpen(false);
  }, [liked, loved, onToggle]);

  // Collapsed-button appearance reflects the current reaction.
  const current = loved
    ? { color: LOVE_COLOR, label: 'Loved', icon: <DoubleThumb size={iconSize} filled /> }
    : liked
      ? { color: LIKE_COLOR, label: 'Liked', icon: <ThumbUpRoundedIcon sx={{ fontSize: iconSize }} /> }
      : { color: '#e5e5e5', label: 'Rate this', icon: <ThumbUpOffAltRoundedIcon sx={{ fontSize: iconSize }} /> };

  const isActive = liked || loved;

  const OPTIONS = [
    { key: 'liked', label: 'Like', color: LIKE_COLOR, active: liked, icon: (sz) => <ThumbUpRoundedIcon sx={{ fontSize: sz }} /> },
    { key: 'loved', label: 'Love', color: LOVE_COLOR, active: loved, icon: (sz) => <DoubleThumb size={sz} filled /> },
  ];

  return (
    <Box
      ref={wrapRef}
      data-noexpand
      onMouseEnter={canHover ? openNow : undefined}
      onMouseLeave={canHover ? closeSoon : undefined}
      sx={{ position: 'relative', display: 'inline-flex' }}
    >
      <Tooltip title={open ? '' : current.label} placement="top">
        <IconButton
          size="small"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="React"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          sx={{
            bgcolor: isActive ? alpha(current.color, 0.25) : alpha('#fff', 0.1),
            border: `1.5px solid ${isActive ? current.color : alpha('#fff', 0.2)}`,
            color: current.color,
            width: btnSize, height: btnSize,
            backdropFilter: 'blur(6px)',
            transition: 'all 0.18s',
            '&:hover': {
              bgcolor: isActive ? alpha(current.color, 0.35) : alpha('#fff', 0.2),
              transform: 'scale(1.08)',
            },
          }}
        >
          {current.icon}
        </IconButton>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.92 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            // framer-motion owns the inline `transform`, so the centering can't
            // live in `sx` (it would be overwritten). Prepend it to the
            // generated transform instead — keeps the popup centred on the icon.
            transformTemplate={(_, generated) => `translateX(-50%) ${generated}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              pb: 1,            // invisible bridge → hover path stays continuous
              zIndex: 1500,
            }}
          >
            <Box sx={{
              display: 'flex',
              gap: 0.5,
              p: 0.75,
              bgcolor: alpha('#0a0a0a', 0.92),
              border: `1px solid ${alpha('#fff', 0.14)}`,
              borderRadius: 3,
              backdropFilter: 'blur(12px)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            }}>
              {OPTIONS.map((opt) => (
                <Box
                  key={opt.key}
                  sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}
                >
                  <IconButton
                    aria-label={opt.active ? `Remove ${opt.label}` : opt.label}
                    onClick={() => choose(opt.key)}
                    sx={{
                      width: btnSize, height: btnSize,
                      bgcolor: opt.active ? alpha(opt.color, 0.28) : alpha('#fff', 0.06),
                      border: `1.5px solid ${opt.active ? opt.color : alpha('#fff', 0.16)}`,
                      color: opt.active ? opt.color : '#e5e5e5',
                      transition: 'all 0.15s',
                      '&:hover': {
                        bgcolor: alpha(opt.color, 0.3),
                        borderColor: opt.color,
                        color: opt.color,
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    {opt.icon(iconSize)}
                  </IconButton>
                  <Typography sx={{
                    fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.3,
                    color: opt.active ? opt.color : alpha('#fff', 0.6),
                  }}>
                    {opt.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
}
