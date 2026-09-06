import {
  Apps as QuickLaunchIcon,
  History as RecentIcon,
} from '@mui/icons-material';

import { APPS } from '../homeData';
import { contentAwareSize } from './dashboardLayout';

import AdminWidget from './widgets/AdminWidget';
import ArcadeWidget from './widgets/ArcadeWidget';
import CinemaWidget from './widgets/CinemaWidget';
import IpoWidget from './widgets/IpoWidget';
import QuickLaunchWidget from './widgets/QuickLaunchWidget';
import RecentWidget from './widgets/RecentWidget';
import VaultWidget from './widgets/VaultWidget';
import WalletWidget from './widgets/WalletWidget';
import WeatherWidget from './widgets/WeatherWidget';

/**
 * Which widget renders each app, and how big it starts.
 *
 * Keyed by app id so the accent, gradient, icon, label, route and description all keep coming from
 * the single app registry in `homeData` — a widget only adds the component and its sizing. An app
 * with no entry here still appears in Quick Launch, it just has no tile of its own.
 *
 * `sizes` narrows which footprints a widget may cycle through: the arcade and vault tiles have one
 * short list of figures and stretching them to a large tile only adds whitespace.
 */
const APP_WIDGETS = {
  ipo: { Component: IpoWidget, defaultSize: 'lg', sizes: ['md', 'lg'] },
  cinema: { Component: CinemaWidget, defaultSize: 'lg', sizes: ['md', 'lg'] },
  wallet: {
    Component: WalletWidget,
    defaultSize: 'md',
    sizes: ['sm', 'md'],
    resolveSize: contentAwareSize((summary) => (summary.wallet?.total ?? 0) === 0),
  },
  password: {
    Component: VaultWidget,
    // Medium by default so the add/generate shortcuts have somewhere to sit; `contentAwareSize`
    // still drops it to small for a signed-in user whose vault is empty.
    defaultSize: 'md',
    sizes: ['sm', 'md'],
    resolveSize: contentAwareSize((summary) => (summary.vault?.total ?? 0) === 0),
  },
  weather: { Component: WeatherWidget, defaultSize: 'sm', sizes: ['sm', 'md'] },
  games: { Component: ArcadeWidget, defaultSize: 'sm', sizes: ['sm', 'md'] },
  admin: { Component: AdminWidget, defaultSize: 'md', sizes: ['sm', 'md'] },
};

/**
 * Widgets that are not an app: they summarise the hub itself. They carry their own identity
 * because there is no entry in `homeData` to borrow one from.
 */
const UTILITY_WIDGETS = [
  {
    id: 'quick-launch',
    label: 'All apps',
    description: 'Jump straight into any app.',
    Icon: QuickLaunchIcon,
    Component: QuickLaunchWidget,
    accent: '#0d9488',
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)',
    defaultSize: 'md',
    sizes: ['md', 'lg'],
    adminOnly: false,
  },
  {
    id: 'recent',
    label: 'Recent',
    description: 'Where you left off.',
    Icon: RecentIcon,
    Component: RecentWidget,
    accent: '#64748b',
    gradient: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)',
    defaultSize: 'sm',
    sizes: ['sm', 'md'],
    adminOnly: false,
  },
];

/**
 * Every widget this user may see, in the order a fresh dashboard lays them out.
 *
 * Order matters only for a first visit — `useDashboardLayout` takes over once the user rearranges
 * anything, and appends any widget added here later to the end of their saved layout.
 */
export function buildWidgets(isAdmin) {
  const appWidgets = APPS.filter((app) => !app.adminOnly || isAdmin)
    .map((app) => {
      const widget = APP_WIDGETS[app.id];
      if (!widget) return null;

      return {
        id: app.id,
        label: app.label,
        description: app.description,
        Icon: app.Icon,
        accent: app.accent,
        gradient: app.gradient,
        route: app.route,
        adminOnly: app.adminOnly,
        ...widget,
      };
    })
    .filter(Boolean);

  // Quick Launch sits after the two headline apps rather than at the end: on a first visit it is
  // the tile that explains what the rest of the hub is.
  //
  // The rest are ordered widest-first so the default layout tiles the four-column grid without
  // relying on the grid's dense packing to tidy up after it.
  const [ipo, cinema, ...rest] = appWidgets;
  const [quickLaunch, recent] = UTILITY_WIDGETS;

  const bySize = { lg: 0, md: 1, sm: 2 };
  const remaining = [...rest].sort(
    (a, b) => (bySize[a.defaultSize] ?? 3) - (bySize[b.defaultSize] ?? 3)
  );

  return [ipo, cinema, quickLaunch, ...remaining, recent].filter(Boolean);
}

export default buildWidgets;
