// components/Navbar/CategoryModal.jsx
import React from 'react';
import {
  Box,
  Typography,
  Button,
  alpha,
  useTheme
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

const CategoryModal = ({ 
  open, 
  categories, 
  selectedCategory, 
  onSelect, 
  onClear, 
  onClose 
}) => {
  const theme = useTheme();

  const handleCategoryClick = (category) => {
    onSelect(category);
    // Modal closes automatically through the onSelect handler in Navbar
  };

  const handleClearClick = () => {
    onClear();
    // Modal closes automatically through the onClear handler in Navbar
  };

  const handleCloseClick = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: alpha(theme.palette.common.black, 0.5),
            backdropFilter: 'blur(8px)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={onClose} // Close when clicking backdrop
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking modal content
          >
            <Box
              sx={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '90vw',
                maxWidth: '500px',
                maxHeight: '70vh',
                background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.background.default, 0.95)} 100%)`,
                backdropFilter: 'blur(40px)',
                borderRadius: '20px',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: `0 25px 50px ${alpha(theme.palette.common.black, 0.25)}`,
                overflow: 'hidden',
                zIndex: 9999,
              }}
            >
              {/* Header */}
              <Box sx={{ 
                p: 3, 
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 100%)`
              }}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 700,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    textAlign: 'center'
                  }}
                >
                  Browse Categories
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    textAlign: 'center', 
                    color: 'text.secondary',
                    mt: 1
                  }}
                >
                  Discover your favorite genres
                </Typography>
              </Box>

              {/* Categories Grid */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '12px',
                  padding: '20px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}
              >
                {categories.map((category) => (
                  <motion.div
                    key={category.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Box
                      component="button"
                      onClick={() => handleCategoryClick(category)}
                      sx={{
                        height: '48px',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: selectedCategory?.id === category.id ? 600 : 500,
                        transition: 'all 0.3s ease',
                        background: selectedCategory?.id === category.id
                          ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                          : alpha(theme.palette.background.paper, 0.8),
                        color: selectedCategory?.id === category.id ? theme.palette.common.white : theme.palette.text.primary,
                        border: `1px solid ${selectedCategory?.id === category.id ? 'transparent' : alpha(theme.palette.divider, 0.2)}`,
                        backdropFilter: 'blur(10px)',
                        cursor: 'pointer',
                        width: '100%',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: `0 4px 15px ${alpha(theme.palette.common.black, 0.1)}`,
                        }
                      }}
                    >
                      {category.name}
                    </Box>
                  </motion.div>
                ))}
              </Box>

              {/* Actions */}
              <Box sx={{ 
                p: 3, 
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                display: 'flex',
                gap: 2
              }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleClearClick}
                  sx={{
                    borderRadius: '12px',
                    py: 1.5,
                    fontWeight: 600
                  }}
                >
                  Clear
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleCloseClick}
                  sx={{
                    borderRadius: '12px',
                    py: 1.5,
                    fontWeight: 600,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                  }}
                >
                  Close
                </Button>
              </Box>
            </Box>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CategoryModal;