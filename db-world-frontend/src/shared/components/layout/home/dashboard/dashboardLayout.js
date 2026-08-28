/**
 * The dashboard's layout rules, as pure functions over a plain `{ order, sizes, hidden }` object.
 *
 * Kept out of the hook so the interesting behaviour — merging a saved order with a registry that
 * has since changed, moving a tile past hidden ones — is directly testable without a renderer.
 */

export const DASHBOARD_LAYOUT_KEY = 'dbworld_dashboard_v1';

/**
 * The three widget footprints, in grid columns × rows.
 *
 * Presets rather than free resize handles: a drag-corner is fiddly on a phone and lets a user
 * build a layout with holes in it, whereas cycling S → M → L keeps every arrangement valid and
 * works identically with a mouse, a finger and the keyboard.
 */
export const SIZES = ['sm', 'md', 'lg'];

export const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' };

export const EMPTY_LAYOUT = { order: [], sizes: {}, hidden: [] };

/** A hand-edited or half-written localStorage entry must not brick the hub. */
export const normaliseLayout = (stored) => ({
  order: Array.isArray(stored?.order) ? stored.order.filter((id) => typeof id === 'string') : [],
  sizes: stored?.sizes && typeof stored.sizes === 'object' && !Array.isArray(stored.sizes)
    ? stored.sizes
    : {},
  hidden: Array.isArray(stored?.hidden) ? stored.hidden.filter((id) => typeof id === 'string') : [],
});

/**
 * Merges the saved order with the widget registry.
 *
 * Saved order wins, then any widget the registry has gained since the user last saved is appended.
 * Widgets the registry has since dropped fall out, as do duplicates. This is what lets a new app
 * ship without every existing user having to reset their dashboard.
 */
export const mergeOrder = (savedOrder, widgets) => {
  const known = new Set(widgets.map((widget) => widget.id));
  const seen = new Set();

  const fromSaved = (savedOrder ?? []).filter((id) => {
    if (!known.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return [...fromSaved, ...widgets.map((widget) => widget.id).filter((id) => !seen.has(id))];
};

/** Only hidden ids that still exist in the registry — a stale one must not hide nothing forever. */
const hiddenSet = (layout, widgets) => {
  const known = new Set(widgets.map((widget) => widget.id));
  return new Set((layout.hidden ?? []).filter((id) => known.has(id)));
};

/** Ordered, visible widgets, each carrying the size the user chose (or the widget's default). */
export const resolveVisible = (layout, widgets) => {
  const hidden = hiddenSet(layout, widgets);
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));

  return mergeOrder(layout.order, widgets)
    .filter((id) => !hidden.has(id))
    .map((id) => {
      const widget = byId.get(id);
      const saved = layout.sizes?.[id];

      return { ...widget, size: SIZES.includes(saved) ? saved : widget.defaultSize };
    });
};

/** Hidden widgets, for the "add back" tray. */
export const resolveAvailable = (layout, widgets) => {
  const hidden = hiddenSet(layout, widgets);
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));

  return mergeOrder(layout.order, widgets)
    .filter((id) => hidden.has(id))
    .map((id) => byId.get(id))
    .filter(Boolean);
};

/**
 * Moves the widget at visible index `from` to visible index `to`.
 *
 * Both indices address the *visible* run, because that is what the user is looking at. They are
 * translated back to positions in the full order so hidden widgets keep their slot and reappear
 * where they were when un-hidden.
 */
export const applyMove = (layout, widgets, from, to) => {
  const merged = mergeOrder(layout.order, widgets);
  const hidden = hiddenSet(layout, widgets);
  const visibleIds = merged.filter((id) => !hidden.has(id));

  if (from === to) return layout;
  if (from < 0 || to < 0 || from >= visibleIds.length || to >= visibleIds.length) return layout;

  const reordered = [...visibleIds];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);

  let cursor = 0;
  const order = merged.map((id) => (hidden.has(id) ? id : reordered[cursor++]));

  return { ...layout, order };
};

export const applySize = (layout, id, size) =>
  SIZES.includes(size) ? { ...layout, sizes: { ...layout.sizes, [id]: size } } : layout;

/** Advances a widget one step through the footprints it allows, wrapping at the end. */
export const applyCycleSize = (layout, widgets, id) => {
  const widget = widgets.find((candidate) => candidate.id === id);
  if (!widget) return layout;

  const allowed = widget.sizes?.length ? widget.sizes : SIZES;
  const saved = layout.sizes?.[id];
  const current = allowed.includes(saved) ? saved : widget.defaultSize;
  const next = allowed[(allowed.indexOf(current) + 1) % allowed.length];

  return { ...layout, sizes: { ...layout.sizes, [id]: next } };
};

export const applyHidden = (layout, id, shouldHide) => {
  const hidden = new Set(layout.hidden ?? []);

  if (shouldHide) hidden.add(id);
  else hidden.delete(id);

  return { ...layout, hidden: [...hidden] };
};

/** Whether the user has touched anything — drives whether "Reset" is worth offering. */
export const isCustomised = (layout) =>
  (layout.order?.length ?? 0) > 0 ||
  (layout.hidden?.length ?? 0) > 0 ||
  Object.keys(layout.sizes ?? {}).length > 0;

/**
 * A footprint rule for widgets whose content depends on who is looking.
 *
 * Two cases a saved layout cannot anticipate:
 *   - signed out there is nothing to count and the tile shows a pitch instead, which needs more
 *     room than a figure did, not less — this is the site's best conversion surface;
 *   - signed in with an empty app there is genuinely nothing to show, and a large tile of nothing
 *     is worse than a small one.
 *
 * Applied only outside edit mode (see `Home`), so resizing a tile by hand still behaves.
 */
export const contentAwareSize = (isEmpty) => (size, { isAuthenticated, summary, isLoading } = {}) => {
  if (!isAuthenticated) return size === 'sm' ? 'md' : size;
  if (isLoading || !summary) return size;
  return isEmpty(summary) ? 'sm' : size;
};
