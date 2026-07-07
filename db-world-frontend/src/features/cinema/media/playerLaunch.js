// Shared resolve→launch pipeline for the hybrid video player.
//
// Every "play" entry point (Record-Details, Continue-Watching, the media-details drawer)
// funnels through resolveAndBuildMedia() so the player payload — url, variants, episodes,
// storyboard, requestId, audio, ids — is assembled IDENTICALLY. This kills the recurring
// class of bugs where one launch path silently dropped a field (missing storyboard /
// variants / requestId). The quality variants of the current title are resolved in ONE
// batch call (POST /api/stream/resolve-batch) instead of N per-file resolves.
import { resolveMediaBatch, loadStreamFileInfoByRecordId } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import { buildStoryboard } from '../utils/storyboard';
import { parseEpisode, buildHybridEpisodes } from '../utils/episodeUtils';
import { fetchRecord } from '../api/cinemaApi';
import { getQuality, getCodec, getHdrTags } from './helpers';

const heightOf = (f) => Number(f?.video?.resolution?.split('x')?.[1]) || 0;

/** Stable season-episode key: prefer TMDB season/episode fields, else parse the filename. */
export function episodeKey(f) {
  const ep = parseEpisode(f?.general?.fileName);
  const s = f?.tmdbSeasonNumber != null ? f.tmdbSeasonNumber : ep?.season;
  const e = f?.tmdbEpisodeNumber != null ? f.tmdbEpisodeNumber : ep?.episode;
  return `${s}-${e}`;
}

/**
 * The quality-variant files of `current`: same season/episode for a series, all files for
 * a movie. Falls back to just `current` when nothing matches.
 */
export function variantFilesFor(allFiles, current, isSeries) {
  const files = (allFiles || []).filter(Boolean);
  if (!isSeries) return files.length ? files : [current].filter(Boolean);
  const key = episodeKey(current);
  const same = files.filter((f) => episodeKey(f) === key);
  return same.length ? same : [current].filter(Boolean);
}

/**
 * Resolve the quality variants of `current` (one batch call) and assemble the full player
 * `media` payload for navigate(DB_PLAYER_ROUTE, { state: { media } }).
 *
 * @param {object}   args.current       the file being played (must have mediaFileId for CDN resolve)
 * @param {object[]} args.variantFiles  quality alternatives to resolve (usually variantFilesFor(...))
 * @param {object[]} [args.episodes]    prebuilt episode list (lazily-resolved urls); [] for movies
 * @param {object}   [args.record]      record for recordId/title fallbacks
 * @param {string}   [args.title]       display title
 * @param {string}   [args.fileId]      watch-progress key (defaults to current id/mediaFileId)
 * @returns {Promise<object>} the media payload
 * @throws if no stream URL could be resolved
 */
export async function resolveAndBuildMedia({ current, variantFiles, episodes = [], record = null, title = '', fileId }) {
  const files = (variantFiles?.length ? variantFiles : [current]).filter(Boolean);
  const ids = [...new Set(files.map((f) => f?.mediaFileId).filter(Boolean))];

  const resolved = ids.length ? await resolveMediaBatch(ids, 'ONLINE') : [];
  const byId = new Map((resolved || []).map((r) => [r.mediaFileId, r]));

  const variants = files
    .map((f) => {
      const r = byId.get(f?.mediaFileId);
      if (!r?.cdnUrl) return null;
      return {
        url: r.cdnUrl,
        label: getQuality(f.video, f.general?.fileName),
        height: heightOf(f),
        mediaFileId: f.mediaFileId,
        codec: getCodec(f.video?.format),                                          // H.265 / H.264 / AV1…
        hdr: getHdrTags(f.video?.hdrFormat || f.video?.hdrFormatCompatibility, f.general?.fileName), // ['DV','HDR10']
      };
    })
    .filter(Boolean);

  const currentResolved = byId.get(current?.mediaFileId);
  const url = currentResolved?.cdnUrl || variants[0]?.url;
  if (!url) throw new Error('No stream URL');

  const storyboard = buildStoryboard(url, current?.mediaFileId, currentResolved?.mediaFile) || null;

  return {
    url,
    fileId:      String(fileId ?? current?.id ?? current?.mediaFileId ?? ''),
    mediaFileId: current?.mediaFileId || null,
    title:       title || current?.general?.fileName || '',
    fileName:    current?.general?.fileName || '',
    overview:    record?.tmdb?.overview ?? '',   // shown on the pause info card (movies)
    recordId:    record?.id ?? record?.recordId ?? currentResolved?.recordId ?? null,
    audio:       currentResolved?.mediaFile?.audio || current?.audio || [],
    variants,
    episodes,
    storyboard,
    requestId:   currentResolved?.requestId ?? null,
  };
}

/**
 * Build the full player `media` payload from just a mediaFileId — used on refresh, a
 * shared deep-link (`/player/:mediaFileId`), and the instant Continue-Watching launch
 * (navigate first, resolve inside the player). Assembles the SAME shape as
 * resolveAndBuildMedia for an in-app launch: quality variants + rich episode list.
 *
 * @param {string} mediaFileId
 * @param {object} [hints]  { recordId, title, type } — lets callers that already know the
 *                          record (Continue-Watching) skip the discovery resolve.
 * @returns {Promise<object>} the media payload
 * @throws if the file can't be resolved to a stream URL
 */
export async function buildMediaFromFileId(mediaFileId, hints = {}) {
  if (!mediaFileId) throw new Error('No mediaFileId');

  // Discover the parent record. A cold deep-link resolves the file once to learn it;
  // Continue-Watching passes it as a hint and skips this round-trip.
  let recordId = hints.recordId ?? null;
  if (!recordId) {
    const resolved = await resolveMediaBatch([mediaFileId], 'ONLINE');
    const r = (resolved || []).find((x) => x.mediaFileId === mediaFileId) || (resolved || [])[0];
    if (!r?.cdnUrl) throw new Error('No stream URL');
    recordId = r.recordId ?? null;
  }

  // Record (TMDB seasons/title/overview) + its files (quality variants + episode list).
  const [record, infoResp] = await Promise.all([
    recordId ? fetchRecord(recordId).catch(() => null) : Promise.resolve(null),
    recordId ? loadStreamFileInfoByRecordId(recordId).catch(() => null) : Promise.resolve(null),
  ]);
  const rawFiles  = infoResp?.data ?? [];
  const converted = CommonServices.convertMediaInfoToCustomFormat(null, rawFiles);
  const current   = converted.find((f) => f.mediaFileId === mediaFileId)
    ?? { mediaFileId, id: mediaFileId };

  const episodes = buildHybridEpisodes(converted, current, record?.tmdb?.seasons);
  const isSeries = episodes.length > 0;

  return resolveAndBuildMedia({
    current,
    variantFiles: variantFilesFor(converted, current, isSeries),
    episodes,
    record: record ?? { recordId },
    title: hints.title || record?.tmdb?.title || record?.tmdb?.name || record?.name || current.general?.fileName || '',
    fileId: mediaFileId,
  });
}
