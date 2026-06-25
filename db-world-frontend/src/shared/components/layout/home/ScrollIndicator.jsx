import React, { memo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { KeyboardArrowDown as KeyboardArrowDownIcon } from '@mui/icons-material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { cardFocusSx } from './homeStyles';

const ScrollIndicator = memo(function ScrollIndicator({ scrolled, T }) {
  const prefersReducedMotion = useReducedMotion();

  const handleScrollDown = useCallback(() => {
    const target = document.getElementById('apps');

    if (target) {
      target.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      return;
    }

    window.scrollTo({
      top: window.innerHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [prefersReducedMotion]);

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: {
          xs: 14,
          sm: 20,
          md: 34,
          xl: 44,
        },
        left: 0,
        right: 0,
        display: {
          xs: 'none',
          sm: 'flex',
        },
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <AnimatePresence>
        {!scrolled && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.8, duration: 0.35 }}
            style={{ pointerEvents: 'auto' }}
          >
            <Box
              role="button"
              tabIndex={0}
              onClick={handleScrollDown}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleScrollDown();
                }
              }}
              aria-label="Scroll to apps"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                color: T.textMuted,
                userSelect: 'none',
                px: 1.5,
                py: 1,
                borderRadius: 999,
                transition: 'color 0.2s ease, background-color 0.2s ease',
                ...cardFocusSx(T.teal),
                '&:hover': {
                  color: T.textPrimary,
                  bgcolor: 'rgba(255,255,255,0.04)',
                },
              }}
            >
              <Typography
                sx={{
                  fontSize: {
                    sm: '0.68rem',
                    md: '0.72rem',
                  },
                  lineHeight: 1,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  mb: 0.4,
                  whiteSpace: 'nowrap',
                }}
              >
                Scroll Down
              </Typography>

              <motion.div
                animate={
                  prefersReducedMotion
                    ? undefined
                    : {
                        y: [0, 7, 0],
                      }
                }
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <KeyboardArrowDownIcon
                  sx={{
                    fontSize: {
                      sm: 28,
                      xl: 34,
                    },
                    color: T.teal,
                    filter: 'drop-shadow(0 0 6px rgba(0,255,200,0.4))',
                  }}
                />
              </motion.div>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
});

ScrollIndicator.displayName = 'ScrollIndicator';

export default ScrollIndicator;