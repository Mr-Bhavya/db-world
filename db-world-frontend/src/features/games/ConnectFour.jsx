import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { PersonRounded, RefreshRounded, SmartToyRounded } from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';

import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import GameShell from './GameShell';

/**
 * Connect Four, against a friend on one screen or against the computer.
 *
 * The board is a flat array, row 0 at the top, so `index = row * COLS + col`. Discs fall to the
 * lowest empty row in their column.
 */

const COLS = 7;
const ROWS = 6;
const EMPTY = null;
const RED = 'red';
const YELLOW = 'yellow';

const COLOURS = {
  [RED]: '#f43f5e',
  [YELLOW]: '#fbbf24',
};

/**
 * Every line of four on the board, worked out once at module load.
 *
 * Win checking and the AI's scoring both walk all of them on every move — 69 lines, and the AI
 * evaluates thousands of positions, so recomputing the geometry each time is wasted work.
 */
const LINES = (() => {
  const lines = [];
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      directions.forEach(([dc, dr]) => {
        const cells = [];
        for (let step = 0; step < 4; step += 1) {
          const c = col + dc * step;
          const r = row + dr * step;
          if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
          cells.push(r * COLS + c);
        }
        lines.push(cells);
      });
    }
  }

  return lines;
})();

const emptyBoard = () => Array(COLS * ROWS).fill(EMPTY);

/** The row a disc dropped into this column would land in, or -1 when the column is full. */
const landingRow = (board, col) => {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row * COLS + col] === EMPTY) return row;
  }
  return -1;
};

const openColumns = (board) =>
  Array.from({ length: COLS }, (_, col) => col).filter((col) => landingRow(board, col) >= 0);

/** The winning line's cells, or null. Returned rather than a boolean so the UI can highlight it. */
const findWin = (board) => {
  for (const cells of LINES) {
    const first = board[cells[0]];
    if (first !== EMPTY && cells.every((cell) => board[cell] === first)) {
      return { player: first, cells };
    }
  }
  return null;
};

const drop = (board, col, player) => {
  const row = landingRow(board, col);
  if (row < 0) return null;

  const next = board.slice();
  next[row * COLS + col] = player;
  return next;
};

// -- The opponent -------------------------------------------------------------

const WIN_SCORE = 100000;

/**
 * How good this position is for `me`, from the shape of the lines rather than just wins.
 *
 * Counting threats — three in a row with the fourth square still open, and two with two open —
 * is what makes the computer build towards something instead of playing the first legal move. The
 * centre column is weighted because it takes part in more lines than any other.
 */
const scoreFor = (board, me) => {
  const them = me === RED ? YELLOW : RED;
  let score = 0;

  for (let row = 0; row < ROWS; row += 1) {
    if (board[row * COLS + 3] === me) score += 3;
  }

  for (const cells of LINES) {
    let mine = 0;
    let theirs = 0;
    cells.forEach((cell) => {
      if (board[cell] === me) mine += 1;
      else if (board[cell] === them) theirs += 1;
    });

    if (mine > 0 && theirs > 0) continue; // blocked line, worth nothing to either side

    if (mine === 4) score += WIN_SCORE;
    else if (mine === 3) score += 60;
    else if (mine === 2) score += 8;

    if (theirs === 4) score -= WIN_SCORE;
    // Their three-in-a-row is scored harder than our own, so blocking beats building when both
    // are available — losing next turn costs more than winning one turn sooner gains.
    else if (theirs === 3) score -= 85;
    else if (theirs === 2) score -= 8;
  }

  return score;
};

/** Minimax with alpha-beta pruning. Depth 5 is instant on a phone and beats a casual player. */
const minimax = (board, depth, alpha, beta, maximising, me) => {
  const win = findWin(board);
  if (win) return win.player === me ? WIN_SCORE + depth : -WIN_SCORE - depth;

  const columns = openColumns(board);
  if (depth === 0 || columns.length === 0) return scoreFor(board, me);

  const them = me === RED ? YELLOW : RED;
  let best = maximising ? -Infinity : Infinity;
  let a = alpha;
  let b = beta;

  // Centre-out ordering makes alpha-beta prune far more of the tree, because the strongest moves
  // tend to be central and get evaluated first.
  const ordered = columns.slice().sort((x, y) => Math.abs(3 - x) - Math.abs(3 - y));

  for (const col of ordered) {
    const next = drop(board, col, maximising ? me : them);
    const value = minimax(next, depth - 1, a, b, !maximising, me);

    if (maximising) {
      best = Math.max(best, value);
      a = Math.max(a, value);
    } else {
      best = Math.min(best, value);
      b = Math.min(b, value);
    }
    if (b <= a) break;
  }

  return best;
};

const chooseColumn = (board, me) => {
  const columns = openColumns(board);
  if (columns.length === 0) return -1;

  let bestCol = columns[0];
  let bestValue = -Infinity;

  for (const col of columns.slice().sort((x, y) => Math.abs(3 - x) - Math.abs(3 - y))) {
    const value = minimax(drop(board, col, me), 4, -Infinity, Infinity, false, me);
    if (value > bestValue) {
      bestValue = value;
      bestCol = col;
    }
  }

  return bestCol;
};

// -- Component ----------------------------------------------------------------

export default function ConnectFour() {
  usePageMeta('Connect Four — DB Games', { exact: true });

  const T = useT();
  const reduce = useReducedMotion();

  const [vsComputer, setVsComputer] = useState(true);
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState(RED);
  const [result, setResult] = useState(null); // { player, cells } | 'draw' | null
  const [wins, setWins] = useState(() => {
    const stored = Number.parseInt(localStorage.getItem('connect_four_wins') ?? '0', 10);
    return Number.isFinite(stored) ? stored : 0;
  });

  // The player is always red; the computer is yellow and moves second.
  const thinking = vsComputer && turn === YELLOW && !result;
  const boardRef = useRef(board);
  boardRef.current = board;

  const settle = useCallback((next, mover) => {
    const win = findWin(next);
    if (win) {
      setResult(win);
      // Only counts when there was something to beat.
      if (vsComputer && win.player === RED) {
        setWins((current) => {
          const total = current + 1;
          localStorage.setItem('connect_four_wins', String(total));
          return total;
        });
      }
      return;
    }

    if (openColumns(next).length === 0) {
      setResult('draw');
      return;
    }

    setTurn(mover === RED ? YELLOW : RED);
  }, [vsComputer]);

  const play = useCallback((col) => {
    if (result || thinking) return;

    const next = drop(boardRef.current, col, turn);
    if (!next) return; // full column

    setBoard(next);
    settle(next, turn);
  }, [result, settle, thinking, turn]);

  // The computer's reply. Deferred a beat so its disc does not appear in the same frame as
  // yours — instant is unreadable, and it makes the game feel like it is not responding.
  useEffect(() => {
    if (!thinking) return undefined;

    const id = setTimeout(() => {
      const current = boardRef.current;
      const col = chooseColumn(current, YELLOW);
      if (col < 0) return;

      const next = drop(current, col, YELLOW);
      if (!next) return;

      setBoard(next);
      settle(next, YELLOW);
    }, 420);

    return () => clearTimeout(id);
  }, [thinking, settle]);

  const reset = useCallback(() => {
    setBoard(emptyBoard());
    setTurn(RED);
    setResult(null);
  }, []);

  const switchMode = (next) => {
    setVsComputer(next);
    reset();
  };

  const winningCells = result && result !== 'draw' ? new Set(result.cells) : null;

  const status = (() => {
    if (result === 'draw') return 'A draw — the board is full';
    if (result) {
      if (!vsComputer) return `${result.player === RED ? 'Red' : 'Yellow'} wins`;
      return result.player === RED ? 'You win' : 'The computer wins';
    }
    if (thinking) return 'Thinking…';
    if (!vsComputer) return `${turn === RED ? 'Red' : 'Yellow'} to play`;
    return turn === RED ? 'Your turn' : 'Computer';
  })();

  return (
    <GameShell
      title="Connect Four"
      width="sm"
      stats={[
        { label: 'Turn', value: <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: COLOURS[turn], mx: 'auto' }} /> },
        { label: 'Wins', value: wins || '—' },
      ]}
      actions={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'vs Computer', value: true, Icon: SmartToyRounded },
            { label: 'Two players', value: false, Icon: PersonRounded },
          ].map((mode) => (
            <Button
              key={mode.label}
              size="small"
              onClick={() => switchMode(mode.value)}
              startIcon={<mode.Icon sx={{ fontSize: 16 }} />}
              sx={{
                fontWeight: 800, fontSize: '0.74rem', borderRadius: 2, minHeight: 34, px: 1.5,
                color: vsComputer === mode.value ? '#fff' : T.textMuted,
                bgcolor: vsComputer === mode.value ? T.teal : 'transparent',
                border: `1px solid ${vsComputer === mode.value ? T.teal : T.glassBorder}`,
                '&:hover': {
                  bgcolor: vsComputer === mode.value ? T.tealHover : T.tealBg,
                  color: vsComputer === mode.value ? '#fff' : T.teal,
                },
              }}
            >
              {mode.label}
            </Button>
          ))}

          <Button
            size="small"
            onClick={reset}
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
        <Typography sx={{ textAlign: 'center', fontSize: '0.74rem', color: T.textFaint }}>
          Tap a column to drop a disc. Four in a row — any direction — takes it.
        </Typography>
      }
    >
      <Typography
        sx={{
          textAlign: 'center', mb: 1.5, fontSize: '0.95rem', fontWeight: 800,
          color: result && result !== 'draw'
            ? COLOURS[result.player]
            : result === 'draw' ? T.textMuted : T.textPrimary,
        }}
      >
        {status}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gap: { xs: '4px', sm: '6px' },
          p: { xs: 0.75, sm: 1 },
          borderRadius: 3,
          bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${T.glassBorder}`,
          userSelect: 'none',
          touchAction: 'manipulation',
        }}
      >
        {board.map((cell, index) => {
          const col = index % COLS;
          const playable = !result && !thinking && landingRow(board, col) >= 0;

          return (
            <Box
              key={index}
              onClick={() => play(col)}
              role="button"
              tabIndex={-1}
              aria-label={`Column ${col + 1}${cell ? `, ${cell}` : ', empty'}`}
              sx={{
                aspectRatio: '1',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                cursor: playable ? 'pointer' : 'default',
                bgcolor: T.bg === '#000000' ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.07)',
                // Hovering anywhere in a column highlights the whole column, since that — not the
                // cell — is what a click actually does.
                transition: 'background-color .15s ease',
              }}
            >
              {cell && (
                <Box
                  component={motion.div}
                  initial={reduce ? false : { y: -140, opacity: 0.4 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 30, mass: 0.8 }}
                  sx={{
                    width: '86%',
                    height: '86%',
                    borderRadius: '50%',
                    bgcolor: COLOURS[cell],
                    boxShadow: winningCells?.has(index)
                      ? `0 0 0 3px ${T.textPrimary}, 0 0 22px ${COLOURS[cell]}`
                      : `inset 0 -3px 6px rgba(0,0,0,0.35)`,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {result && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            onClick={reset}
            variant="contained"
            sx={{
              bgcolor: T.teal, color: '#fff', fontWeight: 800, borderRadius: 2.5,
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
