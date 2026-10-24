import { describe, it, expect } from 'vitest';
import { distinctEpisodeName } from './helpers';

// TMDB episode names frequently restate the number the row already shows. Stripping
// that prefix is the only reason an episode row can drop its E01 plate without
// losing the number — so the edges here decide whether rows read right or blank out.
describe('distinctEpisodeName', () => {
  it('drops a prefix that only restates the number', () => {
    expect(distinctEpisodeName('Episode 1 : Ft. Alia Bhatt')).toBe('Ft. Alia Bhatt');
    expect(distinctEpisodeName('Episode 12 - Pilot')).toBe('Pilot');
    expect(distinctEpisodeName('Ep. 3: Stendhal Syndrome')).toBe('Stendhal Syndrome');
    expect(distinctEpisodeName('Episode 4 Oranges from China')).toBe('Oranges from China');
    expect(distinctEpisodeName('episode 9 — Demolition Boys')).toBe('Demolition Boys');
  });

  it('returns null when the name was ONLY a number, so the caller can fall back', () => {
    // The row renders the numeral separately; leaving "" here would blank the title.
    expect(distinctEpisodeName('Episode 12')).toBeNull();
    expect(distinctEpisodeName('Episode 5: ')).toBeNull();
    expect(distinctEpisodeName('')).toBeNull();
    expect(distinctEpisodeName(null)).toBeNull();
    expect(distinctEpisodeName(undefined)).toBeNull();
  });

  it('leaves a real title alone, including ones that merely start like the prefix', () => {
    expect(distinctEpisodeName('An Ode to Life')).toBe('An Ode to Life');
    expect(distinctEpisodeName('Stendhal Syndrome')).toBe('Stendhal Syndrome');
    // No digits follow, so these are titles and not numbering.
    expect(distinctEpisodeName('Epilogue')).toBe('Epilogue');
    expect(distinctEpisodeName('Episodes of Fury')).toBe('Episodes of Fury');
    // "E5" is not the "ep" spelling the pattern matches.
    expect(distinctEpisodeName('E5 Something')).toBe('E5 Something');
  });

  it('does not strip a number from the middle of a title', () => {
    expect(distinctEpisodeName('The Episode 9 Incident')).toBe('The Episode 9 Incident');
  });
});
