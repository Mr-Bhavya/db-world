// Route wrapper for the hybrid player. The media to play comes either from router
// state (fast path — the launcher already resolved the CDN URL + built episodes) or,
// on refresh / a shared deep-link / the instant Continue-Watching launch, is resolved
// on mount from the :mediaFileId in the URL. Restores the saved resume position
// (GET /api/cinema/progress/{fileId}), persists progress, and drives episode navigation.
//
// Route: /db-world/db-cinema/player/:mediaFileId
//   fast path:    navigate(playerPath(id), { state: { media } })
//   instant path: navigate(playerPath(id), { state: { resume: { recordId, title, type } } })
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import CircularProgress from '@mui/material/CircularProgress';
import DbWorldVideoPlayer from './DbWorldVideoPlayer';
import { buildStoryboard } from '../../utils/storyboard';
import { buildMediaFromFileId } from '../../media/playerLaunch';
import { addWatched } from '../../api/cinemaApi';
import { getWatchProgress, saveWatchProgress, resolveMediaUrl } from '@shared/services/ApiServices';
import usePageMeta from '@shared/hooks/usePageMeta';

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
  const { mediaFileId: routeId } = useParams();
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const watchedMarkedRef = useRef(new Set()); // record ids already auto-marked Watched this session

  // media: from route state (fast in-app launch) or resolved from the URL id (refresh /
  // deep-link / instant Continue-Watching). Resolving happens behind the loading screen.
  const [media, setMedia]   = useState(() => state?.media || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (media || !routeId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const m = await buildMediaFromFileId(routeId, state?.resume || {});
        if (!cancelled) setMedia(m);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [routeId, media, state]);

  const episodes  = media?.episodes || [];
  // The show/movie name stays constant; per-episode info (S#E# · name) is derived
  // inside the player from `episodes` + `currentEpisodeId`.
  const showTitle = media?.title || media?.fileName || '';
  usePageMeta(showTitle ? `${showTitle} — DB Cinema` : 'Now Playing — DB Cinema', { exact: true });
  const [cur, setCur] = useState(null); // { url, fileId, startMs, audio, requestId, mediaFileId, recordId }

  useEffect(() => {
    if (!media?.url) return undefined;
    let cancelled = false;
    (async () => {
      const startMs = await resumePointFor(media.fileId);
      if (!cancelled) setCur({
        url: media.url, fileId: media.fileId, startMs, audio: media.audio || [],
        storyboard: media.storyboard || null,
        // requestId comes from the ONLINE resolve (movie or first episode). Null-safe:
        // if the media was built without a resolve, telemetry is simply skipped.
        requestId: media.requestId || null,
        mediaFileId: media.mediaFileId || media.fileId || null,
        recordId: media.recordId ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [media]);

  const selectEpisode = useCallback(async (ep) => {
    // Resolve the stream URL and the resume point concurrently — they don't depend
    // on each other, so running them in parallel halves the wait before playback.
    const [resolved, startMs] = await Promise.all([
      (!ep.url && ep.mediaFileId)
        ? resolveMediaUrl(ep.mediaFileId, 'ONLINE').catch(() => null)
        : Promise.resolve(null),
      resumePointFor(ep.fileId),
    ]);

    let url = ep.url;
    let mf = null;
    let storyboard = ep.storyboard || null;
    let requestId = null;
    let recordId = media?.recordId ?? null;
    if (resolved?.data?.cdnUrl) {
      url = resolved.data.cdnUrl;
      mf = resolved.data.mediaFile;
      storyboard = buildStoryboard(url, ep.mediaFileId, mf) || storyboard;
      requestId = resolved.data.requestId || null;
      recordId = resolved.data.recordId ?? recordId;
    }
    if (!url) return;
    setCur({
      url, fileId: ep.fileId, startMs, audio: mf?.audio || [], storyboard,
      requestId, mediaFileId: ep.mediaFileId || ep.fileId || null, recordId,
    });
  }, [media]);

  const handleProgress = useCallback(({ positionMs, durationMs, ended }) => {
    if (!cur?.fileId) return;
    saveWatchProgress(cur.fileId, {
      positionMs: ended ? 0 : positionMs,
      durationMs,
      recordId: media?.recordId ?? undefined,
    }).catch(() => {});

    // Auto-mark the record Watched once the title truly finishes: a movie (no episodes)
    // or the LAST episode of a series. Fire once per record, then refresh Continue
    // Watching so the finished title drops out of the row.
    if (ended && media?.recordId && !watchedMarkedRef.current.has(media.recordId)) {
      const eps = media.episodes || [];
      const isLast = eps.length === 0 || eps[eps.length - 1]?.fileId === cur.fileId;
      if (isLast) {
        watchedMarkedRef.current.add(media.recordId);
        addWatched(media.recordId)
          .then(() => qc.invalidateQueries({ queryKey: ['continue-watching'] }))
          .catch(() => {});
      }
    }
  }, [cur, media, qc]);

  // Neither a URL id nor route media → nothing to play.
  useEffect(() => {
    if (!routeId && !media) navigate(-1);
  }, [routeId, media, navigate]);

  if (failed) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'grid',
        placeItems: 'center', color: '#fff', textAlign: 'center', padding: 24 }}>
        <div style={{ display: 'grid', gap: 16, placeItems: 'center' }}>
          <div>Couldn’t load this video.</div>
          <button onClick={() => navigate(-1)}
            style={{ padding: '10px 22px', background: '#14b8a6', color: '#fff', border: 'none',
              borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!media || !cur) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'grid', placeItems: 'center' }}>
        <CircularProgress sx={{ color: '#14b8a6' }} />
      </div>
    );
  }

  return (
    <DbWorldVideoPlayer
      src={cur.url}
      startMs={cur.startMs}
      title={showTitle}
      overview={media?.overview || ''}
      fileId={cur.fileId}
      variants={media.variants || []}
      episodes={episodes}
      currentEpisodeId={cur.fileId}
      onSelectEpisode={selectEpisode}
      onProgress={handleProgress}
      onClose={() => navigate(-1)}
      audio={cur.audio || []}
      storyboard={cur.storyboard || null}
      requestId={cur.requestId || null}
      mediaFileId={cur.mediaFileId || null}
      recordId={cur.recordId ?? null}
    />
  );
}
