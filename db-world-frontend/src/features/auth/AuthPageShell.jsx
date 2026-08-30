import React from 'react';
import { Box } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { Aurora, GlassPanel } from '@shared/ui/surfaces';

/**
 * The centred glass card the auth routes share.
 *
 * Extracted so /login, /reset-password and /verify-email cannot drift apart: they are the same
 * screen to a visitor, and three copies of this layout would eventually disagree about padding,
 * width or the entrance animation.
 */
export default function AuthPageShell({ children, maxWidth = 440 }) {
  const T = useT();
  const reduce = useReducedMotion();

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100dvh',
        bgcolor: T.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, sm: 3 },
        pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 32px)' },
        pb: 5,
        overflowX: 'hidden',
      }}
    >
      <Aurora />

      <Box
        component={motion.div}
        initial={reduce ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth, minWidth: 0 }}
      >
        <GlassPanel sx={{ p: { xs: 2.5, sm: 4 } }}>{children}</GlassPanel>
      </Box>
    </Box>
  );
}
