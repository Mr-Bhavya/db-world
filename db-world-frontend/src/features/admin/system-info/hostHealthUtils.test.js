import { describe, it, expect } from 'vitest';
import {
  columnsForWidth, distributeGroups, formatAge, formatInterval, groupChecks, normalizeStatus, statusRank,
} from './hostHealthUtils';

const check = (id, group, status) => ({ id, group, name: id, status, value: '', detail: '', hint: '' });

describe('normalizeStatus', () => {
  it('keeps the four known states', () => {
    expect(['ok', 'warn', 'fail', 'unknown'].map(normalizeStatus)).toEqual(['ok', 'warn', 'fail', 'unknown']);
  });

  it('reads anything else as unknown', () => {
    expect(normalizeStatus('degraded')).toBe('unknown');
    expect(normalizeStatus(undefined)).toBe('unknown');
    // Not a prototype key either.
    expect(normalizeStatus('toString')).toBe('unknown');
  });

  it('ranks fail before warn before unknown before ok', () => {
    expect(['ok', 'unknown', 'warn', 'fail'].sort((a, b) => statusRank(a) - statusRank(b)))
      .toEqual(['fail', 'warn', 'unknown', 'ok']);
  });
});

describe('groupChecks', () => {
  it('puts fail and warn rows first within a group, otherwise keeping report order', () => {
    const [disks] = groupChecks([
      check('disk.root', 'Disks', 'ok'),
      check('disk.hdd', 'Disks', 'warn'),
      check('disk.boot', 'Disks', 'ok'),
      check('smart.hdd', 'Disks', 'fail'),
    ]);
    expect(disks.checks.map((c) => c.id)).toEqual(['smart.hdd', 'disk.hdd', 'disk.root', 'disk.boot']);
    expect(disks.worst).toBe('fail');
  });

  it('orders groups by their worst check, then by the fixed group order', () => {
    const groups = groupChecks([
      check('hw.temp', 'Hardware', 'ok'),
      check('disk.root', 'Disks', 'ok'),
      check('backup.db', 'Backups', 'fail'),
      check('updates.security', 'Security', 'warn'),
      check('net.dns', 'Network', 'ok'),
    ]);
    expect(groups.map((g) => g.group)).toEqual(['Backups', 'Security', 'Disks', 'Hardware', 'Network']);
  });

  it('files a check without a group under System, and unknown groups after the known ones', () => {
    const groups = groupChecks([
      check('x', 'Zigbee', 'ok'),
      check('y', undefined, 'ok'),
      check('z', 'Disks', 'ok'),
    ]);
    expect(groups.map((g) => g.group)).toEqual(['Disks', 'System', 'Zigbee']);
  });

  it('copes with no checks at all', () => {
    expect(groupChecks(undefined)).toEqual([]);
    expect(groupChecks([null])).toEqual([]);
  });
});

describe('formatAge', () => {
  it('reads in the coarsest useful unit', () => {
    expect(formatAge(20)).toBe('just now');
    expect(formatAge(4 * 60 + 59)).toBe('4 min ago');
    expect(formatAge(3 * 3600 + 10)).toBe('3 h ago');
    expect(formatAge(50 * 3600)).toBe('2 days ago');
  });

  it('is null when the age is unknown, and never negative', () => {
    expect(formatAge(null)).toBeNull();
    expect(formatAge('soon')).toBeNull();
    expect(formatAge(-30)).toBe('just now');
  });
});

describe('formatInterval', () => {
  it('formats the doctor cadence', () => {
    expect(formatInterval(900)).toBe('15 min');
    expect(formatInterval(3600)).toBe('1 h');
    expect(formatInterval(5400)).toBe('1.5 h');
    expect(formatInterval(30)).toBe('30 s');
    expect(formatInterval(0)).toBeNull();
  });
});

describe('columnsForWidth', () => {
  it('fits as many 340 px columns as the width allows, at most 3', () => {
    expect(columnsForWidth(320)).toBe(1);
    expect(columnsForWidth(700)).toBe(2);
    expect(columnsForWidth(1100)).toBe(3);
    expect(columnsForWidth(2400)).toBe(3);
  });

  it('is 1 before the container has been measured', () => {
    expect(columnsForWidth(0)).toBe(1);
    expect(columnsForWidth(undefined)).toBe(1);
    expect(columnsForWidth(Number.NaN)).toBe(1);
  });
});

describe('distributeGroups', () => {
  const group = (name, rows, problems = 0) => ({
    group: name,
    checks: Array.from({ length: rows }, (_, i) => ({ id: `${name}.${i}`, status: i < problems ? 'warn' : 'ok' })),
  });

  // The report from the Pi on 2026-10-05: one warning on Disks, 14 Services checks.
  const pi = [
    group('Disks', 4, 1), group('Hardware', 3), group('Services', 14),
    group('Backups', 4), group('Security', 6), group('Network', 3), group('System', 3),
  ];
  const names = (cols) => cols.map((c) => c.map((g) => g.group));

  it('gives the tall Services group a column of its own and balances the rest', () => {
    expect(names(distributeGroups(pi, 3))).toEqual([
      ['Disks', 'Security', 'System'],
      ['Hardware', 'Backups', 'Network'],
      ['Services'],
    ]);
  });

  it('keeps every group exactly once, in the order given within each column', () => {
    for (const n of [1, 2, 3]) {
      const cols = distributeGroups(pi, n);
      expect(cols).toHaveLength(n);
      expect(cols.flat()).toHaveLength(pi.length);
      for (const c of cols) {
        const order = c.map((g) => pi.indexOf(g));
        expect(order).toEqual([...order].sort((a, b) => a - b));
      }
    }
  });

  it('is a single column when one fits, or the count is nonsense', () => {
    expect(names(distributeGroups(pi, 1))).toEqual([pi.map((g) => g.group)]);
    expect(distributeGroups(pi, 0)).toHaveLength(1);
    expect(distributeGroups(pi, Number.NaN)).toHaveLength(1);
  });

  it('counts an open problem row as taller than a healthy one', () => {
    // Same row count, but A carries two problems: B goes beside it, C under B.
    const cols = distributeGroups([group('A', 3, 2), group('B', 3), group('C', 1)], 2);
    expect(names(cols)).toEqual([['A'], ['B', 'C']]);
  });

  it('leaves extra columns empty rather than inventing groups', () => {
    expect(names(distributeGroups([group('Only', 2)], 3))).toEqual([['Only'], [], []]);
    expect(distributeGroups(undefined, 2)).toEqual([[], []]);
  });
});
