import { describe, it, expect } from 'vitest';
import {
  allSettings, asBool, asText, clampNumeric, filterCategories,
  isModified, matchesQuery, pendingChanges,
} from './settingsUtils';

const setting = (over = {}) => ({
  key: 'tracking.enabled',
  label: 'Tracking enabled',
  description: 'Master flag — gates all live tracking writes.',
  valueType: 'BOOLEAN',
  value: 'true',
  defaultValue: 'true',
  ...over,
});

const categories = [
  {
    category: 'Activity Tracking',
    settings: [
      setting(),
      setting({ key: 'tracking.batch-tick-ms', label: 'Batch tick (ms)', description: 'Shipper flush cadence.', valueType: 'LONG', value: '9000', defaultValue: '5000' }),
    ],
  },
  {
    category: 'IPO Tracker',
    settings: [
      setting({ key: 'ipo.sources.enabled', label: 'Enabled sources', description: 'Comma-separated keys.', valueType: 'STRING', value: 'ipoguru,nse', defaultValue: 'ipoguru,nse' }),
    ],
  },
];

describe('asText / asBool', () => {
  it('normalises null and undefined to an empty string', () => {
    expect(asText(null)).toBe('');
    expect(asText(undefined)).toBe('');
    expect(asText(0)).toBe('0');
  });

  it('reads the server’s string booleans', () => {
    expect(asBool('true')).toBe(true);
    expect(asBool(true)).toBe(true);
    expect(asBool('false')).toBe(false);
    expect(asBool('')).toBe(false);
  });
});

describe('isModified', () => {
  it('compares as strings, so 5 and "5" are the same value', () => {
    expect(isModified({ value: 5, defaultValue: '5' })).toBe(false);
    expect(isModified({ value: '9000', defaultValue: '5000' })).toBe(true);
  });

  it('treats a missing value as unmodified when the default is also absent', () => {
    expect(isModified({})).toBe(false);
  });
});

describe('matchesQuery', () => {
  const s = setting({ key: 'ingestion.storyboard.enabled', label: 'Storyboard generation', description: 'Scrub-bar preview sprite.' });

  it('matches on the config key, not just the label', () => {
    expect(matchesQuery(s, 'storyboard.enabled')).toBe(true);
  });

  it('matches on label and description, case-insensitively', () => {
    expect(matchesQuery(s, 'STORYBOARD')).toBe(true);
    expect(matchesQuery(s, 'scrub-bar')).toBe(true);
  });

  it('an empty or whitespace query matches everything', () => {
    expect(matchesQuery(s, '')).toBe(true);
    expect(matchesQuery(s, '   ')).toBe(true);
  });

  it('rejects a non-match', () => {
    expect(matchesQuery(s, 'weather')).toBe(false);
  });
});

describe('filterCategories', () => {
  it('returns everything when unfiltered', () => {
    expect(allSettings(filterCategories(categories))).toHaveLength(3);
  });

  it('drops categories left empty, so the rail never offers a dead entry', () => {
    const out = filterCategories(categories, { query: 'ipo' });
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('IPO Tracker');
  });

  it('modifiedOnly keeps just the non-default settings', () => {
    const out = filterCategories(categories, { modifiedOnly: true });
    expect(allSettings(out).map((s) => s.key)).toEqual(['tracking.batch-tick-ms']);
  });

  it('combines the query and the modified filter', () => {
    expect(filterCategories(categories, { query: 'ipo', modifiedOnly: true })).toHaveLength(0);
  });

  it('tolerates a missing or empty list', () => {
    expect(filterCategories(undefined)).toEqual([]);
    expect(filterCategories([{ category: 'X' }])).toEqual([]);
  });
});

describe('pendingChanges', () => {
  it('reports a draft that differs from the saved value', () => {
    expect(pendingChanges(categories, { 'tracking.batch-tick-ms': '7000' }))
      .toEqual([{ key: 'tracking.batch-tick-ms', value: '7000' }]);
  });

  /** Typing a value and typing it back is not a pending change. */
  it('ignores a draft that matches the saved value', () => {
    expect(pendingChanges(categories, { 'tracking.batch-tick-ms': '9000' })).toEqual([]);
  });

  it('ignores drafts for keys that no longer exist', () => {
    expect(pendingChanges(categories, { 'gone.away': 'x' })).toEqual([]);
  });

  it('keeps an explicitly empty draft, which is a real edit', () => {
    expect(pendingChanges(categories, { 'ipo.sources.enabled': '' }))
      .toEqual([{ key: 'ipo.sources.enabled', value: '' }]);
  });

  it('handles no drafts at all', () => {
    expect(pendingChanges(categories, {})).toEqual([]);
    expect(pendingChanges(categories, undefined)).toEqual([]);
  });
});

describe('clampNumeric', () => {
  const n = { valueType: 'INTEGER', minValue: 1, maxValue: 64 };

  it('clamps to the catalog bounds', () => {
    expect(clampNumeric(n, '100')).toBe('64');
    expect(clampNumeric(n, '0')).toBe('1');
    expect(clampNumeric(n, '8')).toBe('8');
  });

  it('leaves non-numeric settings and empty input alone', () => {
    expect(clampNumeric({ valueType: 'STRING' }, '100')).toBe('100');
    expect(clampNumeric(n, '')).toBe('');
  });

  it('leaves unparseable input for the field to reject', () => {
    expect(clampNumeric(n, 'abc')).toBe('abc');
  });

  it('does not invent bounds that the catalog did not set', () => {
    expect(clampNumeric({ valueType: 'INTEGER' }, '99999')).toBe('99999');
  });
});
