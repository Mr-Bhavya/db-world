import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import ThumbUpRoundedIcon from '@mui/icons-material/ThumbUpRounded';
import ThumbUpOffAltRoundedIcon from '@mui/icons-material/ThumbUpOffAltRounded';

import { haptic } from '@shared/platform/platform';

/* ═══════════════════════════════════════════════════════════
   NETFLIX-STYLE REACTION BUTTON

   Collapses "Like" + "Love" into a single control. Hovering
   (desktop) or tapping (touch) reveals a chooser with two
   reactions:
     • Like  → single thumb
     • Love  → double thumb
   Reactions are mutually exclusive (picking one clears the
   other), matching Netflix's thumb scale.

   ── The chooser is MONOCHROME, on purpose ──────────────────
   It used to render two saturated circles (blue Like, pink
   Love), which made one control look like two unrelated
   features. Like and Love are two points on ONE scale, so the
   thing that should differ between them is the ICON, not the
   hue — and Netflix shows exactly that: bare white thumbs in a
   dark capsule, filled when chosen. Colour on this page is
   reserved for the teal CTA, which is the only thing that
   should pull the eye. The card icons elsewhere in the app
   (features/cinema/icons) already work this way.

   ── Platform-appropriate labels ────────────────────────────
   Pointer devices get Netflix's white tooltip bubble above the
   hovered thumb. Touch has no hover, so there the labels sit
   permanently under each icon instead of being unreachable.

   Three behavioural fixes live here too:
   1. HOVER INTENT — opening on the first pixel of hover meant a
      cursor crossing the action row popped the chooser open in
      passing. Both edges are delayed now.
   2. TARGET SIZE — options used to inherit the collapsed size,
      which is 26px in the phone rail.
   3. KEYBOARD — it was pointer-only, with no way to reach the
      options or dismiss them.

   The wrapper carries `data-noexpand` so taps inside the mobile
   RecordDetailSheet don't trigger the sheet's expand gesture.
═══════════════════════════════════════════════════════════ */

const OPEN_DELAY = 120;   // sustained hover before the chooser appears
const CLOSE_DELAY = 160;  // grace period for crossing the bridge gap
const MIN_OPTION = 40;    // never smaller than a comfortable tap target

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

/**
 * Netflix's tooltip: a white label with a caret, floating above the hovered thumb.
 *
 * The centering lives on a STATIC outer box and the animation on an inner one, and that
 * split is load-bearing: framer-motion writes the element's `transform` itself, so a
 * `translateX(-50%)` in `sx` on an animated element is silently overwritten — the label
 * then hangs off to the right of the thumb it names. (The chooser above solves the same
 * problem with `transformTemplate`; a plain wrapper is simpler where nothing needs to
 * animate horizontally.)
 */
function LabelBubble({ children }) {
  return (
    <Box sx={{
      position: 'absolute', bottom: '100%', left: '50%',
      transform: 'translateX(-50%)',
      mb: 0.75, pointerEvents: 'none', zIndex: 1,
    }}>
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 3 }}
        transition={{ duration: 0.12 }}
      >
        <Box sx={{
          bgcolor: '#fff', color: '#111', px: 0.9, py: 0.35, borderRadius: 1,
          fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0.2,
          whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,0.55)',
        }}>
          {children}
        </Box>
        {/* Caret, so the label points at the thumb it names. */}
        <Box sx={{
          width: 8, height: 8, bgcolor: '#fff', mx: 'auto', mt: '-4px',
          transform: 'rotate(45deg)', borderRadius: '1px',
        }} />
      </Box>
    </Box>
  );
}

export default function ReactionButton({ liked, loved, onToggle, btnSize, iconSize, flat = false }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);   // index of the option under the cursor
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  // Only steal focus when the chooser was opened FROM the keyboard; doing it on hover
  // would yank focus around under a pointer user.
  const viaKeyboard = useRef(false);

  // Hover-to-reveal only on real pointer devices; touch uses tap.
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');

  const clearTimers = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const openNow = useCallback(() => { clearTimers(); setOpen(true); }, [clearTimers]);

  const openSoon = useCallback(() => {
    clearTimers();
    openTimer.current = setTimeout(() => setOpen(true), OPEN_DELAY);
  }, [clearTimers]);

  const closeSoon = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => { setOpen(false); setHovered(null); }, CLOSE_DELAY);
  }, [clearTimers]);

  const closeNow = useCallback(() => {
    clearTimers();
    setOpen(false);
    setHovered(null);
  }, [clearTimers]);

  // Close on outside tap/click.
  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) closeNow();
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open, closeNow]);

  useEffect(() => clearTimers, [clearTimers]);

  // Apply a reaction with mutual exclusivity (Netflix thumb scale):
  //   picking the active one removes it; picking the other swaps.
  const choose = useCallback((key) => {
    const isActive = key === 'liked' ? liked : loved;
    if (isActive) {
      onToggle(key, true);                       // toggle the active reaction off
      haptic.light();
    } else {
      onToggle(key, false);                      // turn the chosen reaction on
      if (key === 'liked' && loved) onToggle('loved', true);   // clear the other
      if (key === 'loved' && liked) onToggle('liked', true);
      haptic.success();
    }
    closeNow();
    triggerRef.current?.focus?.();
  }, [liked, loved, onToggle, closeNow]);

  // Collapsed-button appearance reflects the current reaction — by icon, not by colour.
  const current = loved
    ? { label: 'Loved', icon: <DoubleThumb size={iconSize} filled /> }
    : liked
      ? { label: 'Liked', icon: <ThumbUpRoundedIcon sx={{ fontSize: iconSize }} /> }
      : { label: 'Rate this', icon: <ThumbUpOffAltRoundedIcon sx={{ fontSize: iconSize }} /> };

  const isActive = liked || loved;

  const OPTIONS = useMemo(() => [
    {
      key: 'liked', active: liked,
      label: liked ? 'Liked' : 'Like',
      icon: (sz) => <ThumbUpRoundedIcon sx={{ fontSize: sz }} />,
    },
    {
      key: 'loved', active: loved,
      label: loved ? 'Loved' : 'Love',
      icon: (sz) => <DoubleThumb size={sz} filled />,
    },
  ], [liked, loved]);

  // The chooser is a deliberate decision, so its targets don't shrink with the collapsed
  // control — in the phone rail that would be 26px.
  const optionSize = Math.max(btnSize ?? MIN_OPTION, MIN_OPTION);
  const optionIcon = Math.round(optionSize * 0.5);

  /** Which option starts focused: the active one, else the first. */
  const initialIndex = useMemo(() => {
    const i = OPTIONS.findIndex((o) => o.active);
    return i === -1 ? 0 : i;
  }, [OPTIONS]);

  useEffect(() => {
    if (!open || !viaKeyboard.current) return;
    optionRefs.current[initialIndex]?.focus?.();
    setHovered(initialIndex);
  }, [open, initialIndex]);

  const openFromKeyboard = useCallback(() => {
    viaKeyboard.current = true;
    openNow();
  }, [openNow]);

  const move = useCallback((from, delta) => {
    const next = (from + delta + OPTIONS.length) % OPTIONS.length;
    setHovered(next);
    optionRefs.current[next]?.focus?.();
  }, [OPTIONS.length]);

  const onMenuKeyDown = useCallback((e) => {
    const at = hovered ?? initialIndex;
    switch (e.key) {
      case 'Escape':
        e.stopPropagation();          // don't also close the sheet/dialog behind
        closeNow();
        triggerRef.current?.focus?.();
        break;
      case 'ArrowRight': case 'ArrowDown':
        e.preventDefault(); move(at, 1); break;
      case 'ArrowLeft': case 'ArrowUp':
        e.preventDefault(); move(at, -1); break;
      case 'Home':
        e.preventDefault(); move(-1, 1); break;
      case 'End':
        e.preventDefault(); move(0, -1); break;
      default:
        break;
    }
  }, [hovered, initialIndex, closeNow, move]);

  return (
    <Box
      ref={wrapRef}
      data-noexpand
      onMouseEnter={canHover ? openSoon : undefined}
      onMouseLeave={canHover ? closeSoon : undefined}
      // Focus leaving the whole control (Tab away) closes it, the way a real menu does.
      onBlur={(e) => {
        if (open && !wrapRef.current?.contains(e.relatedTarget)) closeNow();
      }}
      sx={{ position: 'relative', display: 'inline-flex' }}
    >
      <Tooltip title={open ? '' : current.label} placement="top">
        <IconButton
          ref={triggerRef}
          size="small"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={isActive ? current.label : 'Rate this'}
          onClick={(e) => {
            e.stopPropagation();
            viaKeyboard.current = false;
            if (open) closeNow(); else openNow();
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault(); openFromKeyboard();
            } else if (e.key === 'Enter' || e.key === ' ') {
              // Enter/Space also fires onClick; this only marks it as a keyboard
              // interaction so the chooser hands focus to an option.
              viaKeyboard.current = true;
            }
          }}
          sx={flat ? {
            // Flat variant for the phone action rail — see ShareButton.
            p: 0,
            color: isActive ? '#fff' : alpha('#fff', 0.62),
            width: btnSize, height: btnSize,
            transition: 'color .18s',
            '&:hover': { bgcolor: 'transparent', color: '#fff' },
          } : {
            bgcolor: isActive || open ? alpha('#fff', 0.22) : alpha('#fff', 0.1),
            border: `1.5px solid ${isActive ? '#fff' : alpha('#fff', 0.2)}`,
            color: '#fff',
            width: btnSize, height: btnSize,
            backdropFilter: 'blur(6px)',
            transition: 'all 0.18s',
            '&:hover': { bgcolor: alpha('#fff', 0.24), transform: 'scale(1.08)' },
          }}
        >
          {/* Keyed on the reaction so applying one replays the pop — the feedback for a
              tap that otherwise only changes a shape. */}
          <Box
            key={loved ? 'loved' : liked ? 'liked' : 'none'}
            component={motion.span}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 14 }}
            sx={{ display: 'inline-flex' }}
          >
            {current.icon}
          </Box>
        </IconButton>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <Box
            component={motion.div}
            role="menu"
            aria-label="Reactions"
            initial={{ opacity: 0, y: 8, scale: 0.84 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28, mass: 0.5 }}
            // framer-motion owns the inline `transform`, so the centering can't
            // live in `sx` (it would be overwritten). Prepend it to the
            // generated transform instead — keeps the popup centred on the icon.
            transformTemplate={(_, generated) => `translateX(-50%) ${generated}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={onMenuKeyDown}
            onMouseEnter={canHover ? openNow : undefined}
            sx={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              pb: 1,            // invisible bridge → hover path stays continuous
              zIndex: 1500,
            }}
          >
            {/* The capsule: Netflix's dark bar of bare thumbs. Pill-shaped for the
                icon-only pointer layout; softly rounded when the touch labels give it
                a second line. */}
            <Box sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: canHover ? 0.25 : 0.75,
              px: 0.5, py: 0.5,
              bgcolor: '#181818',
              border: `1px solid ${alpha('#fff', 0.16)}`,
              borderRadius: canHover ? 999 : 3,
              boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
            }}>
              {OPTIONS.map((opt, i) => {
                const lit = hovered === i;
                return (
                  <Box
                    key={opt.key}
                    onMouseEnter={() => setHovered(i)}
                    sx={{
                      position: 'relative',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                    }}
                  >
                    <AnimatePresence>
                      {canHover && lit && <LabelBubble>{opt.label}</LabelBubble>}
                    </AnimatePresence>

                    <Box
                      component={motion.div}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.02 + i * 0.04, type: 'spring', stiffness: 560, damping: 24 }}
                    >
                      <IconButton
                        ref={(el) => { optionRefs.current[i] = el; }}
                        role="menuitemradio"
                        aria-checked={opt.active}
                        aria-label={opt.active ? `Remove ${opt.key === 'liked' ? 'like' : 'love'}` : opt.label}
                        onClick={() => choose(opt.key)}
                        sx={{
                          width: optionSize, height: optionSize,
                          // Only the CHOSEN one carries a fill — with no hues to tell
                          // them apart, that ring is how you see what you picked.
                          bgcolor: opt.active ? alpha('#fff', 0.18) : 'transparent',
                          color: opt.active ? '#fff' : alpha('#fff', 0.82),
                          transition: 'background-color .15s, color .15s, transform .15s',
                          transform: lit ? 'scale(1.14)' : 'none',
                          '&:hover, &:focus-visible': {
                            bgcolor: alpha('#fff', opt.active ? 0.24 : 0.12),
                            color: '#fff',
                          },
                          '&:focus-visible': { outline: `2px solid ${alpha('#fff', 0.9)}`, outlineOffset: 2 },
                        }}
                      >
                        {opt.icon(optionIcon)}
                      </IconButton>
                    </Box>

                    {/* Touch has no hover to reveal the bubble, so the label lives
                        under the icon there instead. */}
                    {!canHover && (
                      <Typography sx={{
                        mt: 0.15, fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.2,
                        color: opt.active ? '#fff' : alpha('#fff', 0.66),
                        // Bounded by the icon above it and centred: a nowrap label wider
                        // than its column pushed out past the capsule's rounded edge.
                        width: optionSize, textAlign: 'center',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {opt.label}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
}
