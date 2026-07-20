import React, { useCallback, useRef, useState } from 'react';
import { Box, Dialog, IconButton, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import { useT } from '@shared/theme/ThemeContext';
import RecordDetailContent from './RecordDetailContent';

// Expand transition: when opened from a hover popup (originRect supplied by
// HoverPopup.goDetail), the modal starts at the popup's exact position and
// scale, then springs to fill the screen — one continuous motion, no open/close gap.
// For every other entry point (card click, hero) it falls back to a simple scale-in.
const NFXExpand = React.forwardRef(function NFXExpand(
  { in: inProp, children, onExited, originRect },
  ref
) {
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  // Cap matches the Paper maxWidth below (1360 on TV) so the grow start-scale
  // stays accurate on very large screens.
  const modalW = Math.min(vw * 0.92, vw >= 1920 ? 1360 : 1150);

  // Start the modal shell at the popup's footprint so it appears to grow out of it.
  const initial = originRect
    ? {
        opacity: 1,
        scale: Math.min(originRect.width / modalW, 0.92),
        x: Math.round((originRect.left + originRect.width  / 2) - vw / 2),
        y: Math.round((originRect.top  + originRect.height / 2) - vh / 2),
      }
    : { opacity: 0, scale: 0.88 };

  return (
    <AnimatePresence onExitComplete={onExited}>
      {inProp && (
        <motion.div
          ref={ref}
          initial={initial}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 290, damping: 26 }}
          style={{ transformOrigin: 'center center' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default function RecordDetailModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const T = useT();
  const isTV = useMediaQuery('(min-width:1920px)');
  const maxW = isTV ? 1360 : 1150;
  const [open, setOpen] = useState(true);
  const [scrollEl, setScrollEl] = useState(null);
  const closingRef = useRef(false);

  const setScrollerRef = useCallback((node) => {
    setScrollEl(node);
  }, []);

  const originRect = location.state?.originRect ?? null;

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
  }, []);

  const handleExited = useCallback(() => {
    const background = location.state?.background;
    if (background) {
      navigate(background.pathname + (background.search ?? ''), { replace: true });
    } else {
      navigate(-1);
    }
  }, [navigate, location.state]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      scroll="paper"
      TransitionComponent={NFXExpand}
      TransitionProps={{ onExited: handleExited, originRect }}
      PaperProps={{
        ref: setScrollerRef,
        sx: {
          width: '92vw',
          maxWidth: maxW,
          maxHeight: '92vh',
          borderRadius: 3,
          overflow: 'auto',
          bgcolor: 'transparent',
          boxShadow: '0 32px 90px rgba(0,0,0,0.7)',
          // Slim, theme-aware scrollbar that sits inside the rounded Paper.
          // The 3px transparent border + padding-box clip insets the thumb so
          // it reads as a pill rather than flush against the rounded edge.
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(T.text, 0.28)} transparent`,
          '&::-webkit-scrollbar': { width: 10 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(T.text, 0.24),
            borderRadius: 999,
            border: '3px solid transparent',
            backgroundClip: 'padding-box',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: alpha(T.text, 0.42),
            backgroundClip: 'padding-box',
          },
        },
      }}
      slotProps={{
        backdrop: {
          sx: { bgcolor: alpha('#000', 0.82) },
        },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="Close detail"
          sx={{
            position: 'fixed',
            top: { xs: 12, md: 18 },
            right: { xs: 12, md: 18 },
            zIndex: 20,
            bgcolor: alpha('#000', 0.6), color: '#fff',
            border: `1px solid ${alpha('#fff', 0.18)}`,
            width: 38, height: 38,
            '&:hover': { bgcolor: alpha('#000', 0.82) },
          }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>

        <RecordDetailContent
          inModal
          scrollRoot={scrollEl}
          onClose={handleClose}
          stickyOffset={0}
          preview={location.state?.cardRecord ?? null}
        />
      </Box>
    </Dialog>
  );
}