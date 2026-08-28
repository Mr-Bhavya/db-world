import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import { clampTextSx } from '../../homeStyles';
import WidgetShell from '../WidgetShell';

/**
 * The games keep their high scores in localStorage — they are single-player and were never sent to
 * the server — so this widget reads them directly rather than going through the summary endpoint.
 * That also means it is the one tile that is fully live for a signed-out visitor.
 *
 * Every game is listed whether or not it has been played: a first-time visitor gets a menu they
 * can launch from instead of a tile telling them it has nothing to show yet.
 */
const GAMES = [
  { key: '2048_best', label: '2048', route: Constants.DB_GAMES_2048_ROUTE },
  { key: 'snake_best', label: 'Snake', route: Constants.DB_GAMES_SNAKE_ROUTE },
  { key: 'memory_best', label: 'Memory', route: Constants.DB_GAMES_MEMORY_MATCH_ROUTE },
  // Tic-tac-toe keeps no high score, so it has no storage key — it is here to be launched.
  { key: null, label: 'Tic-tac-toe', route: Constants.DB_GAMES_TIC_TAC_TOE_ROUTE },
];

const readBest = (key) => {
  if (typeof window === 'undefined' || !key) return 0;

  const value = Number.parseInt(localStorage.getItem(key) ?? '0', 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export default function ArcadeWidget({ widget, onNavigate, ...shell }) {
  const T = useT();

  // Played games first, so a returning player's scores are what they see; the rest follow as
  // things left to try.
  const games = useMemo(() => {
    const withScores = GAMES.map((game) => ({ ...game, best: readBest(game.key) }));
    return [
      ...withScores.filter((game) => game.best > 0).sort((a, b) => b.best - a.best),
      ...withScores.filter((game) => game.best === 0),
    ];
  }, []);

  const played = games.some((game) => game.best > 0);
  // A small tile is one grid row: three games fit, four clip. The section caption is dropped there
  // too — the tile is already titled "Arcade", so it was costing a row to repeat itself.
  const compact = widget.size === 'sm';
  const rows = games.slice(0, compact ? 3 : GAMES.length);

  return (
    <WidgetShell widget={widget} {...shell}>
      {!compact && (
        <Typography
          sx={{
            color: T.textMuted,
            fontSize: '0.62rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            mb: 0.5,
          }}
        >
          {played ? 'Your best' : 'Pick a game'}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
        {rows.map((game) => (
          <Box
            key={game.route}
            role="button"
            tabIndex={0}
            aria-label={`Play ${game.label}`}
            onClick={(event) => {
              event.stopPropagation();
              onNavigate?.(game.route);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onNavigate?.(game.route);
            }}
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 1,
              px: 0.75,
              py: 0.25,
              borderRadius: 1.2,
              cursor: 'pointer',
              minWidth: 0,
              '&:hover': { bgcolor: T.glassHover },
              '&:focus-visible': { outline: `2px solid ${widget.accent}`, outlineOffset: 1 },
            }}
          >
            <Typography
              sx={{ color: T.textMuted, fontSize: '0.74rem', fontWeight: 700, ...clampTextSx(1) }}
            >
              {game.label}
            </Typography>
            <Typography
              sx={{
                color: game.best > 0 ? widget.accent : T.textFaint,
                fontSize: game.best > 0 ? '0.86rem' : '0.7rem',
                fontWeight: game.best > 0 ? 900 : 700,
                flexShrink: 0,
              }}
            >
              {game.best > 0 ? game.best.toLocaleString() : 'Play'}
            </Typography>
          </Box>
        ))}
      </Box>
    </WidgetShell>
  );
}
