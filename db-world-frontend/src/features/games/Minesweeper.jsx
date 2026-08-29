import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import {
  FlagRounded, RefreshRounded, SentimentVeryDissatisfiedRounded, TimerRounded,
} from '@mui/icons-material';

import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import GameShell from './GameShell';
import { formatSeconds } from './gamesData';

/**
 * Minesweeper.
 *
 * Board state is a flat array of cells rather than a grid of grids: neighbour lookups are the hot
 * path (every reveal walks them, and a flood fill walks thousands), and index arithmetic on one
 * array beats two levels of indirection.
 */

const LEVELS = {
  beginner: { label: 'Beginner', cols: 9, rows: 9, mines: 10 },
  intermediate: { label: 'Intermediate', cols: 12, rows: 16, mines: 32 },
  expert: { label: 'Expert', cols: 16, rows: 22, mines: 70 },
};

/**
 * Board shapes are portrait, not the desktop original's landscape.
 *
 * The classic intermediate board is 16x16 and expert is 30x16 — laid out on a phone those give
 * cells under 20px, which is unhittable. Taller-than-wide keeps the cells thumb-sized and the
 * mine density matches the originals (~16% and ~20%).
 */

/** The eight neighbours' (dx, dy). */
const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/** Number colours, following the convention every version of this game has used. */
const NUMBER_COLOURS = ['', '#60a5fa', '#4ade80', '#f87171', '#c084fc', '#fb923c', '#22d3ee', '#e2e8f0', '#94a3b8'];

const makeBoard = (level) =>
  Array.from({ length: level.cols * level.rows }, () => ({
    mine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
  }));

const neighboursOf = (index, level) => {
  const x = index % level.cols;
  const y = Math.floor(index / level.cols);

  return NEIGHBOURS.reduce((acc, [dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < level.cols && ny >= 0 && ny < level.rows) acc.push(ny * level.cols + nx);
    return acc;
  }, []);
};

/**
 * Mines are laid *after* the first click, never on it or its neighbours.
 *
 * Losing on move one is not a game, and an opening that cannot flood-fill leaves you guessing.
 * Every good version of this game does the same thing.
 */
const layMines = (board, level, safeIndex) => {
  const forbidden = new Set([safeIndex, ...neighboursOf(safeIndex, level)]);
  const candidates = board.map((_, index) => index).filter((index) => !forbidden.has(index));

  for (let placed = 0; placed < level.mines && candidates.length > 0; placed += 1) {
    const pick = Math.floor(Math.random() * candidates.length);
    board[candidates[pick]].mine = true;
    candidates.splice(pick, 1);
  }

  board.forEach((cell, index) => {
    cell.adjacent = cell.mine
      ? 0
      : neighboursOf(index, level).filter((n) => board[n].mine).length;
  });

  return board;
};

/**
 * Iterative flood fill, not recursive — an expert board's opening move can clear several hundred
 * cells, and the recursive version blows the stack on the boards worth playing.
 */
const revealFrom = (board, level, startIndex) => {
  const queue = [startIndex];

  while (queue.length > 0) {
    const index = queue.pop();
    const cell = board[index];
    if (cell.revealed || cell.flagged) continue;

    cell.revealed = true;
    if (cell.adjacent === 0 && !cell.mine) queue.push(...neighboursOf(index, level));
  }

  return board;
};

export default function Minesweeper() {
  usePageMeta('Minesweeper — DB Games', { exact: true });

  const T = useT();
  const [levelKey, setLevelKey] = useState('beginner');
  const level = LEVELS[levelKey];

  const [board, setBoard] = useState(() => makeBoard(LEVELS.beginner));
  const [phase, setPhase] = useState('idle'); // idle | playing | won | lost
  const [seconds, setSeconds] = useState(0);
  const [best, setBest] = useState(0);
  const bestKey = `minesweeper_best_${levelKey}`;

  // Long-press flags on touch, where there is no right button.
  const pressTimer = useRef(null);
  const longPressed = useRef(false);

  const reset = useCallback((nextKey = levelKey) => {
    setBoard(makeBoard(LEVELS[nextKey]));
    setPhase('idle');
    setSeconds(0);
  }, [levelKey]);

  useEffect(() => {
    const stored = Number.parseInt(localStorage.getItem(bestKey) ?? '0', 10);
    setBest(Number.isFinite(stored) ? stored : 0);
  }, [bestKey]);

  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const id = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const minesLeft = useMemo(
    () => level.mines - board.filter((cell) => cell.flagged).length,
    [board, level.mines]
  );

  const finish = useCallback((next, timeTaken) => {
    setPhase(next);
    if (next !== 'won') return;

    setBest((current) => {
      if (current > 0 && current <= timeTaken) return current;
      localStorage.setItem(bestKey, String(timeTaken));
      return timeTaken;
    });
  }, [bestKey]);

  // Worked out here rather than inside a `setBoard` updater: an updater has to be pure, and this
  // has to start the clock and settle the outcome as well as produce the next board. React may
  // call an updater twice, which would have fired those twice with it.
  const reveal = useCallback((index) => {
    if (phase === 'won' || phase === 'lost') return;

    const cell = board[index];
    if (cell.flagged || cell.revealed) return;

    let next = board.map((c) => ({ ...c }));

    if (phase === 'idle') {
      next = layMines(next, level, index);
      setPhase('playing');
    }

    if (next[index].mine) {
      next.forEach((c) => { if (c.mine) c.revealed = true; });
      setBoard(next);
      finish('lost');
      return;
    }

    revealFrom(next, level, index);

    // Won when every cell that is not a mine has been turned over. Flags are irrelevant —
    // requiring them would fail a player who cleared the board without marking anything.
    if (next.every((c) => c.mine || c.revealed)) {
      next.forEach((c) => { if (c.mine) c.flagged = true; });
      finish('won', seconds);
    }

    setBoard(next);
  }, [board, finish, level, phase, seconds]);

  const toggleFlag = useCallback((index) => {
    if (phase === 'won' || phase === 'lost' || phase === 'idle') return;

    setBoard((current) => current.map((cell, i) => (
      i === index && !cell.revealed ? { ...cell, flagged: !cell.flagged } : cell
    )));
  }, [phase]);

  const startPress = (index) => () => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      toggleFlag(index);
    }, 350);
  };

  const endPress = (index) => () => {
    clearTimeout(pressTimer.current);
    // A press that already flagged must not also reveal on release.
    if (!longPressed.current) reveal(index);
  };

  const cancelPress = () => clearTimeout(pressTimer.current);

  const changeLevel = (key) => {
    setLevelKey(key);
    reset(key);
  };

  const faceLabel = phase === 'lost' ? 'Boom' : phase === 'won' ? 'Cleared' : 'Mines';

  return (
    <GameShell
      title="Minesweeper"
      width="sm"
      stats={[
        { label: faceLabel, value: phase === 'lost' ? '💥' : minesLeft, accent: true },
        { label: 'Time', value: formatSeconds(seconds) },
        { label: 'Best', value: best ? formatSeconds(best) : '—' },
      ]}
      actions={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(LEVELS).map(([key, config]) => (
            <Button
              key={key}
              size="small"
              onClick={() => changeLevel(key)}
              sx={{
                fontWeight: 800, fontSize: '0.74rem', borderRadius: 2, minHeight: 34, px: 1.5,
                color: key === levelKey ? '#fff' : T.textMuted,
                bgcolor: key === levelKey ? T.teal : 'transparent',
                border: `1px solid ${key === levelKey ? T.teal : T.glassBorder}`,
                '&:hover': { bgcolor: key === levelKey ? T.tealHover : T.tealBg, color: key === levelKey ? '#fff' : T.teal },
              }}
            >
              {config.label}
            </Button>
          ))}

          <Button
            size="small"
            onClick={() => reset()}
            startIcon={<RefreshRounded sx={{ fontSize: 16 }} />}
            sx={{
              ml: 'auto', fontWeight: 800, fontSize: '0.74rem', borderRadius: 2, minHeight: 34,
              color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg },
            }}
          >
            New game
          </Button>
        </Box>
      }
      footer={
        <Typography sx={{ textAlign: 'center', fontSize: '0.74rem', color: T.textFaint, lineHeight: 1.6 }}>
          Tap to reveal. Long-press — or right-click — to flag a mine.
        </Typography>
      }
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))`,
          gap: '3px',
          // The board is the one thing on the page that must never be dragged or text-selected:
          // both fire constantly when you sweep a finger across cells.
          userSelect: 'none',
          touchAction: 'manipulation',
        }}
      >
        {board.map((cell, index) => {
          const showNumber = cell.revealed && !cell.mine && cell.adjacent > 0;

          return (
            <Box
              key={index}
              role="button"
              tabIndex={-1}
              aria-label={cell.revealed ? `Revealed, ${cell.adjacent}` : cell.flagged ? 'Flagged' : 'Hidden cell'}
              onContextMenu={(event) => { event.preventDefault(); toggleFlag(index); }}
              onPointerDown={startPress(index)}
              onPointerUp={endPress(index)}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              sx={{
                aspectRatio: '1',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                cursor: 'pointer',
                fontWeight: 900,
                fontSize: 'clamp(0.6rem, 2.6vw, 0.95rem)',
                color: showNumber ? NUMBER_COLOURS[cell.adjacent] : T.textMuted,
                bgcolor: cell.revealed
                  ? (cell.mine ? 'rgba(248,113,113,0.22)' : T.bg === '#000000' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                  : T.glass,
                border: `1px solid ${cell.revealed ? 'transparent' : T.glassBorder}`,
                transition: 'background-color .12s ease',
                '&:hover': cell.revealed ? undefined : { bgcolor: T.glassHover },
              }}
            >
              {cell.flagged && !cell.revealed && <FlagRounded sx={{ fontSize: '0.95em', color: T.error }} />}
              {cell.revealed && cell.mine && (
                <SentimentVeryDissatisfiedRounded sx={{ fontSize: '1em', color: T.error }} />
              )}
              {showNumber && cell.adjacent}
            </Box>
          );
        })}
      </Box>

      {(phase === 'won' || phase === 'lost') && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: phase === 'won' ? T.success : T.error }}>
            {phase === 'won' ? `Cleared in ${formatSeconds(seconds)}` : 'You hit a mine'}
          </Typography>
          <Button
            onClick={() => reset()}
            variant="contained"
            startIcon={<TimerRounded />}
            sx={{
              mt: 1.5, bgcolor: T.teal, color: '#fff', fontWeight: 800, borderRadius: 2.5,
              minHeight: 44, px: 3, '&:hover': { bgcolor: T.tealHover },
            }}
          >
            Play again
          </Button>
        </Box>
      )}
    </GameShell>
  );
}
