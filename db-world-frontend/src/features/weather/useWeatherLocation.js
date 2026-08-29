import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Why a location lookup failed, in terms the UI can actually explain.
 *
 * The browser collapses several very different situations into one `PERMISSION_DENIED`, and the
 * two that used to break this app silently were not the user saying no at all:
 *
 * - `insecure` — geolocation is unavailable outside a secure context, so it is dead over plain
 *   http on a LAN address. No prompt appears and no error explains it.
 * - `blocked` — a `Permissions-Policy: geolocation=()` response header disables the API for the
 *   whole document. Also silent, also unfixable by the user.
 *
 * Naming them separately is the difference between "turn on location" (useless advice when the
 * page is served over http) and a message that points at the real cause.
 */
export const LocationError = {
  UNSUPPORTED: 'unsupported',
  INSECURE: 'insecure',
  BLOCKED: 'blocked',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
};

/** Permission states, matching Capacitor's vocabulary plus an "unknown" for before the probe. */
export const LocationPermission = {
  UNKNOWN: 'unknown',
  PROMPT: 'prompt',
  GRANTED: 'granted',
  DENIED: 'denied',
};

const POSITION_OPTIONS = {
  // City-level accuracy is all a weather lookup needs. High accuracy wakes the GPS radio, which on
  // a phone means a slower first fix and a visible battery cost for no better forecast.
  enableHighAccuracy: false,
  // Cold GPS fixes routinely take longer than ten seconds; the old timeout gave up on them.
  timeout: 15000,
  // A five-minute-old fix is still the right city.
  maximumAge: 300000,
};

const isNative = () => Capacitor.isNativePlatform();

/**
 * The environment-level reasons geolocation cannot work, checked before anything is asked of the
 * user. Native apps have neither problem — both are properties of a browsing context.
 *
 * Resolved once and memoised: neither the platform nor the document's secure-context flag can
 * change while the page is open, and this is read on every render of every mounted consumer.
 */
let cachedBlocker;

const environmentBlocker = () => {
  if (cachedBlocker === undefined) {
    if (isNative()) cachedBlocker = null;
    else if (typeof navigator === 'undefined' || !navigator.geolocation) cachedBlocker = LocationError.UNSUPPORTED;
    else if (typeof window !== 'undefined' && window.isSecureContext === false) cachedBlocker = LocationError.INSECURE;
    else cachedBlocker = null;
  }
  return cachedBlocker;
};

/**
 * Distinguishes a policy block from a real refusal.
 *
 * Both arrive as `PERMISSION_DENIED`, but a Permissions-Policy block resolves instantly and its
 * message says so, whereas a refusal is either the user clicking Block or a previously stored
 * decision. The message sniff is a heuristic, so it only ever downgrades the advice we show — it
 * never suppresses the prompt.
 */
const classifyDenial = (error) => {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('permissions policy') || message.includes('feature policy')
    ? LocationError.BLOCKED
    : LocationError.DENIED;
};

const classify = (error) => {
  // 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT — the W3C codes, which Capacitor's web
  // implementation passes straight through.
  switch (error?.code) {
    case 1: return classifyDenial(error);
    case 2: return LocationError.UNAVAILABLE;
    case 3: return LocationError.TIMEOUT;
    default: return LocationError.UNAVAILABLE;
  }
};

/**
 * The device's position, asked for at most once without the user's say-so.
 *
 * On mount it only *probes* the permission. If location was already granted — on this site before,
 * or to the app in Android's settings — it resolves a position silently, because that user has
 * already answered the question. If it was not, nothing happens until {@link request} is called
 * from something the user clicked. That is what keeps the home dashboard, which mounts this hook
 * on the app's landing page, from throwing a permission prompt at a first-time visitor.
 */
export default function useWeatherLocation() {
  const [permission, setPermission] = useState(LocationPermission.UNKNOWN);
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);

  const blocker = environmentBlocker();
  // Guards the state writes that land after an await. Set on the way in as well as cleared on the
  // way out: a cleanup-then-effect cycle (StrictMode's double mount) would otherwise leave the flag
  // stuck false and silently kill every update for the rest of the component's life.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /**
   * Resolves to `{ coords }` or `{ error }`.
   *
   * The reason is *returned* as well as stored, because the caller reads it straight after its own
   * `await` — where the `error` it can see through this hook is still the value from the render
   * that created its callback. Returning it is what lets a denial say "location is turned off"
   * instead of the generic "could not pin you down".
   */
  const locate = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const position = await Geolocation.getCurrentPosition(POSITION_OPTIONS);
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!mounted.current) return { coords: next };
      setCoords(next);
      setPermission(LocationPermission.GRANTED);
      return { coords: next };
    } catch (e) {
      const reason = classify(e);
      if (!mounted.current) return { error: reason };
      setError(reason);
      if (reason === LocationError.DENIED || reason === LocationError.BLOCKED) {
        setPermission(LocationPermission.DENIED);
      }
      return { error: reason };
    } finally {
      if (mounted.current) setLocating(false);
    }
  }, []);

  /**
   * Explicit user action: ask for the permission (native) or trigger the browser prompt (web).
   * Same `{ coords } | { error }` contract as {@link locate}.
   */
  const request = useCallback(async () => {
    if (blocker) {
      setError(blocker);
      return { error: blocker };
    }
    if (isNative()) {
      try {
        const result = await Geolocation.requestPermissions();
        // Coarse is enough for weather, so a coarse-only grant counts as a yes.
        const granted = result.location === 'granted' || result.coarseLocation === 'granted';
        if (!granted) {
          if (mounted.current) {
            setPermission(LocationPermission.DENIED);
            setError(LocationError.DENIED);
          }
          return { error: LocationError.DENIED };
        }
      } catch {
        if (mounted.current) setError(LocationError.UNAVAILABLE);
        return { error: LocationError.UNAVAILABLE };
      }
    }
    return locate();
  }, [blocker, locate]);

  // Probe on mount, and resolve a position only for someone who has already said yes.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (blocker) {
        setPermission(LocationPermission.DENIED);
        setError(blocker);
        return;
      }

      let state = LocationPermission.PROMPT;
      try {
        const status = await Geolocation.checkPermissions();
        // "prompt-with-rationale" is Android's "ask again" state — still a prompt, not a refusal.
        state = String(status?.location ?? '').startsWith('prompt')
          ? LocationPermission.PROMPT
          : status.location;
      } catch {
        // Firefox has no Permissions API entry for geolocation and throws here. Unknown is not
        // denied: fall back to prompting, which is the honest default.
        state = LocationPermission.PROMPT;
      }

      if (cancelled || !mounted.current) return;
      setPermission(state);
      if (state === LocationPermission.GRANTED) locate();
    })();

    return () => { cancelled = true; };
  }, [blocker, locate]);

  return {
    coords,
    permission,
    error,
    locating,
    /** True while the mount-time probe is still deciding, so callers can hold off on a fallback. */
    resolving: permission === LocationPermission.UNKNOWN,
    /** Set when geolocation cannot work here at all, whatever the user does. */
    unavailable: blocker,
    request,
  };
}
