import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { ArrowBackRounded } from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';

import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import { Aurora, GlassPanel } from '@shared/ui/surfaces';

/**
 * The frame every game sits in.
 *
 * All six were carrying their own copy of the same thing — full-height background, a pulsing teal
 * radial glow, a container, a back button and a glass card — which is why they drifted from the
 * rest of the app the moment the shared surfaces landed. One shell instead, on the same `Aurora`
 * and `GlassPanel` primitives as the hub, the weather page and sign-in.
 *
 * @param {{label: string, value: React.ReactNode, accent?: boolean}[]} stats
 *   The score row beside the title. Games score themselves differently — points, moves, time,
 *   wins — so each passes its own rather than the shell assuming one shape.
 */
export default function GameShell({ title, stats = [], width = 'sm', actions, children, footer }) {
  const T = useT();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: T.bg,
        minHeight: '100dvh',
        color: T.textPrimary,
        pt: { xs: '56px', md: '64px' },
        overflowX: 'hidden',
      }}
    >
      <Aurora />

      <Container maxWidth={width} sx={{ position: 'relative', zIndex: 1, py: { xs: 2.5, md: 4 } }}>
        <Button
          startIcon={<ArrowBackRounded />}
          onClick={() => navigate(Constants.DB_GAMES_ROUTE)}
          sx={{
            mb: 2, color: T.textMuted, fontWeight: 700, borderRadius: 2,
            '&:hover': { color: T.teal, bgcolor: T.tealBg },
          }}
        >
          Games
        </Button>

        <Box
          component={motion.div}
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassPanel sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 2, mb: 2, flexWrap: 'wrap',
              }}
            >
              <Typography
                component="h1"
                sx={{ fontSize: '1.3rem', fontWeight: 900, color: T.textPrimary, letterSpacing: '-0.02em' }}
              >
                {title}
              </Typography>

              {stats.length > 0 && (
                <Box sx={{ display: 'flex', gap: { xs: 1.75, sm: 2.5 }, ml: 'auto' }}>
                  {stats.map((stat) => (
                    <Box key={stat.label} sx={{ textAlign: 'center', minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: '0.62rem', fontWeight: 800, color: T.textMuted,
                          textTransform: 'uppercase', letterSpacing: '0.07em',
                        }}
                      >
                        {stat.label}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2,
                          color: stat.accent ? T.teal : T.textPrimary,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {stat.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {actions && <Box sx={{ mb: 2 }}>{actions}</Box>}

            {children}
          </GlassPanel>
        </Box>

        {footer && <Box sx={{ mt: 2 }}>{footer}</Box>}
      </Container>
    </Box>
  );
}
