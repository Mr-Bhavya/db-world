import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';

// Colour map for tiles
const TILE_STYLE = {
  0:    { bg: 'rgba(255,255,255,0.04)', color: 'transparent' },
  2:    { bg: '#eee4da', color: '#776e65' },
  4:    { bg: '#ede0c8', color: '#776e65' },
  8:    { bg: '#f2b179', color: '#f9f6f2' },
  16:   { bg: '#f59563', color: '#f9f6f2' },
  32:   { bg: '#f67c5f', color: '#f9f6f2' },
  64:   { bg: '#f65e3b', color: '#f9f6f2' },
  128:  { bg: '#edcf72', color: '#f9f6f2' },
  256:  { bg: '#edcc61', color: '#f9f6f2' },
  512:  { bg: '#edc850', color: '#f9f6f2' },
  1024: { bg: '#edc53f', color: '#f9f6f2' },
  2048: { bg: '#0d9488', color: '#ffffff' },
};
const getTileStyle = (v) => TILE_STYLE[v] ?? { bg: '#3c3a32', color: '#f9f6f2' };

/* ── Grid logic ──────────────────────────────────────────────────────────── */
const INIT_GRID = () => {
  const g = Array.from({ length: 4 }, () => Array(4).fill(0));
  return addTile(addTile(g));
};

function emptyCells(g) {
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!g[r][c]) cells.push([r, c]);
  return cells;
}

function addTile(g) {
  const cells = emptyCells(g);
  if (!cells.length) return g;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  const ng = g.map(row => [...row]);
  ng[r][c] = Math.random() < 0.9 ? 2 : 4;
  return ng;
}

function slideRow(row) {
  const nums  = row.filter(Boolean);
  const res   = [];
  let score   = 0;
  let i = 0;
  while (i < nums.length) {
    if (nums[i] === nums[i + 1]) { res.push(nums[i] * 2); score += nums[i] * 2; i += 2; }
    else { res.push(nums[i]); i++; }
  }
  while (res.length < 4) res.push(0);
  return { row: res, score };
}

function moveLeft(g) {
  let score = 0;
  const ng = g.map(row => { const { row: r, score: s } = slideRow(row); score += s; return r; });
  return { grid: ng, score };
}

function rotate90(g) {
  return g[0].map((_, c) => g.map(row => row[c]).reverse());
}

function move(g, dir) {
  let grid = g.map(r => [...r]);
  let rots = { left: 0, right: 2, up: 3, down: 1 };
  const n  = rots[dir];
  for (let i = 0; i < n; i++) grid = rotate90(grid);
  const { grid: moved, score } = moveLeft(grid);
  let result = moved;
  for (let i = 0; i < (4 - n) % 4; i++) result = rotate90(result);
  const changed = JSON.stringify(result) !== JSON.stringify(g);
  return { grid: changed ? addTile(result) : result, score, changed };
}

function hasWon(g)  { return g.flat().includes(2048); }
function hasMoves(g) {
  if (emptyCells(g).length) return true;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (c < 3 && g[r][c] === g[r][c+1]) return true;
      if (r < 3 && g[r][c] === g[r+1][c]) return true;
    }
  return false;
}

/* ── Component ───────────────────────────────────────────────────────────── */
const Game2048 = () => {
  usePageMeta('2048 — DB Games', { exact: true });

  const T        = useT();
  const navigate = useNavigate();
  const [grid, setGrid]   = useState(INIT_GRID);
  const [score, setScore] = useState(0);
  const [best, setBest]   = useState(() => parseInt(localStorage.getItem('2048_best') || '0'));
  const [won, setWon]     = useState(false);
  const [over, setOver]   = useState(false);

  const apply = useCallback((dir) => {
    if (over) return;
    setGrid(g => {
      const { grid: ng, score: s, changed } = move(g, dir);
      if (!changed) return g;
      setScore(sc => {
        const ns = sc + s;
        setBest(b => { const nb = Math.max(b, ns); localStorage.setItem('2048_best', nb); return nb; });
        return ns;
      });
      if (hasWon(ng))  setWon(true);
      if (!hasMoves(ng)) setOver(true);
      return ng;
    });
  }, [over]);

  const reset = () => {
    setGrid(INIT_GRID());
    setScore(0);
    setWon(false);
    setOver(false);
  };

  useEffect(() => {
    const handler = (e) => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) { e.preventDefault(); apply(map[e.key]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [apply]);

  // Touch swipe
  const touchStart = React.useRef(null);
  const onTouchStart = (e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd   = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) apply(dx > 0 ? 'right' : 'left');
    else apply(dy > 0 ? 'down' : 'up');
    touchStart.current = null;
  };

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

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1, py: { xs: 3, md: 5 } }}>
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
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: T.teal, letterSpacing: '-0.02em' }}>2048</Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1.5, minWidth: 52 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: T.textMuted }}>SCORE</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: T.textPrimary }}>{score}</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1.5, minWidth: 52 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: T.textMuted }}>BEST</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: T.textPrimary }}>{best}</Typography>
                </Box>
                <Button
                  size="small" onClick={reset}
                  sx={{ color: T.textMuted, border: `1px solid ${T.glassBorder}`, borderRadius: 1.5, minWidth: 'unset', px: 1,
                    '&:hover': { color: T.teal, borderColor: T.teal } }}
                >
                  <Refresh sx={{ fontSize: 18 }} />
                </Button>
              </Box>
            </Box>

            {/* Win / Game over banners */}
            <AnimatePresence>
              {(won || over) && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Box sx={{
                    mb: 2, p: 1.5, textAlign: 'center', borderRadius: 2,
                    bgcolor: won ? 'rgba(13,148,136,0.15)' : 'rgba(248,113,113,0.1)',
                    border: `1px solid ${won ? 'rgba(13,148,136,0.35)' : 'rgba(248,113,113,0.3)'}`,
                  }}>
                    <Typography sx={{ fontWeight: 700, color: won ? T.teal : '#f87171', fontSize: '0.95rem' }}>
                      {won ? '🎉 You reached 2048!' : '💀 Game Over'}
                    </Typography>
                    <Button size="small" onClick={reset} sx={{ mt: 0.5, color: T.textMuted, textDecoration: 'underline', fontSize: '0.78rem' }}>
                      Play again
                    </Button>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Grid */}
            <Box
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              sx={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px', p: '8px',
                bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2,
                border: `1px solid ${T.glassBorder}`,
                userSelect: 'none',
              }}
            >
              {grid.flat().map((val, i) => {
                const { bg, color } = getTileStyle(val);
                return (
                  <Box
                    key={i}
                    sx={{
                      aspectRatio: '1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 1.5, bgcolor: bg, color,
                      fontSize: val >= 1024 ? '0.75rem' : val >= 128 ? '0.9rem' : '1rem',
                      fontWeight: 900,
                      transition: 'background 0.1s',
                    }}
                  >
                    {val || ''}
                  </Box>
                );
              })}
            </Box>

            <Typography sx={{ fontSize: '0.72rem', color: T.textMuted, textAlign: 'center', mt: 2 }}>
              Arrow keys to move · Swipe on mobile
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default Game2048;
