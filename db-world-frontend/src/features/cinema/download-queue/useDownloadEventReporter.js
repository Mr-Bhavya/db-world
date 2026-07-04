import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import { postTrackEvents } from '@shared/services/ApiServices';

/** Throttle window for PROGRESS events, per requestId (ms). */
const PROGRESS_THROTTLE_MS = 5000;

/**
 * crypto.randomUUID() may be unavailable on older WebViews (app minSdk 23
 * predates broad support). Fall back to a good-enough unique id so telemetry
 * never throws inside a native event callback.
 */
const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * App-wide reporter that mirrors native download lifecycle events to the
 * server's /api/track/events endpoint for activity/audit tracking.
 *
 * Android-only (no-op on web/other platforms). Mount once, app-wide, so it
 * keeps listening regardless of which page is on screen — see App.jsx.
 *
 * This is a "shadow" listener alongside useDownloads(): it does not touch
 * any download-queue UI state, it only reports telemetry.
 */
export function useDownloadEventReporter() {
  // Per-requestId timestamp of the last PROGRESS event we reported, to throttle.
  const lastProgressSentRef = useRef(new Map());
  // requestIds we've seen enter a 'paused' state, so the next downloadProgress
  // event for that requestId (fired when aria2 resumes it) can be reported as
  // RESUME instead of being ignored.
  const pausedRequestIdsRef = useRef(new Set());

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined;

    const baseEvent = (d, type) => {
      const requestId = d?.requestId;
      if (!requestId) return null; // no session to report against
      return {
        sessionId: requestId,
        activity: 'DOWNLOAD',
        clientApp: 'ARIA2',
        clientEventId: genId(),
        occurredAt: new Date().toISOString(),
        mediaFileId: d.mediaFileId || null,
        recordId: d.recordId ? Number(d.recordId) : null,
        type,
      };
    };

    const report = (event) => {
      if (!event) return;
      postTrackEvents([event]);
    };

    const listeners = [];
    (async () => {
      listeners.push(
        await DbWorldDownload.addListener('downloadAdded', (d) => {
          try {
            // Retries re-enqueue under a new gid, so the native side emits
            // downloadAdded again — but it carries the same requestId, so
            // this correctly surfaces as another START and the backend
            // aggregator increments attemptCount for the "failed ->
            // re-downloaded" case. RETRY is intentionally not a separate
            // event type here.
            report(baseEvent(d, 'START'));
          } catch {
            // never let telemetry break a download
          }
        }),
        await DbWorldDownload.addListener('downloadProgress', (d) => {
          try {
            const requestId = d?.requestId;
            if (!requestId) return;
            // The native plugin never emits downloadStateChanged with a
            // 'running' status on unpause — the download simply re-enters
            // aria2's active list and starts firing downloadProgress again.
            // Detect resume here instead, and report it immediately
            // (unthrottled) before falling through to the throttled
            // PROGRESS logic below.
            if (pausedRequestIdsRef.current.has(requestId)) {
              pausedRequestIdsRef.current.delete(requestId);
              report(baseEvent(d, 'RESUME'));
            }
            const now = Date.now();
            const last = lastProgressSentRef.current.get(requestId) || 0;
            if (now - last < PROGRESS_THROTTLE_MS) return;
            lastProgressSentRef.current.set(requestId, now);
            report({
              ...baseEvent(d, 'PROGRESS'),
              cumulativeBytes: d.bytesDownloaded,
              speedBps: d.speedBytesPerSec,
              connections: d.connections,
              completionPercent: d.progress,
            });
          } catch {
            // never let telemetry break a download
          }
        }),
        await DbWorldDownload.addListener('downloadStateChanged', (d) => {
          try {
            const requestId = d?.requestId;
            if (!requestId) return;
            if (d.status === 'paused') {
              pausedRequestIdsRef.current.add(requestId);
              report(baseEvent(d, 'PAUSE'));
            } else if (d.status === 'cancelled') {
              pausedRequestIdsRef.current.delete(requestId);
              report(baseEvent(d, 'ABORT'));
            }
            // 'running' is not handled here: see downloadProgress above for
            // resume detection. success/failed are reported via
            // downloadComplete/downloadError instead, to avoid duplicate
            // events for the same terminal transition.
          } catch {
            // never let telemetry break a download
          }
        }),
        await DbWorldDownload.addListener('downloadComplete', (d) => {
          try {
            const requestId = d?.requestId;
            if (requestId) pausedRequestIdsRef.current.delete(requestId);
            report({
              ...baseEvent(d, 'COMPLETE'),
              cumulativeBytes: d.bytesTotal,
              completionPercent: 100,
            });
          } catch {
            // never let telemetry break a download
          }
        }),
        await DbWorldDownload.addListener('downloadError', (d) => {
          try {
            const requestId = d?.requestId;
            if (requestId) pausedRequestIdsRef.current.delete(requestId);
            report({
              ...baseEvent(d, 'FAIL'),
              errorMessage: d.errorMessage || d.error || null,
            });
          } catch {
            // never let telemetry break a download
          }
        }),
      );
    })();

    return () => listeners.forEach(l => l?.remove());
  }, []);
}
