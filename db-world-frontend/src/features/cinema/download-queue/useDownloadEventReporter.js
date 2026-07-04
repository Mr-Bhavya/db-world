import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import { postTrackEvents } from '@shared/services/ApiServices';

/** Throttle window for PROGRESS events, per requestId (ms). */
const PROGRESS_THROTTLE_MS = 5000;

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
  // requestIds we've seen enter a 'paused' state, so a later 'running' state
  // can be reported as RESUME instead of being ignored.
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
        clientEventId: crypto.randomUUID(),
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
          report(baseEvent(d, 'START'));
        }),
        await DbWorldDownload.addListener('downloadProgress', (d) => {
          const requestId = d?.requestId;
          if (!requestId) return;
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
        }),
        await DbWorldDownload.addListener('downloadStateChanged', (d) => {
          const requestId = d?.requestId;
          if (!requestId) return;
          if (d.status === 'paused') {
            pausedRequestIdsRef.current.add(requestId);
            report(baseEvent(d, 'PAUSE'));
          } else if (d.status === 'cancelled') {
            pausedRequestIdsRef.current.delete(requestId);
            report(baseEvent(d, 'ABORT'));
          } else if (d.status === 'running' && pausedRequestIdsRef.current.has(requestId)) {
            pausedRequestIdsRef.current.delete(requestId);
            report(baseEvent(d, 'RESUME'));
          }
          // success/failed are reported via downloadComplete/downloadError instead,
          // to avoid duplicate events for the same terminal transition.
        }),
        await DbWorldDownload.addListener('downloadComplete', (d) => {
          const requestId = d?.requestId;
          if (requestId) pausedRequestIdsRef.current.delete(requestId);
          report({
            ...baseEvent(d, 'COMPLETE'),
            cumulativeBytes: d.bytesTotal,
            completionPercent: 100,
          });
        }),
        await DbWorldDownload.addListener('downloadError', (d) => {
          const requestId = d?.requestId;
          if (requestId) pausedRequestIdsRef.current.delete(requestId);
          report({
            ...baseEvent(d, 'FAIL'),
            errorMessage: d.errorMessage || d.error || null,
          });
        }),
      );
    })();

    return () => listeners.forEach(l => l?.remove());
  }, []);
}
