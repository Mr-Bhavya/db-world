import { describe, it, expect, beforeEach } from 'vitest';
import { useFileManagerStore } from './useFileManagerStore';

const items = [
  { path: '/a' },
  { path: '/b' },
  { path: '/c' },
  { path: '/d' },
  { path: '/e' },
];

const initialState = useFileManagerStore.getState();

describe('useFileManagerStore', () => {
  beforeEach(() => {
    useFileManagerStore.setState(
      { ...initialState, selection: new Set(), anchorId: null, clipboard: null },
      true
    );
  });

  it('toggleSelect additive toggles membership', () => {
    useFileManagerStore.getState().toggleSelect('/a', { additive: true });
    expect(useFileManagerStore.getState().selection.has('/a')).toBe(true);

    useFileManagerStore.getState().toggleSelect('/a', { additive: true });
    expect(useFileManagerStore.getState().selection.has('/a')).toBe(false);
  });

  it('additive toggle preserves other existing selections', () => {
    useFileManagerStore.getState().toggleSelect('/a', { additive: true });
    useFileManagerStore.getState().toggleSelect('/b', { additive: true });

    const sel = useFileManagerStore.getState().selection;
    expect([...sel].sort()).toEqual(['/a', '/b']);
  });

  it('selectAll fills selection from a list of items', () => {
    useFileManagerStore.getState().selectAll(items);

    const sel = useFileManagerStore.getState().selection;
    expect(sel.size).toBe(5);
    expect(sel.has('/c')).toBe(true);
  });

  it('clearSelection empties the selection and resets the anchor', () => {
    useFileManagerStore.getState().selectAll(items);
    useFileManagerStore.getState().clearSelection();

    expect(useFileManagerStore.getState().selection.size).toBe(0);
    expect(useFileManagerStore.getState().anchorId).toBeNull();
  });

  it('a plain (non-additive, non-range) toggle selects only that item and sets the anchor', () => {
    useFileManagerStore.getState().toggleSelect('/a', { additive: true });
    useFileManagerStore.getState().toggleSelect('/c', {});

    const state = useFileManagerStore.getState();
    expect([...state.selection]).toEqual(['/c']);
    expect(state.anchorId).toBe('/c');
  });

  it('range-select from an anchor selects the inclusive slice', () => {
    useFileManagerStore.getState().toggleSelect('/b', {}); // anchor = /b, selection = {/b}
    useFileManagerStore.getState().toggleSelect('/d', { range: true, items }); // extend to /b../d

    const sel = useFileManagerStore.getState().selection;
    expect([...sel].sort()).toEqual(['/b', '/c', '/d']);
  });

  it('range-select works backwards (target before anchor)', () => {
    useFileManagerStore.getState().toggleSelect('/d', {}); // anchor = /d
    useFileManagerStore.getState().toggleSelect('/b', { range: true, items });

    const sel = useFileManagerStore.getState().selection;
    expect([...sel].sort()).toEqual(['/b', '/c', '/d']);
  });

  it('range-select is additive on top of an existing selection when additive is also set', () => {
    useFileManagerStore.getState().toggleSelect('/a', { additive: true }); // pre-existing selection, anchor = /a
    useFileManagerStore.getState().toggleSelect('/b', {}); // new anchor = /b, selection = {/b}
    useFileManagerStore.getState().toggleSelect('/d', { range: true, additive: true, items });

    const sel = useFileManagerStore.getState().selection;
    expect([...sel].sort()).toEqual(['/b', '/c', '/d']);
  });

  it('setClipboard stores mode and items; clearClipboard resets it', () => {
    useFileManagerStore.getState().setClipboard('cut', items.slice(0, 2));
    expect(useFileManagerStore.getState().clipboard).toEqual({ mode: 'cut', items: items.slice(0, 2) });

    useFileManagerStore.getState().clearClipboard();
    expect(useFileManagerStore.getState().clipboard).toBeNull();
  });

  it('navigate resets selection and updates path', () => {
    useFileManagerStore.getState().selectAll(items);
    useFileManagerStore.getState().navigate('/sub');

    const state = useFileManagerStore.getState();
    expect(state.path).toBe('/sub');
    expect(state.selection.size).toBe(0);
  });

  it('setLocation resets path to root and clears selection', () => {
    useFileManagerStore.getState().navigate('/sub');
    useFileManagerStore.getState().selectAll(items);
    useFileManagerStore.getState().setLocation('loc-2');

    const state = useFileManagerStore.getState();
    expect(state.locationId).toBe('loc-2');
    expect(state.path).toBe('/');
    expect(state.selection.size).toBe(0);
  });
});
