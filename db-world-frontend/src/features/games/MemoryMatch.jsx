import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Grid, Typography } from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';

const EMOJIS = ['🐉', '🦄', '🚀', '🌊', '🔥', '⚡', '🎯', '🍀', '🦋', '🌙', '💎', '🎸', '🦊', '🐬', '🌸', '🏔️'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeCards(count = 8) {
  const chosen = EMOJIS.slice(0, count);
  return shuffle([...chosen, ...chosen]).map((emoji, i) => ({
    id: i, emoji, flipped: false, matched: false,
  }));
}

const MemoryMatch = () => {
  usePageMeta('Memory Match — DB Games', { exact: true });

  const T          = useT();
  const navigate   = useNavigate();
  const [cards, setCards]     = useState(() => makeCards(8));
  const [flipped, setFlipped] = useState([]);   // indices currently face-up (max 2)
  const [locked, setLocked]   = useState(false);
  const [moves, setMoves]     = useState(0);
  const [time, setTime]       = useState(0);
  const [running, setRunning] = useState(false);
  const [won, setWon]         = useState(false);
  const [best, setBest]       = useState(() => parseInt(localStorage.getItem('memory_best') || '0'));

  // Timer
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const reset = () => {
    setCards(makeCards(8));
    setFlipped([]);
    setLocked(false);
    setMoves(0);
    setTime(0);
    setRunning(false);
    setWon(false);
  };

  const handleFlip = useCallback((idx) => {
    if (locked || cards[idx].flipped || cards[idx].matched) return;
    if (!running && !won) setRunning(true);

    const next = flipped.concat(idx);
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, flipped: true } : c));
    setFlipped(next);

    if (next.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [a, b] = next;
      setTimeout(() => {
        setCards(prev => {
          const updated = prev.map((c, i) => {
            if (i === a || i === b) {
              const matched = prev[a].emoji === prev[b].emoji;
              return { ...c, flipped: matched, matched };
            }
            return c;
          });
          const allDone = updated.every(c => c.matched);
          if (allDone) {
            setRunning(false);
            setWon(true);
            setBest(bst => {
              const nb = bst === 0 ? moves + 1 : Math.min(bst, moves + 1);
              localStorage.setItem('memory_best', nb);
              return nb;
            });
          }
          return updated;
        });
        setFlipped([]);
        setLocked(false);
      }, 700);
    }
  }, [flipped, locked, cards, running, won, moves]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Box sx={{
      bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary,
      pt: { xs: '56px', md: '64px' },
    }}>
      <motion.div
        animate={{ opacity: [0.06, 0.14, 0.06] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: `radial-gradient(ellipse 50% 40% at 50% 30%, ${T.tealGlow ?? 'rgba(13,148,136,0.12)'} 0%, transparent 70%)`,
        }}
      />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, py: { xs: 3, md: 5 } }}>
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(Constants.DB_GAMES_ROUTE)}
            sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: 'transparent' } }}
          >
            Games
          </Button>
        </Box>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: T.textPrimary }}>Memory Match</Typography>
              <Button
                size="small" startIcon={<Refresh />} onClick={reset}
                variant="outlined"
                sx={{ borderColor: T.glassBorder, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal } }}
              >
                New
              </Button>
            </Box>

            {/* Stats */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'center' }}>
              {[
                { label: 'Moves', value: moves },
                { label: 'Time',  value: fmt(time) },
                { label: 'Best',  value: best ? `${best} moves` : '—' },
              ].map(({ label, value }) => (
                <Box key={label} sx={{
                  flex: 1, textAlign: 'center', p: 1.5,
                  bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${T.glassBorder}`, borderRadius: 2,
                }}>
                  <Typography sx={{ fontSize: '0.68rem', color: T.textMuted, mb: 0.25 }}>{label}</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: T.teal }}>{value}</Typography>
                </Box>
              ))}
            </Box>

            {/* Win banner */}
            <AnimatePresence>
              {won && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Box sx={{
                    mb: 2, p: 2, textAlign: 'center',
                    bgcolor: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.3)',
                    borderRadius: 2,
                  }}>
                    <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>🎉</Typography>
                    <Typography sx={{ fontWeight: 700, color: T.teal }}>
                      Completed in {moves} moves!
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>{fmt(time)}</Typography>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cards grid */}
            <Grid container spacing={1}>
              {cards.map((card, idx) => (
                <Grid key={card.id} item xs={3}>
                  <Box
                    onClick={() => handleFlip(idx)}
                    sx={{
                      aspectRatio: '1',
                      perspective: '600px',
                      cursor: card.matched || card.flipped ? 'default' : 'pointer',
                    }}
                  >
                    <motion.div
                      animate={{ rotateY: card.flipped || card.matched ? 180 : 0 }}
                      transition={{ duration: 0.35 }}
                      style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', position: 'relative' }}
                    >
                      {/* Back */}
                      <Box sx={{
                        position: 'absolute', inset: 0,
                        backfaceVisibility: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: `1px solid ${T.glassBorder}`,
                        fontSize: '1.25rem',
                        transition: 'background 0.2s',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.09)' },
                      }}>
                        🂠
                      </Box>
                      {/* Front */}
                      <Box sx={{
                        position: 'absolute', inset: 0,
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 2,
                        bgcolor: card.matched ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.07)',
                        border: `1px solid ${card.matched ? 'rgba(13,148,136,0.4)' : T.glassBorder}`,
                        fontSize: '1.5rem',
                        boxShadow: card.matched ? '0 0 12px rgba(13,148,136,0.25)' : 'none',
                      }}>
                        {card.emoji}
                      </Box>
                    </motion.div>
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Typography sx={{ fontSize: '0.72rem', color: T.textMuted, textAlign: 'center', mt: 2 }}>
              Find all 8 matching pairs
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default MemoryMatch;
