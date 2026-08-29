import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

import { GAMES } from '@features/games/gamesData';
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
 *
 * The list comes from the arcade's own registry, so adding a game no longer means remembering to
 * add it here too. Each entry knows how to read and format its own best — they are scored in
 * points, moves, seconds and wins, which is also why they are not sorted against each other.
 */

export default function ArcadeWidget({ widget, onNavigate, ...shell }) {
  const T = useT();

  // Played games first, so a returning player's scores are what they see; the rest follow as
  // things left to try. Within each group the registry's own order stands — comparing a 2048
  // score against a Minesweeper time would be sorting on numbers that mean different things.
  const games = useMemo(() => {
    const withScores = GAMES.map((game) => ({ ...game, best: game.readBest() }));
    return [
      ...withScores.filter((game) => game.best),
      ...withScores.filter((game) => !game.best),
    ];
  }, []);

  const played = games.some((game) => game.best);
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
            aria-label={`Play ${game.title}`}
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
              {game.title}
            </Typography>
            <Typography
              sx={{
                color: game.best ? widget.accent : T.textFaint,
                fontSize: game.best ? '0.86rem' : '0.7rem',
                fontWeight: game.best ? 900 : 700,
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {game.best ? game.best.label : 'Play'}
            </Typography>
          </Box>
        ))}
      </Box>
    </WidgetShell>
  );
}
