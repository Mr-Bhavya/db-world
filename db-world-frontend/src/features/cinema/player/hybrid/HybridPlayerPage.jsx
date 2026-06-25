// Route wrapper for the hybrid player. Reads the media to play from router state,
// restores the saved resume position (GET /api/cinema/progress/{fileId}), renders
// the shared player, persists progress (PUT) on pause/close/end + periodically, and
// drives episode navigation (resolving each episode's resume point on switch).
//
// Expected navigation: navigate(DB_PLAYER_ROUTE, { state: { media: {
//   url, fileId, title, fileName, recordId, variants, episodes } } })
import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DbWorldVideoPlayer from './DbWorldVideoPlayer';
import { buildStoryboard } from '../../utils/storyboard';
import { getWatchProgress, saveWatchProgress, resolveMediaUrl } from '@shared/services/ApiServices';

// Resume only if meaningfully into the file and not within 30s of the end.
async function resumePointFor(fileId) {
  if (!fileId) return 0;
  try {
    const p   = await getWatchProgress(fileId);
    const pos = p?.positionMs || 0;
    const dur = p?.durationMs || 0;
    if (pos > 5000 && (dur === 0 || pos < dur - 30000)) return pos;
  } catch { /* none */ }
  return 0;
}

export default function HybridPlayerPage() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const media     = state?.media;
  const episodes  = media?.episodes || [];
  // The show/movie name stays constant; per-episode info (S#E# · name) is derived
  // inside the player from `episodes` + `currentEpisodeId`.
  const showTitle = media?.title || media?.fileName || '';
  const [cur, setCur] = useState(null); // { url, fileId, startMs, audio }

  useEffect(() => {
    if (!media?.url) { navigate(-1); return undefined; }
    let cancelled = false;
    (async () => {
      const startMs = await resumePointFor(media.fileId);
      if (!cancelled) setCur({
        url: media.url, fileId: media.fileId, startMs, audio: media.audio || [],
        storyboard: media.storyboard || null,
      });
    })();
    return () => { cancelled = true; };
  }, [media, navigate]);

  const selectEpisode = useCallback(async (ep) => {
    let url = ep.url;
    let mf = null;
    let storyboard = ep.storyboard || null;
    if (!url && ep.mediaFileId) {
      try {
        const r = await resolveMediaUrl(ep.mediaFileId, 'ONLINE');
        url = r?.data?.cdnUrl; mf = r?.data?.mediaFile;
        storyboard = buildStoryboard(url, ep.mediaFileId, mf) || storyboard;
      } catch { /* ignore */ }
    }
    if (!url) return;
    const startMs = await resumePointFor(ep.fileId);
    setCur({ url, fileId: ep.fileId, startMs, audio: mf?.audio || [], storyboard });
  }, []);

  const handleProgress = useCallback(({ positionMs, durationMs, ended }) => {
    if (!cur?.fileId) return;
    saveWatchProgress(cur.fileId, {
      positionMs: ended ? 0 : positionMs,
      durationMs,
      recordId: media?.recordId ?? undefined,
    }).catch(() => {});
  }, [cur, media]);

  if (!media?.url) return null;
  if (!cur) return <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000 }} />;

  return (
    <DbWorldVideoPlayer
      src={cur.url}
      startMs={cur.startMs}
      title={showTitle}
      fileId={cur.fileId}
      variants={media.variants || []}
      episodes={episodes}
      currentEpisodeId={cur.fileId}
      onSelectEpisode={selectEpisode}
      onProgress={handleProgress}
      onClose={() => navigate(-1)}
      audio={cur.audio || []}
      storyboard={cur.storyboard || null}
    />
  );
}
