// Route wrapper for the hybrid player. The media to play comes either from router
// state (fast path — the launcher already resolved the CDN URL + built episodes) or,
// on refresh / a shared deep-link / the instant Continue-Watching launch, is resolved
// on mount from the :mediaFileId in the URL. Restores the saved resume position
// (GET /api/cinema/progress/{fileId}), persists progress, and drives episode navigation.
//
// Route: /db-world/db-cinema/player/:mediaFileId
//   fast path:    navigate(playerPath(id), { state: { media } })
//   instant path: navigate(playerPath(id), { state: { resume: { recordId, title, type } } })
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { registerPlugin } from '@capacitor/core';
import CircularProgress from '@mui/material/CircularProgress';
import DbWorldVideoPlayer from './DbWorldVideoPlayer';
import { buildStoryboard } from '../../utils/storyboard';
import { buildMediaFromFileId } from '../../media/playerLaunch';
import { addWatched, tmdbImg } from '../../api/cinemaApi';
import { getWatchProgress, saveWatchProgress, saveWatchProgressOnExit, resolveMediaBatch, getRecordProgress } from '@shared/services/ApiServices';
import usePageMeta from '@shared/hooks/usePageMeta';
import { isNativePlayerEnabled } from './nativePlayerFlag';
import { watchedFraction, progressByFile } from '../../utils/watchProgress';
import { readCachedProgress, writeCachedProgress, clearCachedProgress, mergeProgress } from '../../utils/progressCache';
import { mediaInfoOf, videoSpecs, fileSpecs, techBadges, toBridgeRows, qualityLabel, variantDetail } from './mediaSpecs';

const NativePlayer = registerPlugin('NativePlayer');

// Compact audio-track formatters for the native Info sheet (mirror the web player's labels),
// built from the file's MediaInfo (`cur.audio`) which the ExoPlayer track list doesn't fully expose.
const _audCodec = (a) => {
  const raw = String(a.formatCommercial || a.format || a.codecId || '').toUpperCase();
  if (raw.includes('EAC3') || raw.includes('E-AC-3') || raw.includes('E-AC3')) return 'E-AC3';
  if (raw.includes('TRUEHD') || raw.includes('TRUE-HD')) return 'TrueHD';
  if (raw.includes('DTS-HD') || raw.includes('DTSHD')) return 'DTS-HD';
  if (raw.includes('DTS')) return 'DTS';
  if (raw.includes('AC-3') || raw.includes('AC3')) return 'AC3';
  if (raw.includes('AAC')) return 'AAC';
  if (raw.includes('OPUS')) return 'Opus';
  if (raw.includes('FLAC')) return 'FLAC';
  if (raw.includes('MP3') || raw.includes('MPEG AUDIO')) return 'MP3';
  if (raw.includes('PCM')) return 'PCM';
  return a.format || '';
};
const _audCh = (a) => {
  const n = Number(a.channels);
  if (n >= 8) return '7.1';
  if (n >= 6) return '5.1';
  if (n === 2) return 'Stereo';
  if (n === 1) return 'Mono';
  return '';
};
const _audBr = (a) => {
  const n = Number(a.bitRate);
  if (Number.isFinite(n) && n > 0) return `${Math.round(n / 1000)} kbps`;
  if (typeof a.bitRate === 'string' && a.bitRate.trim()) return a.bitRate.trim();
  return '';
};
const _audSr = (a) => {
  const hz = Number(a.sampleRate ?? a.samplingRate);
  return hz > 0 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz` : '';
};
const buildAudioInfo = (audio) => (audio || []).map((a, i) => ({
  name: a.language || a.title || `Audio ${i + 1}`,
  detail: [_audCodec(a), _audCh(a), _audBr(a), _audSr(a)].filter(Boolean).join(' · '),
}));

/**
 * Resume only if meaningfully into the file and not within 30s of the end.
 *
 * The local cache is consulted alongside the server because it is written far more often
 * — a crash, or a save the network never carried, leaves the server behind by up to a
 * heartbeat. Newest of the two wins, so watching on another device still takes priority.
 */
async function resumePointFor(fileId) {
  if (!fileId) return 0;
  let server = null;
  try { server = await getWatchProgress(fileId); } catch { /* offline or none */ }

  const best = mergeProgress(readCachedProgress(fileId), server);
  const pos = best?.positionMs || 0;
  const dur = best?.durationMs || 0;
  if (pos > 5000 && (dur === 0 || pos < dur - 30000)) return pos;
  return 0;
}

export default function HybridPlayerPage() {
  const { state } = useLocation();
  const { mediaFileId: routeId } = useParams();
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const watchedMarkedRef = useRef(new Set()); // record ids already auto-marked Watched this session
  const closedRef = useRef(false);            // guard: navigate back only once on native close

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

  const episodes  = useMemo(() => media?.episodes || [], [media]);
  // The show/movie name stays constant; per-episode info (S#E# · name) is derived
  // inside the player from `episodes` + `currentEpisodeId`.
  const showTitle = media?.title || media?.fileName || '';
  usePageMeta(showTitle ? `${showTitle} — DB Cinema` : 'Now Playing — DB Cinema', { exact: true });
  const [cur, setCur] = useState(null); // { url, fileId, startMs, audio, requestId, mediaFileId, recordId, variants }

  useEffect(() => {
    if (!media?.url) return undefined;
    let cancelled = false;
    (async () => {
      const startMs = await resumePointFor(media.fileId);
      if (!cancelled) setCur({
        url: media.url, fileId: media.fileId, startMs, audio: media.audio || [],
        storyboard: media.storyboard || null,
        info: media.mediaInfo || null,   // full MediaInfo → Info panel + tech badges
        // Quality alternatives of the file PLAYING NOW. They belong to `cur`, not
        // to `media`: an episode switch replaces them (see selectEpisode).
        variants: media.variants || [],
        // requestId comes from the ONLINE resolve (movie or first episode). Null-safe:
        // if the media was built without a resolve, telemetry is simply skipped.
        requestId: media.requestId || null,
        mediaFileId: media.mediaFileId || media.fileId || null,
        recordId: media.recordId ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [media]);

  // Per-episode watched bars. One request per record (not per episode); the entry for
  // the file playing is kept live from the progress ticks below, so the bar grows as
  // you watch instead of only after a reopen.
  const [watched, setWatched] = useState({});   // fileId -> 0..1
  const recordId = media?.recordId ?? null;
  useEffect(() => {
    if (!recordId || !episodes.length) return undefined;
    let cancelled = false;
    getRecordProgress(recordId)
      .then((rows) => {
        if (cancelled) return;
        setWatched(progressByFile(rows));
      })
      .catch(() => { /* bars are decoration — a failure just means none */ });
    return () => { cancelled = true; };
  }, [recordId, episodes.length]);

  // Leaving the player refreshes what was fetched before this session's watching: the
  // record page's per-episode bars, and Continue Watching — which is also what the hero
  // Resume button reads, so a stale entry would send it back to the previous episode.
  useEffect(() => () => {
    qc.invalidateQueries({ queryKey: ['record-progress'] });
    qc.invalidateQueries({ queryKey: ['continue-watching'] });
  }, [qc]);

  const episodesWithProgress = useMemo(
    () => episodes.map((e) => ({ ...e, progress: watched[String(e.fileId)] ?? 0 })),
    [episodes, watched],
  );

  const selectEpisode = useCallback(async (ep) => {
    // One batch resolve covers the file to play AND its quality alternatives, so
    // the Quality menu switches to the new episode's files instead of staying
    // pinned to the episode the player was launched on (where picking a quality
    // would have jumped back to that episode, and nothing matched the file
    // playing so no quality showed as selected).
    const playId  = ep.mediaFileId || ep.fileId;
    const descrs  = ep.variants?.length ? ep.variants : [{ mediaFileId: playId, label: '', height: 0 }];
    const ids     = [...new Set(descrs.map((v) => v.mediaFileId).filter(Boolean))];

    // The resolve and the resume point don't depend on each other, so running
    // them in parallel halves the wait before playback.
    const [resolved, startMs] = await Promise.all([
      ids.length ? resolveMediaBatch(ids, 'ONLINE').catch(() => []) : Promise.resolve([]),
      resumePointFor(ep.fileId),
    ]);
    const byId = new Map((resolved || []).map((r) => [r.mediaFileId, r]));

    const variants = descrs
      .map((v) => {
        const cdnUrl = byId.get(v.mediaFileId)?.cdnUrl;
        return cdnUrl ? { ...v, url: cdnUrl } : null;
      })
      .filter(Boolean);

    const r   = byId.get(playId);
    const url = r?.cdnUrl || ep.url || variants[0]?.url;
    if (!url) return;
    const info = mediaInfoOf(r?.mediaFile);
    setCur({
      url,
      fileId:      ep.fileId,
      startMs,
      audio:       info?.audio || [],
      info,
      storyboard:  buildStoryboard(url, playId, r?.mediaFile) || ep.storyboard || null,
      requestId:   r?.requestId || null,
      mediaFileId: playId || null,
      recordId:    r?.recordId ?? media?.recordId ?? null,
      variants,
    });
  }, [media]);

  // Native player: hand it a flat episode + variant list to display, and route its
  // episode-tap events back into the existing selectEpisode() (which resolves + reloads).
  useEffect(() => {
    if (!isNativePlayerEnabled() || !cur) return;
    const eps = (episodesWithProgress || []).map((e) => ({
      fileId: String(e.fileId),
      label: e.label || '',
      name: e.name || '',
      overview: e.overview || '',
      still: tmdbImg(e.stillPath, 'w300') || '',
      runtime: e.runtime ? `${e.runtime}m` : '',
      progress: e.progress,     // 0..1 watched bar on the native episode row
    }));
    const variants = (cur.variants || []).map((v) => ({
      url: v.url, label: qualityLabel(v), detail: variantDetail(v),
      mediaFileId: String(v.mediaFileId ?? ''),
    }));
    NativePlayer.setPlaylist({
      episodes: eps,
      variants,
      currentFileId: String(cur.fileId),
      // Which variant is on screen — the native Quality sheet has no other way to
      // mark the running quality, and it isn't always `currentFileId` (auto-pick
      // may open a different file than the one keying watch progress).
      currentVariantId: String(cur.mediaFileId ?? ''),
      title: showTitle,
      overview: media?.overview || '',
      storyboard: cur.storyboard || null,
      audioInfo: buildAudioInfo(cur.audio),
      // MediaInfo the native sheet can't read off ExoPlayer (container, bitrates,
      // colour, HDR format…) plus the record page's tech badges, formatted here so
      // both players show exactly the same strings.
      videoSpecs: toBridgeRows(videoSpecs(cur.info)),
      fileSpecs:  toBridgeRows(fileSpecs(cur.info)),
      badges:     techBadges(cur.info),
    }).catch(() => {});
  }, [episodesWithProgress, cur, media, showTitle]);

  // Native player: when the user closes it from the native X (which fires playerClosed),
  // pop this route so the WebView doesn't linger on the hidden headless player (white screen).
  useEffect(() => {
    if (!isNativePlayerEnabled()) return undefined;
    let handle;
    NativePlayer.addListener('playerClosed', () => {
      if (closedRef.current) return;
      closedRef.current = true;
      navigate(-1);
    }).then((h) => { handle = h; });
    return () => handle?.remove?.();
  }, [navigate]);

  useEffect(() => {
    if (!isNativePlayerEnabled()) return undefined;
    let handle;
    NativePlayer.addListener('playerSelectEpisode', ({ fileId }) => {
      const ep = (episodes || []).find((e) => String(e.fileId) === String(fileId));
      if (ep) selectEpisode(ep);
    }).then((h) => { handle = h; });
    return () => handle?.remove?.();
  }, [episodes, selectEpisode]);

  const handleProgress = useCallback(({ positionMs, durationMs, ended, network, onExit }) => {
    if (!cur?.fileId) return;
    const fraction = ended ? 1 : watchedFraction({ positionMs, durationMs });
    setWatched((prev) => (prev[cur.fileId] === fraction ? prev : { ...prev, [cur.fileId]: fraction }));

    // Local first, always: free, synchronous, and the thing that actually survives a
    // crash. Finishing clears the entry so a stale position can't resurrect a done file.
    if (ended) clearCachedProgress(cur.fileId);
    else writeCachedProgress(cur.fileId, { positionMs, durationMs });

    // The network save is the cross-device copy, and runs on the player's slower cadence.
    if (!network && !ended) return;
    const payload = {
      positionMs: ended ? 0 : positionMs,
      durationMs,
      recordId: media?.recordId ?? undefined,
    };
    if (onExit) saveWatchProgressOnExit(cur.fileId, payload);
    else saveWatchProgress(cur.fileId, payload).catch(() => {});

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
      variants={cur.variants || []}
      episodes={episodesWithProgress}
      currentEpisodeId={cur.fileId}
      onSelectEpisode={selectEpisode}
      onProgress={handleProgress}
      onClose={() => navigate(-1)}
      audio={cur.audio || []}
      info={cur.info || null}
      storyboard={cur.storyboard || null}
      requestId={cur.requestId || null}
      mediaFileId={cur.mediaFileId || null}
      recordId={cur.recordId ?? null}
    />
  );
}
