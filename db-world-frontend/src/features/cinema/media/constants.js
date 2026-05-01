// ─── Quality / HDR / Codec metadata shared across all media components ─────────

export const QUALITY_ORDER = ['8K', '4K', '2160p', '2K', '1440p', '1080p', '720p', '480p', '360p', 'SD', 'Unknown'];

export const QUALITY_META = {
  '8K':     { color: '#ff3d00', label: '8K' },
  '4K':     { color: '#ff6b35', label: '4K' },
  '2160p':  { color: '#ff6b35', label: '4K' },
  '2K':     { color: '#f59e0b', label: '2K' },
  '1440p':  { color: '#f59e0b', label: '1440p' },
  '1080p':  { color: '#10b981', label: '1080p' },
  '720p':   { color: '#3b82f6', label: '720p' },
  '480p':   { color: '#8b5cf6', label: '480p' },
  '360p':   { color: '#6b7280', label: '360p' },
  'SD':     { color: '#6b7280', label: 'SD' },
  'Unknown':{ color: '#4b5563', label: '?' },
};

export const HDR_META = {
  'DV':     { color: '#7c3aed', label: 'Dolby Vision' },
  'HDR10+': { color: '#d97706', label: 'HDR10+' },
  'HDR10':  { color: '#b45309', label: 'HDR10' },
  'HDR':    { color: '#92400e', label: 'HDR' },
};

export const CODEC_META = {
  'AV1':   { color: '#0891b2' },
  'H.265': { color: '#059669' },
  'H.264': { color: '#2563eb' },
  'VP9':   { color: '#7c3aed' },
};
