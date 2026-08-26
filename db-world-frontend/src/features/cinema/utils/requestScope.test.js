import { describe, it, expect } from 'vitest';
import { requestScopeKey, indexRequests, coveringRequest, applyVote, scopeSuffix } from './requestScope';

const req = (over = {}) => ({
  kind: 'NEW_FILES', season: null, episode: null, scopeLabel: 'All',
  voteCount: 1, hasMyVote: false, ...over,
});

describe('requestScopeKey', () => {
  it('separates the whole title, a season and an episode', () => {
    expect(requestScopeKey({})).toBe('NEW_FILES|*|*');
    expect(requestScopeKey({ season: 2 })).toBe('NEW_FILES|2|*');
    expect(requestScopeKey({ season: 2, episode: 5 })).toBe('NEW_FILES|2|5');
  });

  it('keeps season 0 distinct from no season at all', () => {
    expect(requestScopeKey({ season: 0 })).not.toBe(requestScopeKey({}));
    expect(requestScopeKey({ season: 0 })).toBe('NEW_FILES|0|*');
  });

  it('keeps kinds apart', () => {
    expect(requestScopeKey({ kind: 'HIGHER_QUALITY' })).not.toBe(requestScopeKey({}));
  });
});

describe('coveringRequest', () => {
  const index = indexRequests([
    req({ scopeLabel: 'All', voteCount: 4 }),
    req({ season: 2, scopeLabel: 'Season 2', voteCount: 3, hasMyVote: true }),
    req({ season: 2, episode: 5, scopeLabel: 'S02E05', voteCount: 2 }),
  ]);

  it('prefers the episode over its season and the season over the whole title', () => {
    expect(coveringRequest(index, { season: 2, episode: 5 }).scopeLabel).toBe('S02E05');
    expect(coveringRequest(index, { season: 2, episode: 6 }).scopeLabel).toBe('Season 2');
    expect(coveringRequest(index, { season: 3, episode: 1 }).scopeLabel).toBe('All');
  });

  it('returns null when nothing is pending', () => {
    expect(coveringRequest(indexRequests([]), { season: 1, episode: 1 })).toBeNull();
    expect(coveringRequest(null, { season: 1 })).toBeNull();
  });
});

describe('applyVote', () => {
  const list = [req({ season: 2, scopeLabel: 'Season 2', voteCount: 1, hasMyVote: true })];

  it('replaces the entry for the scope that was voted on', () => {
    const next = applyVote(list, req({ season: 2, scopeLabel: 'Season 2', voteCount: 2, hasMyVote: true }));
    expect(next).toHaveLength(1);
    expect(next[0].voteCount).toBe(2);
  });

  it('drops a scope whose last vote was withdrawn (the row is pruned server-side)', () => {
    const next = applyVote(list, req({ season: 2, voteCount: 0, hasMyVote: false }));
    expect(next).toEqual([]);
  });

  it('adds a scope that was not in the list', () => {
    const next = applyVote(list, req({ season: 2, episode: 5, voteCount: 1, hasMyVote: true }));
    expect(next).toHaveLength(2);
  });
});

describe('scopeSuffix', () => {
  it('is empty for a whole-title request and spaced otherwise', () => {
    expect(scopeSuffix('All')).toBe('');
    expect(scopeSuffix(undefined)).toBe('');
    expect(scopeSuffix('S02E05')).toBe(' S02E05');
  });
});
