// ─── Media helper functions shared across all media components ─────────────────

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
    if (m) {
      const v = m[1].toLowerCase();
      return v === '4k' ? '4K' : v === '8k' ? '8K' : m[1];
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

export function getSeason(fileName) {
  if (!fileName) return null;
  const m = fileName.match(/[Ss](\d{1,2})[Ee]\d{1,2}/);
  return m ? String(parseInt(m[1], 10)).padStart(2, '0') : null;
}
