import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readCachedProgress, writeCachedProgress, clearCachedProgress, mergeProgress,
} from './progressCache';

// The suite runs in node, and this module is the one place that touches Web Storage.
// A stub keeps the tests dependency-free rather than pulling jsdom in for one file.
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();

beforeEach(() => localStorage.clear());

describe('the local cache', () => {
  it('round-trips a position', () => {
    writeCachedProgress('f1', { positionMs: 90_000, durationMs: 2_400_000 });

    expect(readCachedProgress('f1')).toMatchObject({ positionMs: 90_000, durationMs: 2_400_000 });
  });

  it('is empty for a file nobody has played', () => {
    expect(readCachedProgress('nope')).toBeNull();
    expect(readCachedProgress(null)).toBeNull();
  });

  it('ignores a zero position — there is nothing to resume to', () => {
    writeCachedProgress('f1', { positionMs: 0, durationMs: 2_400_000 });

    expect(readCachedProgress('f1')).toBeNull();
  });

  it('forgets a file on request, so finishing cannot resurrect a stale position', () => {
    writeCachedProgress('f1', { positionMs: 90_000 });
    clearCachedProgress('f1');

    expect(readCachedProgress('f1')).toBeNull();
  });

  it('survives a corrupt store rather than throwing into playback', () => {
    localStorage.setItem('dbworld:player:progress', 'not json{');

    expect(readCachedProgress('f1')).toBeNull();
    expect(() => writeCachedProgress('f1', { positionMs: 1000 })).not.toThrow();
  });

  it('never grows without bound — oldest entries fall off', () => {
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
    for (let i = 0; i < 130; i += 1) writeCachedProgress(`f${i}`, { positionMs: 1000 });

    const stored = JSON.parse(localStorage.getItem('dbworld:player:progress'));
    expect(Object.keys(stored)).toHaveLength(120);
    expect(stored.f0).toBeUndefined();        // oldest dropped
    expect(stored.f129).toBeDefined();        // newest kept
    vi.restoreAllMocks();
  });
});

describe('mergeProgress', () => {
  const local  = { positionMs: 500_000, at: Date.parse('2026-08-26T10:00:00Z') };
  const server = { positionMs: 120_000, updatedAt: '2026-08-26T09:00:00Z' };

  it('takes the newer of the two, not the furthest along', () => {
    // Local is behind in position but ahead in time: this device watched most recently.
    expect(mergeProgress(local, server)).toBe(local);
  });

  it('lets another device win when it watched later', () => {
    const newerServer = { positionMs: 10_000, updatedAt: '2026-08-26T11:00:00Z' };

    expect(mergeProgress(local, newerServer)).toBe(newerServer);
  });

  it('breaks a tie in the server’s favour — it is the cross-device answer', () => {
    const sameTime = { positionMs: 10_000, updatedAt: '2026-08-26T10:00:00Z' };

    expect(mergeProgress(local, sameTime)).toBe(sameTime);
  });

  it('copes when either side is missing', () => {
    expect(mergeProgress(local, null)).toBe(local);
    expect(mergeProgress(null, server)).toBe(server);
    expect(mergeProgress(null, null)).toBeNull();
  });
});
