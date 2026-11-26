import { describe, expect, it } from 'vitest';
import { formatBytes, formatDurationMs, formatEta, formatSize, formatSpeed } from './format';

describe('formatBytes', () => {
  it('scales through units and keeps 0 visible', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1.5 * 1024 ** 2)).toBe('1.5 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.00 GB');
    expect(formatBytes(2 * 1024 ** 4)).toBe('2.00 TB');
  });

  it('returns the fallback for missing or invalid input', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes('abc', '?')).toBe('?');
    expect(formatBytes(-1)).toBe('—');
  });
});

describe('formatSize / formatSpeed / formatEta', () => {
  it('treats 0 as unknown for sizes and idle for speed', () => {
    expect(formatSize(0)).toBeNull();
    expect(formatSize(1024 ** 2)).toBe('1.0 MB');
    expect(formatSpeed(0)).toBeNull();
    expect(formatSpeed(1024 ** 2 * 2)).toBe('2.0 MB/s');
  });

  it('formats ETA buckets', () => {
    expect(formatEta(0)).toBeNull();
    expect(formatEta(45)).toBe('45s');
    expect(formatEta(125)).toBe('2m 5s');
    expect(formatEta(3720)).toBe('1h 2m');
  });

  it('formats elapsed milliseconds', () => {
    expect(formatDurationMs(undefined)).toBe('—');
    expect(formatDurationMs(3_723_000)).toBe('1h 2m 3s');
  });
});
