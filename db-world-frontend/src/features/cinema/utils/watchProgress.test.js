import { describe, it, expect } from 'vitest';
import { watchedFraction, progressByFile, episodeProgress } from './watchProgress';

describe('watchedFraction', () => {
  it('is the fraction of the way through', () => {
    expect(watchedFraction({ positionMs: 600_000, durationMs: 2_400_000 })).toBe(0.25);
  });

  it('counts the last 5% as finished, so credits do not leave a sliver', () => {
    expect(watchedFraction({ positionMs: 2_290_000, durationMs: 2_400_000 })).toBe(1);
  });

  it('is 0 without a usable position or duration', () => {
    expect(watchedFraction()).toBe(0);
    expect(watchedFraction({ positionMs: 60_000, durationMs: 0 })).toBe(0);
    expect(watchedFraction({ positionMs: 0, durationMs: 2_400_000 })).toBe(0);
  });

  it('never exceeds 1 when a stale duration undershoots', () => {
    expect(watchedFraction({ positionMs: 3_000_000, durationMs: 2_400_000 })).toBe(1);
  });
});

describe('progressByFile', () => {
  it('keys the API rows by file id as strings', () => {
    expect(progressByFile([{ fileId: 12, positionMs: 1_200_000, durationMs: 2_400_000 }]))
      .toEqual({ 12: 0.5 });
  });

  it('survives an empty or missing response', () => {
    expect(progressByFile(null)).toEqual({});
  });
});

describe('episodeProgress', () => {
  const files = [{ id: 'a' }, { id: 'b' }];

  it('takes the furthest master — progress is per file, but the bar is per episode', () => {
    expect(episodeProgress({ a: 0.2, b: 0.8 }, files)).toBe(0.8);
  });

  it('falls back to the mediaFileId when a file carries no id', () => {
    expect(episodeProgress({ z: 0.4 }, [{ mediaFileId: 'z' }])).toBe(0.4);
  });

  it('is 0 for an episode nobody has started', () => {
    expect(episodeProgress({ a: 0.5 }, [{ id: 'other' }])).toBe(0);
    expect(episodeProgress({}, undefined)).toBe(0);
  });
});
