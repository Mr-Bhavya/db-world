import {
  Album as ConnectFourIcon,
  Apps as Icon2048,
  Flag as MinesweeperIcon,
  Grid3x3 as TicTacToeIcon,
  LinearScale as SnakeIcon,
  Style as MemoryIcon,
} from '@mui/icons-material';

import Constants from '@shared/constants';

/**
 * Every game, in one place.
 *
 * The arcade existed as two lists that had to agree by hand — one in the hub page, another in the
 * home dashboard's tile — so adding a game meant remembering both. Metadata only: deliberately no
 * component imports, or the hub's lazy chunks would be pulled into whatever imports this.
 *
 * Each entry owns how its own best score is stored and read. The games are single-player and were
 * never sent to the server, so this is all localStorage, and it is what makes the dashboard tile
 * the one that works fully signed out.
 */

const readNumber = (key) => {
  if (typeof window === 'undefined') return 0;

  const value = Number.parseInt(localStorage.getItem(key) ?? '0', 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

/** `m:ss`, for the games scored in time rather than points. */
export const formatSeconds = (total) => {
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
};

export const GAMES = [
  {
    id: '2048',
    title: '2048',
    description: 'Slide numbered tiles to combine them. Reach the 2048 tile to win — if you can.',
    Icon: Icon2048,
    route: Constants.DB_GAMES_2048_ROUTE,
    badge: 'Puzzle',
    accent: '#ec4899',
    readBest: () => {
      const best = readNumber('2048_best');
      return best ? { value: best, label: String(best) } : null;
    },
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    description: 'Clear the field without hitting a mine. Every number tells you how many touch it.',
    Icon: MinesweeperIcon,
    route: Constants.DB_GAMES_MINESWEEPER_ROUTE,
    badge: 'Logic',
    accent: '#38bdf8',
    // Timed, so the best run is the *fastest*. Beginner is the board everyone plays first, so it
    // is the one figure worth surfacing outside the game.
    readBest: () => {
      const best = readNumber('minesweeper_best_beginner');
      return best ? { value: best, label: formatSeconds(best) } : null;
    },
  },
  {
    id: 'connect-four',
    title: 'Connect Four',
    description: 'Drop discs to line up four. Play a friend on one screen, or take on the computer.',
    Icon: ConnectFourIcon,
    route: Constants.DB_GAMES_CONNECT_FOUR_ROUTE,
    badge: '1–2 Players',
    accent: '#f59e0b',
    readBest: () => {
      const wins = readNumber('connect_four_wins');
      return wins ? { value: wins, label: `${wins} win${wins === 1 ? '' : 's'}` } : null;
    },
  },
  {
    id: 'snake',
    title: 'Snake',
    description: "Guide the snake to eat food and grow longer. Don't hit the walls or yourself.",
    Icon: SnakeIcon,
    route: Constants.DB_GAMES_SNAKE_ROUTE,
    badge: 'Arcade',
    accent: '#10b981',
    readBest: () => {
      const best = readNumber('snake_best');
      return best ? { value: best, label: String(best) } : null;
    },
  },
  {
    id: 'memory',
    title: 'Memory Match',
    description: 'Flip cards to find matching pairs. Sixteen cards, eight pairs, as few moves as you can.',
    Icon: MemoryIcon,
    route: Constants.DB_GAMES_MEMORY_MATCH_ROUTE,
    badge: 'Memory',
    accent: '#a855f7',
    readBest: () => {
      const best = readNumber('memory_best');
      return best ? { value: best, label: `${best} moves` } : null;
    },
  },
  {
    id: 'tictactoe',
    title: 'Tic Tac Toe',
    description: 'The classic. Place X and O on a 3×3 grid; first to line up three takes it.',
    Icon: TicTacToeIcon,
    route: Constants.DB_GAMES_TIC_TAC_TOE_ROUTE,
    badge: '2 Players',
    accent: '#6366f1',
    // Nothing to beat — it is two people at one screen, and a draw is the skilled outcome.
    readBest: () => null,
  },
];
