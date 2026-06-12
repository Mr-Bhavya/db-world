// Shared hybrid video player. Renders ALL UI (controls/gestures) in React; the
// video layer is native ExoPlayer (Android, behind a transparent WebView) or an
// HTML5 <video> (web), abstracted by playerAdapter. Phase 1: transport + scrub +
// double-tap seek + brightness/volume gestures + rotation/lock + speed + buffering.
// Audio/subtitle/quality + settings sheet + episodes arrive in later phases.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrowIcon     from '@mui/icons-material/PlayArrow';
import PauseIcon         from '@mui/icons-material/Pause';
import Replay10Icon      from '@mui/icons-material/Replay10';
import Forward10Icon     from '@mui/icons-material/Forward10';
import CloseIcon         from '@mui/icons-material/Close';
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';
import LockIcon          from '@mui/icons-material/Lock';
import LockOpenIcon      from '@mui/icons-material/LockOpen';
import SpeedIcon         from '@mui/icons-material/Speed';
import BrightnessHighIcon from '@mui/icons-material/BrightnessHigh';
import VolumeUpIcon      from '@mui/icons-material/VolumeUp';
import SettingsIcon      from '@mui/icons-material/Settings';
import AudiotrackIcon    from '@mui/icons-material/Audiotrack';
import ClosedCaptionIcon from '@mui/icons-material/ClosedCaption';
import HighQualityIcon   from '@mui/icons-material/HighQuality';
import CheckIcon         from '@mui/icons-material/Check';
import PlaylistPlayIcon  from '@mui/icons-material/PlaylistPlay';
import SkipNextIcon      from '@mui/icons-material/SkipNext';
import MemoryIcon        from '@mui/icons-material/Memory';
import ArrowBackIcon     from '@mui/icons-material/ArrowBack';
import ChevronRightIcon  from '@mui/icons-material/ChevronRight';
import ErrorOutlineIcon  from '@mui/icons-material/ErrorOutline';
import FullscreenIcon     from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { createPlayerAdapter } from './playerAdapter';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const HIDE_MS = 3500;
const TEAL = '#0d9488';   // app theme accent

// Remembered selections (global, per device).
const PREF_AUDIO = 'dbworld:player:audioLang';
const PREF_SUB   = 'dbworld:player:subLang';
const PREF_DECODER = 'dbworld:player:decoder';
const DEFAULT_AUDIO = 'Hindi';
const DEFAULT_SUB   = 'off';
const DECODERS = [{ id: 'auto', label: 'Auto' }, { id: 'hw', label: 'Hardware' }, { id: 'sw', label: 'Software' }];
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const audioLabel = (t) => `${t.language}${t.channels >= 6 ? ' 5.1' : t.channels === 2 ? ' Stereo' : ''}`;

// ── Browser audio-codec support (web only) ───────────────────────────────────
// Used to decide when a track must be transcoded to AAC server-side.
const _codecProbe = typeof document !== 'undefined' ? document.createElement('video') : null;
const browserCanPlay = (mime) => !!_codecProbe && _codecProbe.canPlayType(mime) !== '';
const browserPlaysAudioFormat = (format) => {
  if (!format) return true;
  const f = String(format).toUpperCase();
  if (f.includes('E-AC-3') || f.includes('EAC3') || f.includes('E-AC3')) return browserCanPlay('audio/mp4; codecs="ec-3"');
  if (f.includes('AC-3')   || f.includes('AC3'))                          return browserCanPlay('audio/mp4; codecs="ac-3"');
  if (f.includes('DTS')    || f.includes('TRUEHD') || f.includes('MLP'))  return false; // browsers never decode these
  return true; // AAC / Opus / etc. — assume the browser handles it
};

const fmt = (ms) => {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
};

export default function DbWorldVideoPlayer({
  src, startMs = 0, title = '', fileId, variants = [],
  episodes = [], currentEpisodeId, onSelectEpisode,
  onProgress, onClose,
  audio = [], mediaFileId = '', durationMs = 0, // web transcode metadata
}) {
  const isNative = Capacitor.getPlatform() === 'android';
  const videoRef    = useRef(null);
  const rootRef     = useRef(null);
  const triedQualityRef = useRef(new Set()); // quality urls that failed to decode (avoid loops)
  const adapterRef  = useRef(null);
  const hideTimer   = useRef(null);
  const tapRef      = useRef({ last: 0, x: 0 });
  const gestureRef  = useRef(null);
  const progressRef = useRef({ positionMs: 0, durationMs: 0 });
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const report = useCallback((ended = false) => {
    onProgressRef.current?.({ ...progressRef.current, ended });
  }, []);

  const [position, setPosition]   = useState(0);
  const [duration, setDuration]   = useState(0);
  const [scrub, setScrub]         = useState(null);   // non-null while dragging the bar
  const [playing, setPlaying]     = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [controls, setControls]   = useState(true);
  const [rateIdx, setRateIdx]     = useState(1);       // index into SPEEDS (1 → 1×)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState('main'); // main | audio | subtitles | quality | speed | decoder
  const [audioTracks, setAudioTracks]   = useState([]);
  const [textTracks, setTextTracks]     = useState([]);
  const [curAudio, setCurAudio]   = useState(-1);
  const [curText, setCurText]     = useState(-1);
  const [curQualityId, setCurQualityId] = useState(fileId); // active quality, by mediaFileId (urls can collide)
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const [ended, setEnded]         = useState(false);
  const [countdown, setCountdown] = useState(null);    // seconds to next-episode autoplay
  const appliedRef = useRef(false);                    // preferred tracks applied for this load

  const curIdx = episodes.findIndex(e => e.id === currentEpisodeId || e.fileId === currentEpisodeId);
  const nextEpisode = curIdx >= 0 && curIdx < episodes.length - 1 ? episodes[curIdx + 1] : null;
  const seasonsMap = episodes.reduce((m, ep) => { (m[ep.season] ||= []).push(ep); return m; }, {});
  const [locked, setLocked]       = useState(false);
  const [landscape, setLandscape] = useState(isNative); // default landscape on the app
  const [volume, setVolume]       = useState(1);
  const [brightness, setBrightness] = useState(0.5);
  const [zoom, setZoom]           = useState(1);
  const [decoder, setDecoder]     = useState(() => lsGet(PREF_DECODER, 'auto'));
  const [errorMsg, setErrorMsg]   = useState(null);
  const [infoMsg, setInfoMsg]     = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hud, setHud]             = useState(null);    // { kind:'volume'|'brightness'|'zoom', value }

  // Apply remembered/default audio (Hindi) + subtitle (off) once per load.
  const applyPreferredTracks = useCallback((audio, text) => {
    const a = adapterRef.current; if (!a) return;
    const prefAudio = lsGet(PREF_AUDIO, DEFAULT_AUDIO);
    const at = audio.find(t => t.language === prefAudio);
    if (at) { a.selectAudioTrack(at.id); setCurAudio(at.id); }
    const prefSub = lsGet(PREF_SUB, DEFAULT_SUB);
    if (prefSub === 'off') { a.selectTextTrack(-1); setCurText(-1); }
    else {
      const st = text.find(t => t.language === prefSub);
      if (st) { a.selectTextTrack(st.id); setCurText(st.id); }
      else    { a.selectTextTrack(-1); setCurText(-1); }
    }
  }, []);

  // ── adapter lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    const adapter = createPlayerAdapter(() => videoRef.current);
    adapterRef.current = adapter;
    appliedRef.current = false;
    triedQualityRef.current = new Set();
    setCurQualityId(fileId);
    setEnded(false); setCountdown(null); setErrorMsg(null);

    let prevHtmlBg, prevBodyBg;
    if (isNative) {
      prevHtmlBg = document.documentElement.style.background;
      prevBodyBg = document.body.style.background;
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    }

    const offs = [
      adapter.on('time', d => {
        setPosition(d.positionMs || 0);
        if (d.durationMs) setDuration(d.durationMs);
        progressRef.current = { positionMs: d.positionMs || 0, durationMs: d.durationMs || progressRef.current.durationMs };
      }),
      adapter.on('state', d => {
        setBuffering(d.state === 2);
        if (d.state === 3) setPlaying(true);
      }),
      adapter.on('ended', () => { setPlaying(false); setBuffering(false); report(true); setEnded(true); }),
      adapter.on('error', (d) => { setBuffering(false); setErrorMsg(d?.message || 'This video could not be played.'); }),
      adapter.on('info', (d) => { setBuffering(false); if (d?.message) { setInfoMsg(d.message); setTimeout(() => setInfoMsg(null), 3000); } }),
      adapter.on('tracks', d => {
        const audio = d.audio || [], text = d.text || [];
        setAudioTracks(audio); setTextTracks(text);
        setCurAudio(d.selectedAudio); setCurText(d.selectedText);
        if (!appliedRef.current && (audio.length || text.length)) {
          appliedRef.current = true;
          applyPreferredTracks(audio, text);
        }
      }),
      // Device volume changed via the hardware keys — keep the in-app bar in
      // sync silently (Android already shows its own system volume overlay, so
      // no extra HUD here).
      adapter.on('volume', (d) => {
        if (typeof d?.value === 'number') setVolume(d.value);
      }),
    ];
    // Initialise the bar from the current device media volume.
    adapter.getVolume?.().then((r) => {
      if (typeof r?.value === 'number') setVolume(r.value);
    }).catch(() => {});
    adapter.setDecoderMode?.(lsGet(PREF_DECODER, 'auto')); // set before load so the player builds with it

    // Web: the adapter never emits a 'tracks' event, so seed the audio menu from
    // the file metadata, and if the browser can't decode the chosen track's codec
    // (E-AC3/AC3/DTS), stream it through the server-side AAC transcode instead of
    // the direct CDN URL. Native (ExoPlayer) decodes everything directly.
    let usedTranscode = false;
    if (!isNative && audio.length) {
      const webTracks = audio.map((a, i) => ({ id: i, language: a.language, channels: a.channels, format: a.format }));
      setAudioTracks(webTracks);

      let idx = audio.findIndex(a => a.language === lsGet(PREF_AUDIO, DEFAULT_AUDIO));
      if (idx < 0) idx = 0;

      if (mediaFileId && audio[idx] && !browserPlaysAudioFormat(audio[idx].format)) {
        const token   = lsGet('token', '');
        const apiBase  = getApiBaseUrl();
        adapter.setTranscode?.({
          durationMs,
          audioIndex: idx,
          build: (startSec, audioIdx) =>
            `${apiBase}/api/stream/web/${mediaFileId}?t=${encodeURIComponent(token)}&audio=${audioIdx}&start=${startSec}`,
        });
        setCurAudio(idx);
        appliedRef.current = true;      // track choice is baked into the transcode
        adapter.load(src, startMs);      // url ignored — adapter uses the transcode build()
        usedTranscode = true;
      }
    }
    if (!usedTranscode) adapter.load(src, startMs);

    if (isNative) adapter.setOrientation('landscape'); // default to full-screen landscape
    scheduleHide();

    // Periodic save so progress survives a crash / force-kill.
    const saveTimer = setInterval(() => { if (progressRef.current.positionMs > 0) report(false); }, 20000);

    return () => {
      offs.forEach(f => f());
      clearInterval(saveTimer);
      report(false); // save on close/unmount
      adapter.release();
      clearTimeout(hideTimer.current);
      if (isNative) {
        document.documentElement.style.background = prevHtmlBg;
        document.body.style.background = prevBodyBg;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ── Pause when the app/tab goes to the background ───────────────────────────
  // Video (and its audio) must not keep playing once the user leaves: Home
  // button / app switch on Android, tab hidden or window blur on web.
  useEffect(() => {
    const pauseForBackground = () => {
      const a = adapterRef.current;
      if (!a) return;
      a.pause();
      setPlaying(false);
      report(false); // persist progress on the way out
    };

    let stateListener;
    if (isNative) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) pauseForBackground();
      }).then((l) => { stateListener = l; }).catch(() => {});
    }

    const onVisibility = () => { if (document.hidden) pauseForBackground(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', pauseForBackground);

    return () => {
      stateListener?.remove?.();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', pauseForBackground);
    };
  }, [report]);

  // ── controls auto-hide ──────────────────────────────────────────────────────
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), HIDE_MS);
  }, []);
  const showControls = useCallback(() => { setControls(true); scheduleHide(); }, [scheduleHide]);

  // ── transport ───────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const a = adapterRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); report(false); }
    else         { a.play();  setPlaying(true); }
    showControls();
  }, [playing, showControls, report]);

  const seekBy = useCallback((deltaMs) => {
    const a = adapterRef.current; if (!a) return;
    const target = Math.max(0, Math.min(duration || Infinity, position + deltaMs));
    a.seekTo(target); setPosition(target); showControls();
  }, [position, duration, showControls]);

  const rotate = () => {
    const next = !landscape; setLandscape(next); setLocked(false);
    adapterRef.current?.setOrientation(next ? 'landscape' : 'portrait'); showControls();
  };
  const toggleLock = () => {
    const next = !locked; setLocked(next);
    adapterRef.current?.setOrientation(next ? 'locked' : 'sensor'); showControls();
  };
  const close = () => { adapterRef.current?.release(); onClose?.(); };

  // ── settings (audio / subtitle / quality / speed) ───────────────────────────
  const chooseAudio = (t) => { adapterRef.current?.selectAudioTrack(t.id); setCurAudio(t.id); lsSet(PREF_AUDIO, t.language); };
  const chooseSub   = (t) => {
    if (!t) { adapterRef.current?.selectTextTrack(-1); setCurText(-1); lsSet(PREF_SUB, DEFAULT_SUB); }
    else    { adapterRef.current?.selectTextTrack(t.id); setCurText(t.id); lsSet(PREF_SUB, t.language); }
  };
  const chooseSpeed = (i) => { setRateIdx(i); adapterRef.current?.setRate(SPEEDS[i]); };
  const chooseQuality = (v) => {
    appliedRef.current = false;                 // re-apply track prefs after the reload
    adapterRef.current?.load(v.url, progressRef.current.positionMs);
    setCurQualityId(v.mediaFileId);
  };
  const chooseDecoder = (mode) => {
    appliedRef.current = false;                 // player is recreated → re-apply track prefs
    adapterRef.current?.setDecoderMode(mode);
    setDecoder(mode); lsSet(PREF_DECODER, mode);
  };

  // ── next-episode autoplay (default ON, 10s) ─────────────────────────────────
  const goNext = useCallback(() => {
    if (!nextEpisode) return;
    setEnded(false); setCountdown(null);
    onSelectEpisode?.(nextEpisode);
  }, [nextEpisode, onSelectEpisode]);

  useEffect(() => {
    if (!ended || !nextEpisode) return undefined;
    setCountdown(10);
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c == null) return null;
        if (c <= 1) { clearInterval(iv); goNext(); return null; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [ended, nextEpisode, goNext]);

  const cancelAutoplay = () => { setCountdown(null); setEnded(false); };

  // ── web fullscreen ──────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.();
      else document.exitFullscreen?.();
    } catch { /* not supported */ }
    showControls();
  }, [showControls]);
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ── auto-downgrade quality on a fatal decode error ──────────────────────────
  // Fires after native HW→SW fallback also failed. Picks the next lower variant.
  useEffect(() => {
    if (!errorMsg) return;
    const curH = variants.find(v => v.mediaFileId === curQualityId)?.height ?? 0;
    const lower = variants
      .filter(v => v.height > 0 && (curH === 0 || v.height < curH) && !triedQualityRef.current.has(v.mediaFileId))
      .sort((a, b) => b.height - a.height)[0];
    if (lower) {
      triedQualityRef.current.add(curQualityId);
      setErrorMsg(null);
      setInfoMsg(`Couldn't play this quality — switching to ${lower.label}`);
      setTimeout(() => setInfoMsg(null), 3500);
      chooseQuality(lower);
    }
    // no lower variant → leave errorMsg set so the error overlay shows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorMsg]);

  // Keyboard shortcuts (web): space/k play, ←/→ seek, m mute, Esc close; any key reveals controls.
  useEffect(() => {
    const onKey = (e) => {
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': seekBy(10000); break;
        case 'ArrowLeft':  seekBy(-10000); break;
        case 'f': case 'F': if (!isNative) toggleFullscreen(); break;
        case 'Escape':     if (!document.fullscreenElement) close(); break;
        default:           showControls();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seekBy, showControls, toggleFullscreen, isNative]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── seek bar drag ─────────────────────────────────────────────────────────
  const onScrubChange = (e) => { setScrub(Number(e.target.value)); showControls(); };
  const onScrubCommit = () => {
    if (scrub != null) { adapterRef.current?.seekTo(scrub); setPosition(scrub); }
    setScrub(null);
  };

  // ── gestures (native + web touch): double-tap seek, vertical swipe = bright/vol ─
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {            // pinch-to-zoom
      gestureRef.current = { pinch: true, startDist: dist(e.touches[0], e.touches[1]), startZoom: zoom };
      return;
    }
    // Ignore touches that land on an interactive control — let the button/seek-bar
    // handle them, don't treat them as a player gesture.
    if (e.target.closest?.('button, input')) { gestureRef.current = { skip: true }; return; }
    const t = e.touches[0];
    gestureRef.current = {
      x: t.clientX, y: t.clientY, t: Date.now(),
      side: t.clientX < window.innerWidth / 2 ? 'left' : 'right',
      startVol: volume, startBright: brightness, moved: false,
    };
  };
  const onTouchMove = (e) => {
    const g = gestureRef.current; if (!g || g.skip) return;
    if (g.pinch) {
      if (e.touches.length < 2) return;
      const z = Math.max(1, Math.min(3, g.startZoom * (dist(e.touches[0], e.touches[1]) / g.startDist)));
      setZoom(z); adapterRef.current?.setZoom(z); setHud({ kind: 'zoom', value: z });
      return;
    }
    const t = e.touches[0];
    const dy = g.y - t.clientY;            // up = positive
    if (Math.abs(dy) < 12 && !g.moved) return;
    g.moved = true;
    const frac = dy / (window.innerHeight * 0.6);   // full swipe ≈ 60% of height
    if (g.side === 'right') {
      const val = Math.max(0, Math.min(1, g.startVol + frac));
      setVolume(val); adapterRef.current?.setVolume(val); setHud({ kind: 'volume', value: val });
    } else {
      const val = Math.max(0.05, Math.min(1, g.startBright + frac));
      setBrightness(val); adapterRef.current?.setBrightness(val); setHud({ kind: 'brightness', value: val });
    }
  };
  const onTouchEnd = () => {
    const g = gestureRef.current; gestureRef.current = null;
    if (g?.skip) return;
    if (g?.pinch || g?.moved) { setTimeout(() => setHud(null), 600); return; }
    // It was a tap → detect double-tap on a side third for seek, else toggle controls.
    const now = Date.now();
    const isDouble = now - tapRef.current.last < 300;
    const x = g ? g.x : tapRef.current.x;
    if (isDouble) {
      tapRef.current.last = 0;
      const third = window.innerWidth / 3;
      if (x < third)            seekBy(-10000);
      else if (x > 2 * third)   seekBy(10000);
      else                      togglePlay();
    } else {
      tapRef.current = { last: now, x };
      setControls(c => { const nv = !c; if (nv) scheduleHide(); return nv; });
    }
  };

  const displayPos = scrub != null ? scrub : position;
  const pct = duration > 0 ? (displayPos / duration) * 100 : 0;
  // "Up next" card appears in the last 20s (and autoplays at the very end).
  const nearEnd = duration > 0 && position > 0 && (duration - position) <= 20000;

  return (
    <div
      ref={rootRef}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseMove={!isNative ? showControls : undefined}   // desktop: reveal controls on mouse move
      onClick={!isNative ? (e) => { if (!e.target.closest('button, input')) showControls(); } : undefined}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: isNative ? 'transparent' : '#000',
               overflow: 'hidden', color: '#fff', fontFamily: 'system-ui, sans-serif', touchAction: 'none' }}
    >
      {/* Web video surface (native renders behind the WebView) */}
      {!isNative && (
        <video ref={videoRef} playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
      )}

      {/* Buffering spinner */}
      {buffering && !errorMsg && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <CircularProgress size={56} sx={{ color: '#fff' }} />
        </div>
      )}

      {/* Transient info toast (e.g. decoder fallback) */}
      {infoMsg && (
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 26,
          background: 'rgba(0,0,0,0.8)', borderRadius: 8, padding: '8px 16px', fontSize: 13, pointerEvents: 'none' }}>
          {infoMsg}
        </div>
      )}

      {/* Fatal playback error */}
      {errorMsg && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, background: 'rgba(0,0,0,0.85)', padding: 24, textAlign: 'center' }}>
          <ErrorOutlineIcon sx={{ fontSize: 44, color: '#f44336' }} />
          <div style={{ fontSize: 15, maxWidth: 360 }}>{errorMsg}</div>
          <div style={{ fontSize: 12, color: '#999', maxWidth: 360 }}>
            This file’s video or audio format isn’t supported on this device.
          </div>
          <button onClick={close}
            style={{ marginTop: 4, padding: '10px 22px', background: TEAL, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      )}

      {/* Brightness (left) / Volume (right) — vertical HUD on the relevant edge */}
      {hud && hud.kind !== 'zoom' && (
        <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          ...(hud.kind === 'brightness' ? { left: 24 } : { right: 24 }),
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          background: 'rgba(0,0,0,0.6)', borderRadius: 22, padding: '16px 12px', pointerEvents: 'none' }}>
          {hud.kind === 'volume' ? <VolumeUpIcon /> : <BrightnessHighIcon />}
          <div style={{ width: 6, height: 130, background: 'rgba(255,255,255,0.3)', borderRadius: 3,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: `${Math.round(hud.value * 100)}%`, background: '#fff', borderRadius: 3 }} />
          </div>
        </div>
      )}

      {/* Zoom indicator (centered) */}
      {hud && hud.kind === 'zoom' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'rgba(0,0,0,0.7)', borderRadius: 12, padding: '10px 18px', fontWeight: 700, pointerEvents: 'none' }}>
          {hud.value.toFixed(1)}×
        </div>
      )}

      {/* Controls overlay */}
      {controls && !locked && (
        <>
          {/* gradient scrims */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(rgba(0,0,0,0.55), transparent 22%, transparent 70%, rgba(0,0,0,0.7))' }} />

          {/* Top bar */}
          <div style={row('absolute', { top: 0, left: 0, right: 0, padding: 14, justifyContent: 'space-between' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <IconBtn onClick={close}><CloseIcon /></IconBtn>
              <span style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {episodes.length > 1 && (
                <IconBtn onClick={() => { setEpisodesOpen(true); showControls(); }}><PlaylistPlayIcon /></IconBtn>
              )}
              <IconBtn onClick={() => { setSettingsView('main'); setSettingsOpen(true); showControls(); }}><SettingsIcon /></IconBtn>
              {isNative ? (
                <>
                  <IconBtn onClick={rotate}><ScreenRotationIcon /></IconBtn>
                  <IconBtn onClick={toggleLock}>{locked ? <LockIcon /> : <LockOpenIcon />}</IconBtn>
                </>
              ) : (
                <IconBtn onClick={toggleFullscreen}>{isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}</IconBtn>
              )}
            </div>
          </div>

          {/* Center transport */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 40, pointerEvents: 'none' }}>
            <IconBtn big onClick={() => seekBy(-10000)}><Replay10Icon sx={{ fontSize: 38 }} /></IconBtn>
            <IconBtn big onClick={togglePlay}>{playing ? <PauseIcon sx={{ fontSize: 52 }} /> : <PlayArrowIcon sx={{ fontSize: 52 }} />}</IconBtn>
            <IconBtn big onClick={() => seekBy(10000)}><Forward10Icon sx={{ fontSize: 38 }} /></IconBtn>
          </div>

          {/* Bottom bar: time + seek bar */}
          <div style={row('absolute', { bottom: 0, left: 0, right: 0, padding: '10px 16px 18px', gap: 12 })}>
            <span style={{ fontSize: 12, minWidth: 48 }}>{fmt(displayPos)}</span>
            <input type="range" min={0} max={duration || 0} value={displayPos}
              onChange={onScrubChange} onPointerUp={onScrubCommit} onTouchEnd={onScrubCommit} onMouseUp={onScrubCommit}
              style={{ flex: 1, accentColor: TEAL, height: 4 }} />
            <span style={{ fontSize: 12, minWidth: 48, textAlign: 'right' }}>{fmt(duration)}</span>
          </div>
        </>
      )}

      {/* Locked: just an unlock affordance */}
      {locked && controls && (
        <div style={{ position: 'absolute', top: 14, left: 14 }}>
          <IconBtn onClick={toggleLock}><LockIcon /></IconBtn>
        </div>
      )}

      {/* Next-episode autoplay card */}
      {countdown != null && nextEpisode && (
        <div style={{ position: 'absolute', bottom: 84, right: 20, zIndex: 25, width: 300, maxWidth: '80%',
          background: 'rgba(0,0,0,0.88)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#bbb', marginBottom: 4 }}>Next episode in {countdown}s</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{nextEpisode.label}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={goNext}
              style={{ flex: 1, padding: 10, background: TEAL, color: '#fff', border: 'none', borderRadius: 8,
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <SkipNextIcon sx={{ fontSize: 18 }} /> Play now
            </button>
            <button onClick={cancelAutoplay}
              style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
                borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Episode panel (right drawer) */}
      {episodesOpen && (
        <div onClick={() => setEpisodesOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 340, maxWidth: '85%', height: '100%', background: 'rgba(15,15,15,0.92)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', overflowY: 'auto', padding: '16px 0' }}>
            <div style={{ padding: '0 18px 10px', fontWeight: 700, fontSize: 16 }}>Episodes</div>
            {Object.keys(seasonsMap).sort((a, b) => a - b).map(s => (
              <div key={s}>
                <div style={{ padding: '8px 18px', color: '#bbb', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Season {s}</div>
                {seasonsMap[s].map(ep => {
                  const isCur = ep.id === currentEpisodeId || ep.fileId === currentEpisodeId;
                  return (
                    <button key={ep.id} onClick={() => { onSelectEpisode?.(ep); setEpisodesOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 18px',
                        background: isCur ? 'rgba(13,148,136,0.18)' : 'transparent', border: 'none', cursor: 'pointer',
                        color: isCur ? TEAL : '#fff', fontWeight: isCur ? 700 : 500, fontSize: 14, textAlign: 'left' }}>
                      {isCur ? <PlayArrowIcon sx={{ fontSize: 18 }} /> : <span style={{ width: 18 }} />}
                      {ep.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings: two-level (category list → options) so it fits any screen / font size */}
      {settingsOpen && (() => {
        const subLabel = curText < 0 ? 'Off' : `${textTracks.find(t => t.id === curText)?.language ?? 'On'}`;
        const audioCur = audioTracks.find(a => a.id === curAudio);
        const back = () => setSettingsView('main');
        return (
          <div onClick={() => setSettingsOpen(false)}
            style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(420px, 94%)', maxHeight: '86%', display: 'flex', flexDirection: 'column',
                background: 'rgba(16,16,16,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              {settingsView === 'main' ? (
                <>
                  <SheetHeader title="Settings" />
                  <div style={{ overflowY: 'auto' }}>
                    <MasterRow icon={<AudiotrackIcon fontSize="small" />}    label="Audio"     value={audioCur ? audioLabel(audioCur) : 'Default'} onClick={() => setSettingsView('audio')} />
                    <MasterRow icon={<ClosedCaptionIcon fontSize="small" />} label="Subtitles" value={subLabel} onClick={() => setSettingsView('subtitles')} />
                    {variants.length > 1 && (
                      <MasterRow icon={<HighQualityIcon fontSize="small" />} label="Quality" value={variants.find(v => v.mediaFileId === curQualityId)?.label ?? ''} onClick={() => setSettingsView('quality')} />
                    )}
                    <MasterRow icon={<SpeedIcon fontSize="small" />} label="Speed" value={`${SPEEDS[rateIdx]}×`} onClick={() => setSettingsView('speed')} />
                    {isNative && (
                      <MasterRow icon={<MemoryIcon fontSize="small" />} label="Decoder" value={DECODERS.find(d => d.id === decoder)?.label ?? 'Auto'} onClick={() => setSettingsView('decoder')} />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <SheetHeader title={{ audio: 'Audio', subtitles: 'Subtitles', quality: 'Quality', speed: 'Speed', decoder: 'Decoder' }[settingsView]} onBack={back} />
                  <div style={{ overflowY: 'auto' }}>
                    {settingsView === 'audio' && (audioTracks.length
                      ? audioTracks.map(t => <SheetRow key={t.id} selected={t.id === curAudio} label={audioLabel(t)} onClick={() => { chooseAudio(t); back(); }} />)
                      : <SheetEmpty>No alternate audio tracks</SheetEmpty>)}
                    {settingsView === 'subtitles' && (<>
                      <SheetRow selected={curText < 0} label="Off" onClick={() => { chooseSub(null); back(); }} />
                      {textTracks.map(t => <SheetRow key={t.id} selected={t.id === curText} label={`${t.language}${t.forced ? ' (Forced)' : ''}`} onClick={() => { chooseSub(t); back(); }} />)}
                    </>)}
                    {settingsView === 'quality' && variants.map(v => <SheetRow key={v.mediaFileId ?? v.url} selected={v.mediaFileId === curQualityId} label={v.label} onClick={() => { chooseQuality(v); back(); }} />)}
                    {settingsView === 'speed' && SPEEDS.map((s, i) => <SheetRow key={s} selected={i === rateIdx} label={`${s}×${s === 1 ? ' (Normal)' : ''}`} onClick={() => { chooseSpeed(i); back(); }} />)}
                    {settingsView === 'decoder' && DECODERS.map(d => <SheetRow key={d.id} selected={d.id === decoder} label={d.label} onClick={() => { chooseDecoder(d.id); back(); }} />)}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── settings-sheet helpers ──────────────────────────────────────────────────
function SheetHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      {onBack && (
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}>
          <ArrowBackIcon fontSize="small" />
        </button>
      )}
      <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
    </div>
  );
}
function MasterRow({ icon, label, value, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
        background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, textAlign: 'left' }}>
      <span style={{ display: 'flex', color: '#bbb' }}>{icon}</span>
      <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#9aa', fontSize: 13, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      <ChevronRightIcon sx={{ fontSize: 18, color: '#888' }} />
    </button>
  );
}
function SheetRow({ label, selected, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10,
        padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
        color: selected ? '#0d9488' : '#fff', fontWeight: selected ? 700 : 500, fontSize: 14, textAlign: 'left', whiteSpace: 'nowrap' }}>
      <span>{label}</span>
      {selected && <CheckIcon sx={{ fontSize: 16 }} />}
    </button>
  );
}
function SheetEmpty({ children }) {
  return <div style={{ padding: '8px 16px', color: '#777', fontSize: 13 }}>{children}</div>;
}

// ── tiny style helpers ────────────────────────────────────────────────────────
const row = (position, extra) => ({ position, display: 'flex', alignItems: 'center', ...extra });

function IconBtn({ children, onClick, big, label }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{
        pointerEvents: 'auto', display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 1, background: big ? 'rgba(0,0,0,0.35)' : 'transparent',
        border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%',
        width: big ? 64 : 40, height: big ? 64 : 40, padding: 0,
      }}>
      {children}
      {label && <span style={{ fontSize: 9, fontWeight: 700 }}>{label}</span>}
    </button>
  );
}
