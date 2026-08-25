import { describe, it, expect } from 'vitest';
import { buildHybridEpisodes } from './episodeUtils';

/** A converted media file (the shape CommonServices.convertMediaInfoToCustomFormat emits). */
const file = (id, season, episode, height, video = {}) => ({
  id,
  mediaFileId: id,
  tmdbSeasonNumber: season,
  tmdbEpisodeNumber: episode,
  general: { fileName: `Show.S0${season}E0${episode}.${height}p.mkv` },
  video: { resolution: `${Math.round((height * 16) / 9)}x${height}`, ...video },
  streamUrl: null,
});

describe('buildHybridEpisodes', () => {
  it('lists an episode ONCE no matter how many qualities it has', () => {
    const files = [
      file('a', 1, 1, 1080), file('b', 1, 1, 720),
      file('c', 1, 2, 1080), file('d', 1, 2, 720),
    ];
    const eps = buildHybridEpisodes(files, files[0]);

    expect(eps.map(e => e.label)).toEqual(['S01E01', 'S01E02']);
  });

  it('collapses qualities that share a resolution tier', () => {
    // 1440p and 1080p both used to bucket to the label "1080p" — two rows for one episode.
    const files = [file('a', 1, 1, 1440), file('b', 1, 1, 1080)];

    expect(buildHybridEpisodes(files, files[1])).toHaveLength(1);
  });

  it('carries every quality of the episode as variants, best first', () => {
    const files = [file('a', 1, 1, 720), file('b', 1, 1, 2160), file('c', 1, 1, 1080)];
    const [ep] = buildHybridEpisodes(files, files[0]);

    expect(ep.variants.map(v => v.mediaFileId)).toEqual(['b', 'c', 'a']);
    expect(ep.variants.map(v => v.label)).toEqual(['4K', '1080p', '720p']);
  });

  it('plays each episode at the quality being watched, or the next one down', () => {
    const files = [
      file('a', 1, 1, 1080), file('b', 1, 2, 2160), file('c', 1, 2, 1080),
      file('d', 1, 3, 720),  // no 1080p — falls back
    ];
    const eps = buildHybridEpisodes(files, files[0]);

    expect(eps.map(e => e.fileId)).toEqual(['a', 'c', 'd']);
  });

  it('keeps the viewer on their own file even when a sibling ranks higher', () => {
    const files = [file('a', 1, 1, 2160), file('b', 1, 1, 1080)];
    const [ep] = buildHybridEpisodes(files, files[1]);

    expect(ep.fileId).toBe('b');
  });

  it('sorts across seasons and keeps episodes that exist in one quality only', () => {
    const files = [file('a', 2, 1, 480), file('b', 1, 2, 1080), file('c', 1, 1, 1080)];
    const eps = buildHybridEpisodes(files, files[1]);

    expect(eps.map(e => e.label)).toEqual(['S01E01', 'S01E02', 'S02E01']);
  });

  it('returns nothing for a movie', () => {
    const movie = { id: 'm', mediaFileId: 'm', general: { fileName: 'Movie.2160p.mkv' }, video: {} };

    expect(buildHybridEpisodes([movie], movie)).toEqual([]);
  });
});

// A 1080p episode routinely exists twice — an 8-bit and a 10-bit master. Resolution
// can't separate them, so without a tie-break the row played whichever the API listed
// first and both quality rows rendered the same text.
describe('same resolution, different masters', () => {
  const sd = (id, s, e) => file(id, s, e, 1080, { bitDepth: 8, bitRate: 6_000_000 });
  const hd = (id, s, e) => file(id, s, e, 1080, { bitDepth: 10, bitRate: 9_000_000 });

  it('still lists the episode once', () => {
    const files = [sd('a', 1, 1), hd('b', 1, 1)];
    expect(buildHybridEpisodes(files, files[0])).toHaveLength(1);
  });

  it('offers both as quality variants, deeper first', () => {
    const files = [sd('a', 1, 1), hd('b', 1, 1)];
    const [ep] = buildHybridEpisodes(files, files[0]);

    expect(ep.variants.map(v => v.mediaFileId)).toEqual(['b', 'a']);
    expect(ep.variants.map(v => v.depth)).toEqual([10, 8]);
  });

  it('keeps the next episode on the bit depth being watched', () => {
    const files = [sd('a', 1, 1), hd('b', 1, 1), sd('c', 1, 2), hd('d', 1, 2)];

    expect(buildHybridEpisodes(files, files[0]).map(e => e.fileId)).toEqual(['a', 'c']);  // 8-bit
    expect(buildHybridEpisodes(files, files[1]).map(e => e.fileId)).toEqual(['b', 'd']);  // 10-bit
  });

  it('falls back to the fatter file when the matching depth is missing', () => {
    const files = [hd('a', 1, 1), sd('c', 1, 2), hd('d', 1, 2)];
    const only8bit = file('x', 1, 3, 1080, { bitDepth: 8, bitRate: 3_000_000 });
    const eps = buildHybridEpisodes([...files, only8bit], files[0]);

    expect(eps.map(e => e.fileId)).toEqual(['a', 'd', 'x']);
  });

  it('is deterministic regardless of the order the API returned', () => {
    const forwards  = [sd('a', 1, 1), hd('b', 1, 1)];
    const backwards = [hd('b', 1, 1), sd('a', 1, 1)];
    const ref = sd('a', 1, 1);

    expect(buildHybridEpisodes(forwards, ref)[0].fileId)
      .toBe(buildHybridEpisodes(backwards, ref)[0].fileId);
  });
});
