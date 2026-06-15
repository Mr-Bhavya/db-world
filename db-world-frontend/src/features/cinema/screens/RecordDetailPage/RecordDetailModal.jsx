import React, { useCallback, useRef, useState } from 'react';
import { Box, Dialog, IconButton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
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
  const modalW = Math.min(vw * 0.92, 1150);

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
          maxWidth: 1150,
          maxHeight: '92vh',
          borderRadius: 3,
          overflow: 'auto',
          bgcolor: 'transparent',
          boxShadow: '0 32px 90px rgba(0,0,0,0.7)',
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
