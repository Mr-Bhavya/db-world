import React, { useCallback, useRef, useState } from 'react';
import { Box, Dialog, IconButton, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import RecordDetailContent from './RecordDetailContent';

/**
 * Netflix-style modal overlay rendered when a card click on /cinema (or any
 * page) sets `location.state.background` to the previous URL.
 *
 * - URL still updates so refresh / share / back-button work as expected.
 * - Browser back button closes the modal (navigates back to the background
 *   location).
 * - Click outside the dialog (backdrop) closes it.
 * - X button closes it.
 *
 * Only mounted by App.jsx on desktop (md+); on mobile the same route renders
 * RecordDetailPage as a full page.
 */
export default function RecordDetailModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(true);
  const scrollerRef = useRef(null);
  const [scrollEl, setScrollEl] = useState(null);

  // Capture the Dialog's scroll container once it's mounted so PillNav's
  // scrollspy can observe section visibility against it.
  const setScrollerRef = useCallback((node) => {
    scrollerRef.current = node;
    setScrollEl(node);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Wait for the Dialog's exit transition (MUI default ~225ms) before
    // navigating. MUI manages body scroll lock and padding internally — we
    // intentionally do NOT also lock body.style.overflow ourselves; two
    // mechanisms competing was causing scroll to stay locked after close.
    setTimeout(() => {
      const background = location.state?.background;
      if (background) navigate(background.pathname + (background.search ?? ''), { replace: true });
      else navigate(-1);
    }, 230);
  }, [navigate, location.state]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth={false}
      scroll="paper"
      PaperProps={{
        ref: setScrollerRef,
        sx: {
          width: { xs: '100%', md: '92vw' },
          maxWidth: { md: 1200 },
          maxHeight: { xs: '100%', md: '92vh' },
          borderRadius: { xs: 0, md: 3 },
          overflow: 'auto',
          bgcolor: 'transparent', // content provides its own bg via T.bg
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        },
      }}
      BackdropProps={{ sx: { bgcolor: alpha('#000', 0.78), backdropFilter: 'blur(6px)' } }}
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
            backdropFilter: 'blur(8px)',
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
        />
      </Box>
    </Dialog>
  );
}
