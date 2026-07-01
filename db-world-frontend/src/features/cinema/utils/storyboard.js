import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

// Builds the scrub-preview storyboard descriptor the player needs, from a
// /api/stream/resolve response. Returns null when the file has no sprite
// (older files predating the feature, or generation failed) — the player then
// shows a time-only tooltip.
//
// The sprite is served by the Spring backend's StoryboardController at
// /storyboard/{mediaFileId}.jpg. That endpoint lives on the API host
// (api.db-world.in), NOT the CDN host that serves the video bytes
// (cdn.db-world.in) — the CDN vhost only serves /id/… and /path/…, so building
// the sprite URL from the video's cdnUrl origin 404s and the thumbnail never
// loads. We derive it from the API base instead: an absolute api.db-world.in URL
// in the native app / production, and a root-relative '/storyboard/…' in
// same-origin dev (which the dev server proxies). The cdnUrl arg is kept for
// call-site compatibility. The endpoint is public (whitelisted), so the plain
// <img>/CSS-background request needs no auth header.
export function buildStoryboard(cdnUrl, mediaFileId, mediaFile) {
  if (!mediaFileId || !mediaFile || !mediaFile.storyboardCount) return null;
  const apiBase = getApiBaseUrl(); // '' → root-relative (same-origin dev)
  return {
    url:        `${apiBase}/storyboard/${mediaFileId}.jpg`,
    intervalMs: mediaFile.storyboardIntervalMs,
    cols:       mediaFile.storyboardCols,
    rows:       mediaFile.storyboardRows,
    tileW:      mediaFile.storyboardTileW,
    tileH:      mediaFile.storyboardTileH,
    count:      mediaFile.storyboardCount,
  };
}
