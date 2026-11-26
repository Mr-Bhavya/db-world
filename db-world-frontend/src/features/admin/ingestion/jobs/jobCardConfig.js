import {
  Archive,
  CheckCircle,
  Download,
  Error as ErrorIcon,
  Folder,
  HourglassEmpty,
  Http,
  Link as Magnet,
  Merge,
  Pause,
  Queue,
  VideoSettings,
  YouTube,
  Subtitles,
} from '@mui/icons-material';

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function fmtClock(ms) {
  const total = Number(ms);
  if (!Number.isFinite(total) || total < 0) return null;
  const s = Math.floor(total / 1000);
  const hh = Math.floor(s / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  const body = `${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return hh > 0 ? `${hh}:${body}` : body;
}

// Guarded "12:03 / 25:40" encode readout: only shown when the position is within the clip's
// own duration and the duration itself is sane — so a stale/wrong-unit value can never render
// as hundreds of hours. Returns null (→ hidden) otherwise.
export function encodeTime(positionMs, durationMs) {
  const pos = Number(positionMs);
  const dur = Number(durationMs);
  if (!Number.isFinite(dur) || dur <= 0 || dur > 24 * 3600 * 1000) return null;
  if (!Number.isFinite(pos) || pos < 0 || pos > dur * 1.05) return null;
  return `${fmtClock(pos)} / ${fmtClock(dur)}`;
}

export function timeAgo(ts) {
  if (!ts) return null;
  const diff = Date.now() - Number(ts);
  if (!Number.isFinite(diff)) return null;

  const s = Math.floor(diff / 1000);
  if (s < 10) return 'Just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function safeDisplayName(fileName, uri, jobId) {
  if (fileName) return fileName;
  if (uri) {
    try {
      const raw = uri.split('/').pop()?.split('?')[0];
      return raw || jobId;
    } catch {
      return jobId;
    }
  }
  return jobId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

// Phase-aware chip config — ONE label for the current phase. The StageBar below is the visual
// breadcrumb, so the fine step is never repeated as text. Derived from status + step in the card.
export const PHASE_CFG = {
  QUEUED: { label: 'Queued', color: 'default', Icon: Queue },
  STARTED: { label: 'Starting', color: 'info', Icon: HourglassEmpty },
  DOWNLOADING: { label: 'Downloading', color: 'primary', Icon: Download },
  ARIA2_WAITING: { label: 'Waiting for aria2', color: 'warning', Icon: HourglassEmpty },
  ARIA2_PAUSED: { label: 'Paused in aria2', color: 'warning', Icon: Pause },
  EXTRACT: { label: 'Extracting', color: 'primary', Icon: Archive },
  MERGING: { label: 'Merging', color: 'primary', Icon: Merge },
  FFMPEG: { label: 'Encoding', color: 'warning', Icon: VideoSettings },
  MEDIA_INFO: { label: 'Media info', color: 'warning', Icon: VideoSettings },
  PROCESSING: { label: 'Processing', color: 'warning', Icon: VideoSettings },
  AWAITING_INPUT: { label: 'Needs tracks', color: 'secondary', Icon: Subtitles },
  PAUSED: { label: 'Paused', color: 'warning', Icon: Pause },
  SUCCESS: { label: 'Completed', color: 'success', Icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'error', Icon: ErrorIcon },
  CANCELLED: { label: 'Cancelled', color: 'default', Icon: ErrorIcon },
};

export const STEP_CFG = {
  DOWNLOAD: { label: 'Download', Icon: Download },
  EXTRACT: { label: 'Extract', Icon: Archive },
  MERGE: { label: 'Merge', Icon: Merge },
  FFMPEG: { label: 'FFmpeg', Icon: VideoSettings },
  MEDIA_INFO: { label: 'Media Info', Icon: VideoSettings },
};

export const SOURCE_ICONS = {
  YOUTUBE: YouTube,
  HTTP: Http,
  TORRENT: Magnet,
  LOCAL: Folder,
};

export const PIPELINE = ['DOWNLOAD', 'EXTRACT', 'MERGE', 'FFMPEG', 'MEDIA_INFO'];
