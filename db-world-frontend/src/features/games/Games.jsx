import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography } from '@mui/material';
import { ArrowForwardRounded, SportsEsportsRounded } from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';

import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import { Aurora, GlassPanel } from '@shared/ui/surfaces';
import { GAMES } from './gamesData';

/**
 * The arcade.
 *
 * Rebuilt on the same `Aurora` + `GlassPanel` surfaces as the hub, the weather page and sign-in,
 * so it stops looking like a different product. The list itself comes from `gamesData`, which the
 * home dashboard's tile also reads — there used to be two hand-maintained copies.
 *
 * Each card shows that game's own best score when there is one. They are the reason to come back,
 * and they were previously only visible once you were already inside the game.
 */

function GameCard({ game, index, reduce }) {
  const T = useT();
  const navigate = useNavigate();
  const best = game.readBest();
  const { Icon } = game;

  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -4 }}
    >
      <GlassPanel
        onClick={() => navigate(game.route)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate(game.route); }}
        aria-label={`Play ${game.title}`}
        sx={{
          height: '100%',
          minHeight: 196,
          p: 2.5,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          '&:hover': {
            borderColor: `${game.accent}66`,
            boxShadow: `0 0 0 1px ${game.accent}33, 0 24px 60px ${game.accent}22`,
          },
          '&:focus-visible': { outline: `3px solid ${game.accent}`, outlineOffset: 3 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box
            sx={{
              width: 46, height: 46, flexShrink: 0, borderRadius: 2.5,
              display: 'grid', placeItems: 'center',
              bgcolor: `${game.accent}1f`,
              border: `1px solid ${game.accent}3d`,
            }}
          >
            <Icon sx={{ fontSize: 23, color: game.accent }} />
          </Box>

          <Box
            sx={{
              px: 1.25, py: 0.4, borderRadius: 5, flexShrink: 0,
              bgcolor: `${game.accent}14`,
              border: `1px solid ${game.accent}2e`,
            }}
          >
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: game.accent, whiteSpace: 'nowrap' }}>
              {game.badge}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 900, color: T.textPrimary, letterSpacing: '-0.01em' }}>
            {game.title}
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: T.textMuted, lineHeight: 1.6, mt: 0.5 }}>
            {game.description}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: game.accent }}>
            Play
          </Typography>
          <ArrowForwardRounded sx={{ fontSize: 15, color: game.accent }} />

          {best && (
            <Typography
              sx={{
                ml: 'auto', fontSize: '0.72rem', fontWeight: 800, color: T.textFaint,
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}
            >
              Best {best.label}
            </Typography>
          )}
        </Box>
      </GlassPanel>
    </Box>
  );
}

export default function Games() {
  usePageMeta('Games', {
    description: 'Play Minesweeper, Connect Four, 2048, Snake, Memory Match and Tic Tac Toe on DB World.',
  });

  const T = useT();
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

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, py: { xs: 3, sm: 4, md: 6 }, px: { xs: 2, sm: 3 } }}>
        <Box
          component={motion.div}
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: { xs: 3, md: 4 } }}>
            <Box
              sx={{
                width: { xs: 48, sm: 54 }, height: { xs: 48, sm: 54 }, flexShrink: 0, borderRadius: 3,
                display: 'grid', placeItems: 'center', bgcolor: T.tealBg,
                border: `1px solid ${T.teal}44`, boxShadow: `0 0 30px ${T.tealGlow}`,
              }}
            >
              <SportsEsportsRounded sx={{ fontSize: { xs: 24, sm: 27 }, color: T.teal }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h1"
                sx={{
                  fontSize: 'clamp(1.5rem, 6vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.03em',
                  lineHeight: 1.05, color: T.textPrimary,
                }}
              >
                Arcade
              </Typography>
              <Typography sx={{ fontSize: 'clamp(0.82rem, 2.6vw, 0.95rem)', color: T.textMuted, mt: 0.35 }}>
                {GAMES.length} classics. No account, no ads, no waiting.
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: { xs: 1.75, sm: 2.25 },
          }}
        >
          {GAMES.map((game, index) => (
            <GameCard key={game.id} game={game} index={index} reduce={reduce} />
          ))}
        </Box>

        <Typography sx={{ mt: 4, textAlign: 'center', fontSize: '0.74rem', color: T.textFaint }}>
          Scores are kept on this device only — nothing is uploaded.
        </Typography>
      </Container>
    </Box>
  );
}
