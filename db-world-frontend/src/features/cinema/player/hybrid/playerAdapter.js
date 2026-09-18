// Platform adapter for the hybrid player. One interface, two implementations:
//   • native (Android): drives ExoPlayer behind a transparent WebView via the
//     HybridPlayer plugin.
//   • web: drives a normal HTML5 <video> element.
//
// Interface:
//   load(url, startMs) play() pause() seekTo(ms) setRate(x)
//   setVolume(0..1) setBrightness(0..1) setOrientation(mode) release()
//   on(event, cb) -> unsubscribe   events: 'time' 'state' 'ended' 'error'
import { registerPlugin, Capacitor } from '@capacitor/core';
import { isNativePlayerEnabled } from './nativePlayerFlag';

const HybridPlayer = registerPlugin('HybridPlayer');
const NativePlayer = registerPlugin('NativePlayer');

const EVENT_MAP = { time: 'playerTime', state: 'playerState', ended: 'playerEnded', error: 'playerError', tracks: 'playerTracks', info: 'playerInfo', volume: 'playerVolume', pip: 'playerPipChanged' };

const NATIVE_EVENT_MAP = { time: 'playerTime', state: 'playerState', ended: 'playerEnded', error: 'playerError', closed: 'playerClosed', tracks: 'playerTracks', seek: 'playerSeek' };

function createNativeAdapter() {
  return {
    kind: 'native',
    load:          (url, startMs = 0) => HybridPlayer.load({ url, startMs }),
    play:          () => HybridPlayer.play(),
    pause:         () => HybridPlayer.pause(),
    seekTo:        (ms) => HybridPlayer.seekTo({ positionMs: Math.max(0, Math.round(ms)) }),
    setRate:       (rate) => HybridPlayer.setRate({ rate }),
    setVolume:     (value) => HybridPlayer.setVolume({ value }),
    getVolume:     () => HybridPlayer.getVolume(),
    setBrightness: (value) => HybridPlayer.setBrightness({ value }),
    setZoom:       (scale) => HybridPlayer.setZoom({ scale }),
    selectAudioTrack: (id) => HybridPlayer.selectAudioTrack({ id }),
    selectTextTrack:  (id) => HybridPlayer.selectTextTrack({ id }),
    setDecoderMode:(mode) => HybridPlayer.setDecoderMode({ mode }),
    setOrientation:(mode) => HybridPlayer.setOrientation({ mode }),
    enterPip:      () => HybridPlayer.enterPip(),
    release:       () => HybridPlayer.release(),
    on: (event, cb) => {
      let handle;
      HybridPlayer.addListener(EVENT_MAP[event], cb).then(h => { handle = h; });
      return () => handle?.remove?.();
    },
  };
}

// Module-level (shared across adapter INSTANCES) — a src change recreates the adapter, so the
// old instance's release() and the new instance's load() must share this timer for the cancel to
// land. A src change (switch episode / quality) calls release() then load() in the same tick:
// release() defers the real dismiss, load() cancels it → the native player just swaps the media
// item (no teardown, no orientation reset). A genuine close (no load follows) fires the dismiss.
let nativeDismissTimer = null;
const cancelNativeDismiss = () => {
  if (nativeDismissTimer) { clearTimeout(nativeDismissTimer); nativeDismissTimer = null; }
};

function createNativeControllerAdapter() {
  const cancelDismiss = cancelNativeDismiss;
  return {
    kind: 'native-controller',
    load:    (url, startMs = 0) => { cancelDismiss(); return NativePlayer.present({ url, startMs: Math.max(0, Math.round(startMs)) }); },
    play:    () => NativePlayer.play(),
    pause:   () => NativePlayer.pause(),
    seekTo:  (ms) => NativePlayer.seekTo({ positionMs: Math.max(0, Math.round(ms)) }),
    setRate: (rate) => NativePlayer.setRate({ rate }),
    setVolume: () => {},          // Phase-2: native gesture owns volume
    getVolume: () => Promise.resolve({ value: 1 }),
    setBrightness: () => {},      // Phase-2
    setZoom: () => {},            // Phase-2
    selectAudioTrack: () => {},   // Phase-3
    selectTextTrack: () => {},    // Phase-3
    setDecoderMode: () => {},     // Phase-3 (plugin has no setDecoderMode yet)
    setOrientation: () => {},     // Phase-2
    enterPip: () => {},           // Phase-2 (plugin has no enterPip yet)
    release: () => { cancelDismiss(); nativeDismissTimer = setTimeout(() => { nativeDismissTimer = null; NativePlayer.dismiss(); }, 120); },
    on: (event, cb) => {
      const name = NATIVE_EVENT_MAP[event];
      if (!name) return () => {};   // ignore events the Phase-1 plugin doesn't emit (info/volume/pip)
      let handle;
      NativePlayer.addListener(name, cb).then(h => { handle = h; });
      return () => handle?.remove?.();
    },
  };
}

// A stream URL that needs an HLS engine. Live TV channels are almost always HLS, and
// a plain `video.src = '….m3u8'` plays ONLY in Safari/iOS — every other browser needs
// hls.js to fetch the manifest and feed segments through Media Source Extensions.
export const isHlsUrl = (url) => /\.m3u8(\?|#|$)/i.test(String(url || ''));

function createWebAdapter(getVideo) {
  const handlers = {};
  const emit = (e, d) => (handlers[e] || new Set()).forEach(cb => cb(d));
  let v = null;
  let attached = false;
  const ensure = () => (v = getVideo());

  // hls.js instance for the current source, and a token that invalidates an in-flight
  // dynamic import. Switching channel twice quickly would otherwise let the FIRST
  // import resolve last and attach the channel the viewer already moved off.
  let hls = null;
  let loadToken = 0;
  const destroyHls = () => {
    if (!hls) return;
    try { hls.destroy(); } catch { /* already torn down */ }
    hls = null;
  };
  // Safari and iOS play HLS natively; there hls.js is unnecessary (and worse — it
  // can't use the hardware pipeline).
  const canPlayHlsNatively = () => !!v && v.canPlayType('application/vnd.apple.mpegurl') !== '';

  // End of the buffered range that currently covers playback — i.e. how far
  // ahead the browser has preloaded — so the UI can draw the loaded portion.
  const bufferedEndMs = () => {
    try {
      const r = v?.buffered;
      if (!r || r.length === 0) return 0;
      const t = v.currentTime || 0;
      for (let i = 0; i < r.length; i++) {
        if (t >= r.start(i) - 0.5 && t <= r.end(i) + 0.5) return r.end(i) * 1000;
      }
      return r.end(r.length - 1) * 1000; // fall back to the last range
    } catch { return 0; }
  };
  // All buffered [startMs, endMs] ranges — the browser keeps disjoint segments after
  // seeks, so the UI can draw each loaded chunk (not just one contiguous fill).
  const bufferedRangesMs = () => {
    try {
      const r = v?.buffered;
      if (!r || r.length === 0) return [];
      const out = [];
      for (let i = 0; i < r.length; i++) out.push([r.start(i) * 1000, r.end(i) * 1000]);
      return out;
    } catch { return []; }
  };
  const onTime    = () => emit('time', {
    positionMs: (v?.currentTime || 0) * 1000,
    durationMs: (v && isFinite(v.duration) ? v.duration * 1000 : 0),
    bufferedMs: bufferedEndMs(),
    bufferedRanges: bufferedRangesMs(),
  });
  const onEnded   = () => emit('ended', {});
  const onError   = () => emit('error', { code: v?.error?.code, message: 'video error' });
  const onWaiting = () => emit('state', { state: 2 }); // buffering
  const onPlaying = () => emit('state', { state: 3, playing: true }); // actually playing
  // 'canplay' = ready (clear the buffering spinner) but it also fires after a seek while
  // paused — so respect v.paused instead of forcing "playing" (which used to auto-resume).
  const onCanplay = () => emit('state', { state: 3, playing: !(v && v.paused) });
  // Mirror the element's real play/pause so the icon can't desync when playback is
  // paused/resumed by anything other than our own button (OS, fullscreen, tab/screen off).
  const onPlay  = () => emit('state', { playing: true });
  const onPause = () => emit('state', { playing: false });
  const listeners = [
    ['timeupdate', onTime], ['durationchange', onTime], ['progress', onTime],
    ['ended', onEnded], ['error', onError],
    ['waiting', onWaiting], ['playing', onPlaying], ['canplay', onCanplay],
    ['play', onPlay], ['pause', onPause],
  ];

  const attach = () => { if (!attached && v) { listeners.forEach(([ev, fn]) => v.addEventListener(ev, fn)); attached = true; } };

  return {
    kind: 'web',
    load: (url, startMs = 0) => {
      ensure();
      if (!v) return;
      attach();
      destroyHls();
      const token = ++loadToken;
      const start = () => {
        // Seeking a live stream is meaningless and throws on some browsers, so only
        // apply a resume position when there is one.
        if (startMs > 0) { try { v.currentTime = startMs / 1000; } catch { /* unseekable */ } }
        const p = v.play();
        if (p?.catch) p.catch(() => {}); // autoplay may be blocked until a tap
      };

      if (isHlsUrl(url) && !canPlayHlsNatively()) {
        // Loaded on demand: the library is ~400 KB and only live TV needs it, so the
        // cinema bundle must not carry it.
        import('hls.js')
          .then(({ default: Hls }) => {
            if (token !== loadToken || !v) return;           // superseded by a newer load
            if (!Hls.isSupported()) { v.src = url; start(); return; }
            hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 });
            hls.on(Hls.Events.ERROR, (_evt, data) => {
              if (!data?.fatal) return;                      // hls.js retries these itself
              // One recovery attempt per class of fatal error. A network error on a live
              // edge is usually a blip; a media error is usually a decode hiccup. If the
              // recovery doesn't take, surface it so the page can fail over to the
              // channel's next source URL.
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR)      { try { hls.startLoad(); return; } catch { /* fall through */ } }
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR)   { try { hls.recoverMediaError(); return; } catch { /* fall through */ } }
              emit('error', { code: data.type, message: data.details || 'hls error' });
            });
            hls.loadSource(url);
            hls.attachMedia(v);
            start();
          })
          .catch(() => emit('error', { code: 'hls-load', message: 'Could not load the HLS player' }));
        return;
      }

      v.src = url;
      start();
    },
    play:          () => ensure()?.play?.(),
    pause:         () => ensure()?.pause?.(),
    seekTo:        (ms) => { ensure(); if (v) v.currentTime = Math.max(0, ms) / 1000; },
    setRate:       (rate) => { ensure(); if (v) v.playbackRate = rate; },
    setVolume:     (value) => { ensure(); if (v) v.volume = Math.max(0, Math.min(1, value)); },
    getVolume:     () => Promise.resolve({ value: ensure()?.volume ?? 1 }),
    setBrightness: () => {},   // not controllable on web
    setZoom:       (scale) => { ensure(); if (v) v.style.transform = `scale(${scale})`; },
    selectAudioTrack: (id) => {
      ensure(); if (!v) return;
      const ts = v.audioTracks; if (ts) for (let i = 0; i < ts.length; i++) ts[i].enabled = (i === id);
    },
    selectTextTrack:  (id) => { ensure(); const ts = v?.textTracks; if (ts) for (let i = 0; i < ts.length; i++) ts[i].mode = (i === id ? 'showing' : 'disabled'); },
    setDecoderMode:() => {},   // browser-managed on web
    setOrientation:() => {},   // best-effort no-op on web
    enterPip:      () => {},   // Android-only feature; no-op on web
    release: () => {
      loadToken++;   // cancel any in-flight hls.js import
      destroyHls();
      if (v) { try { v.pause(); listeners.forEach(([ev, fn]) => v.removeEventListener(ev, fn)); attached = false; } catch { /* ignore */ } }
    },
    on: (event, cb) => { (handlers[event] ||= new Set()).add(cb); return () => handlers[event]?.delete(cb); },
  };
}

export function createPlayerAdapter(getVideo) {
  if (isNativePlayerEnabled()) return createNativeControllerAdapter();
  return Capacitor.getPlatform() === 'android' ? createNativeAdapter() : createWebAdapter(getVideo);
}
