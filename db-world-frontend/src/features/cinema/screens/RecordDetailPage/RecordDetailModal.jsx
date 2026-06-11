import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Dialog, Grow, IconButton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import RecordDetailContent from './RecordDetailContent';

/**
 * Desktop record-detail modal. Opens with a fast Grow (scale) transition whose
 * transform-origin is the on-screen position of the control that opened it
 * (location.state.originRect) — so it visually expands FROM the expand button.
 * The chunk is preloaded on card hover (see recordNav.preloadDetail), so by the
 * time the user clicks, this opens instantly.
 *
 * - URL still updates so refresh / share / back-button work.
 * - Browser/hardware Back, backdrop click, or X close it (back to background).
 */
export default function RecordDetailModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const scrollerRef = useRef(null);
  const [scrollEl, setScrollEl] = useState(null);

  const setScrollerRef = useCallback((node) => {
    scrollerRef.current = node;
    setScrollEl(node);
  }, []);

  // Grow scales the Paper from its CSS transform-origin. Map the opening
  // control's screen-centre onto the Paper as a percentage so the growth
  // appears to originate there.
  const transformOrigin = useMemo(() => {
    const r = location.state?.originRect;
    if (!r || typeof window === 'undefined') return 'center 28%';
    const x = ((r.left + r.width / 2) / window.innerWidth) * 100;
    const y = ((r.top + r.height / 2) / window.innerHeight) * 100;
    return `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`;
  }, [location.state]);

  const Transition = useMemo(() => React.forwardRef(function ModalGrow(props, ref) {
    return <Grow ref={ref} timeout={{ enter: 240, exit: 170 }} {...props} />;
  }), []);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Let the Grow exit play (~170ms) before popping the route.
    setTimeout(() => {
      const background = location.state?.background;
      if (background) navigate(background.pathname + (background.search ?? ''), { replace: true });
      else navigate(-1);
    }, 180);
  }, [navigate, location.state]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      scroll="paper"
      TransitionComponent={Transition}
      PaperProps={{
        ref: setScrollerRef,
        style: { transformOrigin },
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
      // No backdrop blur — the full-screen blur was the main cause of the
      // sluggish open. A plain dark scrim is far cheaper and feels instant.
      BackdropProps={{ sx: { bgcolor: alpha('#000', 0.82) } }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={handleClose}
          size="small"
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
