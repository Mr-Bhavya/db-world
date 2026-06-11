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

const HybridPlayer = registerPlugin('HybridPlayer');

const EVENT_MAP = { time: 'playerTime', state: 'playerState', ended: 'playerEnded', error: 'playerError', tracks: 'playerTracks', info: 'playerInfo', volume: 'playerVolume' };

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
    release:       () => HybridPlayer.release(),
    on: (event, cb) => {
      let handle;
      HybridPlayer.addListener(EVENT_MAP[event], cb).then(h => { handle = h; });
      return () => handle?.remove?.();
    },
  };
}

function createWebAdapter(getVideo) {
  const handlers = {};
  const emit = (e, d) => (handlers[e] || new Set()).forEach(cb => cb(d));
  let v = null;
  const ensure = () => (v = getVideo());

  const onTime    = () => emit('time', {
    positionMs: (v?.currentTime || 0) * 1000,
    durationMs: v && isFinite(v.duration) ? v.duration * 1000 : 0,
  });
  const onEnded   = () => emit('ended', {});
  const onError   = () => emit('error', { code: v?.error?.code, message: 'video error' });
  const onWaiting = () => emit('state', { state: 2 }); // buffering
  const onPlaying = () => emit('state', { state: 3 }); // ready/playing
  const listeners = [
    ['timeupdate', onTime], ['durationchange', onTime],
    ['ended', onEnded], ['error', onError],
    ['waiting', onWaiting], ['playing', onPlaying], ['canplay', onPlaying],
  ];

  return {
    kind: 'web',
    load: (url, startMs = 0) => {
      ensure();
      if (!v) return;
      listeners.forEach(([ev, fn]) => v.addEventListener(ev, fn));
      v.src = url;
      v.currentTime = (startMs || 0) / 1000;
      const p = v.play();
      if (p?.catch) p.catch(() => {}); // autoplay may be blocked until a tap
    },
    play:          () => ensure()?.play?.(),
    pause:         () => ensure()?.pause?.(),
    seekTo:        (ms) => { ensure(); if (v) v.currentTime = Math.max(0, ms) / 1000; },
    setRate:       (rate) => { ensure(); if (v) v.playbackRate = rate; },
    setVolume:     (value) => { ensure(); if (v) v.volume = Math.max(0, Math.min(1, value)); },
    getVolume:     () => Promise.resolve({ value: ensure()?.volume ?? 1 }),
    setBrightness: () => {},   // not controllable on web
    setZoom:       (scale) => { ensure(); if (v) v.style.transform = `scale(${scale})`; },
    selectAudioTrack: (id) => { ensure(); const ts = v?.audioTracks; if (ts) for (let i = 0; i < ts.length; i++) ts[i].enabled = (i === id); },
    selectTextTrack:  (id) => { ensure(); const ts = v?.textTracks; if (ts) for (let i = 0; i < ts.length; i++) ts[i].mode = (i === id ? 'showing' : 'disabled'); },
    setDecoderMode:() => {},   // browser-managed on web
    setOrientation:() => {},   // best-effort no-op on web
    release: () => {
      if (v) { try { v.pause(); listeners.forEach(([ev, fn]) => v.removeEventListener(ev, fn)); } catch { /* ignore */ } }
    },
    on: (event, cb) => { (handlers[event] ||= new Set()).add(cb); return () => handlers[event]?.delete(cb); },
  };
}

export function createPlayerAdapter(getVideo) {
  return Capacitor.getPlatform() === 'android' ? createNativeAdapter() : createWebAdapter(getVideo);
}
