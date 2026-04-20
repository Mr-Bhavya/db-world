// src/shared/components/ui/BokehBackground.js
import React, { useId } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { useThemeMode } from '@shared/theme';

const ORB_DARK_OPACITY = 0.25;
const ORB_LIGHT_OPACITY = 0.12;
const GRAIN_DARK_OPACITY = 0.03;
const GRAIN_LIGHT_OPACITY = 0.015;

const DOTS = [
  { size: 12, x: '15%', delay: 0,   duration: 8  },
  { size: 7,  x: '40%', delay: 1.2, duration: 10 },
  { size: 16, x: '65%', delay: 0.6, duration: 12 },
  { size: 5,  x: '80%', delay: 2,   duration: 9  },
  { size: 10, x: '25%', delay: 1.8, duration: 11 },
  { size: 8,  x: '55%', delay: 0.3, duration: 7  },
];

export default function BokehBackground({ children, vignette = false, height = '100vh' }) {
  const { T, mode } = useThemeMode();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const filterId = useId().replace(/:/g, '');

  const isDark = mode === 'dark';
  const orbOpacity = isDark ? ORB_DARK_OPACITY : ORB_LIGHT_OPACITY;
  const grainOpacity = isDark ? GRAIN_DARK_OPACITY : GRAIN_LIGHT_OPACITY;

  const dots = isMobile ? DOTS.slice(0, 3) : DOTS;

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        width: '100%',
        overflow: 'hidden',
        bgcolor: T.bg,
      }}
    >
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={`grain-${filterId}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
      </svg>

      <motion.div
        animate={{ x: [0, 30, -20, 0], y: [0, -25, 15, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '45%',
          height: '45%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${T.teal}, transparent 70%)`,
          opacity: orbOpacity,
          pointerEvents: 'none',
          filter: 'blur(40px)',
        }}
      />

      <motion.div
        animate={{ x: [0, -25, 20, 0], y: [0, 20, -30, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: '40%',
          height: '40%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #4f46e5, transparent 70%)',
          opacity: orbOpacity,
          pointerEvents: 'none',
          filter: 'blur(40px)',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: T.text,
          opacity: grainOpacity,
          pointerEvents: 'none',
          filter: `url(#grain-${filterId})`,
          zIndex: 1,
        }}
      />

      {dots.map((dot, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -120, 0], opacity: [dot.delay ? 0.15 : 0.3, 0.4, 0.15] }}
          transition={{
            duration: dot.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: dot.delay,
          }}
          style={{
            position: 'absolute',
            bottom: '15%',
            left: dot.x,
            width: dot.size,
            height: dot.size,
            borderRadius: '50%',
            background: T.teal,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      ))}

      {vignette && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '30%',
            background: `linear-gradient(to bottom, transparent, ${T.bg})`,
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      )}

      <Box sx={{ position: 'relative', zIndex: 4, height: '100%' }}>
        {children}
      </Box>
    </Box>
  );
}
