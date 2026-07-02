import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Typography, Container, Grid } from '@mui/material';
import {
  SportsEsports as GamesIcon,
  Grid3x3 as TicTacToeIcon,
  LinearScale as SnakeIcon,
  Style as MemoryIcon,
  Apps as Icon2048,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT, getGlowProps } from '@shared/theme';

const GAMES = [
  {
    id: 'tictactoe',
    title: 'Tic Tac Toe',
    description: 'Classic two-player strategy game. Place X and O on a 3×3 grid. First to align three wins.',
    icon: TicTacToeIcon,
    route: Constants.DB_GAMES_TIC_TAC_TOE_ROUTE,
    badge: '2 Players',
    color: '#6366f1',
  },
  {
    id: 'snake',
    title: 'Snake',
    description: "Guide the snake to eat food and grow longer. Don't hit the walls or yourself!",
    icon: SnakeIcon,
    route: Constants.DB_GAMES_SNAKE_ROUTE,
    badge: 'Single Player',
    color: '#10b981',
  },
  {
    id: 'memory',
    title: 'Memory Match',
    description: 'Flip cards to find matching pairs. Test your memory with 16 cards in 8 pairs.',
    icon: MemoryIcon,
    route: Constants.DB_GAMES_MEMORY_MATCH_ROUTE,
    badge: 'Single Player',
    color: '#f59e0b',
  },
  {
    id: '2048',
    title: '2048',
    description: 'Slide numbered tiles to combine them. Reach the 2048 tile to win — if you can.',
    icon: Icon2048,
    route: Constants.DB_GAMES_2048_ROUTE,
    badge: 'Puzzle',
    color: '#ec4899',
  },
];

const GameCard = ({ game, index }) => {
  const T = useT();
  const navigate = useNavigate();
  const Icon = game.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ y: -4 }}
      style={{ height: '100%' }}
    >
      <Box
        onClick={() => navigate(game.route)}
        sx={{
          height: '100%',
          minHeight: 200,
          p: 3,
          bgcolor: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 3,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          '&:hover': {
            bgcolor: T.glassHover,
            borderColor: `${game.color}55`,
            boxShadow: `0 0 32px ${game.color}22`,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            bgcolor: `${game.color}18`,
            border: `1px solid ${game.color}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon sx={{ fontSize: 22, color: game.color }} />
          </Box>
          <Box sx={{
            px: 1.25, py: 0.4,
            bgcolor: `${game.color}12`,
            border: `1px solid ${game.color}28`,
            borderRadius: 5,
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: game.color }}>
              {game.badge}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: T.textPrimary, mb: 0.5 }}>
            {game.title}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, lineHeight: 1.6 }}>
            {game.description}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: game.color }}>
            Play Now
          </Typography>
          <ArrowIcon sx={{ fontSize: 14, color: game.color }} />
        </Box>
      </Box>
    </motion.div>
  );
};

const Games = () => {
  usePageMeta('Games', { description: 'Play Tic Tac Toe, Snake, Memory Match and 2048 on DB World.' });

  const T    = useT();
  const GLOW = getGlowProps(T);

  return (
    <Box sx={{
      bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary,
      pt: { xs: '56px', md: '64px' },
    }}>
      <motion.div {...GLOW} />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, py: { xs: 5, md: 8 } }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: 2.5, mb: 2.5,
              bgcolor: T.tealBg, border: `1px solid ${T.tealBg}`,
            }}>
              <GamesIcon sx={{ fontSize: 28, color: T.teal }} />
            </Box>
            <Typography sx={{
              fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15,
              fontSize: { xs: '2rem', md: '2.75rem' }, color: T.textPrimary,
            }}>
              Games
            </Typography>
            <Typography sx={{ mt: 1.5, fontSize: '1rem', color: T.textMuted, maxWidth: 440, mx: 'auto' }}>
              A collection of classic games to pass the time.
            </Typography>
          </Box>
        </motion.div>

        <Grid container spacing={2.5}>
          {GAMES.map((game, i) => (
            <Grid key={game.id} item xs={12} sm={6}>
              <GameCard game={game} index={i} />
            </Grid>
          ))}
        </Grid>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <Box sx={{
            mt: 6, p: 2, textAlign: 'center',
            bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 2,
          }}>
            <Typography sx={{ fontSize: '0.8rem', color: T.textFaint }}>
              More games coming soon.
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default Games;
