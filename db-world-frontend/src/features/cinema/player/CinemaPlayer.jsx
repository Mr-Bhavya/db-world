/**
 * CinemaPlayer — Netflix/Prime-style in-browser video player.
 *
 * Props:
 *   open        {boolean}
 *   onClose     {() => void}
 *   mediaInfo   {object}   — current file (streamUrl, general, video, audio, subtitle)
 *   allFiles    {array}    — optional: all quality variants, enables quality switching
 *   record      {object}   — optional: record metadata for title display
 */
import React, {
  useRef, useState, useEffect, useCallback, useMemo,
} from 'react';
import {
  Box, Typography, IconButton, Slider, Menu, MenuItem,
  Dialog, Fade, CircularProgress, Tooltip, Chip, alpha,
  useTheme, useMediaQuery, Divider, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  PlayArrow, Pause, VolumeUp, VolumeOff, VolumeDown,
  Fullscreen, FullscreenExit, PictureInPicture, Close,
  Replay10, Forward10, Subtitles,
  Audiotrack, Warning, CheckCircle, OpenInNew,
  ArrowBack, QueuePlayNext, ViewList,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import AndroidPlugins from '@platform/android/AndroidPlugins';
import {
  parseEpisode, getQualityLabel, buildEpisodeMap, buildAndroidEpisodeList,
} from '../utils/episodeUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(secs) {
  if (!isFinite(secs) || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}


/** Detect browser codec/container support */
function checkCodecSupport(mediaInfo) {
  const video = document.createElement('video');
  const warnings = [];

  const fmt = (mediaInfo?.video?.format ?? '').toUpperCase();
  if (fmt.includes('HEVC') || fmt.includes('H.265') || fmt.includes('H265')) {
    const hevcSupport = video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"');
    if (!hevcSupport || hevcSupport === 'no') {
      warnings.push('H.265 (HEVC) is not supported in this browser. Try Safari or Edge.');
    }
  }

  const audioFmt = (mediaInfo?.audio?.[0]?.format ?? '').toUpperCase();
  if (audioFmt.includes('E-AC') || audioFmt.includes('EAC') || audioFmt.includes('TRUEHD') || audioFmt.includes('ATMOS')) {
    const eac3Support = video.canPlayType('audio/mp4; codecs="ec-3"');
    if (!eac3Support || eac3Support === 'no') {
      warnings.push('EAC-3 / Dolby Atmos audio is not supported in Chrome/Firefox. Video may play silently. Try Safari, Edge, or an external player.');
    }
  }

  return warnings;
}


// ─── Small sub-components ─────────────────────────────────────────────────────

/** Ripple that flashes on double-tap seek */
const SeekRipple = ({ side, show }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        key={side}
        initial={{ opacity: 0.8, scale: 0.6 }}
        animate={{ opacity: 0, scale: 1.4 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'absolute',
          top: '50%', transform: 'translateY(-50%)',
          [side === 'left' ? 'left' : 'right']: '8%',
          width: 80, height: 80,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {side === 'left'
          ? <Replay10 sx={{ color: '#fff', fontSize: 36 }} />
          : <Forward10 sx={{ color: '#fff', fontSize: 36 }} />}
      </motion.div>
    )}
  </AnimatePresence>
);

/** Small settings popup menu (audio / subtitles / quality) */
const TrackMenu = ({ anchorEl, open, onClose, title, tracks, activeIndex, onSelect, noTracksLabel }) => (
  <Menu
    anchorEl={anchorEl}
    open={open}
    onClose={onClose}
    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    PaperProps={{
      sx: {
        bgcolor: 'rgba(20,20,20,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 2,
        minWidth: 200,
        maxHeight: 320,
        overflowY: 'auto',
        backdropFilter: 'blur(20px)',
      },
    }}
    disableScrollLock
  >
    <Typography sx={{ px: 2, py: 1, fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {title}
    </Typography>
    <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 0.5 }} />
    {tracks.length === 0 ? (
      <MenuItem disabled>
        <ListItemText primaryTypographyProps={{ sx: { fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' } }}>
          {noTracksLabel}
        </ListItemText>
      </MenuItem>
    ) : (
      tracks.map((track, i) => (
        <MenuItem key={i} onClick={() => { onSelect(i); onClose(); }} dense
          sx={{ py: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            {activeIndex === i
              ? <CheckCircle sx={{ fontSize: 16, color: '#e50914' }} />
              : <Box sx={{ width: 16 }} />}
          </ListItemIcon>
          <ListItemText
            primary={track.label}
            secondary={track.secondary}
            primaryTypographyProps={{ sx: { fontSize: '0.85rem', color: '#fff', fontWeight: activeIndex === i ? 700 : 400 } }}
            secondaryTypographyProps={{ sx: { fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' } }}
          />
        </MenuItem>
      ))
    )}
  </Menu>
);

// ─── Episode panel ────────────────────────────────────────────────────────────

const EpisodePanel = ({ open, onClose, episodeMap, currentEp, onPlay, isMobile }) => {
  const theme = useTheme();
  const seasons = Object.keys(episodeMap).map(Number).sort((a, b) => a - b);
  const [activeSeason, setActiveSeason] = useState(currentEp?.season ?? seasons[0] ?? 1);

  useEffect(() => {
    if (currentEp?.season) setActiveSeason(currentEp.season);
  }, [currentEp?.season]);

  const episodes = episodeMap[activeSeason] ?? [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ep-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10 }}
            onClick={onClose}
          />
          <motion.div
            key="ep-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22 }}
            style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: isMobile ? '85vw' : 340,
              background: 'rgba(14,14,14,0.97)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(24px)',
              display: 'flex', flexDirection: 'column',
              zIndex: 11,
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 2, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Episodes</Typography>
              <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}>
                <Close sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>

            {/* Season chips */}
            {seasons.length > 1 && (
              <Box sx={{ display: 'flex', gap: 0.75, px: 2, py: 1.25, overflowX: 'auto', flexShrink: 0, '&::-webkit-scrollbar': { display: 'none' } }}>
                {seasons.map(s => (
                  <Chip
                    key={s} label={`Season ${s}`} size="small"
                    onClick={() => setActiveSeason(s)}
                    sx={{
                      cursor: 'pointer', flexShrink: 0, fontWeight: 600, fontSize: '0.72rem',
                      bgcolor: activeSeason === s ? '#e50914' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      '&:hover': { bgcolor: activeSeason === s ? '#c4070f' : 'rgba(255,255,255,0.18)' },
                    }}
                  />
                ))}
              </Box>
            )}

            {/* Episode list */}
            <Box sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 } }}>
              {episodes.map(ep => {
                const isCurrent = currentEp?.season === ep.season && currentEp?.episode === ep.episode;
                const rawName = ep.files[0]?.general?.fileName ?? '';
                // Try to extract a readable episode title from the filename
                const titleMatch = rawName.match(/[Ss]\d+[Ee]\d+[.\s\-_]+(.+?)(?:[.\s](1080|720|480|4[Kk]|2160|HEVC|x265|x264|mkv|mp4))/i);
                const epTitle = titleMatch ? titleMatch[1].replace(/[._]/g, ' ').trim() : null;

                return (
                  <Box
                    key={`${ep.season}x${ep.episode}`}
                    onClick={() => { onPlay(ep); onClose(); }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 2, py: 1.5,
                      cursor: 'pointer',
                      bgcolor: isCurrent ? 'rgba(229,9,20,0.1)' : 'transparent',
                      borderLeft: `3px solid ${isCurrent ? '#e50914' : 'transparent'}`,
                      '&:hover': { bgcolor: isCurrent ? 'rgba(229,9,20,0.18)' : 'rgba(255,255,255,0.05)' },
                      transition: 'background 0.15s',
                    }}
                  >
                    <Box sx={{
                      width: 38, height: 38, borderRadius: 1, flexShrink: 0,
                      bgcolor: isCurrent ? '#e50914' : 'rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
                        {ep.episode}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{
                        color: isCurrent ? '#fff' : 'rgba(255,255,255,0.82)',
                        fontWeight: isCurrent ? 700 : 400,
                        fontSize: '0.82rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {epTitle ?? `Episode ${ep.episode}`}
                      </Typography>
                      {ep.files.length > 1 && (
                        <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.66rem' }}>
                          {ep.files.length} quality options
                        </Typography>
                      )}
                    </Box>
                    {isCurrent && (
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#e50914', flexShrink: 0 }} />
                    )}
                  </Box>
                );
              })}
              {episodes.length === 0 && (
                <Box sx={{ py: 6, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                  No episodes found
                </Box>
              )}
            </Box>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─── Main Player ──────────────────────────────────────────────────────────────

const CinemaPlayer = ({ open, onClose, mediaInfo: initialMediaInfo, allFiles = [], record }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ── Current file (can switch quality) ──────────────────────────────────────
  const [currentFile, setCurrentFile] = useState(initialMediaInfo);
  useEffect(() => { setCurrentFile(initialMediaInfo); }, [initialMediaInfo]);

  // ── Video element ref + state ───────────────────────────────────────────────
  const videoRef     = useRef(null);
  const containerRef = useRef(null);
  const progressRef  = useRef(null);

  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [buffered,    setBuffered]    = useState(0);
  const [volume,      setVolume]      = useState(1);
  const [muted,       setMuted]       = useState(false);
  const [fullscreen,  setFullscreen]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [warnings,    setWarnings]    = useState([]);

  // Controls visibility
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef(null);

  // Double-tap feedback
  const [seekRipple, setSeekRipple] = useState(null); // 'left' | 'right' | null
  const lastTapRef   = useRef({ time: 0, x: 0 });
  const tapTimerRef  = useRef(null);

  // Track menus
  const [audioAnchor,   setAudioAnchor]   = useState(null);
  const [subAnchor,     setSubAnchor]     = useState(null);
  const [activeAudio,   setActiveAudio]   = useState(0);
  const [activeSub,     setActiveSub]     = useState(-1); // -1 = off

  // Volume slider show
  const [volSliderOpen, setVolSliderOpen] = useState(false);

  // Episode panel + next-ep overlay
  const [epPanelOpen,   setEpPanelOpen]   = useState(false);
  const [nextEpOverlay, setNextEpOverlay] = useState(false);
  const nextEpRef      = useRef(null);   // stable ref for use inside event listeners
  const nextEpShownRef = useRef(false);  // prevent re-triggering overlay every timeupdate

  // ── Derived track lists ─────────────────────────────────────────────────────
  const audioTracks = useMemo(() =>
    (currentFile?.audio ?? []).map((a, i) => ({
      label: a.language ? `Track ${i + 1} · ${a.language.toUpperCase()}` : `Track ${i + 1}`,
      secondary: [a.format?.split('(')[0].trim(), a.channels ? `${a.channels}ch` : null].filter(Boolean).join(' · '),
    })),
    [currentFile]
  );

  const subTracks = useMemo(() => {
    const list = [{ label: 'Off', secondary: '' }];
    (currentFile?.subtitle ?? []).forEach((s, i) => {
      list.push({
        label: s.language ? s.language.toUpperCase() : `Track ${i + 1}`,
        secondary: s.format ?? '',
      });
    });
    return list;
  }, [currentFile]);

  const episodeMap = useMemo(() => buildEpisodeMap(allFiles), [allFiles]);
  const currentEp  = useMemo(() => parseEpisode(currentFile?.general?.fileName), [currentFile]);
  const isSeries   = useMemo(() => Object.keys(episodeMap).length > 0, [episodeMap]);

  const nextEp = useMemo(() => {
    if (!currentEp || !isSeries) return null;
    const seasonEps = episodeMap[currentEp.season] ?? [];
    const idx = seasonEps.findIndex(e => e.episode === currentEp.episode);
    if (idx >= 0 && idx < seasonEps.length - 1) return seasonEps[idx + 1];
    const nextSeason = currentEp.season + 1;
    if (episodeMap[nextSeason]?.length > 0) return episodeMap[nextSeason][0];
    return null;
  }, [currentEp, episodeMap, isSeries]);

  // Keep stable ref for use in event listeners
  useEffect(() => { nextEpRef.current = nextEp; }, [nextEp]);

  // ── Load new file ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !currentFile?.streamUrl) return;
    setWarnings(checkCodecSupport(currentFile));
    setError(null);
    setLoading(true);
    setCurrentTime(0);
    setDuration(0);

    const v = videoRef.current;
    if (!v) return;
    nextEpShownRef.current = false;
    setNextEpOverlay(false);
    const savedTime = v.currentTime;
    v.src = currentFile.streamUrl;
    v.load();
    // Restore position (quality switch) and autoplay on load
    const onLoaded = () => {
      if (savedTime > 1) v.currentTime = savedTime;
      v.play().catch(() => {});
    };
    v.addEventListener('loadedmetadata', onLoaded, { once: true });
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [open, currentFile?.streamUrl]);

  // ── Video events ────────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay       = () => setPlaying(true);
    const onPause      = () => setPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
      // Show "Next Episode" overlay in last 30 s (only once per file)
      if (!nextEpShownRef.current && v.duration > 60 && v.currentTime > v.duration - 30 && nextEpRef.current) {
        nextEpShownRef.current = true;
        setNextEpOverlay(true);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      if (nextEpRef.current) setNextEpOverlay(true);
    };
    const onDuration   = () => setDuration(v.duration);
    const onWaiting    = () => setLoading(true);
    const onCanPlay    = () => setLoading(false);
    const onError      = () => {
      setLoading(false);
      setError('Unable to play this file. The codec or format may not be supported in this browser. Try an external player.');
    };
    const onFsChange   = () => setFullscreen(!!document.fullscreenElement);

    v.addEventListener('play',       onPlay);
    v.addEventListener('pause',      onPause);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('durationchange', onDuration);
    v.addEventListener('waiting',    onWaiting);
    v.addEventListener('canplay',    onCanPlay);
    v.addEventListener('error',      onError);
    v.addEventListener('ended',      onEnded);
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      v.removeEventListener('play',       onPlay);
      v.removeEventListener('pause',      onPause);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('durationchange', onDuration);
      v.removeEventListener('waiting',    onWaiting);
      v.removeEventListener('canplay',    onCanPlay);
      v.removeEventListener('error',      onError);
      v.removeEventListener('ended',      onEnded);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  // Pause on close
  useEffect(() => {
    if (!open) videoRef.current?.pause();
  }, [open]);

  // ── Controls auto-hide ──────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    if (playing) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3500);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) { setControlsVisible(true); clearTimeout(hideTimerRef.current); }
    else showControls();
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      showControls();
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ':
        case 'k': e.preventDefault(); if (v.paused) v.play().catch(() => {}); else v.pause(); break;
        case 'ArrowLeft':  e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 10); break;
        case 'ArrowUp':    e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); setVolume(v.volume); break;
        case 'ArrowDown':  e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); setVolume(v.volume); break;
        case 'm': setMuted(m => { v.muted = !m; return !m; }); break;
        case 'f': toggleFullscreen(); break;
        case 'n': if (nextEpRef.current) playEpisode(nextEpRef.current); break;
        case 'e': if (isSeries) setEpPanelOpen(p => !p); break;
        case 'Escape': if (!document.fullscreenElement) handleClose(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, showControls]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ─────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    showControls();
  };

  const seek = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
    showControls();
  };

  const handleVolumeChange = (_, val) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (videoRef.current) await videoRef.current.requestPictureInPicture();
    } catch { /* PiP not supported */ }
  };

  const handleSeekBar = (e) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = videoRef.current;
    if (v) { v.currentTime = pct * duration; showControls(); }
  };

  const playEpisode = useCallback((ep) => {
    if (!ep?.files?.length) return;
    // Try to match the current quality, fall back to first file
    const currentQ = getQualityLabel(currentFile);
    const preferred = ep.files.find(f => getQualityLabel(f) === currentQ) ?? ep.files[0];
    setNextEpOverlay(false);
    setEpPanelOpen(false);
    setCurrentFile(preferred);
    setWarnings(checkCodecSupport(preferred));
    setError(null);
    setLoading(true);
    setCurrentTime(0);
    setDuration(0);
    if (videoRef.current) {
      videoRef.current.src = preferred.streamUrl;
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentFile]);

  // ── Mobile touch: double-tap to seek ────────────────────────────────────────
  const handleTouchTap = (e) => {
    showControls();
    const now = Date.now();
    const touch = e.changedTouches[0];
    const rect  = e.currentTarget.getBoundingClientRect();
    const x     = touch.clientX - rect.left;
    const prev  = lastTapRef.current;

    if (now - prev.time < 280 && Math.abs(x - prev.x) < 100) {
      // Double tap
      clearTimeout(tapTimerRef.current);
      const isLeft = x < rect.width / 2;
      seek(isLeft ? -10 : 10);
      setSeekRipple(isLeft ? 'left' : 'right');
      setTimeout(() => setSeekRipple(null), 600);
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x };
      tapTimerRef.current = setTimeout(() => togglePlay(), 200);
    }
  };

  const handleClose = () => {
    videoRef.current?.pause();
    if (document.fullscreenElement) document.exitFullscreen();
    onClose();
  };

  const openExternal = () => {
    if (currentFile?.streamUrl) window.open(currentFile.streamUrl, '_blank');
  };

  const openAndroid = () => {
    const episodes = buildAndroidEpisodeList(allFiles ?? [], currentFile);
    AndroidPlugins.launchNativePlayer({
      url:            currentFile?.streamUrl,
      title:          record?.tmdb?.title || record?.tmdb?.name || record?.name || title,
      fileName:       currentFile?.general?.fileName,
      fileId:         String(currentFile?.id || ''),
      preferredAudio: 'Hindi',
      preferredSub:   null,
      episodes,
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const title = record?.tmdb?.title || record?.tmdb?.name || record?.name || currentFile?.general?.fileName || 'Now Playing';
  const VolumeIcon = muted || volume === 0 ? VolumeOff : volume < 0.5 ? VolumeDown : VolumeUp;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      PaperProps={{ sx: { bgcolor: '#000', overflow: 'hidden' } }}
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 300 }}
    >
      {/* ── Container ── */}
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          bgcolor: '#000',
          cursor: controlsVisible ? 'default' : 'none',
          userSelect: 'none',
        }}
        onMouseMove={showControls}
        onMouseLeave={() => playing && setControlsVisible(false)}
      >
        {/* ── Video element ── */}
        <Box
          component="video"
          ref={videoRef}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
          playsInline
          preload="auto"
        />

        {/* ── Double-tap ripples (mobile) ── */}
        <SeekRipple side="left"  show={seekRipple === 'left'} />
        <SeekRipple side="right" show={seekRipple === 'right'} />

        {/* ── Loading spinner ── */}
        <AnimatePresence>
          {loading && !error && (
            <motion.div
              key="spinner"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
            >
              <CircularProgress sx={{ color: '#e50914' }} size={52} thickness={3} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error state ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}
            >
              <Warning sx={{ fontSize: 52, color: '#f59e0b' }} />
              <Typography sx={{ color: '#fff', textAlign: 'center', maxWidth: 400, lineHeight: 1.6, fontSize: '0.95rem' }}>
                {error}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mt: 1 }}>
                {Capacitor.getPlatform() === 'android' ? (
                  <Chip label="Open in Media Player" icon={<PlayArrow />} onClick={openAndroid}
                    sx={{ bgcolor: '#e50914', color: '#fff', fontWeight: 700, cursor: 'pointer' }} />
                ) : (
                  <Chip label="Open in external player" icon={<OpenInNew />} onClick={openExternal}
                    sx={{ bgcolor: alpha('#fff', 0.15), color: '#fff', fontWeight: 600, cursor: 'pointer' }} />
                )}
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Codec warning banners ── */}
        <AnimatePresence>
          {controlsVisible && warnings.length > 0 && !error && (
            <motion.div
              key="warnings"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ position: 'absolute', top: 72, left: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px', pointerEvents: 'none' }}
            >
              {warnings.map((w, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1,
                  bgcolor: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 1.5, px: 2, py: 1,
                }}>
                  <Warning sx={{ fontSize: 16, color: '#f59e0b', mt: 0.2, flexShrink: 0 }} />
                  <Typography sx={{ color: '#fef3c7', fontSize: '0.78rem', lineHeight: 1.5 }}>{w}</Typography>
                </Box>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Next Episode overlay (last 30 s / after ended) ── */}
        <AnimatePresence>
          {nextEpOverlay && nextEp && (
            <motion.div
              key="next-ep"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'absolute', bottom: 110, right: 20, zIndex: 6 }}
            >
              <Box
                onClick={() => playEpisode(nextEp)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  bgcolor: 'rgba(229,9,20,0.92)',
                  borderRadius: 2, px: 2, py: 1.25,
                  cursor: 'pointer', backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 20px rgba(229,9,20,0.4)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  '&:hover': { bgcolor: 'rgba(196,7,15,0.95)' },
                  transition: 'background 0.15s',
                }}
              >
                <Box>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1 }}>
                    Next Episode
                  </Typography>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.4 }}>
                    S{String(nextEp.season).padStart(2, '0')} E{String(nextEp.episode).padStart(2, '0')}
                  </Typography>
                </Box>
                <QueuePlayNext sx={{ color: '#fff', fontSize: 28 }} />
              </Box>
              <IconButton
                size="small"
                onClick={() => setNextEpOverlay(false)}
                sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', p: 0.3, '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
              >
                <Close sx={{ fontSize: 12 }} />
              </IconButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════════════
            CONTROLS OVERLAY
        ══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {controlsVisible && (
            <motion.div
              key="controls"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}
            >
              {/* ── Top gradient ── */}
              <Box sx={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)', pt: 1.5, pb: 4, px: 2, pointerEvents: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <IconButton size="small" onClick={handleClose} sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                    <ArrowBack />
                  </IconButton>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '0.9rem', sm: '1rem' }, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {title}
                    </Typography>
                    {currentFile?.general?.fileName && (
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentFile.general.fileName}
                      </Typography>
                    )}
                  </Box>
                  {isSeries && (
                    <Tooltip title="Episodes  (E)">
                      <IconButton size="small" onClick={() => setEpPanelOpen(true)} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
                        <ViewList sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {Capacitor.getPlatform() !== 'android' && (
                    <Tooltip title="Open in external player">
                      <IconButton size="small" onClick={openExternal} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
                        <OpenInNew sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {/* ── Center: transparent click area for play/pause ── */}
              <Box
                sx={{ flex: 1, cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={!isMobile ? togglePlay : undefined}
                onTouchEnd={isMobile ? handleTouchTap : undefined}
              />

              {/* ── Bottom controls ── */}
              <Box sx={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                pt: 4, pb: { xs: 1.5, sm: 2 }, px: { xs: 1.5, sm: 2.5 },
                pointerEvents: 'auto',
              }}>
                {/* Seek bar */}
                <Box
                  ref={progressRef}
                  onClick={handleSeekBar}
                  sx={{
                    position: 'relative',
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: 0.5,
                    '&:hover .progress-thumb': { transform: 'scale(1)' },
                  }}
                >
                  {/* Track */}
                  <Box sx={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.2)' }} />
                  {/* Buffered */}
                  <Box sx={{ position: 'absolute', left: 0, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.35)', width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
                  {/* Played */}
                  <Box sx={{ position: 'absolute', left: 0, height: 4, borderRadius: 2, bgcolor: '#e50914', width: `${duration ? (currentTime / duration) * 100 : 0}%`, transition: 'width 0.1s linear' }} />
                  {/* Thumb */}
                  <Box
                    className="progress-thumb"
                    sx={{
                      position: 'absolute',
                      left: `${duration ? (currentTime / duration) * 100 : 0}%`,
                      width: 14, height: 14,
                      borderRadius: '50%',
                      bgcolor: '#e50914',
                      transform: 'scale(0)',
                      transition: 'transform 0.15s',
                      ml: '-7px',
                      boxShadow: '0 0 4px rgba(229,9,20,0.6)',
                    }}
                  />
                </Box>

                {/* Controls row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                  {/* Play/Pause */}
                  <IconButton onClick={togglePlay} size="small" sx={{ color: '#fff' }}>
                    {playing ? <Pause sx={{ fontSize: { xs: 22, sm: 26 } }} /> : <PlayArrow sx={{ fontSize: { xs: 22, sm: 26 } }} />}
                  </IconButton>

                  {/* Skip back/forward */}
                  <Tooltip title="Back 10s  ←">
                    <IconButton onClick={() => seek(-10)} size="small" sx={{ color: 'rgba(255,255,255,0.8)', display: { xs: 'none', sm: 'flex' } }}>
                      <Replay10 sx={{ fontSize: 22 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Forward 10s  →">
                    <IconButton onClick={() => seek(10)} size="small" sx={{ color: 'rgba(255,255,255,0.8)', display: { xs: 'none', sm: 'flex' } }}>
                      <Forward10 sx={{ fontSize: 22 }} />
                    </IconButton>
                  </Tooltip>

                  {/* Next episode */}
                  {isSeries && nextEp && (
                    <Tooltip title={`Next: S${String(nextEp.season).padStart(2, '0')}E${String(nextEp.episode).padStart(2, '0')}  (N)`}>
                      <IconButton onClick={() => playEpisode(nextEp)} size="small" sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff' } }}>
                        <QueuePlayNext sx={{ fontSize: { xs: 20, sm: 22 } }} />
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* Volume */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    onMouseEnter={() => setVolSliderOpen(true)}
                    onMouseLeave={() => setVolSliderOpen(false)}>
                    <IconButton onClick={toggleMute} size="small" sx={{ color: '#fff' }}>
                      <VolumeIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
                    </IconButton>
                    <Box sx={{
                      width: volSliderOpen ? 80 : 0,
                      overflow: 'hidden',
                      transition: 'width 0.2s',
                      display: { xs: 'none', sm: 'block' },
                    }}>
                      <Slider
                        value={muted ? 0 : volume}
                        min={0} max={1} step={0.05}
                        onChange={handleVolumeChange}
                        size="small"
                        sx={{
                          color: '#fff', width: 72,
                          '& .MuiSlider-thumb': { width: 12, height: 12 },
                          '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.3)' },
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Time */}
                  <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: '0.72rem', sm: '0.8rem' }, fontVariantNumeric: 'tabular-nums', ml: 0.5 }}>
                    {formatTime(currentTime)}
                    <Box component="span" sx={{ color: 'rgba(255,255,255,0.45)', mx: 0.5 }}>/</Box>
                    {formatTime(duration)}
                  </Typography>

                  <Box sx={{ flex: 1 }} />

                  {/* Subtitles */}
                  <Tooltip title="Subtitles">
                    <IconButton
                      size="small"
                      onClick={(e) => setSubAnchor(e.currentTarget)}
                      sx={{ color: activeSub >= 0 ? '#e50914' : 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
                    >
                      <Subtitles sx={{ fontSize: { xs: 18, sm: 20 } }} />
                    </IconButton>
                  </Tooltip>

                  {/* Audio tracks */}
                  <Tooltip title="Audio">
                    <IconButton
                      size="small"
                      onClick={(e) => setAudioAnchor(e.currentTarget)}
                      sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
                    >
                      <Audiotrack sx={{ fontSize: { xs: 18, sm: 20 } }} />
                    </IconButton>
                  </Tooltip>

                  {/* PiP */}
                  {!isMobile && document.pictureInPictureEnabled && (
                    <Tooltip title="Picture in Picture">
                      <IconButton size="small" onClick={togglePiP} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
                        <PictureInPicture sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* Fullscreen */}
                  <Tooltip title={fullscreen ? 'Exit fullscreen  F' : 'Fullscreen  F'}>
                    <IconButton size="small" onClick={toggleFullscreen} sx={{ color: '#fff' }}>
                      {fullscreen
                        ? <FullscreenExit sx={{ fontSize: { xs: 22, sm: 24 } }} />
                        : <Fullscreen sx={{ fontSize: { xs: 22, sm: 24 } }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Episode list panel ── */}
        {isSeries && (
          <EpisodePanel
            open={epPanelOpen}
            onClose={() => setEpPanelOpen(false)}
            episodeMap={episodeMap}
            currentEp={currentEp}
            onPlay={playEpisode}
            isMobile={isMobile}
          />
        )}
      </Box>

      {/* ── Track menus (outside motion div so they don't animate out) ── */}
      <TrackMenu
        anchorEl={audioAnchor}
        open={Boolean(audioAnchor)}
        onClose={() => setAudioAnchor(null)}
        title="Audio Track"
        tracks={audioTracks}
        activeIndex={activeAudio}
        onSelect={(i) => {
          setActiveAudio(i);
          // Native audioTracks switching (limited browser support — shown as UI feedback)
          const at = videoRef.current?.audioTracks;
          if (at) {
            for (let j = 0; j < at.length; j++) at[j].enabled = j === i;
          }
        }}
        noTracksLabel="No audio track info"
      />
      <TrackMenu
        anchorEl={subAnchor}
        open={Boolean(subAnchor)}
        onClose={() => setSubAnchor(null)}
        title="Subtitles"
        tracks={subTracks}
        activeIndex={activeSub + 1}
        onSelect={(i) => setActiveSub(i - 1)}
        noTracksLabel="No subtitles"
      />
    </Dialog>
  );
};

export default CinemaPlayer;
