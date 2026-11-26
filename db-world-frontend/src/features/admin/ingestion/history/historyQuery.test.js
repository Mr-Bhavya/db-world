import { describe, expect, it } from 'vitest';
import { normalizeHistoryPage, toHistoryParams } from './historyQuery';

describe('toHistoryParams', () => {
  it('omits blank search and unknown status, clamps paging', () => {
    expect(toHistoryParams({ page: -3, size: 500, q: '   ', status: 'BOGUS' }))
      .toEqual({ page: 0, size: 100 });
  });

  it('trims search and keeps a known status', () => {
    expect(toHistoryParams({ page: 2, size: 25, q: '  movie_1 ', status: 'FAILED' }))
      .toEqual({ page: 2, size: 25, q: 'movie_1', status: 'FAILED' });
  });
});

describe('normalizeHistoryPage', () => {
  it('reads the paged shape and keeps server counts', () => {
    const page = normalizeHistoryPage({
      content: [{ jobId: 'a' }], totalElements: 40, totalPages: 2, counts: { SUCCESS: 30, TOTAL: 40 },
    });
    expect(page.content).toHaveLength(1);
    expect(page.totalElements).toBe(40);
    expect(page.counts).toEqual({ SUCCESS: 30, TOTAL: 40 });
  });

  it('derives counts from the legacy array shape', () => {
    const page = normalizeHistoryPage([{ status: 'FAILED' }, { status: 'FAILED' }, { status: 'SUCCESS' }]);
    expect(page.totalElements).toBe(3);
    expect(page.counts).toEqual({ TOTAL: 3, FAILED: 2, SUCCESS: 1 });
  });

  it('returns an empty page for missing data', () => {
    expect(normalizeHistoryPage(undefined)).toMatchObject({ content: [], totalElements: 0 });
  });
});
