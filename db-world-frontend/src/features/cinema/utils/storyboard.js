// Builds the scrub-preview storyboard descriptor the player needs, from a
// /api/stream/resolve response. Returns null when the file has no sprite
// (older files predating the feature, or generation failed) — the player then
// shows a time-only tooltip.
//
// The sprite is served by the same CDN host as the video, at
// /storyboard/{mediaFileId}.jpg, so we derive its URL from the resolved cdnUrl.
export function buildStoryboard(cdnUrl, mediaFileId, mediaFile) {
  if (!cdnUrl || !mediaFileId || !mediaFile || !mediaFile.storyboardCount) return null;
  try {
    const origin = new URL(cdnUrl).origin;
    return {
      url:        `${origin}/storyboard/${mediaFileId}.jpg`,
      intervalMs: mediaFile.storyboardIntervalMs,
      cols:       mediaFile.storyboardCols,
      rows:       mediaFile.storyboardRows,
      tileW:      mediaFile.storyboardTileW,
      tileH:      mediaFile.storyboardTileH,
      count:      mediaFile.storyboardCount,
    };
  } catch {
    return null;
  }
}
