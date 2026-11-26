import { describe, expect, it } from 'vitest';
import {
  countDownloadTabs, countJobStatuses, filterAdminJobs, filterDownloads,
  formatAbsoluteTime, formatRelativeTime, matchesLocalDate, pruneReadySelection, summarizeDownloads, transferStats,
} from './downloadCenterModel';

const jobs = [
  { id: 'q1', status: 'QUEUED', bytesTotal: 0 },
  { id: 'r1', status: 'READY', bytesTotal: 1024 },
  { id: 'f1', status: 'FAILED' },
];
const downloads = [
  { downloadId: 'd1', status: 'running', source: 'cinema' },
  { downloadId: 'd2', status: 'success', source: 'downloader', bytesTotal: 2048 },
  { downloadId: 'd3', status: 'failed', source: 'cinema' },
];

describe('download center model', () => {
  it('filters both collections by source and tab and calculates visible counts', () => {
    expect(filterDownloads(jobs, downloads, 'cinema', 'all')).toEqual({ serverJobs: [], deviceDownloads: downloads.filter((item) => item.source === 'cinema') });
    expect(filterDownloads(jobs, downloads, 'downloader', 'ready').serverJobs.map((job) => job.id)).toEqual(['r1']);
    expect(countDownloadTabs(jobs, downloads, 'all')).toEqual({ all: 6, active: 2, ready: 2, failed: 2 });
  });

  it('summarizes active, ready, failed and known ready size', () => {
    expect(summarizeDownloads(jobs, downloads)).toEqual({ active: 2, ready: 2, failed: 2, readyBytes: 3072, readyBytesKnown: true, liveSpeed: 0 });
  });

  it('sums live speed from moving transfers only, ignoring paused device items', () => {
    const liveJobs = [{ id: 'a', status: 'DOWNLOADING', speed: 1000 }, { id: 'b', status: 'READY', speed: 999 }];
    const liveDevices = [
      { downloadId: 'x', status: 'running', speedBytesPerSec: 500 },
      { downloadId: 'y', status: 'paused', speedBytesPerSec: 700 },
    ];
    expect(summarizeDownloads(liveJobs, liveDevices).liveSpeed).toBe(1500);
  });

  it('prunes selections that are no longer ready', () => {
    expect(pruneReadySelection(['r1', 'q1', 'missing'], jobs)).toEqual(['r1']);
    expect(pruneReadySelection(['r1'], [{ id: 'r1', status: 'EXPIRED' }])).toEqual([]);
  });

  it('formats relative and absolute timestamps without emitting Invalid Date', () => {
    const now = new Date('2026-11-26T00:00:00Z');
    expect(formatRelativeTime('2026-11-25T23:55:00Z', now, 'past')).toBe('Added 5 min ago');
    expect(formatRelativeTime('2026-11-26T03:00:00Z', now, 'future')).toBe('Expires in 3 h');
    expect(formatRelativeTime(null, now, 'future')).toBe('Expiration unavailable');
    expect(formatRelativeTime('not-a-date', now)).toBe('Date unavailable');
    expect(formatAbsoluteTime(null)).toBe('');
    expect(formatAbsoluteTime(1795651200000)).toBe(new Date(1795651200000).toLocaleString());
    expect(formatRelativeTime(1795650700000, 1795651200000)).toBe('Added 8 min ago');
  });

  it('matches date filters in local time and safely rejects missing or invalid values', () => {
    const localDate = new Date(2026, 10, 26, 12).toISOString();
    expect(matchesLocalDate(localDate, '2026-11-26')).toBe(true);
    expect(matchesLocalDate(null, '2026-11-26')).toBe(false);
    expect(matchesLocalDate('bad-date', '2026-11-26')).toBe(false);
    expect(matchesLocalDate(localDate, '2026-02-31')).toBe(false);
  });

  it('filters admin jobs safely across nullable fields and counts each status', () => {
    const adminJobs = [
      { id: 'a', status: 'READY', owner: null, source: null, title: null, fileName: null, createdAt: '2026-11-26T01:00:00Z' },
      { id: 'b', status: 'FAILED', owner: 'alice', createdAt: null },
    ];
    expect(filterAdminJobs(adminJobs, { search: 'alice' }).map((job) => job.id)).toEqual(['b']);
    expect(filterAdminJobs(adminJobs, { date: '2026-11-26' }).map((job) => job.id)).toEqual(['a']);
    expect(countJobStatuses(adminJobs)).toMatchObject({ READY: 1, FAILED: 1, QUEUED: 0 });
  });
});

describe('transferStats', () => {
  it('derives percent, remaining bytes and an ETA from speed when the source omits it', () => {
    expect(transferStats({ bytesDownloaded: 250, bytesTotal: 1000, speed: 50 }))
      .toEqual({ percent: 25, downloaded: 250, total: 1000, remaining: 750, speed: 50, eta: 15 });
  });

  it('clamps over-reported bytes and percent and keeps unknown values null', () => {
    expect(transferStats({ bytesDownloaded: 1200, bytesTotal: 1000, percent: 104.6, speed: 0, eta: -1 }))
      .toEqual({ percent: 100, downloaded: 1000, total: 1000, remaining: 0, speed: null, eta: null });
    expect(transferStats({ bytesDownloaded: 300, bytesTotal: 0 }))
      .toEqual({ percent: null, downloaded: 300, total: null, remaining: null, speed: null, eta: null });
  });

  it('does not show 100% before the transfer has finished', () => {
    expect(transferStats({ bytesDownloaded: 999, bytesTotal: 1000 }).percent).toBe(99);
  });
});
