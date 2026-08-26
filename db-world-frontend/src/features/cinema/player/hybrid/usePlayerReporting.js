import { useCallback, useEffect, useRef } from 'react';
import { postStreamTrackEvents, postStreamTrackEventsOnExit } from '@shared/services/ApiServices';

const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Owns the hybrid player's "reporting" concern off a single progress ref:
 *   - watch-progress save (via onProgress) so playback can resume after a crash/close,
 *   - fire-and-forget STREAM_START/TICK/PAUSE/SEEK/STOP telemetry to /api/track/events
 *     so the backend can derive "watched %".
 *
 * Both read the same {@code progressRef} (position/duration), which the caller keeps
 * current from the adapter's 'time' events. All telemetry is best-effort — every emit is
 * wrapped in try/catch and the underlying API swallows its own errors — so it can never
 * affect playback.
 *
 * @returns {{ progressRef, report, emitStreamEvent, streamStartedRef, streamStoppedRef }}
 *   progressRef       — { positionMs, durationMs }; caller updates it from 'time' events
 *   report(ended)     — persist watch progress (calls onProgress)
 *   emitStreamEvent   — (type, overrides?) → queue one STREAM_* event
 *   flushEvents       — ({onExit}?) → send the queue now
 *   streamStartedRef  — guards STREAM_START firing once per session
 *   streamStoppedRef  — guards STREAM_STOP firing once per session
 */
export function usePlayerReporting({ isNative, requestId, mediaFileId, recordId, onProgress }) {
  const progressRef = useRef({ positionMs: 0, durationMs: 0 });

  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const report = useCallback((ended = false, opts = {}) => {
    onProgressRef.current?.({ ...progressRef.current, ended, ...opts });
  }, []);

  const streamStartedRef = useRef(false); // guards STREAM_START firing once per session
  const streamStoppedRef = useRef(false); // guards STREAM_STOP firing once per session
  const requestIdRef = useRef(requestId);
  requestIdRef.current = requestId;
  const mediaFileIdRef = useRef(mediaFileId);
  mediaFileIdRef.current = mediaFileId;
  const recordIdRef = useRef(recordId);
  recordIdRef.current = recordId;

  // Outbound event queue. /api/track/events accepts up to 100 events per call, so a
  // tick, a pause and three seeks are one request rather than five. START and STOP are
  // flushed on the spot: they open and close the session the backend accounts against,
  // and a queued STOP is a STOP that may never be sent.
  const queueRef = useRef([]);
  const flushEvents = useCallback(({ onExit = false } = {}) => {
    const batch = queueRef.current;
    if (!batch.length) return;
    queueRef.current = [];
    try {
      if (onExit) postStreamTrackEventsOnExit(batch, { app: isNative });
      else        postStreamTrackEvents(batch, { app: isNative });
    } catch { /* telemetry must never affect playback */ }
  }, [isNative]);

  const emitStreamEvent = useCallback((type, overrides = {}) => {
    try {
      const rid = requestIdRef.current;
      if (!rid) return; // no resolved session for this file — skip entirely
      const event = {
        sessionId: rid,
        activity: 'STREAM',
        clientApp: isNative ? 'APP' : 'WEB',
        type,
        occurredAt: new Date().toISOString(),
        clientEventId: genId(),
        mediaFileId: mediaFileIdRef.current || null,
        recordId: recordIdRef.current ? Number(recordIdRef.current) : null,
        positionMs: Math.round(progressRef.current.positionMs) || null,
        durationMs: Math.round(progressRef.current.durationMs) || null,
        ...overrides,
      };
      queueRef.current.push(event);
      // Cap the queue at the endpoint's own limit; the oldest ticks are the least
      // interesting thing to lose if a device somehow stays offline this long.
      if (queueRef.current.length > 100) queueRef.current = queueRef.current.slice(-100);
      // STOP often coincides with the page going away, so it gets the unload-safe send.
      if (type === 'STREAM_START') flushEvents();
      if (type === 'STREAM_STOP')  flushEvents({ onExit: true });
    } catch {
      // telemetry must never affect playback
    }
  }, [isNative, flushEvents]);

  // Periodic flush so a long, uneventful watch still reports in.
  useEffect(() => {
    const t = setInterval(() => flushEvents(), 60000);
    return () => { clearInterval(t); flushEvents({ onExit: true }); };
  }, [flushEvents]);

  // Re-arm the start/stop guards whenever the session (requestId) changes —
  // covers episode switches so the new session reports its own START/STOP.
  useEffect(() => {
    streamStartedRef.current = false;
    streamStoppedRef.current = false;
  }, [requestId]);

  return { progressRef, report, emitStreamEvent, flushEvents, streamStartedRef, streamStoppedRef };
}
