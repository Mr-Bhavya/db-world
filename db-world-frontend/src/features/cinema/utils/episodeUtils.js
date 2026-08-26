import { heightOf, variantOf } from '../media/helpers';

/** Parse S##E## from a filename → { season, episode } or null */
export function parseEpisode(fileName) {
  const m = (fileName ?? '').match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
  if (!m) return null;
  return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
}

/**
 * Season/episode for a media file, preferring the stored columns.
 *
 * `tmdbSeasonNumber` / `tmdbEpisodeNumber` are what the admin UI writes when
 * someone corrects a mis-named file. Deriving from the filename alone meant
 * those corrections had no effect anywhere the player looked — and a file whose
 * name lacks S##E## disappeared from the episode list entirely, which in turn
 * made `variantFilesFor` treat every episode of the show as a quality variant
 * of the current one.
 *
 * Returns null only when neither source knows.
 */
export function episodeRefOf(file) {
  const s = file?.tmdbSeasonNumber;
  const e = file?.tmdbEpisodeNumber;
  if (s != null && e != null) return { season: Number(s), episode: Number(e) };

  const parsed = parseEpisode(file?.general?.fileName);
  if (!parsed) return null;

  // One side stored, the other only in the name — take the stored one.
  return {
    season:  s != null ? Number(s) : parsed.season,
    episode: e != null ? Number(e) : parsed.episode,
  };
}

/** Build { [season]: [{season, episode, files}] } from an allFiles array */
export function buildEpisodeMap(files) {
  const map = {};
  for (const f of files) {
    const ep = episodeRefOf(f);
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
 * Look up the full TMDB episode object for a season/episode number.
 * `tmdbSeasons` is record.tmdb.seasons: [{ seasonNumber, episodes:[{ episodeNumber,
 * name, overview, stillPath, runtime, airDate, voteAverage }] }].
 * Returns null when not found.
 */
export function tmdbEpisode(tmdbSeasons, season, episode) {
  if (!Array.isArray(tmdbSeasons)) return null;
  const s = tmdbSeasons.find(x => Number(x?.seasonNumber) === Number(season));
  return s?.episodes?.find(x => Number(x?.episodeNumber) === Number(episode)) ?? null;
}

/**
 * Look up a TMDB episode name for a given season/episode number.
 * Returns '' when not found (so callers can fall back to the S##E## label).
 */
export function tmdbEpisodeName(tmdbSeasons, season, episode) {
  return tmdbEpisode(tmdbSeasons, season, episode)?.name ?? '';
}

const depthOf   = (f) => Number(f?.video?.bitDepth) || 0;
const bitRateOf = (f) => Number(f?.video?.bitRate) || 0;

/**
 * The file that best matches `ref` from a best-first `ranked` list: the closest
 * resolution without going over (the smallest when all exceed it), then — because a
 * 1080p episode routinely exists as both an 8-bit and a 10-bit master — the one whose
 * bit depth matches what the viewer is already watching, and finally the fatter file.
 */
function pickLike(ranked, ref) {
  const targetH = heightOf(ref);
  const withinTarget = targetH ? ranked.filter(f => heightOf(f) <= targetH) : ranked;
  const pool = withinTarget.length ? withinTarget : [ranked[ranked.length - 1]];

  // Same resolution, different masters — resolution alone can't separate these.
  const tier = pool.filter(f => heightOf(f) === heightOf(pool[0]));
  if (tier.length === 1) return tier[0];
  return tier.find(f => depthOf(f) === depthOf(ref))
    ?? [...tier].sort((a, b) => bitRateOf(b) - bitRateOf(a))[0];
}

/**
 * Rich episode list for the hybrid player — ONE entry per episode, sorted, each
 * with a stable id. Returns [] for movies.
 *
 * An episode that exists in several qualities is a single row whose alternatives
 * live in `variants`; the list used to be built per FILE, so such an episode
 * appeared twice and "Next episode" stepped onto a duplicate of the one already
 * playing instead of the next episode.
 *
 * The file a row plays is the one closest to `currentFile`'s quality without
 * going over, so changing episode keeps the quality the viewer is watching.
 *
 * @param {Array} [tmdbSeasons] record.tmdb.seasons — used to attach episode names.
 */
export function buildHybridEpisodes(allFiles, currentFile, tmdbSeasons = []) {
  if (!Array.isArray(allFiles) || !currentFile) return [];
  const pad     = (n) => String(n).padStart(2, '0');
  const idOf    = (f) => String(f?.id ?? f?.mediaFileId ?? '');

  const groups = new Map();   // 'season-episode' → { ep, files }
  for (const f of allFiles) {
    const ep = episodeRefOf(f);
    if (!ep) continue;
    const key = `${ep.season}-${ep.episode}`;
    if (!groups.has(key)) groups.set(key, { ep, files: [] });
    groups.get(key).files.push(f);
  }

  return [...groups.values()]
    .sort((a, b) => (a.ep.season !== b.ep.season ? a.ep.season - b.ep.season : a.ep.episode - b.ep.episode))
    .map(({ ep, files }) => {
      // Best first: resolution, then bit depth, then bitrate — so two 1080p masters
      // of one episode have a stable order instead of whatever the API listed first.
      const ranked = [...files].sort((a, b) =>
        (heightOf(b) - heightOf(a)) || (depthOf(b) - depthOf(a)) || (bitRateOf(b) - bitRateOf(a)));
      // The viewer's own file always represents its own episode — picking by
      // height instead could hand its row a sibling id and break the highlight.
      const f = ranked.find(x => idOf(x) === idOf(currentFile)) ?? pickLike(ranked, currentFile);
      const meta = tmdbEpisode(tmdbSeasons, ep.season, ep.episode);
      return {
        id:          idOf(f),
        fileId:      idOf(f),
        mediaFileId: f.mediaFileId ?? f.id ?? '',
        season:      ep.season,
        episode:     ep.episode,
        name:        meta?.name ?? '',           // TMDB episode title ('' if unknown)
        overview:    meta?.overview ?? '',       // TMDB episode synopsis
        stillPath:   meta?.stillPath ?? null,    // TMDB still image path (→ tmdbImg)
        runtime:     meta?.runtime ?? null,      // minutes
        airDate:     meta?.airDate ?? null,
        label:       `S${pad(ep.season)}E${pad(ep.episode)}`,
        url:         f.streamUrl ?? '',          // may be empty → resolved lazily on selection
        // This episode's quality alternatives, best first. Urls are resolved when
        // the episode is selected so the Quality menu can follow the episode.
        variants:    ranked.map(variantOf),
      };
    });
}
