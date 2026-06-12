/** Parse S##E## from a filename → { season, episode } or null */
export function parseEpisode(fileName) {
  const m = (fileName ?? '').match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
  if (!m) return null;
  return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
}

/** Derive quality label from a mediaFile object (has .video.resolution or .general.fileName) */
export function getQualityLabel(mediaFile) {
  const res = mediaFile?.video?.resolution;
  if (!res) {
    return mediaFile?.general?.fileName?.match(/(\d{3,4}p|4K|8K)/i)?.[1] ?? 'SD';
  }
  const [, h] = res.split('x').map(Number);
  if (h >= 2160) return '4K';
  if (h >= 1080) return '1080p';
  if (h >= 720)  return '720p';
  if (h >= 480)  return '480p';
  return 'SD';
}

/** Build { [season]: [{season, episode, files}] } from an allFiles array */
export function buildEpisodeMap(files) {
  const map = {};
  for (const f of files) {
    const ep = parseEpisode(f?.general?.fileName);
    if (!ep) continue;
    const key = `${ep.season}x${ep.episode}`;
    if (!map[key]) map[key] = { ...ep, files: [] };
    map[key].files.push(f);
  }
  const seasons = {};
  for (const ep of Object.values(map)) {
    if (!seasons[ep.season]) seasons[ep.season] = [];
    seasons[ep.season].push(ep);
  }
  for (const s of Object.keys(seasons)) {
    seasons[s].sort((a, b) => a.episode - b.episode);
  }
  return seasons;
}

/**
 * Look up a TMDB episode name for a given season/episode number.
 * `tmdbSeasons` is record.tmdb.seasons: [{ seasonNumber, episodes:[{ episodeNumber, name }] }].
 * Returns '' when not found (so callers can fall back to the S##E## label).
 */
export function tmdbEpisodeName(tmdbSeasons, season, episode) {
  if (!Array.isArray(tmdbSeasons)) return '';
  const s = tmdbSeasons.find(x => Number(x?.seasonNumber) === Number(season));
  const e = s?.episodes?.find(x => Number(x?.episodeNumber) === Number(episode));
  return e?.name ?? '';
}

/**
 * Rich episode list for the hybrid player: same quality as currentFile, sorted,
 * each with a resolved url + stable id. Returns [] for movies.
 *
 * @param {Array} [tmdbSeasons] record.tmdb.seasons — used to attach episode names.
 */
export function buildHybridEpisodes(allFiles, currentFile, tmdbSeasons = []) {
  if (!Array.isArray(allFiles) || !currentFile) return [];
  const quality = getQualityLabel(currentFile);
  const pad = (n) => String(n).padStart(2, '0');
  return allFiles
    .filter(f => getQualityLabel(f) === quality)
    .map(f => ({ f, ep: parseEpisode(f?.general?.fileName) }))
    .filter(({ ep }) => ep !== null)
    .sort((a, b) => (a.ep.season !== b.ep.season ? a.ep.season - b.ep.season : a.ep.episode - b.ep.episode))
    .map(({ f, ep }) => {
      const name = tmdbEpisodeName(tmdbSeasons, ep.season, ep.episode);
      return {
        id:          String(f.id ?? f.mediaFileId ?? ''),
        fileId:      String(f.id ?? f.mediaFileId ?? ''),
        mediaFileId: f.mediaFileId ?? f.id ?? '',
        season:      ep.season,
        episode:     ep.episode,
        name,                                    // TMDB episode title ('' if unknown)
        label:       `S${pad(ep.season)}E${pad(ep.episode)}`,
        url:         f.streamUrl ?? '',          // may be empty → resolved lazily on selection
      };
    });
}
