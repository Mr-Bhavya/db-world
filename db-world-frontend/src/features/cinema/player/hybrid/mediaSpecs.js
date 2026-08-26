// Technical detail for the file on screen.
//
// The record page reads a file's MediaInfo straight off the record's file list; the
// player only ever kept the audio tracks, so its Info panel could show a resolution
// TIER ("4K") and nothing else. Everything below is derived from the same MediaInfo,
// formatted ONCE here and rendered by both players — the web Info panel directly, the
// native Compose sheet via the rows pushed over the NativePlayer bridge.
import CommonServices from '@shared/services/CommonServices';
import { getQuality, getCodec, getHdrTags, objectAudioTag } from '../../media/helpers';
import { QUALITY_META, HDR_META, CODEC_META } from '../../media/constants';

const OBJECT_AUDIO_COLOR = '#8b5cf6';

/**
 * The stream-resolve endpoints hand back a raw MediaFileDto (a flat `tracks` array);
 * convert it to the general/video/audio/subtitle shape the rest of the app speaks.
 *
 * `mediaFile.audio` does NOT exist on that DTO — reading it is why an episode switch
 * used to leave the player with no track metadata at all.
 */
export function mediaInfoOf(mediaFile) {
  if (!mediaFile) return null;
  return CommonServices.convertMediaInfoToCustomFormat(null, [mediaFile])[0] ?? null;
}

/** Bits per second as "8.4 Mb/s", or null when unknown. */
export const mbps = (bps) => {
  const n = Number(bps);
  return Number.isFinite(n) && n > 0 ? `${(n / 1e6).toFixed(1)} Mb/s` : null;
};
const fpsText = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `${Number(n.toFixed(3))} fps` : null;
};
const durationText = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? CommonServices.formatDuration(n) : null;
};
const join = (...parts) => parts.filter(Boolean).join(' · ') || null;
/** Drop rows MediaInfo couldn't fill — a panel of "—" reads as broken, not as detailed. */
const kept = (pairs) => pairs.filter(([, v]) => v != null && v !== '' && v !== 'N/A');

/** Codec name without MediaInfo's trailing codec id — "HEVC (V_MPEGH/ISO/HEVC)" → "HEVC". */
const codecName = (format) => (format ? String(format).split('(')[0].trim() : null);

/** Video rows: exact geometry, codec profile, colour, frame rate, bitrate, HDR. */
export function videoSpecs(info) {
  const v = info?.video;
  if (!v) return [];
  const tier = getQuality(v, info?.general?.fileName);
  return kept([
    ['Resolution',  v.resolution
      ? `${v.resolution.replace('x', ' × ')}${tier && tier !== 'Unknown' ? ` (${tier})` : ''}`
      : (tier !== 'Unknown' ? tier : null)],
    ['Aspect ratio', v.aspectRatio],
    ['Codec',        codecName(v.format)],
    ['Profile',      join(v.formatProfile, v.formatLevel && `Level ${v.formatLevel}`, v.formatTier)],
    ['Bit depth',    v.bitDepth ? `${v.bitDepth}-bit` : null],
    ['Colour',       join(v.colourPrimaries, v.colorSpace, v.chromaSubsampling)],
    ['Transfer',     v.transferCharacteristics],
    ['HDR format',   v.hdrDetails],
    ['Frame rate',   join(fpsText(v.frameRate), v.frameRateMode)],
    ['Bitrate',      mbps(v.bitRate)],
    ['Stream size',  v.size],
  ]);
}

/** File rows: what the container is and how big it is. */
export function fileSpecs(info) {
  const g = info?.general;
  if (!g) return [];
  return kept([
    ['Container',       join(g.format, g.formatVersion)],
    ['Size',            g.fileSize],
    ['Overall bitrate', g.overallBitrate],
    ['Duration',        durationText(g.duration)],
    ['Encoder',         g.encodedLibrary || g.encodedApplication],
    ['Fast start',      g.isStreamable ? 'Yes' : null],
  ]);
}

/**
 * The record page's tech badges for the file actually playing — resolution, HDR,
 * object audio, codec. `filled` marks the resolution chip, which is solid there.
 */
export function techBadges(info) {
  if (!info) return [];
  const out = [];
  const quality = getQuality(info.video, info.general?.fileName);
  if (quality && quality !== 'Unknown') {
    const meta = QUALITY_META[quality] || QUALITY_META.Unknown;
    out.push({ label: meta.label, color: meta.color, filled: true });
  }
  for (const tag of getHdrTags(info.video?.hdrDetails, info.general?.fileName)) {
    const meta = HDR_META[tag];
    if (meta) out.push({ label: meta.label, color: meta.color, filled: false });
  }
  const object = objectAudioTag(info.audio);
  if (object) out.push({ label: object, color: OBJECT_AUDIO_COLOR, filled: false });
  const codec = getCodec(info.video?.format);
  if (codec) out.push({ label: codec, color: (CODEC_META[codec] || {}).color || '#6b7280', filled: false });
  return out;
}

/** [label, value] pairs → the { name, detail } rows the native bridge carries. */
export const toBridgeRows = (pairs) => pairs.map(([name, detail]) => ({ name, detail: String(detail) }));

/**
 * A quality-menu row: "1080p · H.265 · 10-bit · HDR10". Bit depth is named only above 8
 * — 8-bit is the unremarkable default, but depth is usually the ONLY thing separating
 * two 1080p masters of the same episode, and without it both rows read identically.
 */
export const qualityLabel = (v) => [
  v?.label,
  v?.codec,
  v?.depth > 8 ? `${v.depth}-bit` : null,
  ...(v?.hdr || []),
].filter(Boolean).join(' · ');

/**
 * The second line of a quality row: "1920 × 1080 · 8.4 Mb/s". The label above it is a
 * TIER — two rows both reading "1080p" say nothing about which is the bigger file, and
 * the bitrate is what actually decides whether a connection can carry it.
 */
export const variantDetail = (v) => [
  v?.resolution ? v.resolution.replace('x', ' × ') : null,
  mbps(v?.bitRate),
].filter(Boolean).join(' · ');
