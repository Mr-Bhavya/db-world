// Shared resolve→launch pipeline for the hybrid video player.
//
// Every "play" entry point (Record-Details, Continue-Watching, the media-details drawer)
// funnels through resolveAndBuildMedia() so the player payload — url, variants, episodes,
// storyboard, requestId, audio, ids — is assembled IDENTICALLY. This kills the recurring
// class of bugs where one launch path silently dropped a field (missing storyboard /
// variants / requestId). The quality variants of the current title are resolved in ONE
// batch call (POST /api/stream/resolve-batch) instead of N per-file resolves.
import { resolveMediaBatch } from '@shared/services/ApiServices';
import { buildStoryboard } from '../utils/storyboard';
import { parseEpisode } from '../utils/episodeUtils';
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
    recordId:    record?.id ?? record?.recordId ?? currentResolved?.recordId ?? null,
    audio:       currentResolved?.mediaFile?.audio || current?.audio || [],
    variants,
    episodes,
    storyboard,
    requestId:   currentResolved?.requestId ?? null,
  };
}
