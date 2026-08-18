// ─── Automatic quality selection for online streaming ──────────────────────────
//
// Playback here is discrete files over progressive HTTP — one whole file per
// quality, no HLS/DASH manifest, so there is no mid-stream adaptation to lean
// on. That makes the choice made at LAUNCH the one that matters: get it right
// and the user never touches the quality button; get it wrong and they either
// stare at a spinner or watch 480p on a 4K panel.
//
// Three independent gates, applied in order. Each can only ever narrow the
// candidate set, and if they narrow it to nothing we fall back to the smallest
// file rather than refusing to play.

import { getCodec, getQuality, qualityRank } from './helpers';

/** Height of the largest picture this display can actually resolve. */
function deviceMaxHeight() {
  if (typeof window === 'undefined') return 1080;
  const dpr = window.devicePixelRatio || 1;
  const s = window.screen || {};
  // Physical pixels on the long edge — a phone in portrait still has a
  // landscape-shaped video area, so orientation shouldn't change the answer.
  const longEdge = Math.max(s.width || 0, s.height || 0) * dpr;
  const shortEdge = Math.min(s.width || 0, s.height || 0) * dpr;
  if (!longEdge) return 1080;

  // Video fills the SHORT edge in a 16:9 landscape frame, so that's the real
  // vertical resolution ceiling. Rounded up to the nearest standard tier so a
  // 1200px-tall panel isn't denied 1080p over 120 pixels.
  const usable = Math.max(shortEdge, longEdge * 0.5625);
  if (usable >= 3200) return 4320;
  if (usable >= 1700) return 2160;
  if (usable >= 1300) return 1440;
  if (usable >= 900)  return 1080;
  if (usable >= 620)  return 720;
  return 480;
}

/**
 * Sustained throughput in megabits/sec, or null when the browser won't say.
 *
 * navigator.connection.downlink is a rounded recent-throughput estimate, not a
 * capacity measurement, so it is treated as a ceiling to stay under rather than
 * a target to fill.
 */
function downlinkMbps() {
  if (typeof navigator === 'undefined') return null;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return null;
  if (typeof c.downlink === 'number' && c.downlink > 0) return c.downlink;
  // Older Androids expose only the generation.
  switch (c.effectiveType) {
    case 'slow-2g': return 0.05;
    case '2g':      return 0.25;
    case '3g':      return 1.5;
    case '4g':      return 10;
    default:        return null;
  }
}

function saveDataOn() {
  if (typeof navigator === 'undefined') return false;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return !!c?.saveData;
}

/* Codec probes. Cached — canPlayType forces a codec-registry lookup and this
   runs once per candidate file otherwise. */
let codecCache = null;

function codecSupport() {
  if (codecCache) return codecCache;
  const probe = (type) => {
    try {
      const v = document.createElement('video');
      return v.canPlayType(type) !== '';
    } catch { return false; }
  };
  codecCache = {
    // hvc1/hev1 both appear in the wild; either answering yes is enough.
    'H.265': probe('video/mp4; codecs="hvc1.1.6.L93.B0"') || probe('video/mp4; codecs="hev1.1.6.L93.B0"'),
    'AV1':   probe('video/mp4; codecs="av01.0.05M.08"'),
    'VP9':   probe('video/webm; codecs="vp9"'),
    'H.264': true,   // universal floor
  };
  return codecCache;
}

/**
 * Whether this platform can be trusted to play a codec the browser denies.
 *
 * Inside the Capacitor shell the actual decoder is ExoPlayer, not the WebView,
 * and ExoPlayer handles HEVC on essentially every Android device that ships a
 * hardware decoder. Asking canPlayType there would wrongly rule out every 4K
 * HEVC file, so native playback skips the codec gate entirely.
 */
function nativeDecoding() {
  if (typeof window === 'undefined') return false;
  return !!(window.Capacitor?.isNativePlatform?.());
}

/** Megabits/sec this file needs, or null when we can't tell. */
function requiredMbps(file) {
  const bps = Number(file?.video?.bitRate);
  if (Number.isFinite(bps) && bps > 0) return bps / 1e6;
  return null;
}

function heightOf(file) {
  const res = file?.video?.resolution;
  if (typeof res === 'string' && res.includes('x')) {
    const h = Number(res.split('x')[1]);
    if (Number.isFinite(h) && h > 0) return h;
  }
  // Fall back to the quality tier parsed from the filename.
  const q = getQuality(file?.video ?? {}, file?.general?.fileName);
  const map = { '8K': 4320, '4K': 2160, '2160p': 2160, '2K': 1440, '1440p': 1440, '1080p': 1080, '720p': 720, '480p': 480, '360p': 360 };
  return map[q] ?? 0;
}

/** Best-first: highest resolution, then highest bitrate as the tie-break. */
function byQualityDesc(a, b) {
  const h = heightOf(b) - heightOf(a);
  if (h !== 0) return h;
  const q = qualityRank(getQuality(a?.video ?? {}, a?.general?.fileName))
          - qualityRank(getQuality(b?.video ?? {}, b?.general?.fileName));
  if (q !== 0) return q;
  return (requiredMbps(b) ?? 0) - (requiredMbps(a) ?? 0);
}

/**
 * Choose the file to open a stream with.
 *
 * Returns `{ file, reason, caps }` — `reason` is a short human string the UI
 * can show ("4K · fits your connection"), because a silent automatic choice
 * that picks 720p on a fast line just reads as the app being broken.
 *
 * @param {Array}  files          candidate media files (same title/episode)
 * @param {object} [opts]
 * @param {number} [opts.headroom] fraction of measured downlink we're willing
 *                                 to commit to video. Defaults to 0.7 — the
 *                                 rest absorbs protocol overhead, other tabs,
 *                                 and the fact that downlink lags reality.
 */
export function pickAutoQuality(files, opts = {}) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) return { file: null, reason: null, caps: null };

  const headroom = opts.headroom ?? 0.7;
  const maxH = deviceMaxHeight();
  const mbps = downlinkMbps();
  const saver = saveDataOn();
  const native = nativeDecoding();
  const support = native ? null : codecSupport();

  const caps = { maxHeight: maxH, downlinkMbps: mbps, saveData: saver, native };

  const sorted = [...list].sort(byQualityDesc);

  // ── Gate 1: codec. A file the decoder can't open is worse than no choice. ──
  const playable = native
    ? sorted
    : sorted.filter((f) => {
        const codec = getCodec(f?.video?.format);
        if (!codec) return true;                  // unknown → let the player try
        return support[codec] !== false;
      });
  const afterCodec = playable.length ? playable : sorted;

  // ── Gate 2: display. No point shipping 4K to a 720p panel. ──
  // Data saver clamps hard regardless of screen.
  const heightCap = saver ? 720 : maxH;
  const fitsScreen = afterCodec.filter((f) => {
    const h = heightOf(f);
    return h === 0 || h <= heightCap;
  });
  const afterScreen = fitsScreen.length ? fitsScreen : [afterCodec[afterCodec.length - 1]];

  // ── Gate 3: bandwidth. Only applied when the browser gave us a number. ──
  if (mbps == null) {
    const file = afterScreen[0];
    return { file, reason: describe(file, 'best for this screen'), caps };
  }

  const budget = mbps * headroom;
  const fitsPipe = afterScreen.filter((f) => {
    const need = requiredMbps(f);
    return need == null || need <= budget;    // unknown bitrate → don't exclude
  });

  if (fitsPipe.length) {
    const file = fitsPipe[0];
    return { file, reason: describe(file, saver ? 'data saver' : 'fits your connection'), caps };
  }

  // Nothing fits the pipe — take the smallest rather than stalling on the
  // biggest, and say so.
  const file = afterScreen[afterScreen.length - 1];
  return { file, reason: describe(file, 'lowest available for this connection'), caps };
}

function describe(file, why) {
  if (!file) return null;
  const q = getQuality(file?.video ?? {}, file?.general?.fileName);
  return `${q} · ${why}`;
}

export default pickAutoQuality;
