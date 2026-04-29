// Category filter panel — bottom sheet on mobile, dropdown on desktop
import React, { useEffect, useRef } from 'react';
import { Box, Typography, Chip, IconButton, useTheme, useMediaQuery } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

const CategoryModal = ({
  open,
  categories,
  selectedCategory,
  onSelect,
  onClear,
  onClose,
  appBarHeight,
}) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const TOP      = appBarHeight ?? 68;
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 80);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [open, onClose]);

  // Close on page scroll (> 40px movement)
  useEffect(() => {
    if (!open) return;
    const startY = window.scrollY;
    const handler = () => {
      if (Math.abs(window.scrollY - startY) > 40) onClose();
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [open, onClose]);

  const bg     = alpha('#0e0e0e', 0.97);
  const border = alpha(theme.palette.common.white, 0.08);

  // ── Mobile: bottom sheet ────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              style={{
                position: 'fixed', inset: 0,
                background: alpha(theme.palette.common.black, 0.55),
                zIndex: 1198,
              }}
            />

            {/* Sheet */}
            <motion.div
              key="cat-sheet"
              ref={panelRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1199,
                background: bg,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: `1px solid ${border}`,
                borderRadius: '20px 20px 0 0',
                boxShadow: `0 -8px 40px ${alpha(theme.palette.common.black, 0.6)}`,
                paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
                maxHeight: '72vh',
                overflowY: 'auto',
              }}
            >
              {/* Drag handle */}
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: alpha(theme.palette.common.white, 0.2) }} />
              </Box>

              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, pt: 1, pb: 1.5 }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: theme.palette.text.primary, flex: 1 }}>
                  Genres
                </Typography>
                {selectedCategory && (
                  <Typography
                    onClick={onClear}
                    sx={{ fontSize: '0.78rem', fontWeight: 600, color: theme.palette.primary.main, cursor: 'pointer', mr: 1, '&:hover': { opacity: 0.75 } }}
                  >
                    Clear
                  </Typography>
                )}
                <IconButton size="small" onClick={onClose}
                  sx={{ color: alpha(theme.palette.common.white, 0.5), '&:hover': { color: theme.palette.text.primary } }}>
                  <CloseIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Box>

              {/* Chips */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2.5, pb: 2 }}>
                {/* "All" chip */}
                <Chip
                  label="All"
                  size="small"
                  onClick={onClear}
                  sx={chipSx(!selectedCategory, theme)}
                />
                {categories.map((cat) => {
                  const isActive = selectedCategory?.id === cat.id;
                  return (
                    <Chip
                      key={cat.id}
                      label={cat.name}
                      size="small"
                      onClick={() => { onSelect(isActive ? null : cat); if (!isActive) onClose(); }}
                      sx={chipSx(isActive, theme)}
                    />
                  );
                })}
              </Box>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // ── Desktop: top dropdown ────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Subtle backdrop */}
          <motion.div
            key="cat-backdrop-desktop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, top: TOP,
              background: alpha(theme.palette.common.black, 0.35),
              zIndex: 1198,
            }}
          />

          <motion.div
            key="cat-dropdown"
            ref={panelRef}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: TOP,
              left: 0,
              right: 0,
              zIndex: 1199,
              background: bg,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: `1px solid ${border}`,
              boxShadow: `0 12px 40px ${alpha(theme.palette.common.black, 0.6)}`,
              padding: '20px 40px 24px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography sx={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: alpha(theme.palette.text.primary, 0.45), flex: 1,
              }}>
                Genres
              </Typography>
              {selectedCategory && (
                <Typography onClick={onClear} sx={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: theme.palette.primary.main, cursor: 'pointer', mr: 2,
                  '&:hover': { opacity: 0.75 },
                }}>
                  Clear filter
                </Typography>
              )}
              <IconButton size="small" onClick={onClose}
                sx={{ color: alpha(theme.palette.common.white, 0.4), '&:hover': { color: theme.palette.text.primary } }}>
                <CloseIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip label="All" size="small" onClick={onClear} sx={chipSx(!selectedCategory, theme)} />
              {categories.map((cat) => {
                const isActive = selectedCategory?.id === cat.id;
                return (
                  <Chip
                    key={cat.id}
                    label={cat.name}
                    size="small"
                    onClick={() => { onSelect(isActive ? null : cat); if (!isActive) onClose(); }}
                    sx={chipSx(isActive, theme)}
                  />
                );
              })}
            </Box>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ── Shared chip styles ────────────────────────────────────────────────────────
function chipSx(isActive, theme) {
  return {
    bgcolor: isActive
      ? theme.palette.primary.main
      : alpha(theme.palette.common.white, 0.09),
    color: isActive
      ? theme.palette.primary.contrastText ?? '#fff'
      : alpha(theme.palette.common.white, 0.85),
    fontWeight: isActive ? 700 : 400,
    fontSize: '0.8rem',
    border: `1px solid ${isActive ? 'transparent' : alpha(theme.palette.common.white, 0.12)}`,
    transition: 'background 0.15s, border-color 0.15s',
    cursor: 'pointer',
    '&:hover': {
      bgcolor: isActive
        ? alpha(theme.palette.primary.main, 0.82)
        : alpha(theme.palette.common.white, 0.16),
    },
    '& .MuiChip-label': { px: 1.5 },
  };
}

export default CategoryModal;
