import {
  AccountBalanceWallet as WalletIcon,
  AdminPanelSettings as AdminIcon,
  MovieFilter as CinemaIcon,
  Shield as VaultIcon,
  ShowChart as IpoIcon,
  SportsEsports as ArcadeIcon,
  WbSunny as WeatherIcon,
} from '@mui/icons-material';

import Constants from '@shared/constants';

/**
 * The app registry. One entry per app, and the single source of every place an app is named: the
 * home dashboard's widgets, the header's Apps panel and drawer, and the command palette all read
 * from here, so adding an app is one edit.
 *
 * Ordered by product priority (IPO first), which is also the order a fresh dashboard lays tiles
 * out. Each entry carries its own identity — a distinct accent plus a matching gradient (no two
 * apps share a colour), a label, a one-line `tagline` for menus and a longer `description` used as
 * a widget's fallback when it has no live data.
 *
 * Accents are solid hex so they read correctly over both the AMOLED-dark and pure-white surfaces;
 * theme-dependent surfaces come from the `useT()` tokens at the render site, never hard-coded here.
 *
 * Widget sizing is NOT here — that lives in `dashboard/widgetRegistry`, because it is a property of
 * the tile rather than of the app, and the user overrides it anyway.
 */
export const APPS = [
  {
    id: 'ipo',
    label: 'IPO Radar',
    description: 'Track live GMP, subscription and allotment for every Indian IPO.',
    tagline: 'Live IPO tracker',
    Icon: IpoIcon,
    route: Constants.DB_IPO_ROUTE,
    adminOnly: false,
    accent: '#10b981',
    gradient: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
  },
  {
    id: 'cinema',
    label: 'Cinema',
    description: 'Stream movies, binge series and catch live channels.',
    tagline: 'Movies, series & live TV',
    Icon: CinemaIcon,
    route: Constants.DB_CINEMA_BROWSE_ROUTE,
    adminOnly: false,
    accent: '#ef4444',
    gradient: 'linear-gradient(135deg, #f87171 0%, #b91c1c 100%)',
  },
  {
    id: 'password',
    label: 'Vault',
    description: 'AES-256 encrypted password manager — only you hold the key.',
    tagline: 'Password manager',
    Icon: VaultIcon,
    route: Constants.DB_PASSWORD_MANAGER_ROUTE,
    adminOnly: false,
    accent: '#6366f1',
    gradient: 'linear-gradient(135deg, #818cf8 0%, #4338ca 100%)',
  },
  {
    id: 'wallet',
    label: 'Wallet',
    description: 'Keep Aadhaar, PAN, licence and more encrypted and handy.',
    tagline: 'Document wallet',
    Icon: WalletIcon,
    route: Constants.DB_WALLET_ROUTE,
    adminOnly: false,
    accent: '#14b8a6',
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%)',
  },
  {
    id: 'games',
    label: 'Arcade',
    description: 'Quick mini-games and high-score leaderboards.',
    tagline: 'Mini-games',
    Icon: ArcadeIcon,
    route: Constants.DB_GAMES_ROUTE,
    adminOnly: false,
    accent: '#a855f7',
    gradient: 'linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)',
  },
  {
    id: 'weather',
    label: 'Weather',
    description: 'Live conditions and forecasts for any location.',
    tagline: 'Live forecasts',
    Icon: WeatherIcon,
    route: Constants.DB_WEATHER_ROUTE,
    adminOnly: false,
    accent: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
  },
  {
    id: 'admin',
    label: 'Admin Console',
    description: 'Content and system administration.',
    tagline: 'Administration',
    Icon: AdminIcon,
    route: `${Constants.DB_ADMIN_BASE_ROUTE}/dashboard`,
    adminOnly: true,
    accent: '#f59e0b',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
  },
];

export const RECENT_KEY = 'dbworld_recent';
