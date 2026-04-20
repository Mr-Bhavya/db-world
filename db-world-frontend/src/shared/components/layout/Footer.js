// src/shared/components/layout/Footer.js
import React from 'react';
import { Box, Container, Typography, IconButton, Tooltip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { DarkMode as DarkModeIcon, LightMode as LightModeIcon } from '@mui/icons-material';
import { useThemeMode } from '@shared/theme';

const APP_VERSION = '1.0.0';

const ThemeToggleIcon = ({ mode }) => (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={mode}
      initial={{ rotate: -180, scale: 0, opacity: 0 }}
      animate={{ rotate: 0,    scale: 1, opacity: 1 }}
      exit={{    rotate: 180,  scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{ display: 'flex', alignItems: 'center' }}
    >
      {mode === 'dark'
        ? <LightModeIcon sx={{ fontSize: 18 }} />
        : <DarkModeIcon  sx={{ fontSize: 18 }} />
      }
    </motion.div>
  </AnimatePresence>
);

export default function Footer() {
  const { mode, toggleMode, T } = useThemeMode();

  return (
    <Box
      component="footer"
      sx={{ bgcolor: T.bg, position: 'relative', pt: 0 }}
    >
      {/* Gradient accent line — scaleX 0→1 on scroll entry */}
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          height: 1,
          background: `linear-gradient(to right, ${T.teal}, transparent)`,
          transformOrigin: 'left',
        }}
      />

      <Container maxWidth="xl">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: { xs: 'center', sm: 'space-between' },
            textAlign: { xs: 'center', sm: 'left' },
            gap: { xs: 1, sm: 0 },
            py: { xs: 2.5, sm: 1.75 },
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', color: T.textFaint }}>
            © 2026 DB World
          </Typography>

          <Box
            sx={{
              border: `1px solid ${T.glassBorder}`,
              borderRadius: 10,
              px: 1.5,
              py: 0.25,
              display: 'inline-flex',
            }}
          >
            <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, letterSpacing: '0.04em' }}>
              v{APP_VERSION}
            </Typography>
          </Box>

          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              size="small"
              onClick={toggleMode}
              sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}
            >
              <ThemeToggleIcon mode={mode} />
            </IconButton>
          </Tooltip>
        </Box>
      </Container>
    </Box>
  );
}
