// Shared hybrid video player. Renders ALL UI (controls/gestures) in React; the
// video layer is native ExoPlayer (Android, behind a transparent WebView) or an
// HTML5 <video> (web), abstracted by playerAdapter. Phase 1: transport + scrub +
// double-tap seek + brightness/volume gestures + rotation/lock + speed + buffering.
// Audio/subtitle/quality + settings sheet + episodes arrive in later phases.
import React, { useEffect, useRef, useState, useCallback, useContext } from 'react';
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
import VolumeDownIcon    from '@mui/icons-material/VolumeDown';
import VolumeOffIcon     from '@mui/icons-material/VolumeOff';
import SettingsIcon      from '@mui/icons-material/Settings';
import AudiotrackIcon    from '@mui/icons-material/Audiotrack';
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
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { createPlayerAdapter } from './playerAdapter';
import { usePlayerReporting } from './usePlayerReporting';
import { tmdbImg } from '../../api/cinemaApi';

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const HIDE_MS = 3500;
const TEAL = '#0d9488';   // app theme accent

// UI scale factor for large monitors / TVs — controls, text and panels grow so the
// player is legible from across a room. Provided via context so the reusable buttons
// (IconBtn/CtrlBtn) and the settings-sheet rows scale without threading a prop everywhere.
const ScaleCtx = React.createContext(1);
const scaleFor = (w) => (w >= 3000 ? 1.9 : w >= 2200 ? 1.55 : w >= 1600 ? 1.28 : 1);

// Remembered selections (global, per device).
const PREF_AUDIO = 'dbworld:player:audioLang';
const PREF_SUB   = 'dbworld:player:subLang';
const PREF_DECODER = 'dbworld:player:decoder';
const DEFAULT_AUDIO = 'Hindi';
const DEFAULT_SUB   = 'off';
const DECODERS = [{ id: 'auto', label: 'Auto' }, { id: 'hw', label: 'Hardware' }, { id: 'sw', label: 'Software' }];
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
// ── Track-label helpers ──────────────────────────────────────────────────────
// Build rich, human labels from whatever track metadata is present (web seeds from
// the file's MediaInfo; native ExoPlayer emits a subset). Every part is optional so
// a sparse track still renders something sensible.
const chLayout = (t) => {
  const n = Number(t.channels);
  if (n >= 8) return '7.1';
  if (n >= 6) return '5.1';
  if (n === 2) return 'Stereo';
  if (n === 1) return 'Mono';
  // channels missing → accept only an already-clean token ("5.1", "Stereo"), never
  // MediaInfo's raw channel-position dump ("L R C LFE Ls Rs").
  const cl = String(t.channelLayout || '').trim();
  if (/^\d(\.\d)?$/.test(cl)) return cl;
  if (/^(mono|stereo|surround)$/i.test(cl)) return cl;
  return '';
};
// Atmos rides on E-AC3 (JOC) or TrueHD — detect it separately so the label reads
// "DDP Atmos" / "TrueHD Atmos" instead of a plain channel count.
const isAtmos = (t) => /ATMOS|JOC/.test(String(t.formatCommercial || t.format || t.codecId || t.codec || '').toUpperCase());
const audioCodec = (t) => {
  const raw = String(t.formatCommercial || t.format || t.codecId || t.codec || '').toUpperCase();
  if (!raw) return '';
  if (raw.includes('E-AC-3') || raw.includes('EAC3') || raw.includes('E-AC3')) return 'DDP';   // Dolby Digital Plus
  if (raw.includes('TRUEHD') || raw.includes('TRUE-HD'))return 'TrueHD';
  if (raw.includes('DTS-HD') || raw.includes('DTSHD'))  return 'DTS-HD';
  if (raw.includes('DTS'))                              return 'DTS';
  if (raw.includes('AC-3') || raw.includes('AC3'))      return 'DD';    // Dolby Digital
  if (raw.includes('AAC'))                              return 'AAC';
  if (raw.includes('OPUS'))                             return 'Opus';
  if (raw.includes('FLAC'))                             return 'FLAC';
  if (raw.includes('MP3') || raw.includes('MPEG AUDIO'))return 'MP3';
  if (raw.includes('VORBIS'))                           return 'Vorbis';
  if (raw.includes('PCM'))                              return 'PCM';
  return t.format || t.formatCommercial || '';
};
const kbps = (bps) => bps > 0 ? `${Math.round(bps / 1000)} kbps` : '';
const audioLabel = (t) => {
  const codec = audioCodec(t);
  // "DDP Atmos" / "TrueHD Atmos" / "Atmos", else "DDP 5.1" / "AAC Stereo".
  const codecCh = isAtmos(t)
    ? [codec, 'Atmos', chLayout(t)].filter(Boolean).join(' ')   // "DDP Atmos 5.1"
    : [codec, chLayout(t)].filter(Boolean).join(' ');           // "DDP 5.1"
  const name = t.language || t.title || codec || `Audio ${(Number(t.id) || 0) + 1}`;
  return [name, name === codecCh ? '' : codecCh, kbps(t.bitRate)].filter(Boolean).join(' · ');
};
// Native ExoPlayer often labels a track with a raw channel-position dump
// ("Hindi DDP L R C LFE Ls Rs") and omits structured fields. When the file's MediaInfo
// is available (the `audio` prop that seeds the web menu), copy channels/format/bitRate
// onto the matching native track — same index when counts match, else by language — so
// audioLabel() can render "Hindi · DDP Atmos 5.1 · 548 kbps".
function enrichAudioTracks(nativeTracks, meta) {
  if (!Array.isArray(nativeTracks) || !nativeTracks.length) return nativeTracks || [];
  if (!Array.isArray(meta) || !meta.length) return nativeTracks;
  const sameLen = nativeTracks.length === meta.length;
  const used = new Set();
  const byLang = (lang) => {
    const i = meta.findIndex((m, idx) => !used.has(idx)
      && String(m.language || '').toLowerCase() === String(lang || '').toLowerCase());
    if (i < 0) return null;
    used.add(i); return meta[i];
  };
  return nativeTracks.map((t, i) => {
    const m = sameLen ? meta[i] : byLang(t.language);
    if (!m) return t;
    return {
      ...t,
      language:         t.language || m.language,
      channels:         t.channels ?? m.channels,
      channelLayout:    t.channelLayout || m.channelLayout,
      format:           t.format || m.format,
      formatCommercial: t.formatCommercial || m.formatCommercial,
      codecId:          t.codecId || m.codecId,
      bitRate:          t.bitRate ?? m.bitRate,
    };
  });
}
const subFormat = (t) => {
  const raw = String(t.format || t.codecId || '').toUpperCase();
  if (raw.includes('PGS') || raw.includes('HDMV'))    return 'PGS';
  if (raw.includes('SUBRIP') || raw.includes('SRT') || raw.includes('S_TEXT/UTF8')) return 'SRT';
  if (raw.includes('ASS'))                            return 'ASS';
  if (raw.includes('SSA'))                            return 'SSA';
  if (raw.includes('VOBSUB') || raw.includes('VOB'))  return 'VobSub';
  if (raw.includes('WEBVTT') || raw.includes('VTT'))  return 'VTT';
  if (raw.includes('DVB'))                            return 'DVB';
  if (raw.includes('TELETEXT'))                       return 'Teletext';
  return '';
};
const isForced = (t) => t.forced === true || t.forced === 1
  || String(t.forced).toLowerCase() === 'yes' || String(t.forced).toLowerCase() === 'true';
const subtitleLabel = (t) => {
  const name = t.language || t.title || `Subtitle ${(Number(t.id) || 0) + 1}`;
  return [name, subFormat(t), isForced(t) ? 'Forced' : ''].filter(Boolean).join(' · ');
};
const qualityLabel = (v) => [v.label, v.codec, ...(v.hdr || [])].filter(Boolean).join(' · ');

// "S1:E2 · Episode Name" (drops the name when TMDB has none, drops the whole
// thing for movies). withName=false → just "S1:E2".
const epTitle = (ep, withName = true) => {
  if (!ep || ep.season == null || ep.episode == null) return '';
  const short = `S${ep.season}:E${ep.episode}`;
  return withName && ep.name ? `${short} · ${ep.name}` : short;
};

// Player styles injected once: seek-feedback keyframes + the custom progress bar
// (native <input range> keeps touch/keyboard/a11y; we restyle the track + thumb
// and fake the played fill with an inline gradient).
const PLAYER_CSS = `
@keyframes dbw-seekfx { 0% { opacity: 0; transform: scale(0.6); } 18% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.12); } }
.dbw-range { -webkit-appearance: none; appearance: none; width: 100%; height: 5px; border-radius: 999px; outline: none; cursor: pointer; transition: height 0.15s ease; }
.dbw-range:hover { height: 7px; }
.dbw-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #14b8a6; box-shadow: 0 0 8px rgba(20,184,166,0.75); transition: transform 0.15s ease, opacity 0.15s ease; }
.dbw-range:hover::-webkit-slider-thumb, .dbw-range:active::-webkit-slider-thumb { transform: scale(1.3); }
.dbw-range::-moz-range-thumb { width: 14px; height: 14px; border: none; border-radius: 50%; background: #14b8a6; box-shadow: 0 0 8px rgba(20,184,166,0.75); }
/* Seek bar only: hide the scrubber knob until hover/drag, so the played bar reads as a
   clean line — the knob + glow otherwise looks like a height bump at the playhead. */
.dbw-seek::-webkit-slider-thumb { opacity: 0; }
.dbw-seek:hover::-webkit-slider-thumb, .dbw-seek:active::-webkit-slider-thumb { opacity: 1; }
.dbw-seek::-moz-range-thumb { opacity: 0; }
.dbw-seek:hover::-moz-range-thumb, .dbw-seek:active::-moz-range-thumb { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .dbw-range, .dbw-range::-webkit-slider-thumb { transition: none; } }
.dbw-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.28) transparent; }
.dbw-scroll::-webkit-scrollbar { width: 8px; }
.dbw-scroll::-webkit-scrollbar-track { background: transparent; }
.dbw-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.28); border-radius: 4px; }
.dbw-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45); }
.dbw-epfocus:focus-visible { outline: 2px solid #14b8a6; outline-offset: -2px; }
.dbw-ep { background: transparent; transition: background 0.12s ease; }
.dbw-ep:hover { background: rgba(255,255,255,0.08); }
.dbw-ep.cur { background: rgba(13,148,136,0.14); }
/* TV / keyboard focus ring on every player control (D-pad + Tab friendly). */
.dbw-player :focus-visible { outline: 3px solid #14b8a6; outline-offset: 2px; border-radius: 8px; }
.dbw-tip::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.92); color: #fff; font-size: 12px; white-space: nowrap; padding: 4px 8px; border-radius: 6px; opacity: 0; pointer-events: none; transition: opacity 0.12s ease; z-index: 50; }
.dbw-tip:hover::after { opacity: 1; }`;

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
  audio = [], // file audio-track metadata (seeds the audio menu on web)
  storyboard = null, // scrub-preview sprite { url, intervalMs, cols, rows, tileW, tileH, count } | null
  overview = '', // show/movie synopsis — shown on the pause info card (episodes use their own)
  requestId = null, mediaFileId = null, recordId = null, // stream telemetry session (null → reporting is skipped)
}) {
  const isNative = Capacitor.getPlatform() === 'android';
  const reduce   = useReducedMotion();          // honour prefers-reduced-motion
  const videoRef    = useRef(null);
  const rootRef     = useRef(null);
  const triedQualityRef = useRef(new Set()); // quality urls that failed to decode (avoid loops)
  const adapterRef  = useRef(null);
  const hideTimer   = useRef(null);
  const tapRef      = useRef({ last: 0, x: 0 });
  const gestureRef  = useRef(null);
  // Watch-progress save (resume) + fire-and-forget STREAM_* telemetry both read a single
  // progress ref that the adapter 'time' handler below keeps current. Extracted into a hook
  // to keep this component focused on UI/transport.
  const { progressRef, report, emitStreamEvent, streamStartedRef, streamStoppedRef } =
    usePlayerReporting({ isNative, requestId, mediaFileId, recordId, onProgress });

  const [position, setPosition]   = useState(0);
  const [duration, setDuration]   = useState(0);
  const [buffered, setBuffered]   = useState(0);      // preloaded position (ms) — native single-fill fallback
  const [bufferedRanges, setBufferedRanges] = useState([]); // web: all loaded [startMs,endMs] segments
  const [scrub, setScrub]         = useState(null);   // non-null while dragging the bar
  const [preview, setPreview]     = useState(null);   // hover/scrub preview: { leftPx, time } | null
  const barRef      = useRef(null);                   // progress-bar wrapper (for pointer→time math)
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
  const curEp = curIdx >= 0 ? episodes[curIdx] : null;
  const nextEpisode = curIdx >= 0 && curIdx < episodes.length - 1 ? episodes[curIdx + 1] : null;
  const seasonsMap = episodes.reduce((m, ep) => { (m[ep.season] ||= []).push(ep); return m; }, {});
  // Touch bottom-row button count (excluding Settings). When the row would be sparse we
  // pull Settings down into it to keep a balanced set; otherwise it lives top-right.
  const touchRowButtons = (isNative ? 0 : 2)          // volume + fullscreen (web only)
    + 2                                               // speed, audio
    + (episodes.length > 1 ? 1 : 0)                   // episodes
    + (nextEpisode ? 1 : 0);                          // next
  const settingsInRow = !hasHover && touchRowButtons < 4;
  const [locked, setLocked]       = useState(false);
  const [landscape, setLandscape] = useState(isNative); // default landscape on the app
  const [volume, setVolume]       = useState(1);
  const [brightness, setBrightness] = useState(0.5);
  const [zoom, setZoom]           = useState(1);
  const [decoder, setDecoder]     = useState(() => lsGet(PREF_DECODER, 'auto'));
  const [errorMsg, setErrorMsg]   = useState(null);
  const [infoMsg, setInfoMsg]     = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipActive, setPipActive] = useState(false);   // Android Picture-in-Picture active
  const [pauseInfo, setPauseInfo] = useState(false);   // Netflix-style info card while paused + idle
  const [hud, setHud]             = useState(null);    // { kind:'volume'|'brightness'|'zoom', value }
  const [seekFx, setSeekFx]       = useState(null);    // { dir:'fwd'|'back', id } — double-tap/seek feedback
  const [volFx, setVolFx]         = useState(null);    // { dir:'up'|'down', value, id } — arrow-key volume pop
  const [playFx, setPlayFx]       = useState(null);    // { playing, id } — centered play/pause pop
  const [upNextDismissed, setUpNextDismissed] = useState(false);
  const [uiScale, setUiScale] = useState(() => (typeof window !== 'undefined' ? scaleFor(window.innerWidth) : 1));
  // Mouse/desktop vs touch (mobile/tablet/native) — drives the control-bar layout.
  const [hasHover, setHasHover] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches);
  const seekFxTimer = useRef(null);
  const playFxTimer = useRef(null);
  const epHoverTimer = useRef(null);
  const muteRef     = useRef(1);                       // remembers pre-mute volume
  const touchedRef  = useRef(0);                       // ts of last touch — suppresses the trailing click
  const pipActiveRef  = useRef(false);                 // in PiP → don't background-pause
  const pipPendingRef = useRef(false);                 // PiP requested, awaiting confirmation
  const hudTimer    = useRef(null);                    // auto-hides the arrow-key volume HUD
  const pauseTimer  = useRef(null);                    // delay before the pause info card appears
  const playBtnRef  = useRef(null);                    // focus target when controls reveal (TV/keyboard)
  const kbdRevealRef = useRef(false);                  // true when controls were last revealed by a key

  // Grow the UI on large monitors / TVs.
  useEffect(() => {
    const onResize = () => setUiScale(scaleFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Track hover capability so the layout can switch if the input device changes
  // (e.g. a tablet docked to a mouse). Desktop = clustered icon-only bar; touch =
  // centered transport + labelled row.
  useEffect(() => {
    const mq = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    if (!mq) return undefined;
    const on = () => setHasHover(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  // When the controls are revealed by a key/D-pad press, move focus to Play so the
  // remote can navigate from there; don't steal focus on mouse/touch reveals.
  useEffect(() => {
    if (controls && kbdRevealRef.current) {
      kbdRevealRef.current = false;
      playBtnRef.current?.focus?.();
    }
  }, [controls]);

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
    setEnded(false); setCountdown(null); setErrorMsg(null); setUpNextDismissed(false);

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
        if (typeof d.bufferedMs === 'number') setBuffered(d.bufferedMs);
        if (Array.isArray(d.bufferedRanges)) setBufferedRanges(d.bufferedRanges);
        progressRef.current = { positionMs: d.positionMs || 0, durationMs: d.durationMs || progressRef.current.durationMs };
      }),
      adapter.on('state', d => {
        if (typeof d.state === 'number') setBuffering(d.state === 2);
        // Play/pause is driven ONLY by the real play state — never by "ready"/buffering
        // transitions — so seeking or re-buffering while paused can't auto-resume the icon.
        if (typeof d.playing === 'boolean') {
          setPlaying(d.playing);
          // First time we're actually playing this session → STREAM_START (once per requestId).
          if (d.playing && !streamStartedRef.current) {
            streamStartedRef.current = true;
            emitStreamEvent('STREAM_START');
          }
        }
      }),
      adapter.on('ended', () => {
        setPlaying(false); setBuffering(false); report(true); setEnded(true);
        if (!streamStoppedRef.current) {
          streamStoppedRef.current = true;
          emitStreamEvent('STREAM_STOP');
        }
      }),
      adapter.on('error', (d) => { setBuffering(false); setErrorMsg(d?.message || 'This video could not be played.'); }),
      adapter.on('info', (d) => { setBuffering(false); if (d?.message) { setInfoMsg(d.message); setTimeout(() => setInfoMsg(null), 3000); } }),
      adapter.on('tracks', d => {
        // `audio` (the file-metadata prop) enriches native tracks so the menu shows clean
        // labels instead of ExoPlayer's raw channel-position dump.
        const audioTr = enrichAudioTracks(d.audio || [], audio);
        const text = d.text || [];
        setAudioTracks(audioTr); setTextTracks(text);
        setCurAudio(d.selectedAudio); setCurText(d.selectedText);
        if (!appliedRef.current && (audioTr.length || text.length)) {
          appliedRef.current = true;
          applyPreferredTracks(audioTr, text);
        }
      }),
      // Device volume changed via the hardware keys — keep the in-app bar in
      // sync silently (Android already shows its own system volume overlay, so
      // no extra HUD here).
      adapter.on('volume', (d) => {
        if (typeof d?.value === 'number') setVolume(d.value);
      }),
      // Android PiP enter/exit → hide/show the React overlay so only the video shows.
      adapter.on('pip', (d) => {
        const on = !!d?.pip;
        pipActiveRef.current = on;
        pipPendingRef.current = false;
        setPipActive(on);
      }),
    ];
    // Initialise the bar from the current device media volume.
    adapter.getVolume?.().then((r) => {
      if (typeof r?.value === 'number') setVolume(r.value);
    }).catch(() => {});
    adapter.setDecoderMode?.(lsGet(PREF_DECODER, 'auto')); // set before load so the player builds with it

    // Web: the adapter never emits a 'tracks' event, so seed the audio menu from
    // the file metadata and reflect which track is active up front (preferred
    // language if present, else the first). Native (ExoPlayer) emits 'tracks' and
    // applies prefs via applyPreferredTracks instead.
    if (!isNative && audio.length) {
      const webTracks = audio.map((a, i) => ({
        id: i, language: a.language, title: a.title,
        channels: a.channels, channelLayout: a.channelLayout,
        format: a.format, formatCommercial: a.formatCommercial, codecId: a.codecId,
        bitRate: a.bitRate,
      }));
      setAudioTracks(webTracks);
      let idx = audio.findIndex(a => a.language === lsGet(PREF_AUDIO, DEFAULT_AUDIO));
      if (idx < 0) idx = 0;
      setCurAudio(idx);
      appliedRef.current = true;
      // Best-effort: activate the preferred track once the element exists
      // (browsers that expose HTMLMediaElement.audioTracks honour this).
      setTimeout(() => adapter.selectAudioTrack?.(idx), 0);
    }
    adapter.load(src, startMs);

    if (isNative) adapter.setOrientation('landscape'); // default to full-screen landscape
    scheduleHide();

    // Periodic save so progress survives a crash / force-kill. Piggyback the
    // stream TICK on this same ~20s cadence rather than adding a second timer.
    const saveTimer = setInterval(() => {
      if (progressRef.current.positionMs > 0) {
        report(false);
        emitStreamEvent('STREAM_TICK');
      }
    }, 20000);

    return () => {
      offs.forEach(f => f());
      clearInterval(saveTimer);
      report(false); // save on close/unmount
      if (!streamStoppedRef.current) {
        streamStoppedRef.current = true;
        emitStreamEvent('STREAM_STOP');
      }
      adapter.release();
      clearTimeout(hideTimer.current);
      clearTimeout(seekFxTimer.current);
      clearTimeout(hudTimer.current);
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
      if (pipActiveRef.current || pipPendingRef.current) return;  // keep playing in Picture-in-Picture
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
  }, [report, isNative]);

  // ── controls auto-hide ──────────────────────────────────────────────────────
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), HIDE_MS);
  }, []);
  const showControls = useCallback(() => { setControls(true); setPauseInfo(false); scheduleHide(); }, [scheduleHide]);

  // ── transport ───────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const a = adapterRef.current;
    if (!a) return;
    const willPlay = !playing;
    if (playing) {
      a.pause(); setPlaying(false); report(false);
      emitStreamEvent('STREAM_PAUSE');
    } else {
      a.play(); setPlaying(true);
      // Play-after-pause: report a TICK (not a new START) so the session
      // returns to ACTIVE on the backend.
      emitStreamEvent('STREAM_TICK');
    }
    // Brief centered play/pause pop (mirrors the arrow-key volume feedback) — gives
    // desktop click-to-toggle a visual cue now that there's no centered play button.
    setPlayFx({ playing: willPlay, id: Date.now() });
    clearTimeout(playFxTimer.current);
    playFxTimer.current = setTimeout(() => setPlayFx(null), 500);
    showControls();
  }, [playing, showControls, report, emitStreamEvent]);

  // Brief on-screen ±10s feedback (double-tap, seek buttons, arrow keys).
  const flashSeek = useCallback((dir) => {
    clearTimeout(seekFxTimer.current);
    setSeekFx({ dir, id: Date.now() });
    seekFxTimer.current = setTimeout(() => setSeekFx(null), 650);
  }, []);

  const seekBy = useCallback((deltaMs, showUi = true) => {
    const a = adapterRef.current; if (!a) return;
    const target = Math.max(0, Math.min(duration || Infinity, position + deltaMs));
    a.seekTo(target); setPosition(target);
    if (showUi) showControls();     // arrow keys pass false → just the ±10s ripple, no control bar
    flashSeek(deltaMs >= 0 ? 'fwd' : 'back');
    emitStreamEvent('SEEK', { positionMs: Math.round(target) || null });
  }, [position, duration, showControls, flashSeek, emitStreamEvent]);

  const toggleMute = useCallback(() => {
    const a = adapterRef.current; if (!a) return;
    if (volume > 0) { muteRef.current = volume; a.setVolume(0); setVolume(0); }
    else            { const v = muteRef.current || 1; a.setVolume(v); setVolume(v); }
    showControls();
  }, [volume, showControls]);

  // Web/desktop volume (scroll-wheel + inline slider). No floating HUD — the always-visible
  // slider in the control row is the feedback (showControls reveals it), so a second bar is
  // redundant. Native keeps the swipe-gesture HUD (it has no slider).
  const setVol = useCallback((val) => {
    const v = Math.max(0, Math.min(1, val));
    adapterRef.current?.setVolume(v);
    setVolume(v);
    if (v > 0) muteRef.current = v;
  }, []);
  const onWheelVolume = useCallback((e) => {
    if (settingsOpen || episodesOpen) return;   // let an open panel scroll instead
    setVol(volume + (e.deltaY < 0 ? 0.05 : -0.05));
    showControls();
  }, [volume, settingsOpen, episodesOpen, setVol, showControls]);
  // Arrow-key volume (desktop/TV): adjust + flash a brief volume HUD, without revealing the
  // control bar (mirrors the ±10s ripple on left/right seek).
  const bumpVolume = useCallback((delta) => {
    const v = Math.max(0, Math.min(1, volume + delta));
    setVol(v);
    // Centered volume-up/down icon, re-keyed each press so it re-pops like a button click.
    setVolFx({ dir: delta > 0 ? 'up' : 'down', value: v, id: Date.now() });
    clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setVolFx(null), 700);
  }, [volume, setVol]);

  const openSettings = (view) => { setSettingsView(view); setSettingsOpen(true); showControls(); };
  const openEpisodes = () => { setEpisodesOpen(true); showControls(); };
  // Android PiP. Mark pending BEFORE the app backgrounds so the background-pause is skipped;
  // pipActive is confirmed by the 'pip' event (or pending clears on failure/timeout).
  const enterPip = () => {
    pipPendingRef.current = true;
    adapterRef.current?.enterPip?.();
    setTimeout(() => { pipPendingRef.current = false; }, 1500);
  };

  const rotate = () => {
    const next = !landscape; setLandscape(next); setLocked(false);
    adapterRef.current?.setOrientation(next ? 'landscape' : 'portrait'); showControls();
  };
  const toggleLock = () => {
    const next = !locked; setLocked(next);
    adapterRef.current?.setOrientation(next ? 'locked' : 'sensor'); showControls();
  };
  const close = () => { adapterRef.current?.release(); onClose?.(); };

  // Mobile web: force landscape by entering fullscreen + locking the screen orientation.
  // Works on Android Chrome (orientation lock requires fullscreen); iOS Safari has no
  // lock API and desktop is excluded, so both are graceful no-ops. The native app drives
  // orientation through the plugin instead.
  const lockLandscape = useCallback(async () => {
    if (isNative || hasHover) return;
    try {
      const root = rootRef.current;
      if (root?.requestFullscreen && !document.fullscreenElement) await root.requestFullscreen();
      await window.screen?.orientation?.lock?.('landscape');
    } catch { /* best-effort — user-gesture / iOS / desktop limits */ }
  }, [isNative, hasHover]);

  useEffect(() => {
    if (isNative || hasHover) return undefined;
    lockLandscape();                          // attempt now (some browsers need a gesture)…
    const root = rootRef.current;
    const onFirst = () => lockLandscape();    // …and on the first touch, which guarantees one
    root?.addEventListener('pointerdown', onFirst, { once: true });
    return () => {
      root?.removeEventListener('pointerdown', onFirst);
      try { window.screen?.orientation?.unlock?.(); } catch { /* ignore */ }
      try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* ignore */ }
    };
  }, [isNative, hasHover, lockLandscape]);

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
  // Switch to another episode with instant feedback: show the buffering spinner
  // right away (the parent resolves the next episode's URL + resume point async,
  // so without this the old frame sits frozen for a moment).
  const switchEpisode = useCallback((ep) => {
    if (!ep) return;
    setBuffering(true);
    setEnded(false);
    setCountdown(null);
    setUpNextDismissed(false);
    onSelectEpisode?.(ep);
  }, [onSelectEpisode]);

  const goNext = useCallback(() => {
    if (!nextEpisode) return;
    switchEpisode(nextEpisode);
  }, [nextEpisode, switchEpisode]);

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

  // Pause info card (Netflix-style): a short idle after pausing reveals show/episode info
  // (and hides the controls for a clean screen); any interaction — which routes through
  // showControls — dismisses it. Never shown while buffering / ended / errored / in PiP.
  useEffect(() => {
    clearTimeout(pauseTimer.current);
    if (!playing && !buffering && !ended && !errorMsg && !pipActive) {
      pauseTimer.current = setTimeout(() => { setPauseInfo(true); setControls(false); }, 1500);
    } else {
      setPauseInfo(false);
    }
    return () => clearTimeout(pauseTimer.current);
  }, [playing, buffering, ended, errorMsg, pipActive]);

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
      // Arrow keys → volume (↑/↓) + seek (←/→) with just a HUD / ±10s ripple and NO control
      // bar — unless a panel is open, where arrows navigate it (focus) instead.
      if (!settingsOpen && !episodesOpen) {
        switch (e.key) {
          case 'ArrowUp':    e.preventDefault(); bumpVolume(0.05);  return;
          case 'ArrowDown':  e.preventDefault(); bumpVolume(-0.05); return;
          case 'ArrowRight': seekBy(10000, false);  return;
          case 'ArrowLeft':  seekBy(-10000, false); return;
          default: break;
        }
      }
      // Controls hidden → the first (non-arrow) key reveals them + focuses Play (TV/remote).
      // Exception: space / k are play-pause — they must toggle immediately, not just reveal.
      if (!controls && e.key !== 'Escape' && e.key !== ' ' && e.key !== 'k') {
        kbdRevealRef.current = true;
        showControls();
        if (e.key === 'Enter') e.preventDefault();
        return;
      }
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'f': case 'F': if (!isNative) toggleFullscreen(); break;
        case 'Escape':
          if (settingsOpen)      setSettingsOpen(false);   // Back closes the open panel first
          else if (episodesOpen) setEpisodesOpen(false);
          else if (!document.fullscreenElement) close();
          break;
        default: showControls();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controls, settingsOpen, episodesOpen, togglePlay, seekBy, showControls, toggleFullscreen, isNative, bumpVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── seek bar drag + hover preview ───────────────────────────────────────────
  // Builds the { leftPx, time } preview from a 0..1 fraction along the bar,
  // clamping leftPx so the tooltip/thumbnail stays inside the player edges.
  const PREVIEW_HALF = 80; // half the preview bubble width (px)
  const previewAt = useCallback((frac) => {
    const el = barRef.current;
    if (!el || !duration) return;
    const w = el.clientWidth;
    const f = Math.max(0, Math.min(1, frac));
    setPreview({ leftPx: Math.max(PREVIEW_HALF, Math.min(w - PREVIEW_HALF, f * w)), time: f * duration });
  }, [duration]);

  const onBarHover = (e) => { if (scrub == null) previewAt((e.clientX - barRef.current.getBoundingClientRect().left) / barRef.current.clientWidth); };
  const onBarLeave = () => { if (scrub == null) setPreview(null); };

  const onScrubChange = (e) => {
    const ms = Number(e.target.value);
    setScrub(ms); showControls();
    if (duration) previewAt(ms / duration);
  };
  const onScrubCommit = () => {
    if (scrub != null) {
      adapterRef.current?.seekTo(scrub); setPosition(scrub);
      emitStreamEvent('SEEK', { positionMs: Math.round(scrub) || null });
    }
    setScrub(null); setPreview(null);
  };

  // ── gestures (native + web touch): double-tap seek, vertical swipe = bright/vol ─
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const onTouchStart = (e) => {
    touchedRef.current = Date.now();         // mark touch so the trailing click is ignored
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
    setPauseInfo(false);   // any tap dismisses the pause info card
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
  const pct = duration > 0 ? Math.min(100, (displayPos / duration) * 100) : 0;
  // Loaded indicator = the ONE contiguous buffered region around the current playhead
  // (like YouTube), so a stray earlier/later range doesn't read as "loaded after a gap".
  // Web sends real ranges (v.buffered); native sends a single contiguous bufferedMs.
  const bufferedSegs = (() => {
    if (!(duration > 0)) return [];
    if (bufferedRanges.length) {
      const cover = bufferedRanges.find(([s, e]) => position >= s - 300 && position <= e + 300);
      return cover ? [[Math.max(0, (cover[0] / duration) * 100), Math.min(100, (cover[1] / duration) * 100)]] : [];
    }
    return buffered > 0 ? [[0, Math.min(100, (buffered / duration) * 100)]] : [];
  })();
  // "Up next" card appears in the last 60s — series these days end on 1–3 min of
  // credits, so prompt the next episode before the file actually finishes.
  const nearEnd = duration > 0 && position > 0 && (duration - position) <= 60000;
  const showUpNext = nextEpisode && !ended && nearEnd && !upNextDismissed && countdown == null;

  return (
    <ScaleCtx.Provider value={uiScale}>
    <div
      ref={rootRef}
      className="dbw-player"
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseMove={!isNative ? showControls : undefined}   // desktop: reveal controls on mouse move
      onWheel={!isNative ? onWheelVolume : undefined}       // desktop: scroll to change volume
      onClick={!isNative ? (e) => {
        if (e.target.closest('button, input')) return;        // controls handle their own clicks
        if (Date.now() - touchedRef.current < 700) return;    // a touch tap already handled it
        togglePlay();                                         // desktop click = play/pause (also reveals controls)
      } : undefined}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: isNative ? 'transparent' : '#000',
               overflow: 'hidden', color: '#fff', fontFamily: 'system-ui, sans-serif', touchAction: 'none',
               // Desktop: hide the cursor while the controls are hidden; mouse move re-shows both.
               cursor: (!isNative && !controls) ? 'none' : 'default' }}
    >
      <style>{PLAYER_CSS}</style>

      {/* Web video surface (native renders behind the WebView) */}
      {!isNative && (
        <video ref={videoRef} playsInline preload="auto"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
      )}

      {/* In Android PiP the whole window is the tiny video — hide every overlay so only the
          native video (behind the transparent WebView) shows. */}
      {!pipActive && (<>

      {/* Double-tap / seek feedback (±10s ripple on the relevant side) */}
      {seekFx && (
        <div key={seekFx.id} style={{ position: 'absolute', top: 0, bottom: 0, width: '34%', zIndex: 24,
          ...(seekFx.dir === 'fwd' ? { right: 0 } : { left: 0 }),
          display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            width: 116, height: 116, borderRadius: '50%', background: 'rgba(0,0,0,0.45)',
            animation: 'dbw-seekfx 0.65s ease-out forwards' }}>
            {seekFx.dir === 'fwd' ? <Forward10Icon sx={{ fontSize: 36 }} /> : <Replay10Icon sx={{ fontSize: 36 }} />}
            <span style={{ fontSize: 13, fontWeight: 700 }}>{seekFx.dir === 'fwd' ? '+10s' : '-10s'}</span>
          </div>
        </div>
      )}

      {/* Arrow-key volume feedback — a centered icon that pops on each key press */}
      {volFx && (
        <div key={volFx.id} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            width: 120, height: 120, borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
            animation: 'dbw-seekfx 0.65s ease-out forwards' }}>
            {volFx.value === 0
              ? <VolumeOffIcon sx={{ fontSize: 42 }} />
              : volFx.dir === 'up' ? <VolumeUpIcon sx={{ fontSize: 42 }} /> : <VolumeDownIcon sx={{ fontSize: 42 }} />}
            <span style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(volFx.value * 100)}%</span>
          </div>
        </div>
      )}

      {/* Play/pause pop — brief centered icon on every toggle (mirrors the volume
          feedback; desktop click-to-toggle has no persistent center button). */}
      {playFx && (
        <div key={playFx.id} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 24 }}>
          <div style={{ display: 'grid', placeItems: 'center',
            width: Math.round(96 * uiScale), height: Math.round(96 * uiScale), borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', animation: 'dbw-seekfx 0.5s ease-out forwards' }}>
            {playFx.playing
              ? <PlayArrowIcon sx={{ fontSize: Math.round(46 * uiScale) }} />
              : <PauseIcon sx={{ fontSize: Math.round(46 * uiScale) }} />}
          </div>
        </div>
      )}

      {/* Buffering spinner */}
      {buffering && !errorMsg && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <CircularProgress size={56} sx={{ color: '#fff' }} />
        </div>
      )}

      {/* Pause info card (appears ~1.5s after pausing; any interaction dismisses it) */}
      {pauseInfo && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
          style={{ position: 'absolute', inset: 0, zIndex: 22, pointerEvents: 'none', display: 'flex', alignItems: 'center',
            padding: `0 ${Math.round(64 * uiScale)}px`,
            background: 'linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0.45) 45%, transparent 72%)' }}>
          <div style={{ maxWidth: Math.round(560 * uiScale), minWidth: 0 }}>
            <div style={{ fontSize: Math.round(13 * uiScale), color: '#bbb', letterSpacing: 1, textTransform: 'uppercase' }}>
              {curEp ? 'You’re watching' : 'Paused'}
            </div>
            <div style={{ fontSize: Math.round(34 * uiScale), fontWeight: 800, lineHeight: 1.1, marginTop: 6,
              overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {title}
            </div>
            {curEp && (
              <div style={{ fontSize: Math.round(16 * uiScale), color: TEAL, fontWeight: 600, marginTop: 8 }}>
                {epTitle(curEp)}{curEp.runtime ? ` · ${curEp.runtime}m` : ''}
              </div>
            )}
            {(curEp?.overview || overview) && (
              <div style={{ fontSize: Math.round(14 * uiScale), color: '#dcdcdc', lineHeight: 1.5, marginTop: 12,
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {curEp?.overview || overview}
              </div>
            )}
          </div>
        </motion.div>
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
          {/* gradient scrims (stronger at the bottom for the taller control bar) */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(rgba(0,0,0,0.6), transparent 20%, transparent 58%, rgba(0,0,0,0.88))' }} />

          {/* Top bar: close + show name (left); orientation controls (right, native) */}
          <div style={row('absolute', { top: 0, left: 0, right: 0, padding: 14, justifyContent: 'space-between' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <IconBtn onClick={close} ariaLabel="Close player"><CloseIcon /></IconBtn>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: Math.round(16 * uiScale), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                {curEp && (
                  <span style={{ fontSize: Math.round(13 * uiScale), color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {epTitle(curEp)}
                  </span>
                )}
              </div>
            </div>
            {(isNative || !hasHover) && (
              <div style={{ display: 'flex', gap: 4 }}>
                {isNative && <IconBtn onClick={enterPip} ariaLabel="Picture in picture"><PictureInPictureAltIcon /></IconBtn>}
                {isNative && <IconBtn onClick={rotate} ariaLabel="Rotate screen"><ScreenRotationIcon /></IconBtn>}
                {/* On touch, Settings lives top-right — unless the bottom row is sparse,
                    then it drops into the row to keep it balanced (see settingsInRow). */}
                {!hasHover && !settingsInRow && <IconBtn onClick={() => openSettings('main')} ariaLabel="Settings"><SettingsIcon /></IconBtn>}
                {isNative && <IconBtn onClick={toggleLock} ariaLabel={locked ? 'Unlock controls' : 'Lock controls'}>{locked ? <LockIcon /> : <LockOpenIcon />}</IconBtn>}
              </div>
            )}
          </div>

          {/* Center transport — touch only (desktop moves play/seek to the bottom-left bar) */}
          {!hasHover && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 48, pointerEvents: 'none' }}>
            <IconBtn big onClick={() => seekBy(-10000)} ariaLabel="Rewind 10 seconds"><Replay10Icon sx={{ fontSize: 38 }} /></IconBtn>
            <IconBtn big focusRef={playBtnRef} onClick={togglePlay} ariaLabel={playing ? 'Pause' : 'Play'}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={playing ? 'pause' : 'play'} style={{ display: 'flex' }}
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}>
                  {playing ? <PauseIcon sx={{ fontSize: 52 * uiScale }} /> : <PlayArrowIcon sx={{ fontSize: 52 * uiScale }} />}
                </motion.span>
              </AnimatePresence>
            </IconBtn>
            <IconBtn big onClick={() => seekBy(10000)} ariaLabel="Forward 10 seconds"><Forward10Icon sx={{ fontSize: 38 }} /></IconBtn>
          </div>
          )}

          {/* Bottom bar: full-width progress → time → control row (icon + label) */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 28px 16px' }}>

            {/* full-width progress bar — wrapper carries hover→time math + the preview bubble.
                Fill is a 3-stop gradient: teal (played) → light (buffered) → dark (unloaded). */}
            <div ref={barRef} style={{ position: 'relative', height: 16 }} onMouseMove={onBarHover} onMouseLeave={onBarLeave}>
              {preview && (
                <ScrubPreview leftPx={preview.leftPx} time={preview.time} fmt={fmt}
                  thumb={storyboardTile(storyboard, preview.time)} />
              )}
              {/* One 5px strip (track → loaded segments → played fill), centered in the row,
                  so every layer shares the same 0–100% coordinate system and stays aligned.
                  The seek input overlays it with a transparent track — only its thumb shows. */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)',
                height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.22)', overflow: 'hidden', pointerEvents: 'none' }}>
                {bufferedSegs.map(([s, e], i) => (
                  <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${s}%`,
                    width: `${Math.max(0, e - s)}%`, background: 'rgba(255,255,255,0.5)' }} />
                ))}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`, background: TEAL }} />
              </div>
              <input className="dbw-range dbw-seek" type="range" min={0} max={duration || 0} aria-label="Seek"
                value={Math.min(displayPos, duration || displayPos)}
                onChange={onScrubChange} onPointerUp={onScrubCommit} onTouchEnd={onScrubCommit} onMouseUp={onScrubCommit}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, background: 'transparent' }} />
            </div>

            {/* time below the bar, on the edges */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6,
              fontSize: Math.round(12 * uiScale), color: '#ccc', fontVariantNumeric: 'tabular-nums' }}>
              <span>{fmt(displayPos)}</span>
              <span>{fmt(duration)}</span>
            </div>

            {/* Control row. Desktop: transport + volume clustered left, everything else
                right, icon-only with hover tooltips. Touch: centered, equal-spaced,
                labelled buttons (label left of icon); Settings lives top-right instead. */}
            {hasHover ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CtrlBtn icon={playing ? <PauseIcon /> : <PlayArrowIcon />} tip={playing ? 'Pause' : 'Play'}
                    ariaLabel={playing ? 'Pause' : 'Play'} focusRef={playBtnRef} onClick={togglePlay} />
                  <CtrlBtn icon={<Replay10Icon />} tip="Back 10s" ariaLabel="Rewind 10 seconds" onClick={() => seekBy(-10000)} />
                  <CtrlBtn icon={<Forward10Icon />} tip="Forward 10s" ariaLabel="Forward 10 seconds" onClick={() => seekBy(10000)} />
                  <VolumeControl volume={volume} hasHover={hasHover} onToggleMute={toggleMute} onSetVol={setVol} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CtrlBtn icon={<SpeedIcon />} label={`${SPEEDS[rateIdx]}×`} tip="Playback speed"
                    active={rateIdx !== 1} ariaLabel="Playback speed" onClick={() => openSettings('speed')} />
                  <CtrlBtn icon={<AudiotrackIcon />} tip="Audio & subtitles"
                    ariaLabel="Audio and subtitles" onClick={() => openSettings('audiosubs')} />
                  {episodes.length > 1 && (
                    <span style={{ display: 'inline-flex' }}
                      onMouseEnter={() => { clearTimeout(epHoverTimer.current); epHoverTimer.current = setTimeout(openEpisodes, 350); }}
                      onMouseLeave={() => clearTimeout(epHoverTimer.current)}>
                      <CtrlBtn icon={<PlaylistPlayIcon />} tip="Episodes" ariaLabel="Episode list" onClick={openEpisodes} />
                    </span>
                  )}
                  {nextEpisode && <NextEpisodeButton nextEpisode={nextEpisode} onClick={goNext} />}
                  <CtrlBtn icon={<SettingsIcon />} tip="Settings" ariaLabel="Settings" onClick={() => openSettings('main')} />
                  <CtrlBtn icon={isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                    tip={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} ariaLabel="Toggle fullscreen" onClick={toggleFullscreen} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
                marginTop: 6, rowGap: 10, columnGap: 'clamp(14px, 6vw, 40px)' }}>
                {!isNative && (
                  <VolumeControl volume={volume} hasHover={hasHover} label="Volume" labelLeft
                    onToggleMute={toggleMute} onSetVol={setVol} />
                )}
                <CtrlBtn icon={<SpeedIcon />} label={`${SPEEDS[rateIdx]}×`} labelLeft active={rateIdx !== 1}
                  ariaLabel="Playback speed" onClick={() => openSettings('speed')} />
                <CtrlBtn icon={<AudiotrackIcon />} label="Audio" labelLeft
                  ariaLabel="Audio and subtitles" onClick={() => openSettings('audiosubs')} />
                {episodes.length > 1 && (
                  <CtrlBtn icon={<PlaylistPlayIcon />} label="Episodes" labelLeft ariaLabel="Episode list" onClick={openEpisodes} />
                )}
                {nextEpisode && (
                  <CtrlBtn icon={<SkipNextIcon />} label="Next" labelLeft ariaLabel="Next episode" onClick={goNext} />
                )}
                {settingsInRow && (
                  <CtrlBtn icon={<SettingsIcon />} label="Settings" labelLeft ariaLabel="Settings" onClick={() => openSettings('main')} />
                )}
                {!isNative && (
                  <CtrlBtn icon={isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                    label={isFullscreen ? 'Exit' : 'Fullscreen'} labelLeft ariaLabel="Toggle fullscreen" onClick={toggleFullscreen} />
                )}
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Locked: just an unlock affordance */}
      {locked && controls && (
        <div style={{ position: 'absolute', top: 14, left: 14 }}>
          <IconBtn onClick={toggleLock}><LockIcon /></IconBtn>
        </div>
      )}

      {/* Next-episode card — autoplay countdown at the very end, or a manual
          "Up next" prompt during the last 60s (credits) of the episode. */}
      {((countdown != null && nextEpisode) || showUpNext) && (
        <div style={{ position: 'absolute', bottom: 110, right: 20, zIndex: 25, width: 320, maxWidth: '82%',
          background: 'rgba(0,0,0,0.9)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, color: '#bbb', marginBottom: 4 }}>
            {countdown != null ? `Next episode in ${countdown}s` : 'Up next'}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12,
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {epTitle(nextEpisode)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={goNext}
              style={{ flex: 1, padding: 10, background: TEAL, color: '#fff', border: 'none', borderRadius: 8,
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <SkipNextIcon sx={{ fontSize: 18 }} /> {countdown != null ? 'Play now' : 'Play next'}
            </button>
            <button onClick={countdown != null ? cancelAutoplay : () => setUpNextDismissed(true)}
              style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
                borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              {countdown != null ? 'Cancel' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* Episode panel (right drawer) — Netflix-style rows: still thumbnail + title +
          runtime + 2-line synopsis, current episode highlighted, smooth styled scroll. */}
      {episodesOpen && (
        <div onClick={() => setEpisodesOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} className="dbw-scroll"
            style={{ width: Math.round(420 * uiScale), maxWidth: '92%', height: '100%', background: 'rgba(14,14,14,0.96)',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', overflowY: 'auto', padding: '14px 0',
              borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${Math.round(18 * uiScale)}px 12px` }}>
              <span style={{ fontWeight: 700, fontSize: Math.round(17 * uiScale) }}>Episodes</span>
              <IconBtn onClick={() => setEpisodesOpen(false)} ariaLabel="Close episodes"><CloseIcon /></IconBtn>
            </div>
            {Object.keys(seasonsMap).sort((a, b) => a - b).map(s => (
              <div key={s}>
                <div style={{ padding: `10px ${Math.round(18 * uiScale)}px 6px`, color: '#9aa', fontSize: Math.round(12 * uiScale), fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Season {s}</div>
                {seasonsMap[s].map(ep => {
                  const isCur = ep.id === currentEpisodeId || ep.fileId === currentEpisodeId;
                  return (
                    <button key={ep.id} className={`dbw-epfocus dbw-ep${isCur ? ' cur' : ''}`}
                      onClick={() => { switchEpisode(ep); setEpisodesOpen(false); }}
                      style={{ display: 'flex', gap: Math.round(12 * uiScale), width: '100%',
                        padding: `${Math.round(10 * uiScale)}px ${Math.round(16 * uiScale)}px`, textAlign: 'left',
                        cursor: 'pointer', border: 'none', borderLeft: `3px solid ${isCur ? TEAL : 'transparent'}` }}>
                      {/* still thumbnail (16:9) */}
                      <div style={{ position: 'relative', width: Math.round(132 * uiScale), flexShrink: 0, aspectRatio: '16 / 9',
                        borderRadius: 8, overflow: 'hidden', background: '#1c1c1c' }}>
                        {ep.stillPath
                          ? <img src={tmdbImg(ep.stillPath, 'w300')} alt="" loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#555' }}>
                              <PlaylistPlayIcon /></div>}
                        {isCur && (
                          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.4)' }}>
                            <PlayArrowIcon sx={{ fontSize: Math.round(30 * uiScale), color: TEAL }} /></div>)}
                      </div>
                      {/* text */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: Math.round(13 * uiScale), color: isCur ? TEAL : '#fff', flexShrink: 0 }}>{ep.label}</span>
                          {ep.runtime ? <span style={{ fontSize: Math.round(11 * uiScale), color: '#888', flexShrink: 0 }}>{ep.runtime}m</span> : null}
                        </div>
                        {ep.name && (
                          <div style={{ fontSize: Math.round(13 * uiScale), color: isCur ? TEAL : '#e0e0e0', marginTop: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.name}</div>)}
                        {ep.overview && (
                          <div style={{ fontSize: Math.round(11.5 * uiScale), color: '#8f9296', marginTop: 3, lineHeight: 1.35,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {ep.overview}</div>)}
                      </div>
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
              style={{ width: settingsView === 'audiosubs' ? `min(${Math.round(560 * uiScale)}px, 96%)` : `min(${Math.round(420 * uiScale)}px, 94%)`,
                maxHeight: '86%', display: 'flex', flexDirection: 'column',
                background: 'rgba(16,16,16,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              {settingsView === 'main' ? (
                <>
                  <SheetHeader title="Settings" />
                  <div style={{ overflowY: 'auto' }}>
                    <MasterRow icon={<AudiotrackIcon fontSize="small" />} label="Audio & Subtitles"
                      value={`${audioCur ? audioLabel(audioCur) : 'Default'} · ${subLabel}`} onClick={() => setSettingsView('audiosubs')} />
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
                  <SheetHeader title={{ audiosubs: 'Audio & Subtitles', quality: 'Quality', speed: 'Speed', decoder: 'Decoder' }[settingsView]} onBack={back} />
                  <div style={{ overflowY: 'auto' }}>
                    {settingsView === 'audiosubs' && (
                      <div style={{ display: 'flex', alignItems: 'stretch' }}>
                        {/* left: audio */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <SheetSection>Audio</SheetSection>
                          {audioTracks.length
                            ? audioTracks.map(t => <SheetRow key={t.id} selected={t.id === curAudio} label={audioLabel(t)} onClick={() => chooseAudio(t)} />)
                            : <SheetEmpty>No alternate audio tracks</SheetEmpty>}
                        </div>
                        {/* divider */}
                        <div style={{ width: 1, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                        {/* right: subtitles */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <SheetSection>Subtitles</SheetSection>
                          <SheetRow selected={curText < 0} label="Off" onClick={() => chooseSub(null)} />
                          {textTracks.map(t => <SheetRow key={t.id} selected={t.id === curText} label={subtitleLabel(t)} onClick={() => chooseSub(t)} />)}
                        </div>
                      </div>
                    )}
                    {settingsView === 'quality' && variants.map(v => <SheetRow key={v.mediaFileId ?? v.url} selected={v.mediaFileId === curQualityId} label={qualityLabel(v)} onClick={() => { chooseQuality(v); back(); }} />)}
                    {settingsView === 'speed' && SPEEDS.map((s, i) => <SheetRow key={s} selected={i === rateIdx} label={`${s}×${s === 1 ? ' (Normal)' : ''}`} onClick={() => { chooseSpeed(i); back(); }} />)}
                    {settingsView === 'decoder' && DECODERS.map(d => <SheetRow key={d.id} selected={d.id === decoder} label={d.label} onClick={() => { chooseDecoder(d.id); back(); }} />)}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
      </>)}
    </div>
    </ScaleCtx.Provider>
  );
}

// ── settings-sheet helpers ──────────────────────────────────────────────────
function SheetHeader({ title, onBack }) {
  const scale = useContext(ScaleCtx);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `${Math.round(14 * scale)}px 16px`,
      borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back" style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}>
          <ArrowBackIcon sx={{ fontSize: Math.round(20 * scale) }} />
        </button>
      )}
      <span style={{ fontWeight: 700, fontSize: Math.round(16 * scale) }}>{title}</span>
    </div>
  );
}
function MasterRow({ icon, label, value, onClick }) {
  const scale = useContext(ScaleCtx);
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: `${Math.round(14 * scale)}px 16px`,
        background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', fontSize: Math.round(15 * scale), textAlign: 'left' }}>
      <span style={{ display: 'flex', color: '#bbb' }}>{icon}</span>
      <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#9aa', fontSize: Math.round(13 * scale), maxWidth: Math.round(160 * scale), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      <ChevronRightIcon sx={{ fontSize: Math.round(18 * scale), color: '#888' }} />
    </button>
  );
}
function SheetRow({ label, selected, onClick }) {
  const scale = useContext(ScaleCtx);
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10,
        padding: `${Math.round(10 * scale)}px 16px`, background: 'transparent', border: 'none', cursor: 'pointer',
        color: selected ? '#0d9488' : '#fff', fontWeight: selected ? 700 : 500, fontSize: Math.round(14 * scale), textAlign: 'left', whiteSpace: 'nowrap' }}>
      <span>{label}</span>
      {selected && <CheckIcon sx={{ fontSize: Math.round(16 * scale) }} />}
    </button>
  );
}
function SheetEmpty({ children }) {
  return <div style={{ padding: '8px 16px', color: '#777', fontSize: 13 }}>{children}</div>;
}

// Crops the storyboard sprite to the tile matching `timeMs` and returns it as a
// framed thumbnail, or null when there's no sprite for this file. Uses CSS
// background cropping so the whole sprite loads once and every tile is instant.
function storyboardTile(sb, timeMs) {
  if (!sb || !sb.count || !sb.intervalMs || !sb.tileW || !sb.tileH) return null;
  const idx = Math.max(0, Math.min(sb.count - 1, Math.floor(timeMs / sb.intervalMs)));
  const col = idx % sb.cols;
  const row = Math.floor(idx / sb.cols);
  return (
    <div style={{
      width: sb.tileW, height: sb.tileH, borderRadius: 6, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
      backgroundImage: `url(${sb.url})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${sb.cols * sb.tileW}px ${sb.rows * sb.tileH}px`,
      backgroundPosition: `-${col * sb.tileW}px -${row * sb.tileH}px`,
    }} />
  );
}

// Hover/scrub preview bubble above the progress bar: an optional thumbnail frame
// (Part B — storyboard) stacked over the timestamp. Centered on leftPx; the
// caller has already clamped leftPx so it never overflows the player edges.
function ScrubPreview({ leftPx, time, fmt, thumb }) {
  return (
    <div style={{ position: 'absolute', bottom: '100%', left: leftPx, transform: 'translateX(-50%)',
      marginBottom: 12, pointerEvents: 'none', zIndex: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {thumb}
      <span style={{ background: 'rgba(0,0,0,0.85)', padding: '3px 9px', borderRadius: 6, fontSize: 12,
        fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
        {fmt(time)}
      </span>
    </div>
  );
}
function SheetSection({ children }) {
  return (
    <div style={{ padding: '12px 16px 4px', color: '#bbb', fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</div>
  );
}

// ── tiny style helpers ────────────────────────────────────────────────────────
const row = (position, extra) => ({ position, display: 'flex', alignItems: 'center', ...extra });

// Round icon button (top bar + big center transport), with hover/tap motion.
function IconBtn({ children, onClick, big, ariaLabel, focusRef }) {
  const reduce = useReducedMotion();
  const scale = useContext(ScaleCtx);
  const dim = Math.round((big ? 64 : 44) * scale);
  // Scale MUI icon children by uiScale (adding an ignored sx to a non-icon child is harmless).
  const scaled = React.Children.map(children, (ch) =>
    React.isValidElement(ch)
      ? React.cloneElement(ch, { sx: { ...(ch.props.sx || {}), fontSize: Math.round((ch.props.sx?.fontSize || 24) * scale) } })
      : ch);
  return (
    <motion.button type="button" aria-label={ariaLabel} ref={focusRef}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      whileHover={reduce ? undefined : { scale: 1.1 }}
      whileTap={reduce ? undefined : { scale: 0.88 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: big ? 'rgba(0,0,0,0.4)' : 'transparent',
        border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%',
        width: dim, height: dim, padding: 0,
      }}>
      {scaled}
    </motion.button>
  );
}

// Volume: a mute-toggle icon with a horizontal slider that expands from width 0.
// Desktop — hover expands, click the icon mutes. Touch — tap the icon expands (drag
// the slider to 0 to mute). Lives in the control row, below the scrubber, so the
// slider can never overlap the progress bar.
function VolumeControl({ volume, hasHover, label, labelLeft, onToggleMute, onSetVol }) {
  const reduce = useReducedMotion();
  const scale = useContext(ScaleCtx);
  const [open, setOpen] = useState(false);
  const muted = volume === 0;
  const w = Math.round(90 * scale);
  const onBtn = (e) => {
    e.stopPropagation();
    if (hasHover) onToggleMute();
    else setOpen((o) => !o);
  };
  const text = label ? <span>{label}</span> : null;
  const icon = <span style={{ display: 'inline-flex', fontSize: Math.round(22 * scale) }}>
    {muted ? <VolumeOffIcon sx={{ fontSize: Math.round(22 * scale) }} /> : <VolumeUpIcon sx={{ fontSize: Math.round(22 * scale) }} />}
  </span>;
  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={hasHover ? () => setOpen(true) : undefined}
      onMouseLeave={hasHover ? () => setOpen(false) : undefined}
    >
      <motion.button type="button" aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={onBtn}
        whileHover={reduce ? undefined : { scale: 1.06 }} whileTap={reduce ? undefined : { scale: 0.92 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{
          pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: label ? Math.round(7 * scale) : 0,
          minHeight: Math.round(44 * scale), padding: `${Math.round(8 * scale)}px ${Math.round((label ? 12 : 10) * scale)}px`,
          borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent',
          color: muted ? TEAL : '#fff', fontSize: Math.round(13 * scale), fontWeight: 600, whiteSpace: 'nowrap',
        }}>
        {labelLeft ? <>{text}{icon}</> : <>{icon}{text}</>}
      </motion.button>
      <div style={{ width: open ? w : 0, overflow: 'hidden', transition: 'width 0.2s ease',
        display: 'flex', alignItems: 'center' }}>
        <input className="dbw-range" type="range" min={0} max={1} step={0.02} value={volume} aria-label="Volume"
          onChange={(e) => onSetVol(Number(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          style={{ width: w, background: `linear-gradient(to right, #fff ${volume * 100}%, rgba(255,255,255,0.3) ${volume * 100}%)` }} />
      </div>
    </div>
  );
}

// Labelled control-row button (icon + text beside it), with hover/tap motion +
// an active (teal) state. Min 44px tall for touch.
function CtrlBtn({ icon, label, labelLeft, tip, onClick, active, ariaLabel, focusRef }) {
  const reduce = useReducedMotion();
  const scale = useContext(ScaleCtx);
  const scaledIcon = React.isValidElement(icon)
    ? React.cloneElement(icon, { sx: { ...(icon.props.sx || {}), fontSize: Math.round((icon.props.sx?.fontSize || 22) * scale) } })
    : icon;
  const text = label ? <span>{label}</span> : null;
  return (
    <motion.button type="button" aria-label={ariaLabel || label || tip} ref={focusRef}
      className={tip ? 'dbw-tip' : undefined} data-tip={tip || undefined}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      whileHover={reduce ? undefined : { scale: 1.06, backgroundColor: active ? 'rgba(20,184,166,0.26)' : 'rgba(255,255,255,0.14)' }}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'relative',
        pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: label ? Math.round(7 * scale) : 0,
        minHeight: Math.round(44 * scale), padding: `${Math.round(8 * scale)}px ${Math.round((label ? 12 : 10) * scale)}px`,
        borderRadius: 12, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(20,184,166,0.18)' : 'transparent',
        color: active ? TEAL : '#fff', fontSize: Math.round(13 * scale), fontWeight: 600, whiteSpace: 'nowrap',
      }}>
      {labelLeft ? <>{text}{scaledIcon}</> : <>{scaledIcon}{text}</>}
    </motion.button>
  );
}

// The "Next" control-row button plus a hover preview of the upcoming episode
// (still thumbnail + "S#:E# · title" + short synopsis). Pointer-only affordance;
// touch users get the on-screen "Up next" card and the episode drawer instead.
function NextEpisodeButton({ nextEpisode: ep, onClick }) {
  const [hover, setHover] = useState(false);
  const scale = useContext(ScaleCtx);
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <CtrlBtn icon={<SkipNextIcon />} ariaLabel="Next episode" onClick={onClick} />
      {hover && ep && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', right: 0, zIndex: 40,
          width: Math.round(320 * scale), maxWidth: '80vw', background: 'rgba(0,0,0,0.94)', borderRadius: 12,
          overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', pointerEvents: 'none',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        }}>
          {ep.stillPath && (
            <img src={tmdbImg(ep.stillPath, 'w300')} alt="" loading="lazy"
              style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} />
          )}
          <div style={{ padding: Math.round(12 * scale) }}>
            <div style={{ fontSize: Math.round(11 * scale), color: TEAL, fontWeight: 800, letterSpacing: 0.6, marginBottom: Math.round(5 * scale) }}>UP NEXT</div>
            <div style={{
              fontWeight: 700, fontSize: Math.round(15 * scale), lineHeight: 1.3, marginBottom: ep.overview ? Math.round(6 * scale) : 0,
              overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {epTitle(ep)}{ep.runtime ? ` · ${ep.runtime}m` : ''}
            </div>
            {ep.overview && (
              <div style={{
                fontSize: Math.round(12.5 * scale), color: '#9aa0a6', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {ep.overview}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
