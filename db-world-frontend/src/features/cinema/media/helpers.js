// ─── Media helper functions shared across all media components ─────────────────
import { QUALITY_ORDER } from './constants';

export function getQuality({ resolution, width, height } = {}, fileName) {
  let w, h;

  if (resolution) {
    [w, h] = resolution.split('x').map(Number);
  } else if (width && height) {
    w = width;
    h = height;
  }

  if (w && h) {
    if (h >= 4320 || w >= 7680) return '8K';
    if (h >= 2160 || w >= 3840) return '4K';
    if (h >= 1440 || w >= 2560) return '1440p';
    if (h >= 1080 || w >= 1920) return '1080p';
    if (h >= 720  || w >= 1280) return '720p';
    if (h >= 480  || w >= 854)  return '480p';
    if (h > 0) return 'SD';
  }

  // Fallback to filename
  if (fileName) {
    const m = fileName.match(/(\d{3,4}p|4K|8K)/i);
    if (m) {
      const v = m[1].toUpperCase();
      return v === '4K' || v === '8K' ? v : m[1];
    }
  }

  return 'Unknown';
}

export function getCodec(videoFormat) {
  if (!videoFormat) return null;
  const f = videoFormat.toUpperCase();
  if (f.includes('AV1'))  return 'AV1';
  if (f.includes('HEVC') || f.includes('H.265') || f.includes('H265')) return 'H.265';
  if (f.includes('AVC')  || f.includes('H.264') || f.includes('H264')) return 'H.264';
  if (f.includes('VP9'))  return 'VP9';
  return videoFormat.split('(')[0].trim().split(' ')[0];
}

export function getHdrTags(hdrDetails, fileName) {
  const src = `${hdrDetails || ''} ${fileName || ''}`.toUpperCase();
  const tags = [];
  if (src.includes('DOLBY VISION') || src.includes(' DV ') || src.includes('.DV.')) tags.push('DV');
  if (src.includes('HDR10+') || src.includes('HDR10 PLUS') || src.includes('HDR10PLUS')) tags.push('HDR10+');
  else if (src.includes('HDR10')) tags.push('HDR10');
  else if (src.includes('HDR')) tags.push('HDR');
  return tags;
}

const ATMOS_HINTS = ['ATMOS', 'JOC'];
const DTSX_HINTS = ['DTS:X', 'DTS-X'];

/** 'ATMOS' | 'DTS:X' | null — object audio anywhere in a file's audio tracks. */
export function objectAudioTag(audioTracks) {
  const haystack = (audioTracks ?? [])
    .flatMap((a) => [a?.format, a?.commercialName, a?.formatCommercial, a?.title])
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  if (ATMOS_HINTS.some((h) => haystack.includes(h))) return 'ATMOS';
  if (DTSX_HINTS.some((h) => haystack.includes(h))) return 'DTS:X';
  return null;
}

export function getSeason(fileName) {
  if (!fileName) return null;
  const m = fileName.match(/[Ss](\d{1,2})[Ee]\d{1,2}/);
  return m ? String(parseInt(m[1], 10)).padStart(2, '0') : null;
}

export function getEpisodeNumber(fileName) {
  if (!fileName) return null;
  const m = fileName.match(/[Ss]\d{1,2}[Ee](\d{1,3})/);
  if (m) return parseInt(m[1], 10);
  const ep = fileName.match(/(?:^|[\s._-])E(\d{1,3})(?:[\s._-]|$)/i);
  return ep ? parseInt(ep[1], 10) : null;
}

export function qualityRank(q) {
  const idx = QUALITY_ORDER.indexOf(q);
  return idx === -1 ? 999 : idx;
}

const HEIGHT_BY_TIER = {
  '8K': 4320, '4K': 2160, '2160p': 2160, '1440p': 1440,
  '1080p': 1080, '720p': 720, '480p': 480, '360p': 360,
};

/**
 * Vertical resolution of a media file, falling back to the tier parsed from its
 * name. 0 when neither source knows.
 *
 * This is the single measure of "how good is this file" — comparing quality
 * LABELS instead put a 1440p and a 1080p rip in the same bucket, which is how
 * the same episode ended up listed twice.
 */
export function heightOf(file) {
  const res = file?.video?.resolution;
  if (typeof res === 'string' && res.includes('x')) {
    const h = Number(res.split('x')[1]);
    if (Number.isFinite(h) && h > 0) return h;
  }
  return HEIGHT_BY_TIER[getQuality(file?.video ?? {}, file?.general?.fileName)] ?? 0;
}

/**
 * The quality descriptor the player's Quality menu renders for one file. `url` is
 * added by whoever resolves the file — signed CDN urls go stale, so the offline
 * part is kept separate and carried around on its own.
 */
export function variantOf(file) {
  return {
    mediaFileId: file?.mediaFileId ?? file?.id ?? '',
    label:  getQuality(file?.video, file?.general?.fileName),
    height: heightOf(file),
    resolution: file?.video?.resolution ?? null,     // exact '1920x1080'
    // Two 1080p masters of the same episode differ by bit depth far more often than
    // by anything else, and without it both rows of the quality menu read "1080p".
    depth:  Number(file?.video?.bitDepth) || 0,
    bitRate: Number(file?.video?.bitRate) || 0,
    codec:  getCodec(file?.video?.format),                                   // H.265 / H.264 / AV1…
    // hdrDetails is the key convertMediaInfoToCustomFormat actually writes;
    // hdrFormat/hdrFormatCompatibility are the backend TrackDto names and never
    // survive the conversion, so reading those made every variant's HDR tag fall
    // back to guessing from the filename.
    hdr:    getHdrTags(file?.video?.hdrDetails, file?.general?.fileName),    // ['DV','HDR10']
  };
}
