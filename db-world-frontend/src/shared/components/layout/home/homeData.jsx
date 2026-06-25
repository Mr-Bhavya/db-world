import {
  AdminPanelSettings as AdminIcon,
  Lock as PasswordIcon,
  MovieFilter as CinemaIcon,
  SportsEsports as GamesIcon,
  WbSunny as WeatherIcon,
} from '@mui/icons-material';

import Constants from '@shared/constants';

export const APPS = [
  {
    id: 'cinema',
    label: 'DB Cinema',
    description: 'Browse movies, series, and streams',
    Icon: CinemaIcon,
    route: Constants.DB_CINEMA_BROWSE_ROUTE,
    adminOnly: false,
    accent: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
  },
  {
    id: 'weather',
    label: 'DB Weather',
    description: 'Live weather for any location',
    Icon: WeatherIcon,
    route: Constants.DB_WEATHER_ROUTE,
    adminOnly: false,
    accent: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
  },
  {
    id: 'games',
    label: 'DB Games',
    description: 'Mini-games and leaderboards',
    Icon: GamesIcon,
    route: Constants.DB_GAMES_ROUTE,
    adminOnly: false,
    accent: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
  },
  {
    id: 'password',
    label: 'Password Manager',
    description: 'Secure credential vault',
    Icon: PasswordIcon,
    route: Constants.DB_PASSWORD_MANAGER_ROUTE,
    adminOnly: false,
    accent: '#0d9488',
    gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
  },
  {
    id: 'admin',
    label: 'Admin Console',
    description: 'Content and system administration',
    Icon: AdminIcon,
    route: `${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`,
    adminOnly: true,
    accent: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  },
];

export const RECENT_KEY = 'dbworld_recent';
export const FAVORITES_KEY = 'dbworld_favorites';
