import { Suspense } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import GroupLayout from './components/GroupLayout';
import ExpenseRowSkeleton from './components/ExpenseRowSkeleton';

/**
 * The one page the three group tabs are.
 *
 * <h2>Why this exists</h2>
 * Expenses, Report and History were three <em>top-level</em> routes, each lazily loaded and all
 * three sharing the app's one Suspense boundary. So every tab click unmounted the entire page,
 * put the app-wide loading bar over it while the chunk downloaded, and then built the header,
 * the balance card and the tab bar again from scratch — entry animations and all — before
 * scrolling you back to the top. Making the three share a layout component was never going to
 * fix that on its own: a fresh instance of shared chrome is still a fresh instance.
 *
 * <p>A layout route fixes it properly. The chrome is mounted once by this component and the tabs
 * are its children, so switching swaps only what is inside {@link Outlet} — the header does not
 * blink, the balance does not re-animate, and a tab whose chunk is still downloading falls into
 * the small boundary below instead of the app-wide one.
 *
 * <p>Which tab is current comes from the URL rather than a prop, because the router owns that
 * fact and a prop would be a second copy of it that can disagree.
 */
export default function TallyGroupShell() {
  const { groupId } = useParams();
  const { pathname } = useLocation();

  // The last segment: the group id itself on the expenses tab, "report" or "history" otherwise.
  // filter(Boolean) so a trailing slash does not make the last segment an empty string.
  const last = pathname.split('/').filter(Boolean).pop();
  const active = last === 'report' || last === 'history' ? last : 'expenses';

  return (
    <GroupLayout groupId={groupId} active={active}>
      {/* Its own boundary, inside the chrome. Without one the nearest boundary above a
          suspending tab is the app's, which replaces the whole page — which is the thing this
          file exists to stop. */}
      <Suspense fallback={<TabLoading />}>
        <Outlet />
      </Suspense>
    </GroupLayout>
  );
}

/** Rows, because whichever tab is arriving, something list-shaped is arriving. */
function TabLoading() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: 4 }, (_, i) => <ExpenseRowSkeleton key={i} />)}
    </Box>
  );
}
