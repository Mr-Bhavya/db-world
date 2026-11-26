import { describe, expect, it } from 'vitest';
import { resolveLogoCandidates } from './logoDev';

describe('resolveLogoCandidates', () => {
  it('provides keyless favicon fallbacks for a domain', () => {
    const candidates = resolveLogoCandidates('', 'netflix.com');

    expect(candidates[0]).toContain('google.com/s2/favicons');
    expect(candidates[1]).toContain('icons.duckduckgo.com/ip3/netflix.com.ico');
    expect(candidates).toHaveLength(3);
  });

  it('tries a supplied logo before domain fallbacks and skips duplicate candidates', () => {
    const candidates = resolveLogoCandidates('https://cdn.example.com/logo.png', 'example.com');

    expect(candidates[0]).toBe('https://cdn.example.com/logo.png');
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
