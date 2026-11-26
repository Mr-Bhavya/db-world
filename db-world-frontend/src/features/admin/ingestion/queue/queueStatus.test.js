import { describe, expect, it } from 'vitest';
import { bulkTargetCounts, isLowDisk, summarizeQueue } from './queueStatus';

const GiB = 1024 ** 3;

describe('isLowDisk', () => {
  it('flags under 5 GiB or under 10 % free', () => {
    expect(isLowDisk({ freeBytes: 4 * GiB, totalBytes: 1000 * GiB })).toBe(true);
    expect(isLowDisk({ freeBytes: 50 * GiB, totalBytes: 1000 * GiB })).toBe(true);
    expect(isLowDisk({ freeBytes: 200 * GiB, totalBytes: 1000 * GiB })).toBe(false);
  });

  it('ignores missing or zero totals', () => {
    expect(isLowDisk({ freeBytes: 0, totalBytes: 0 })).toBe(false);
    expect(isLowDisk(null)).toBe(false);
  });
});

describe('summarizeQueue', () => {
  it('maps waiting order to 1-based positions and surfaces low disks', () => {
    const s = summarizeQueue({
      success: true,
      data: {
        slotJobId: 'run',
        waiting: ['a', 'b'],
        parallelCount: 1,
        aria2: { online: true, downloadSpeed: 2048, numActive: 2, numWaiting: 1 },
        disks: [
          { label: 'temp', freeBytes: GiB, totalBytes: 100 * GiB },
          { label: 'library', freeBytes: 900 * GiB, totalBytes: 1000 * GiB },
        ],
      },
    });
    expect(s.positions).toEqual({ a: 1, b: 2 });
    expect(s.waitingCount).toBe(2);
    expect(s.slotJobId).toBe('run');
    expect(s.aria2Online).toBe(true);
    expect(s.downloadSpeed).toBe(2048);
    expect(s.lowDisks.map((d) => d.label)).toEqual(['temp']);
  });

  it('tolerates an empty or missing payload', () => {
    const s = summarizeQueue(undefined);
    expect(s.waitingCount).toBe(0);
    expect(s.aria2Online).toBe(false);
    expect(s.disks).toEqual([]);
  });
});

describe('bulkTargetCounts', () => {
  it('counts jobs each action would affect', () => {
    const c = bulkTargetCounts([
      { status: 'DOWNLOADING' }, { status: 'PAUSED' }, { status: 'FAILED' }, { status: 'SUCCESS' },
    ]);
    expect(c).toEqual({ 'pause-all': 1, 'resume-all': 1, 'retry-failed': 1, 'clear-finished': 2 });
  });
});
