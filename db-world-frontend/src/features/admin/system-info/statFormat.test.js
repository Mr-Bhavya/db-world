import { describe, it, expect } from 'vitest';
import { compactRatio, compactUptime } from './statFormat';

describe('compactRatio', () => {
  it('drops the repeated unit', () => {
    expect(compactRatio('3.47 GB', '7.75 GB')).toBe('3.47 / 7.75 GB');
    expect(compactRatio(' 512 MB ', '1024 MB')).toBe('512 / 1024 MB');
  });

  it('keeps both units when they differ', () => {
    expect(compactRatio('900 MB', '7.75 GB')).toBe('900 MB / 7.75 GB');
  });

  it('leaves values without a unit as they are', () => {
    expect(compactRatio('3', '8')).toBe('3 / 8');
  });
});

describe('compactUptime', () => {
  it('drops seconds next to hours or days', () => {
    expect(compactUptime('23h 27m 9s')).toBe('23h 27m');
    expect(compactUptime('2d 4h 5m 7s')).toBe('2d 4h 5m');
  });

  it('keeps seconds when the uptime is short', () => {
    expect(compactUptime('12m 9s')).toBe('12m 9s');
    expect(compactUptime('45s')).toBe('45s');
  });

  it('passes anything else through, including nothing', () => {
    expect(compactUptime(undefined)).toBeUndefined();
    expect(compactUptime(null)).toBeNull();
    expect(compactUptime('3 days')).toBe('3 days');
    expect(compactUptime('2d 4h')).toBe('2d 4h');
  });
});
