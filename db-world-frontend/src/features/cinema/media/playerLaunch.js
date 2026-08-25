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
import { episodeRefOf, buildHybridEpisodes } from '../utils/episodeUtils';
import { fetchRecord } from '../api/cinemaApi';
import { variantOf } from './helpers';
import { mediaInfoOf } from '../player/hybrid/mediaSpecs';
import { pickAutoQuality } from './pickAutoQuality';

/** Stable season-episode key: prefer TMDB season/episode fields, else parse the filename. */
export function episodeKey(f) {
  const ref = episodeRefOf(f);
  return ref ? `${ref.season}-${ref.episode}` : 'none';
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
 * @param {boolean}  [args.autoPick]    choose the starting file from variantFiles by device
 *                                      capability and connection instead of taking `current`
 *                                      as given. Used by every "just press play" entry point.
 * @returns {Promise<object>} the media payload
 * @throws if no stream URL could be resolved
 */
export async function resolveAndBuildMedia({ current, variantFiles, episodes = [], record = null, title = '', fileId, autoPick = false }) {
  const files = (variantFiles?.length ? variantFiles : [current]).filter(Boolean);

  // Pick the file to OPEN with. Playback is discrete-file (no manifest, no
  // mid-stream adaptation), so this one decision is the whole of "adaptive"
  // quality — the player's quality button remains the manual override.
  let autoReason = null;
  let start = current;
  if (autoPick && files.length > 1) {
    const picked = pickAutoQuality(files);
    if (picked.file) { start = picked.file; autoReason = picked.reason; }
  }

  const ids = [...new Set(files.map((f) => f?.mediaFileId).filter(Boolean))];

  const resolved = ids.length ? await resolveMediaBatch(ids, 'ONLINE') : [];
  const byId = new Map((resolved || []).map((r) => [r.mediaFileId, r]));

  const variants = files
    .map((f) => {
      const r = byId.get(f?.mediaFileId);
      return r?.cdnUrl ? { ...variantOf(f), url: r.cdnUrl } : null;
    })
    .filter(Boolean);

  const currentResolved = byId.get(start?.mediaFileId);
  const url = currentResolved?.cdnUrl || variants[0]?.url;
  if (!url) throw new Error('No stream URL');

  const storyboard = buildStoryboard(url, start?.mediaFileId, currentResolved?.mediaFile) || null;

  // Full MediaInfo of the file being opened, for the player's Info panel and tech
  // badges. The resolve carries it; `start` is the same file already converted, so
  // it stands in when the resolve came back without track data.
  const mediaInfo = mediaInfoOf(currentResolved?.mediaFile) ?? (start?.video ? start : null);

  return {
    url,
    // fileId keys watch progress, so it stays tied to the file the caller
    // identified — swapping quality must not fork someone's resume position.
    fileId:      String(fileId ?? current?.id ?? current?.mediaFileId ?? ''),
    mediaFileId: start?.mediaFileId || null,
    title:       title || start?.general?.fileName || '',
    fileName:    start?.general?.fileName || '',
    overview:    record?.tmdb?.overview ?? '',   // shown on the pause info card (movies)
    recordId:    record?.id ?? record?.recordId ?? currentResolved?.recordId ?? null,
    audio:       mediaInfo?.audio || start?.audio || [],
    mediaInfo,
    variants,
    episodes,
    storyboard,
    requestId:   currentResolved?.requestId ?? null,
    autoReason,
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
