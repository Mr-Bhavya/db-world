import { describe, expect, it } from 'vitest';
import { addRecent, MAX_RECENTS, parseRecents } from './searchRecents';
import { ownsCurrentEntry } from '@shared/hooks/useOverlayBack';

const item = (n) => ({ key: `k${n}`, group: 'IPO', label: `L${n}`, route: `/r/${n}` });

describe('addRecent', () => {
  it('puts the newest first and de-duplicates by key', () => {
    const list = addRecent(addRecent([], item(1)), item(2));
    expect(addRecent(list, item(1)).map((r) => r.key)).toEqual(['k1', 'k2']);
  });

  it('caps the list', () => {
    let list = [];
    for (let i = 0; i < MAX_RECENTS + 3; i += 1) list = addRecent(list, item(i));
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0].key).toBe(`k${MAX_RECENTS + 2}`);
  });

  it('stores only serialisable fields and ignores results without a route', () => {
    const [entry] = addRecent([], { ...item(1), Icon: () => null, accent: '#fff' });
    expect(entry).toEqual(item(1));
    expect(addRecent([item(1)], { key: 'x' })).toEqual([item(1)]);
  });
});

describe('parseRecents', () => {
  it('survives corrupt or foreign storage', () => {
    expect(parseRecents('not json')).toEqual([]);
    expect(parseRecents('{"a":1}')).toEqual([]);
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents(JSON.stringify([item(1), { key: 2 }, null]))).toEqual([item(1)]);
  });
});

describe('ownsCurrentEntry', () => {
  it('is true only while the browser entry still carries the overlay id', () => {
    expect(ownsCurrentEntry({ usr: { overlayStack: [3, 4] } }, 4)).toBe(true);
    // Closing with a navigation replaced or pushed past the overlay's entry: do not pop.
    expect(ownsCurrentEntry({ usr: null, key: 'abc', idx: 2 }, 4)).toBe(false);
    expect(ownsCurrentEntry(null, 4)).toBe(false);
  });
});
