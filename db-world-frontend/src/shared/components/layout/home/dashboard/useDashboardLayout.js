import { useCallback, useMemo, useState } from 'react';

import { safeJsonParse } from '../homeStorage';
import {
  DASHBOARD_LAYOUT_KEY,
  EMPTY_LAYOUT,
  applyCycleSize,
  applyHidden,
  applyMove,
  applySize,
  isCustomised as computeIsCustomised,
  normaliseLayout,
  resolveAvailable,
  resolveVisible,
} from './dashboardLayout';

export { SIZES, SIZE_LABELS, DASHBOARD_LAYOUT_KEY } from './dashboardLayout';

const read = () => {
  if (typeof window === 'undefined') return EMPTY_LAYOUT;

  return normaliseLayout(safeJsonParse(localStorage.getItem(DASHBOARD_LAYOUT_KEY), EMPTY_LAYOUT));
};

const write = (layout) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Private-mode / quota failures cost the user a persisted layout, not the page.
  }
};

/**
 * The user's dashboard arrangement: which widgets show, in what order, at what size.
 *
 * Kept in localStorage rather than on the server. It is a per-device display preference, it has to
 * work for signed-out visitors (who have nowhere to save it), and reading it synchronously on
 * mount avoids the layout shift a fetched layout would cause on every visit.
 *
 * All the rules live in `dashboardLayout.js`; this is the React shell around them.
 *
 * @param widgets the full registry, already filtered to what this user may see
 */
export default function useDashboardLayout(widgets) {
  const [layout, setLayout] = useState(read);

  const update = useCallback((mutate) => {
    setLayout((current) => {
      const next = mutate(current);
      if (next === current) return current;

      write(next);
      return next;
    });
  }, []);

  const visible = useMemo(() => resolveVisible(layout, widgets), [layout, widgets]);
  const available = useMemo(() => resolveAvailable(layout, widgets), [layout, widgets]);

  const move = useCallback(
    (from, to) => update((current) => applyMove(current, widgets, from, to)),
    [update, widgets]
  );

  const setSize = useCallback(
    (id, size) => update((current) => applySize(current, id, size)),
    [update]
  );

  const cycleSize = useCallback(
    (id) => update((current) => applyCycleSize(current, widgets, id)),
    [update, widgets]
  );

  const setHidden = useCallback(
    (id, shouldHide) => update((current) => applyHidden(current, id, shouldHide)),
    [update]
  );

  const reset = useCallback(() => update(() => EMPTY_LAYOUT), [update]);

  return {
    visible,
    available,
    move,
    setSize,
    cycleSize,
    setHidden,
    reset,
    isCustomised: computeIsCustomised(layout),
  };
}
