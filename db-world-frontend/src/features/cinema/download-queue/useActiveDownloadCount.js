import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import DbWorldDownload from '@platform/android/DbWorldDownload';

/**
 * App-wide count of downloads that are running or queued, for the nav badge.
 * Event-driven (no polling): recomputes on add/state-change/complete/error/remove.
 * Returns 0 on non-Android / when the plugin is unavailable.
 */
export function useActiveDownloadCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await DbWorldDownload.listDownloads();
      const n = (res?.downloads ?? []).filter(
        d => d.status === 'running' || d.status === 'pending'
      ).length;
      setCount(n);
    } catch {
      /* web stub / plugin unavailable */
    }
  }, []);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined;
    let mounted = true;
    const listeners = [];
    refresh();
    (async () => {
      const events = [
        'downloadAdded', 'downloadStateChanged',
        'downloadComplete', 'downloadError', 'downloadRemoved',
      ];
      for (const evt of events) {
        const handle = await DbWorldDownload.addListener(evt, refresh);
        if (mounted) listeners.push(handle); else handle?.remove?.();
      }
    })();
    return () => { mounted = false; listeners.forEach(l => l?.remove?.()); };
  }, [refresh]);

  return count;
}
