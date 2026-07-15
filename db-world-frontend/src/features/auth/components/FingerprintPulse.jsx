import React from 'react';
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useT } from '@shared/theme';

/**
 * Animated fingerprint used across the biometric screens. Four states:
 *  - idle:     steady fingerprint, faint rings
 *  - scanning: pulsing concentric rings + breathing icon
 *  - success:  ring/icon snap to green with a check
 *  - error:    shake + red cross
 * Pure framer-motion; colours come from the live theme tokens.
 */
export default function FingerprintPulse({ state = 'idle', size = 120 }) {
  const T = useT();
  const scanning = state === 'scanning';
  const isSuccess = state === 'success';
  const isError = state === 'error';
  const color = isError ? T.error : isSuccess ? T.success : T.teal;
  const glow = isError ? 'rgba(248,113,113,0.20)' : isSuccess ? 'rgba(16,185,129,0.20)' : T.tealGlow;

  const Ring = ({ delay }) => (
    <Box
      component={motion.span}
      aria-hidden
      animate={scanning ? { scale: [1, 1.22, 1], opacity: [0.5, 0, 0.5] } : { scale: 1, opacity: 0.28 }}
      transition={scanning ? { duration: 1.9, repeat: Infinity, ease: 'easeInOut', delay } : { duration: 0.35 }}
      sx={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${color}` }}
    />
  );

  return (
    <Box
      component={motion.div}
      animate={isError ? { x: [0, -9, 9, -7, 7, 0] } : { x: 0 }}
      transition={{ duration: 0.45 }}
      sx={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Box aria-hidden sx={{ position: 'absolute', inset: -size * 0.3, borderRadius: '50%', background: `radial-gradient(circle, ${glow} 0%, transparent 68%)` }} />
      <Ring delay={0} />
      <Ring delay={0.65} />
      <Box
        sx={{
          position: 'relative', width: size * 0.6, height: size * 0.6, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: T.glass, border: `2px solid ${color}`,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isSuccess ? (
            <Box key="ok" component={motion.span} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} sx={{ display: 'flex' }}>
              <CheckRoundedIcon sx={{ fontSize: size * 0.34, color }} />
            </Box>
          ) : isError ? (
            <Box key="err" component={motion.span} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} sx={{ display: 'flex' }}>
              <CloseRoundedIcon sx={{ fontSize: size * 0.34, color }} />
            </Box>
          ) : (
            <Box
              key="fp"
              component={motion.span}
              animate={scanning ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
              transition={scanning ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
              sx={{ display: 'flex' }}
            >
              <FingerprintRoundedIcon sx={{ fontSize: size * 0.42, color }} />
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
}
