import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography, IconButton } from '@mui/material';
import { ArrowBack, Refresh, PlayArrow, Pause } from '@mui/icons-material';
import {
  KeyboardArrowUp, KeyboardArrowDown,
  KeyboardArrowLeft, KeyboardArrowRight,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';

const COLS = 20;
const ROWS = 20;
const CELL = 18;
const SPEED = 130;

const rand = (max) => Math.floor(Math.random() * max);
const newFood = (snake) => {
  let pos;
  do { pos = { x: rand(COLS), y: rand(ROWS) }; }
  while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
};

const DIRS = { UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }, LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 } };
const OPPOSITE = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

const Snake = () => {
  usePageMeta('Snake — DB Games', { exact: true });

  const T          = useT();
  const navigate   = useNavigate();
  const canvasRef  = useRef(null);
  const stateRef   = useRef(null); // mutable game state accessed in rAF
  const rafRef     = useRef(null);
  const lastRef    = useRef(0);
  const queueRef   = useRef([]); // direction queue

  const [score, setScore]       = useState(0);
  const [best, setBest]         = useState(() => parseInt(localStorage.getItem('snake_best') || '0'));
  const [phase, setPhase]       = useState('idle'); // idle | playing | paused | dead

  const initState = () => ({
    snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
    dir:   DIRS.RIGHT,
    food:  newFood([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]),
    score: 0,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current) return;
    const ctx = canvas.getContext('2d');
    const { snake, food } = stateRef.current;

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    // Grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);

    // Food
    const fx = food.x * CELL + CELL / 2;
    const fy = food.y * CELL + CELL / 2;
    const gr = ctx.createRadialGradient(fx, fy, 1, fx, fy, CELL / 2 - 1);
    gr.addColorStop(0, '#ff6b6b');
    gr.addColorStop(1, '#ee5a24');
    ctx.beginPath();
    ctx.arc(fx, fy, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = gr;
    ctx.fill();

    // Snake
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      const alpha  = isHead ? 1 : Math.max(0.35, 1 - i * 0.04);
      ctx.fillStyle = isHead
        ? `rgba(13,148,136,${alpha})`
        : `rgba(13,148,136,${alpha * 0.8})`;
      const pad = isHead ? 1 : 2;
      ctx.beginPath();
      ctx.roundRect(
        seg.x * CELL + pad, seg.y * CELL + pad,
        CELL - pad * 2, CELL - pad * 2,
        isHead ? 4 : 2
      );
      ctx.fill();
    });
  }, []);

  const tick = useCallback((ts) => {
    if (!stateRef.current) return;
    if (ts - lastRef.current >= SPEED) {
      lastRef.current = ts;

      // Apply next direction from queue
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift();
        const cur = Object.keys(DIRS).find(k => DIRS[k] === stateRef.current.dir);
        if (next !== OPPOSITE[cur]) stateRef.current.dir = DIRS[next];
      }

      const { snake, dir, food } = stateRef.current;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      // Wall collision
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
        setPhase('dead');
        return;
      }
      // Self collision
      if (snake.some(s => s.x === head.x && s.y === head.y)) {
        setPhase('dead');
        return;
      }

      const ate   = head.x === food.x && head.y === food.y;
      const next  = [head, ...(ate ? snake : snake.slice(0, -1))];
      const score = ate ? stateRef.current.score + 1 : stateRef.current.score;

      stateRef.current = {
        ...stateRef.current,
        snake: next,
        food:  ate ? newFood(next) : food,
        score,
      };
      if (ate) {
        setScore(score);
        setBest(b => {
          const nb = Math.max(b, score);
          localStorage.setItem('snake_best', nb);
          return nb;
        });
      }
    }
    draw();
    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  const start = useCallback(() => {
    stateRef.current = initState();
    queueRef.current = [];
    lastRef.current  = 0;
    setScore(0);
    setPhase('playing');
  }, []);

  const pause = () => {
    setPhase(p => p === 'paused' ? 'playing' : 'paused');
  };

  useEffect(() => {
    if (phase === 'playing') {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
      if (phase !== 'idle') draw();
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, tick, draw]);

  useEffect(() => {
    if (phase === 'idle') draw();
  }, [phase, draw]);

  useEffect(() => {
    const handler = (e) => {
      const map = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
                    w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT', W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT' };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); queueRef.current.push(dir); }
      if (e.key === ' ') { e.preventDefault(); if (phase === 'playing' || phase === 'paused') pause(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase]);

  const dpad = (dir) => { if (phase === 'playing') queueRef.current.push(dir); };

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
        {/* Back */}
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
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: T.textPrimary }}>Snake</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.68rem', color: T.textMuted }}>SCORE</Typography>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: T.teal }}>{score}</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.68rem', color: T.textMuted }}>BEST</Typography>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: T.textPrimary }}>{best}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Canvas */}
            <Box sx={{
              position: 'relative', borderRadius: 2, overflow: 'hidden',
              border: `1px solid ${T.glassBorder}`, mb: 2,
            }}>
              <canvas
                ref={canvasRef}
                width={COLS * CELL}
                height={ROWS * CELL}
                style={{ display: 'block', width: '100%', imageRendering: 'pixelated' }}
              />
              {/* Overlay for idle / dead / paused */}
              {(phase === 'idle' || phase === 'dead' || phase === 'paused') && (
                <Box sx={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  bgcolor: `${T.sidebar ?? T.bg}cc`, gap: 1.5,
                }}>
                  {phase === 'dead' && (
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171' }}>Game Over</Typography>
                  )}
                  {phase === 'paused' && (
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: T.textMuted }}>Paused</Typography>
                  )}
                  <Button
                    variant="contained"
                    startIcon={phase === 'paused' ? <PlayArrow /> : <PlayArrow />}
                    onClick={phase === 'paused' ? pause : start}
                    sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 700, '&:hover': { bgcolor: '#0f766e' } }}
                  >
                    {phase === 'idle' ? 'Start Game' : phase === 'dead' ? 'Play Again' : 'Resume'}
                  </Button>
                </Box>
              )}
            </Box>

            {/* Controls */}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mb: 2 }}>
              {phase === 'playing' && (
                <Button
                  size="small" startIcon={<Pause />} onClick={pause}
                  sx={{ borderColor: T.glassBorder, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal } }}
                  variant="outlined"
                >
                  Pause
                </Button>
              )}
              <Button
                size="small" startIcon={<Refresh />} onClick={start}
                sx={{ borderColor: T.glassBorder, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal } }}
                variant="outlined"
              >
                Restart
              </Button>
            </Box>

            {/* D-pad (mobile) */}
            <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <IconButton onClick={() => dpad('UP')} sx={{ color: T.textMuted, bgcolor: 'rgba(255,255,255,0.05)' }}>
                <KeyboardArrowUp />
              </IconButton>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton onClick={() => dpad('LEFT')} sx={{ color: T.textMuted, bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <KeyboardArrowLeft />
                </IconButton>
                <IconButton onClick={() => dpad('DOWN')} sx={{ color: T.textMuted, bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <KeyboardArrowDown />
                </IconButton>
                <IconButton onClick={() => dpad('RIGHT')} sx={{ color: T.textMuted, bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <KeyboardArrowRight />
                </IconButton>
              </Box>
            </Box>

            <Typography sx={{ fontSize: '0.72rem', color: T.textMuted, textAlign: 'center', mt: 1 }}>
              Arrow keys / WASD to move · Space to pause
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default Snake;
