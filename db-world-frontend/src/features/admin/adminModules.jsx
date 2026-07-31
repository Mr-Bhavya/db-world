/**
 * Admin module registry — the SINGLE source of truth for admin modules.
 * ---------------------------------------------------------------------
 * Adding a new admin module = ONE entry here. It automatically appears in:
 *   • the sidebar nav          (layout/AdminLayout.jsx)
 *   • the dashboard quick-nav   (dashboard/AdminDashboard.jsx)
 *   • the router                (app/App.jsx)
 *
 * No more editing three hardcoded lists that drift apart.
 *
 * Each entry: { id, path, label, icon, group, badge?, element }
 *   - icon:    an @mui/icons-material component (render as <icon />)
 *   - group:   sidebar section (see ADMIN_GROUPS for order)
 *   - badge:   'Live' | 'New' | 'requests' (dynamic pending count) | undefined
 *   - element: lazy() route component
 */
import { lazy } from 'react';
import {
  SpaceDashboardRounded, ManageAccountsRounded, MovieRounded, VideoLibraryRounded,
  MoveToInboxRounded, SellRounded, DownloadingRounded, InsightsRounded,
  MonitorHeartRounded, TerminalRounded, MemoryRounded, FolderRounded,
  ScheduleRounded, TuneRounded, WalletRounded, CandlestickChartRounded,
} from '@mui/icons-material';

// Section order in the sidebar. 'Overview' renders without a header label.
export const ADMIN_GROUPS = ['Overview', 'Content', 'Users', 'Insights', 'System', 'Apps'];

export const ADMIN_MODULES = [
  { id: 'dashboard',       path: 'dashboard',       label: 'Dashboard',           icon: SpaceDashboardRounded, group: 'Overview', element: lazy(() => import('./dashboard/AdminDashboard.jsx')) },

  // Content — the core catalog workflow, grouped together.
  { id: 'records',         path: 'records',         label: 'Records',             icon: MovieRounded,          group: 'Content',  element: lazy(() => import('./records')) },
  { id: 'media-files',     path: 'media-files',     label: 'Media Files',         icon: VideoLibraryRounded,   group: 'Content',  element: lazy(() => import('./mediafiles')) },
  { id: 'ingestion',       path: 'ingestion',        label: 'Media Ingestion',    icon: DownloadingRounded,    group: 'Content',  element: lazy(() => import('./ingestion')) },
  { id: 'tag-management',  path: 'tag-management',   label: 'Tags & Rails',        icon: SellRounded,           group: 'Content',  element: lazy(() => import('./tags')) },
  { id: 'requests',        path: 'requests',         label: 'Requests',           icon: MoveToInboxRounded,    group: 'Content',  element: lazy(() => import('./requests')) },

  // Users
  { id: 'users',           path: 'users',            label: 'User Management',     icon: ManageAccountsRounded, group: 'Users',    element: lazy(() => import('./users')) },

  // Insights
  { id: 'activity-center', path: 'activity-center',  label: 'Activity & Insights', icon: InsightsRounded,       group: 'Insights', element: lazy(() => import('./activity-center')) },

  // System / infrastructure
  { id: 'system-info',     path: 'system-info',      label: 'System Info',         icon: MonitorHeartRounded,   group: 'System',   element: lazy(() => import('./system-info')) },
  { id: 'logs',            path: 'logs',             label: 'Log Viewer',          icon: TerminalRounded,       group: 'System',   element: lazy(() => import('./logs/LogViewer.jsx')) },
  { id: 'redis',           path: 'redis',            label: 'Redis Cache',         icon: MemoryRounded,         group: 'System',   element: lazy(() => import('./redis')) },
  { id: 'files',           path: 'files',            label: 'File Manager',        icon: FolderRounded,         group: 'System',   element: lazy(() => import('./filemanager')) },
  { id: 'scheduler',       path: 'scheduler',        label: 'Scheduler',           icon: ScheduleRounded,       group: 'System',   element: lazy(() => import('./Scheduler/SchedulerPanel.jsx')) },
  { id: 'settings',        path: 'settings',         label: 'Settings',            icon: TuneRounded,           group: 'System',   element: lazy(() => import('./settings/SettingsPanel.jsx')) },

  // Standalone apps managed from admin
  { id: 'document-wallet', path: 'document-wallet',  label: 'Document Wallet',     icon: WalletRounded,         group: 'Apps',     element: lazy(() => import('./wallet')) },
  { id: 'ipo-admin',       path: 'ipo',              label: 'IPO Tracker',         icon: CandlestickChartRounded, group: 'Apps',   element: lazy(() => import('./ipo')) },
];

/** Modules grouped for the sidebar, in ADMIN_GROUPS order (empty groups dropped). */
export const groupedAdminModules = () =>
  ADMIN_GROUPS
    .map((group) => ({ group, items: ADMIN_MODULES.filter((m) => m.group === group) }))
    .filter((s) => s.items.length > 0);

/** Everything except the dashboard itself — for the dashboard's quick-nav grid. */
export const quickNavModules = () => ADMIN_MODULES.filter((m) => m.id !== 'dashboard');
