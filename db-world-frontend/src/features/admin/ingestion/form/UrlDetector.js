/**
 * Detects the likely source type from a URL string.
 * Returns one of: 'youtube' | 'torrent' | 'magnet' | 'http' | 'unknown'
 */

const YT_DOMAINS = [
  'youtube.com', 'youtu.be', 'www.youtube.com',
  'music.youtube.com', 'youtube-nocookie.com',
];

const YTDLP_DOMAINS = [
  'vimeo.com', 'dailymotion.com', 'twitch.tv',
  'twitter.com', 'x.com', 'reddit.com', 'instagram.com',
  'tiktok.com', 'bilibili.com',
];

export function detectUrlType(url) {
  if (!url || !url.trim()) return 'unknown';
  const s = url.trim().toLowerCase();

  if (s.startsWith('magnet:')) return 'magnet';

  if (s.endsWith('.torrent')) return 'torrent';

  try {
    const { hostname } = new URL(s.startsWith('http') ? s : `https://${s}`);
    if (YT_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))) return 'youtube';
    if (YTDLP_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))) return 'ytdlp';
  } catch {
    // not a valid URL yet
  }

  if (s.startsWith('http://') || s.startsWith('https://')) return 'http';
  return 'unknown';
}

export function isYtDlp(type) {
  return type === 'youtube' || type === 'ytdlp';
}

export function sourceLabel(type) {
  switch (type) {
    case 'youtube': return 'YouTube';
    case 'ytdlp':   return 'Streaming URL';
    case 'magnet':  return 'Magnet Link';
    case 'torrent': return 'Torrent';
    case 'http':    return 'HTTP/HTTPS';
    default:        return 'URL';
  }
}
