import { describe, expect, it } from 'vitest';
import { mergeJobs } from './mergeJobs';

describe('mergeJobs', () => {
  it('returns the previous map when nothing changed', () => {
    const prev = { a: { status: 'DOWNLOADING', progress: 10 } };
    expect(mergeJobs(prev, { a: { status: 'DOWNLOADING', progress: 10 } })).toBe(prev);
  });

  it('keeps identity of unchanged jobs and replaces changed ones', () => {
    const prev = { a: { progress: 10 }, b: { progress: 20 } };
    const out = mergeJobs(prev, { a: { progress: 10 }, b: { progress: 25 } });
    expect(out).not.toBe(prev);
    expect(out.a).toBe(prev.a);
    expect(out.b).toEqual({ progress: 25 });
  });

  it('drops jobs that are no longer reported', () => {
    const prev = { a: { progress: 10 }, b: { progress: 20 } };
    const out = mergeJobs(prev, { a: { progress: 10 } });
    expect(Object.keys(out)).toEqual(['a']);
  });

  it('treats a non-object payload as empty', () => {
    expect(mergeJobs({ a: {} }, null)).toEqual({});
  });
});
