import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Grid, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import GameShell from './GameShell';

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
    <GameShell
      title="Memory Match"
      width="sm"
      stats={[{ label: 'Moves', value: moves, accent: true }, { label: 'Time', value: fmt(time) }, { label: 'Best', value: best ? best : '—' }]}
      actions={
        <Button
          size="small"
          startIcon={<Refresh sx={{ fontSize: 16 }} />}
          onClick={reset}
          sx={{
            fontWeight: 800, fontSize: '0.74rem', borderRadius: 2, minHeight: 34,
            color: T.textMuted, border: `1px solid ${T.glassBorder}`,
            '&:hover': { color: T.teal, borderColor: T.teal, bgcolor: T.tealBg },
          }}
        >
          New game
        </Button>
      }
    >
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
                <Grid key={card.id} size={3}>
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
    </GameShell>
  );
};

export default MemoryMatch;
