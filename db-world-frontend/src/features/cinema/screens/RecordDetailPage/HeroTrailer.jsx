import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ReplayIcon from '@mui/icons-material/Replay';

const MUTE_PREF_KEY = 'dbworld-hero-trailer-muted';

/* YouTube crops its own chrome (watch-later, share, channel avatar, and the
   end-screen card grid) to the video's edges. Over-scaling past "cover" pushes
   that furniture outside the hero so only picture is ever visible. */
const OVERSCAN = 1.32;

/* How long to wait for a PLAYING event before revealing anyway. */
const REVEAL_FALLBACK_MS = 4000;

/* These sit on the same line as the sheet/modal close button, which is rendered
   by a different component in a different coordinate space. Keeping the size and
   the top offset here as named constants is what lets those two line up — see
   HERO_CONTROL_TOP's use in RecordDetailSheet and RecordDetailModal. */
export const HERO_CONTROL_SIZE = 34;
export const HERO_CONTROL_TOP = { xs: 10, md: 18 };

const readMutePref = () => {
  try { return localStorage.getItem(MUTE_PREF_KEY) !== 'false'; } catch { return true; }
};

const writeMutePref = (muted) => {
  try { localStorage.setItem(MUTE_PREF_KEY, String(muted)); } catch { /* private mode */ }
};

/**
 * Muted trailer playing behind the hero copy, the way Prime Video and Hotstar
 * open a title.
 *
 * The iframe is sized by measurement rather than CSS: a 16:9 video has to COVER a
 * hero box whose aspect ratio changes with the breakpoint (and again inside the
 * desktop modal), and there's no pure-CSS way to express "cover" for a replaced
 * element sized in percentages.
 *
 * Sound is toggled over postMessage instead of by reloading the iframe with
 * mute=0, so unmuting doesn't restart the trailer.
 *
 * The trailer plays ONCE and then hands back to the artwork. It deliberately
 * does not loop: YouTube's loop parameter is unreliable on single videos, and a
 * trailer that reaches its natural end paints an end-screen grid of unrelated
 * recommendations over the hero.
 */
export default function HeroTrailer({ videoKey, title, onStop }) {
  const wrapRef = useRef(null);
  const iframeRef = useRef(null);
  const [box, setBox] = useState(null);
  const [muted, setMuted] = useState(readMutePref);
  // The iframe paints black for as long as YouTube takes to buffer. Revealing
  // it on mount therefore blanks the artwork behind a black rectangle and a
  // spinner; we hold the artwork until the player says it is actually playing.
  const [started, setStarted] = useState(false);
  // Latches on an unplayable video so the reveal fallback can't fire afterwards.
  const [failed, setFailed] = useState(false);

  // Is the hero meaningfully on screen? Drives BOTH whether the iframe exists at all
  // and, once it does, whether the video is playing.
  const [visible, setVisible] = useState(false);
  // Latched once the hero has been seen. The iframe is not mounted before that — so
  // landing on an already-scrolled page costs no bandwidth and can't autoplay audio —
  // and is not unmounted after, so scrolling back up RESUMES instead of restarting.
  const [seen, setSeen] = useState(false);
  // YouTube only obeys postMessage once the embed has completed its `listening`
  // handshake. Commands sent before that are silently dropped.
  const [ready, setReady] = useState(false);
  // The message listener must not re-subscribe (it would miss the state change it
  // exists to catch), so it reads visibility through a ref rather than a closure.
  const visibleRef = useRef(false);

  // Keep the newest onStop reachable from listeners that must not re-subscribe
  // (re-registering the message listener would miss the state change it exists
  // to catch).
  const onStopRef = useRef(onStop);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);

  // Size to cover, then overscan so YouTube's own UI falls outside the hero.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const scale = Math.max(width / 16, height / 9) * OVERSCAN;
      setBox({ w: Math.ceil(scale * 16), h: Math.ceil(scale * 9) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const command = useCallback((func) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }),
      'https://www.youtube.com',
    );
  }, []);

  // Subscribe to player events, then retire the trailer the moment it ends so
  // the end-screen card grid never gets a frame to paint in.
  useEffect(() => {
    const onMessage = (e) => {
      if (typeof e.origin !== 'string' || !e.origin.includes('youtube.com')) return;
      // Anything arriving from the embed proves the channel is up — more reliable than
      // the iframe load event alone, which the Capacitor webview does not always give us.
      setReady(true);
      let data;
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch { return; }

      // Deleted / private / embedding-disabled videos never reach PLAYING, so
      // the reveal fallback below would eventually uncover YouTube's "Video
      // unavailable" card sitting behind the hero copy. Retire on error so the
      // artwork simply stays.
      if (data?.event === 'onError') {
        setFailed(true);
        onStopRef.current?.();
        return;
      }

      // YouTube reports state under two shapes depending on whether it's an
      // explicit onStateChange or a bundled infoDelivery.
      const state = data?.event === 'onStateChange'
        ? data.info
        : data?.info?.playerState;

      if (state === 1) {
        setStarted(true);                  // PLAYING → safe to reveal
        // Autoplay can win the race against the first pause command; stop it dead
        // rather than leaving a trailer running under content already scrolled past.
        if (!visibleRef.current) command('pauseVideo');
      }
      if (state === 0) onStopRef.current?.();  // ENDED → hand back to artwork
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [command]);

  const handleLoad = useCallback(() => {
    // Required before YouTube will emit any events to this window.
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening' }),
      'https://www.youtube.com',
    );
    if (!muted) command('unMute');
    setReady(true);
  }, [command, muted]);

  // Safety net for environments where the event channel doesn't come up — the
  // Capacitor webview being the one that matters here. Without this, a silent
  // listener would mean the trailer never reveals at all, which is a worse
  // failure than revealing a beat early.
  useEffect(() => {
    // Only once there is something to reveal — without the `seen` guard this would fade
    // in the trailer's own controls over bare artwork on a page opened scrolled down.
    if (started || failed || !seen) return undefined;
    const t = setTimeout(() => { if (!failed) setStarted(true); }, REVEAL_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [started, failed, seen]);

  // Pause while the hero is off screen — a trailer playing under content the user
  // has scrolled past is just wasted bandwidth (and audio, if they unmuted).
  //
  // The observer RECORDS the desired state rather than issuing the command itself.
  // Issuing it here missed twice over: the iframe does not exist until a measurement
  // tick after mount, and even once it does it ignores commands until the `listening`
  // handshake completes. Either way the command was dropped, and the observer does not
  // fire again until the intersection changes — so a page opened already scrolled kept
  // playing, unpausable.
  useEffect(() => {
    const el = wrapRef.current;
    const see = (onScreen) => {
      visibleRef.current = onScreen;
      setVisible(onScreen);
      if (onScreen) setSeen(true);
    };
    if (!el || typeof IntersectionObserver === 'undefined') {
      see(true);          // no observer support — behave as before, always playing
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => see(entry.intersectionRatio > 0.35),
      { threshold: [0, 0.35, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Apply that state whenever it changes OR the player becomes able to obey.
  useEffect(() => {
    if (!ready) return;
    command(visible ? 'playVideo' : 'pauseVideo');
  }, [visible, ready, command]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      command(next ? 'mute' : 'unMute');
      writeMutePref(next);
      return next;
    });
  }, [command]);

  if (!videoKey) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const src = `https://www.youtube.com/embed/${videoKey}`
    + `?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3`
    + `&fs=0&disablekb=1&playsinline=1&showinfo=0&cc_load_policy=0`
    + `&enablejsapi=1&origin=${encodeURIComponent(origin)}`;

  return (
    // Single motion root so AnimatePresence can actually drive the exit fade —
    // a Fragment here would leave the exit signal with nowhere to land.
    <Box
      ref={wrapRef}
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: started && !failed ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {box && seen && (
          <Box
            component="iframe"
            ref={iframeRef}
            src={src}
            title={title ? `${title} trailer` : 'Trailer'}
            allow="autoplay; encrypted-media"
            frameBorder="0"
            tabIndex={-1}
            onLoad={handleLoad}
            sx={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: box.w, height: box.h,
              border: 'none', display: 'block',
              // Belt and braces with the overscan: the player can never receive
              // a tap, so its controls can never be summoned over the hero.
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>

      {/* Controls opt back into pointer events; the video stage stays inert so
          taps fall through to the hero beneath it.

          Anchored top-right rather than bottom-right: the bottom of the hero is
          where the title block and the phone action rail live, and these two
          buttons landed on top of them. */}
      <Box
        data-noexpand
        sx={{
          position: 'absolute', zIndex: 4,
          right: { xs: 12, md: 24, xl: 40 },
          top: HERO_CONTROL_TOP,
          display: 'flex', gap: 1,
          opacity: started ? 1 : 0,
          transition: 'opacity .4s',
          pointerEvents: started ? 'auto' : 'none',
        }}
      >
        <Tooltip title={muted ? 'Unmute trailer' : 'Mute trailer'} placement="top">
          <IconButton
            size="small"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
            sx={{
              bgcolor: alpha('#000', 0.5), color: '#fff',
              border: `1px solid ${alpha('#fff', 0.28)}`,
              backdropFilter: 'blur(10px)',
              width: HERO_CONTROL_SIZE, height: HERO_CONTROL_SIZE,
              '&:hover': { bgcolor: alpha('#000', 0.72) },
            }}
          >
            {muted ? <VolumeOffIcon sx={{ fontSize: 18 }} /> : <VolumeUpIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Back to artwork" placement="top">
          <IconButton
            size="small"
            onClick={onStop}
            aria-label="Stop trailer and show artwork"
            sx={{
              bgcolor: alpha('#000', 0.5), color: '#fff',
              border: `1px solid ${alpha('#fff', 0.28)}`,
              backdropFilter: 'blur(10px)',
              width: HERO_CONTROL_SIZE, height: HERO_CONTROL_SIZE,
              '&:hover': { bgcolor: alpha('#000', 0.72) },
            }}
          >
            <ReplayIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
