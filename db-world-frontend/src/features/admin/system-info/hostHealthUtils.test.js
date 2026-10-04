import { describe, it, expect } from 'vitest';
import { formatAge, formatInterval, groupChecks, normalizeStatus, statusRank } from './hostHealthUtils';

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
