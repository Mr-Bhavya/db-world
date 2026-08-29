import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import GameShell from './GameShell';

const EMPTY  = null;
const WINS   = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function checkWinner(board) {
  for (const [a,b,c] of WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line: [a,b,c] };
  }
  if (board.every(Boolean)) return { winner: 'draw', line: [] };
  return null;
}

const TicTacToe = () => {
  usePageMeta('Tic Tac Toe — DB Games', { exact: true });

  const T        = useT();
  const [board, setBoard]   = useState(Array(9).fill(EMPTY));
  const [xIsNext, setX]     = useState(true);
  const [result, setResult] = useState(null);

  const handleClick = (i) => {
    if (board[i] || result) return;
    const next = board.slice();
    next[i] = xIsNext ? 'X' : 'O';
    const res = checkWinner(next);
    setBoard(next);
    setX(!xIsNext);
    if (res) setResult(res);
  };

  const reset = () => { setBoard(Array(9).fill(EMPTY)); setX(true); setResult(null); };

  const xColor   = '#6366f1';
  const oColor   = '#ec4899';
  const winLine  = result?.line ?? [];

  const statusText = result
    ? result.winner === 'draw'
      ? "It's a Draw!"
      : `Player ${result.winner} Wins!`
    : `Player ${xIsNext ? 'X' : 'O'}'s turn`;

  const statusColor = result
    ? result.winner === 'draw' ? T.teal : result.winner === 'X' ? xColor : oColor
    : xIsNext ? xColor : oColor;

  return (
    <GameShell title="Tic Tac Toe" width="xs" stats={[]}>
            {/* Title */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              {/* Player labels */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: xColor }} />
                  <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>Player X</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: oColor }} />
                  <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>Player O</Typography>
                </Box>
              </Box>
              <AnimatePresence mode="wait">
                <motion.div
                  key={statusText}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: statusColor }}>
                    {statusText}
                  </Typography>
                </motion.div>
              </AnimatePresence>
            </Box>

            {/* Board */}
            <Box sx={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1, mb: 3,
            }}>
              {board.map((cell, i) => {
                const isWinCell = winLine.includes(i);
                const cellColor = cell === 'X' ? xColor : oColor;
                return (
                  <motion.div
                    key={i}
                    whileHover={!cell && !result ? { scale: 1.04 } : {}}
                    whileTap={!cell && !result ? { scale: 0.96 } : {}}
                  >
                    <Box
                      onClick={() => handleClick(i)}
                      sx={{
                        aspectRatio: '1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 2,
                        bgcolor: isWinCell ? `${cellColor}18` : 'rgba(255,255,255,0.03)',
                        border: `2px solid ${isWinCell ? cellColor : T.glassBorder}`,
                        cursor: cell || result ? 'default' : 'pointer',
                        fontSize: '2rem', fontWeight: 900,
                        color: cell ? cellColor : 'transparent',
                        transition: 'all 0.15s',
                        '&:hover': (!cell && !result) ? {
                          bgcolor: 'rgba(255,255,255,0.06)',
                          borderColor: 'rgba(255,255,255,0.2)',
                        } : {},
                        boxShadow: isWinCell ? `0 0 16px ${cellColor}44` : 'none',
                      }}
                    >
                      <AnimatePresence>
                        {cell && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          >
                            {cell}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Box>
                  </motion.div>
                );
              })}
            </Box>

            {/* Reset */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                startIcon={<Refresh />}
                onClick={reset}
                variant="outlined"
                sx={{
                  borderColor: T.glassBorder, color: T.textMuted,
                  '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: 'rgba(13,148,136,0.06)' },
                }}
              >
                New Game
              </Button>
            </Box>
    </GameShell>
  );
};

export default TicTacToe;
