import { describe, it, expect } from 'vitest';

import {
  EMPTY_LAYOUT,
  contentAwareSize,
  applyCycleSize,
  applyHidden,
  applyMove,
  applySize,
  isCustomised,
  mergeOrder,
  normaliseLayout,
  resolveAvailable,
  resolveVisible,
} from './dashboardLayout';

const widget = (id, defaultSize = 'sm', sizes) => ({ id, defaultSize, ...(sizes ? { sizes } : {}) });

const WIDGETS = [
  widget('ipo', 'lg', ['md', 'lg']),
  widget('cinema', 'lg', ['md', 'lg']),
  widget('wallet', 'md', ['sm', 'md']),
  widget('vault', 'sm'),
];

const ids = (list) => list.map((item) => item.id);

describe('normaliseLayout', () => {
  it('accepts a well-formed layout unchanged', () => {
    const layout = { order: ['a', 'b'], sizes: { a: 'lg' }, hidden: ['b'] };
    expect(normaliseLayout(layout)).toEqual(layout);
  });

  it.each([null, undefined, 42, 'nonsense', []])('survives garbage in localStorage: %s', (stored) => {
    expect(normaliseLayout(stored)).toEqual(EMPTY_LAYOUT);
  });

  it('drops non-string ids rather than letting them reach the registry lookup', () => {
    expect(normaliseLayout({ order: ['a', 7, null, 'b'], hidden: [{}, 'c'] })).toEqual({
      order: ['a', 'b'],
      sizes: {},
      hidden: ['c'],
    });
  });

  it('rejects an array where the sizes map is expected', () => {
    expect(normaliseLayout({ sizes: ['lg'] }).sizes).toEqual({});
  });
});

describe('mergeOrder', () => {
  it('falls back to registry order when nothing is saved', () => {
    expect(mergeOrder([], WIDGETS)).toEqual(['ipo', 'cinema', 'wallet', 'vault']);
  });

  it('keeps the saved arrangement', () => {
    expect(mergeOrder(['vault', 'ipo', 'cinema', 'wallet'], WIDGETS))
      .toEqual(['vault', 'ipo', 'cinema', 'wallet']);
  });

  /** The reason a new app can ship without resetting anyone's dashboard. */
  it('appends widgets the registry has gained since the layout was saved', () => {
    expect(mergeOrder(['vault', 'ipo'], WIDGETS)).toEqual(['vault', 'ipo', 'cinema', 'wallet']);
  });

  it('drops widgets the registry no longer has', () => {
    expect(mergeOrder(['ipo', 'retired-app', 'vault'], WIDGETS))
      .toEqual(['ipo', 'vault', 'cinema', 'wallet']);
  });

  it('de-duplicates a repeated id', () => {
    expect(mergeOrder(['ipo', 'ipo', 'vault'], WIDGETS)).toEqual(['ipo', 'vault', 'cinema', 'wallet']);
  });
});

describe('resolveVisible', () => {
  it('gives each widget its default size when the user has not chosen one', () => {
    expect(resolveVisible(EMPTY_LAYOUT, WIDGETS).map((w) => w.size)).toEqual(['lg', 'lg', 'md', 'sm']);
  });

  it('prefers a saved size', () => {
    const layout = { ...EMPTY_LAYOUT, sizes: { ipo: 'md' } };
    expect(resolveVisible(layout, WIDGETS)[0].size).toBe('md');
  });

  it('ignores a saved size that is not a real footprint', () => {
    const layout = { ...EMPTY_LAYOUT, sizes: { ipo: 'enormous' } };
    expect(resolveVisible(layout, WIDGETS)[0].size).toBe('lg');
  });

  it('omits hidden widgets', () => {
    const layout = { ...EMPTY_LAYOUT, hidden: ['cinema'] };
    expect(ids(resolveVisible(layout, WIDGETS))).toEqual(['ipo', 'wallet', 'vault']);
  });

  /** An admin-only widget hidden while signed in as admin must not vanish from a viewer's tray. */
  it('ignores a hidden id the registry no longer offers', () => {
    const layout = { ...EMPTY_LAYOUT, hidden: ['admin'] };
    expect(ids(resolveVisible(layout, WIDGETS))).toEqual(['ipo', 'cinema', 'wallet', 'vault']);
  });
});

describe('resolveAvailable', () => {
  it('is empty when nothing is hidden', () => {
    expect(resolveAvailable(EMPTY_LAYOUT, WIDGETS)).toEqual([]);
  });

  it('lists exactly the hidden widgets', () => {
    const layout = { ...EMPTY_LAYOUT, hidden: ['wallet', 'ipo'] };
    expect(ids(resolveAvailable(layout, WIDGETS))).toEqual(['ipo', 'wallet']);
  });
});

describe('applyMove', () => {
  it('moves a widget forward', () => {
    const moved = applyMove(EMPTY_LAYOUT, WIDGETS, 0, 2);
    expect(ids(resolveVisible(moved, WIDGETS))).toEqual(['cinema', 'wallet', 'ipo', 'vault']);
  });

  it('moves a widget backward', () => {
    const moved = applyMove(EMPTY_LAYOUT, WIDGETS, 3, 0);
    expect(ids(resolveVisible(moved, WIDGETS))).toEqual(['vault', 'ipo', 'cinema', 'wallet']);
  });

  it('is a no-op when the source and target are the same', () => {
    expect(applyMove(EMPTY_LAYOUT, WIDGETS, 1, 1)).toBe(EMPTY_LAYOUT);
  });

  it.each([
    [-1, 0],
    [0, -1],
    [0, 9],
    [9, 0],
  ])('ignores an out-of-range move (%s → %s)', (from, to) => {
    expect(applyMove(EMPTY_LAYOUT, WIDGETS, from, to)).toBe(EMPTY_LAYOUT);
  });

  /**
   * Indices address the visible run, but the saved order holds hidden widgets too. If the two were
   * confused, dragging past a hidden widget would land on the wrong tile — and un-hiding it later
   * would put it somewhere the user never left it.
   */
  it('reorders around a hidden widget without disturbing its slot', () => {
    const layout = { ...EMPTY_LAYOUT, hidden: ['cinema'] };

    // Visible run is [ipo, wallet, vault]; move ipo to the end of it.
    const moved = applyMove(layout, WIDGETS, 0, 2);

    expect(ids(resolveVisible(moved, WIDGETS))).toEqual(['wallet', 'vault', 'ipo']);
    expect(moved.order[1]).toBe('cinema');

    // Un-hiding restores it to the same slot it occupied throughout.
    const shown = applyHidden(moved, 'cinema', false);
    expect(ids(resolveVisible(shown, WIDGETS))).toEqual(['wallet', 'cinema', 'vault', 'ipo']);
  });
});

describe('applySize', () => {
  it('records the chosen footprint', () => {
    expect(applySize(EMPTY_LAYOUT, 'ipo', 'md').sizes).toEqual({ ipo: 'md' });
  });

  it('rejects a footprint that does not exist', () => {
    expect(applySize(EMPTY_LAYOUT, 'ipo', 'huge')).toBe(EMPTY_LAYOUT);
  });
});

describe('applyCycleSize', () => {
  it('steps through the sizes a widget allows and wraps', () => {
    let layout = applyCycleSize(EMPTY_LAYOUT, WIDGETS, 'ipo'); // lg → md (wraps within [md, lg])
    expect(layout.sizes.ipo).toBe('md');

    layout = applyCycleSize(layout, WIDGETS, 'ipo');
    expect(layout.sizes.ipo).toBe('lg');
  });

  it('falls back to the full size list when a widget names none', () => {
    const layout = applyCycleSize(EMPTY_LAYOUT, WIDGETS, 'vault'); // sm → md
    expect(layout.sizes.vault).toBe('md');
  });

  it('ignores an unknown widget', () => {
    expect(applyCycleSize(EMPTY_LAYOUT, WIDGETS, 'nope')).toBe(EMPTY_LAYOUT);
  });

  /** A stale saved size outside the allowed list must not strand the cycle. */
  it('restarts from the default when the saved size is no longer allowed', () => {
    const layout = { ...EMPTY_LAYOUT, sizes: { ipo: 'sm' } };
    expect(applyCycleSize(layout, WIDGETS, 'ipo').sizes.ipo).toBe('md');
  });
});

describe('applyHidden', () => {
  it('hides and un-hides', () => {
    const hiddenLayout = applyHidden(EMPTY_LAYOUT, 'vault', true);
    expect(hiddenLayout.hidden).toEqual(['vault']);
    expect(applyHidden(hiddenLayout, 'vault', false).hidden).toEqual([]);
  });

  it('does not add the same id twice', () => {
    const once = applyHidden(EMPTY_LAYOUT, 'vault', true);
    expect(applyHidden(once, 'vault', true).hidden).toEqual(['vault']);
  });
});

describe('isCustomised', () => {
  it('is false for a fresh layout', () => {
    expect(isCustomised(EMPTY_LAYOUT)).toBe(false);
  });

  it.each([
    ['order', applyMove(EMPTY_LAYOUT, WIDGETS, 0, 1)],
    ['sizes', applySize(EMPTY_LAYOUT, 'ipo', 'md')],
    ['hidden', applyHidden(EMPTY_LAYOUT, 'ipo', true)],
  ])('is true once %s has been touched', (_field, layout) => {
    expect(isCustomised(layout)).toBe(true);
  });
});

describe('contentAwareSize', () => {
  const walletIsEmpty = contentAwareSize((summary) => (summary.wallet?.total ?? 0) === 0);

  /** Signed out the tile pitches instead of counting, and a pitch needs more room than a figure. */
  it('grows a small tile for the signed-out pitch', () => {
    expect(walletIsEmpty('sm', { isAuthenticated: false })).toBe('md');
  });

  it('leaves a larger tile alone when signed out', () => {
    expect(walletIsEmpty('md', { isAuthenticated: false })).toBe('md');
    expect(walletIsEmpty('lg', { isAuthenticated: false })).toBe('lg');
  });

  it('shrinks to small when the signed-in user has nothing stored', () => {
    expect(walletIsEmpty('md', { isAuthenticated: true, summary: { wallet: { total: 0 } } }))
      .toBe('sm');
  });

  it('keeps the chosen size once there is something to show', () => {
    expect(walletIsEmpty('md', { isAuthenticated: true, summary: { wallet: { total: 3 } } }))
      .toBe('md');
  });

  /** Shrinking mid-load would make the tile jump the moment the summary arrived. */
  it('does not shrink while the summary is still loading', () => {
    expect(walletIsEmpty('md', { isAuthenticated: true, isLoading: true })).toBe('md');
    expect(walletIsEmpty('md', { isAuthenticated: true, summary: null })).toBe('md');
  });

  /** A failed summary drops the section entirely; that is missing data, not an empty wallet. */
  it('treats a missing section as empty only when the summary itself arrived', () => {
    expect(walletIsEmpty('md', { isAuthenticated: true, summary: {} })).toBe('sm');
  });
});
