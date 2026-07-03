import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { ThumbUp, ThumbUpOutlined } from '@mui/icons-material';

/* ═══════════════════════════════════════════════════════════
   CARD REACTION BUTTON

   Netflix-style combined Like / Love control for the cinema
   card hover overlays. Collapsed it shows the current reaction;
   hovering (desktop) or tapping reveals a chooser with:
     • Like  → single thumb 👍
     • Love  → double thumb 👍👍
   Reactions are mutually exclusive (picking one clears the
   other). Styled to match the cards' outline-white buttons.
═══════════════════════════════════════════════════════════ */

const LOVE_COLOR = '#e50914';

/* Two overlapping thumbs = "Love" (a.k.a. double like). Square footprint so
   the host IconButton stays a circle (a wider box stretches it into an oval). */
function DoubleThumb({ size, filled }) {
  const Icon = filled ? ThumbUp : ThumbUpOutlined;
  const t = size * 0.66;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
      <Icon sx={{ fontSize: t, position: 'absolute', left: 0, bottom: 0, opacity: filled ? 0.62 : 0.5 }} />
      <Icon sx={{ fontSize: t, position: 'absolute', right: 0, top: 0 }} />
    </Box>
  );
}

export default function CardReactionButton({
  record, liked, loved, onLike, onLove, iconSize = 13, pad = 0.42,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  const openNow = useCallback(() => { cancelClose(); setOpen(true); }, [cancelClose]);
  const closeSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 130);
  }, [cancelClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open]);
  useEffect(() => cancelClose, [cancelClose]);

  // Mutual exclusivity: picking the active reaction removes it; picking the
  // other swaps. Toggle handlers flip whatever the current state is.
  const choose = useCallback((e, key) => {
    e.stopPropagation();
    if (key === 'like') {
      if (liked) onLike?.(record);
      else { onLike?.(record); if (loved) onLove?.(record); }
    } else if (loved) {
      onLove?.(record);
    } else {
      onLove?.(record);
      if (liked) onLike?.(record);
    }
    setOpen(false);
  }, [liked, loved, onLike, onLove, record]);

  const current = loved
    ? { color: LOVE_COLOR, label: 'Loved', icon: <DoubleThumb size={iconSize} filled /> }
    : liked
      ? { color: '#fff', label: 'Liked', icon: <ThumbUp sx={{ fontSize: iconSize }} /> }
      : { color: '#fff', label: 'Like / Love', icon: <ThumbUpOutlined sx={{ fontSize: iconSize }} /> };

  const active = liked || loved;
  const optIconSize = Math.round(iconSize * 1.2);

  const OPTIONS = [
    { key: 'like', label: 'Like', color: '#fff', on: liked, icon: (s) => <ThumbUp sx={{ fontSize: s }} /> },
    { key: 'love', label: 'Love', color: LOVE_COLOR, on: loved, icon: (s) => <DoubleThumb size={s} filled /> },
  ];

  return (
    <Box
      ref={wrapRef}
      onMouseEnter={canHover ? openNow : undefined}
      onMouseLeave={canHover ? closeSoon : undefined}
      sx={{ position: 'relative', display: 'inline-flex' }}
    >
      <Tooltip title={open ? '' : current.label}>
        <IconButton
          size="small"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="React"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          sx={{
            border: `1.5px solid ${active ? current.color : 'rgba(255,255,255,.5)'}`,
            color: current.color,
            bgcolor: loved ? 'rgba(229,9,20,.16)' : 'transparent',
            p: pad,
            transition: 'all .15s',
            '&:hover': {
              borderColor: '#fff',
              bgcolor: loved ? 'rgba(229,9,20,.24)' : 'rgba(255,255,255,.08)',
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
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.92 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            // framer-motion owns inline `transform`; prepend the centering so it
            // isn't overwritten (keeps the chooser centred on the icon).
            transformTemplate={(_, generated) => `translateX(-50%) ${generated}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              pb: 0.75,          // invisible bridge so hover path stays continuous
              zIndex: 30,
            }}
          >
            <Box sx={{
              display: 'flex',
              gap: 0.5,
              p: 0.6,
              bgcolor: 'rgba(10,10,10,.95)',
              border: '1px solid rgba(255,255,255,.16)',
              borderRadius: 2,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 10px 28px rgba(0,0,0,.7)',
            }}>
              {OPTIONS.map((opt) => (
                <Box key={opt.key} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.2 }}>
                  <IconButton
                    size="small"
                    aria-label={opt.on ? `Remove ${opt.label}` : opt.label}
                    onClick={(e) => choose(e, opt.key)}
                    sx={{
                      border: `1.5px solid ${opt.on ? opt.color : 'rgba(255,255,255,.45)'}`,
                      color: opt.on ? opt.color : '#fff',
                      bgcolor: opt.on ? `${opt.color}22` : 'transparent',
                      p: pad,
                      transition: 'all .15s',
                      '&:hover': { borderColor: opt.color, color: opt.color, bgcolor: `${opt.color}22` },
                    }}
                  >
                    {opt.icon(optIconSize)}
                  </IconButton>
                  <Typography sx={{
                    fontSize: '0.55rem', fontWeight: 700, lineHeight: 1.2,
                    color: opt.on ? opt.color : 'rgba(255,255,255,.65)',
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
