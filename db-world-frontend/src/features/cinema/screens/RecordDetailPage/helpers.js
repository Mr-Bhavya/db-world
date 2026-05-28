// Pure helpers for RecordDetailPage — formatters, quality detection, color picks.

export const getUserId = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1] ?? 'e30='));
    return payload?.userId ?? null;
  } catch {
    return null;
  }
};

export const formatCurrency = (val) => {
  if (!val || val === 0) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const formatBitrate = (bps) => {
  if (!bps) return null;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
};

export const getRatingColor = (rating) => {
  if (rating >= 7.5) return '#4caf50';
  if (rating >= 6) return '#ff9800';
  return '#f44336';
};

// Quality / codec metadata for the Watch section.
export const QUALITY_ORDER = ['8K', '4K', '2160p', '1440p', '1080p', '720p', '480p', 'SD', 'Unknown'];

export const QUALITY_META = {
  '8K':      { color: '#ff3d00', label: '8K' },
  '4K':      { color: '#ff6b35', label: '4K' },
  '2160p':   { color: '#ff6b35', label: '4K' },
  '1440p':   { color: '#f59e0b', label: '1440p' },
  '1080p':   { color: '#10b981', label: '1080p' },
  '720p':    { color: '#3b82f6', label: '720p' },
  '480p':    { color: '#8b5cf6', label: '480p' },
  'SD':      { color: '#6b7280', label: 'SD' },
  'Unknown': { color: '#4b5563', label: '?' },
};

export const CODEC_META = {
  'AV1':   { color: '#0891b2' },
  'H.265': { color: '#059669' },
  'H.264': { color: '#2563eb' },
  'VP9':   { color: '#7c3aed' },
};

export function getQuality(video, fileName) {
  if (video?.resolution) {
    const [w, h] = video.resolution.split('x').map(Number);
    if (h >= 4320 || w >= 7680) return '8K';
    if (h >= 2160 || w >= 3840) return '4K';
    if (h >= 1440 || w >= 2560) return '1440p';
    if (h >= 1080 || w >= 1920) return '1080p';
    if (h >= 720  || w >= 1280) return '720p';
    if (h >= 480  || w >= 854)  return '480p';
    if (h > 0) return 'SD';
  }
  if (fileName) {
    const m = fileName.match(/(\d{3,4}p|4K|8K)/i);
    if (m) return m[1];
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
  return videoFormat.split('(')[0].trim().split(' ')[0] || null;
}
