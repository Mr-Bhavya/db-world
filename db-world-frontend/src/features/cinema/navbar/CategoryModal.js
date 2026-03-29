// Netflix-style genre dropdown — anchored below the AppBar
import React, { useEffect, useRef } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

// Positioned below the fixed AppBar — pass appBarHeight as prop or fall back to a default.
const DEFAULT_APPBAR_H = 68;

const CategoryModal = ({
  open,
  categories,
  selectedCategory,
  onSelect,
  onClear,
  onClose,
  appBarHeight,
}) => {
  const TOP = appBarHeight ?? DEFAULT_APPBAR_H;
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    // Delay so the click that opened the panel doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="category-dropdown"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          ref={panelRef}
          style={{
            position: 'fixed',
            top: TOP,
            left: 0,
            right: 0,
            zIndex: 1199, // just below AppBar (1200) but above content
            background: 'rgba(20,20,20,0.97)',
            backdropFilter: 'blur(6px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            padding: '20px 32px 24px',
          }}
        >
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Genres
            </Typography>
            {selectedCategory && (
              <Typography
                onClick={onClear}
                sx={{ color: '#e50914', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
              >
                Clear filter
              </Typography>
            )}
          </Box>

          {/* Genre chips */}
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
          }}>
            {categories.map((cat) => {
              const isActive = selectedCategory?.id === cat.id;
              return (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  size="small"
                  onClick={() => {
                    onSelect(isActive ? null : cat);
                    if (!isActive) onClose();
                  }}
                  sx={{
                    bgcolor: isActive ? '#e50914' : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontWeight: isActive ? 700 : 400,
                    fontSize: '0.8rem',
                    border: isActive ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: isActive ? '#c40812' : 'rgba(255,255,255,0.2)',
                    },
                    '& .MuiChip-label': { px: 1.5 },
                  }}
                />
              );
            })}
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CategoryModal;
