/**
 * Admin UI kit — barrel. Import everything from '@features/admin/adminUi'.
 *
 * Building a new admin module? Start here:
 *   <AdminPage title="…" icon={SomeIcon} onRefresh={refetch}>
 *     <StatGrid>…<StatCard/>…</StatGrid>
 *     <SectionCard title="…"> <AdminDataTable rows={…} columns={…} loading={…} /> </SectionCard>
 *   </AdminPage>
 * Then add ONE entry to features/admin/adminModules.jsx — it auto-wires the
 * sidebar, dashboard quick-nav, and route.
 */
export {
  AdminPage, PageHeader, SectionCard, StatCard, StatGrid, AdminActionButton, StickyBar,
  EmptyState, ErrorState, LoadingState, TableSkeleton,
} from './primitives';
export { AdminDataTable } from './AdminDataTable';
export { useAdminMuiTheme, adminSurface } from './theme';
export { useAdminHeader, useAdminHeaderValue } from './adminHeader';
export { useSwipeNav } from './useSwipeNav';
